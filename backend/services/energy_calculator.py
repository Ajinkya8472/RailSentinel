"""
energy_calculator.py — Physics-based optimal speed profile for a train.

No AI needed. Uses tractive effort, resistance, and grade physics to
compute the most energy-efficient speed at each route segment.

Called by energy_routes.py GET /api/energy/profile/{train_id}
"""

import math
import logging
import json
from pathlib import Path
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.train_model import Train

logger = logging.getLogger(__name__)

# ── Load route data ──────────────────────────────────────────────────── #
_ROUTES_PATH = Path(__file__).parent.parent / "data" / "train_routes.json"
with open(_ROUTES_PATH, "r", encoding="utf-8") as f:
    _ROUTES: list[dict] = json.load(f)
_ROUTE_MAP = {r["id"]: r for r in _ROUTES}

# ── Physics constants ────────────────────────────────────────────────── #
TRAIN_MASS_KG       = 450_000    # typical express train
GRAVITY             = 9.81       # m/s²
AIR_DENSITY         = 1.225      # kg/m³
DRAG_COEFFICIENT    = 0.8
FRONTAL_AREA_M2     = 9.0        # m²
ROLLING_RESISTANCE  = 0.002      # dimensionless coefficient
MOTOR_EFFICIENCY    = 0.85       # 85%
REGEN_EFFICIENCY    = 0.70       # regenerative braking recovery

# Advisory modes
MODE_MAINTAIN = "maintain"       # green  — keep current speed
MODE_COAST    = "coast"          # blue   — release throttle
MODE_REDUCE   = "reduce"         # amber  — apply brakes
MODE_ACCELERATE = "accelerate"   # white  — open throttle


def _rolling_resistance_force(mass_kg: float) -> float:
    return ROLLING_RESISTANCE * mass_kg * GRAVITY


def _aerodynamic_drag(speed_kmh: float) -> float:
    v = speed_kmh / 3.6  # convert to m/s
    return 0.5 * AIR_DENSITY * DRAG_COEFFICIENT * FRONTAL_AREA_M2 * v ** 2


def _power_kw(speed_kmh: float, grade_pct: float = 0.0) -> float:
    """Instantaneous traction power in kW to maintain speed on a grade."""
    v = speed_kmh / 3.6
    f_roll = _rolling_resistance_force(TRAIN_MASS_KG)
    f_aero = _aerodynamic_drag(speed_kmh)
    f_grade = TRAIN_MASS_KG * GRAVITY * math.sin(math.atan(grade_pct / 100))
    total_force = f_roll + f_aero + f_grade
    return (total_force * v) / (1000 * MOTOR_EFFICIENCY)


def _optimal_speed(max_speed: float, grade_pct: float, curve_radius_m: float = 5000) -> float:
    """
    Compute the most energy-efficient cruise speed.
    - Grade penalty: reduce speed on steep gradients
    - Curve limit: physics-based cant deficiency limit
    """
    # Curve speed limit (simplified): v² = μ * g * r
    curve_limit = math.sqrt(0.15 * GRAVITY * curve_radius_m) * 3.6  # m/s → km/h
    # Grade adjustment: reduce optimal speed by 2 km/h per 1% grade
    grade_penalty = abs(grade_pct) * 2.0
    optimal = max_speed - grade_penalty
    return round(min(optimal, curve_limit, max_speed), 1)


def _energy_saved_kwh(current_speed: float, optimal_speed: float, distance_km: float) -> float:
    """Rough energy saving from coasting/reducing speed over a segment."""
    if current_speed <= optimal_speed:
        return 0.0
    excess_power = _power_kw(current_speed) - _power_kw(optimal_speed)
    time_h = distance_km / optimal_speed if optimal_speed > 0 else 0
    regen = REGEN_EFFICIENCY * (current_speed - optimal_speed) * 0.01
    return round(max(0, excess_power * time_h + regen), 2)


def _advisory_mode(current: float, optimal: float) -> str:
    diff = current - optimal
    if diff > 10:
        return MODE_REDUCE
    if diff > 3:
        return MODE_COAST
    if diff < -5:
        return MODE_ACCELERATE
    return MODE_MAINTAIN


def _advisory_color(mode: str) -> str:
    return {
        MODE_MAINTAIN:   "#22c55e",   # green
        MODE_COAST:      "#3b82f6",   # blue
        MODE_REDUCE:     "#f59e0b",   # amber
        MODE_ACCELERATE: "#ffffff",   # white
    }.get(mode, "#22c55e")


def get_energy_profile(train_id: str) -> dict:
    """
    Return the full energy/speed advisory profile for a train.
    Includes per-segment breakdown and overall kWh saved estimate.
    """
    db: Session = SessionLocal()
    try:
        train = db.query(Train).filter(Train.id == train_id).first()
        if not train:
            return {"error": f"Train {train_id} not found"}

        route_data = _ROUTE_MAP.get(train_id, {})
        waypoints  = route_data.get("waypoints", [])

        segments = []
        total_saved = 0.0
        total_distance = 0.0

        for i in range(len(waypoints) - 1):
            wp_a = waypoints[i]
            wp_b = waypoints[i + 1]

            # Estimate segment distance
            dlat = math.radians(wp_b["lat"] - wp_a["lat"])
            dlng = math.radians(wp_b["lng"] - wp_a["lng"])
            a = (math.sin(dlat / 2) ** 2
                 + math.cos(math.radians(wp_a["lat"]))
                 * math.cos(math.radians(wp_b["lat"]))
                 * math.sin(dlng / 2) ** 2)
            dist_km = 6371 * 2 * math.asin(math.sqrt(a))

            # Simulated grade (slightly vary per segment)
            import random
            grade = random.uniform(-1.5, 1.5)

            # Max speed from route (use train's rated speed range)
            max_speed = train.speed + 20
            optimal   = _optimal_speed(max_speed, grade)
            mode      = _advisory_mode(train.speed, optimal)
            saved     = _energy_saved_kwh(train.speed, optimal, dist_km)

            total_saved    += saved
            total_distance += dist_km

            segments.append({
                "from_station": wp_a["station"],
                "to_station":   wp_b["station"],
                "distance_km":  round(dist_km, 1),
                "grade_pct":    round(grade, 2),
                "current_speed_kmh": round(train.speed, 1),
                "optimal_speed_kmh": optimal,
                "advisory_mode":     mode,
                "advisory_color":    _advisory_color(mode),
                "power_kw":          round(_power_kw(train.speed, grade), 1),
                "energy_saved_kwh":  saved,
            })

        return {
            "train_id":            train_id,
            "train_name":          train.name,
            "current_speed_kmh":   round(train.speed, 1),
            "route_distance_km":   round(total_distance, 1),
            "total_energy_saved_kwh": round(total_saved, 2),
            "co2_saved_kg":        round(total_saved * 0.82, 2),   # 0.82 kg CO₂ / kWh
            "current_advisory":    _advisory_mode(train.speed, segments[0]["optimal_speed_kmh"] if segments else train.speed),
            "current_advisory_color": _advisory_color(_advisory_mode(train.speed, segments[0]["optimal_speed_kmh"] if segments else train.speed)),
            "segments":            segments,
        }

    finally:
        db.close()
