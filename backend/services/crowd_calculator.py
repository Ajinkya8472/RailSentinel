"""
crowd_calculator.py — Computes platform occupancy for every major station.

Uses a 24-hour base pattern (peaks at commute hours) + festival multiplier.
Called by crowd_routes.py GET /api/crowd/forecast
and by risk_aggregator.py every 30 s.
"""

import json
import random
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.crowd_model import PlatformOccupancy
from models.train_model import Train
from services.ai_client import call_crowd

logger = logging.getLogger(__name__)

# ── Load station data ────────────────────────────────────────────────── #
_STATIONS_PATH = Path(__file__).parent.parent / "data" / "stations.json"
with open(_STATIONS_PATH, "r", encoding="utf-8") as f:
    STATIONS: list[dict] = json.load(f)

# Major stations to track crowd for (station_code → capacity per platform)
MONITORED_STATIONS = {
    "NDLS": 3500, "MMCT": 2500, "CSMT": 3000, "HWH": 3000,
    "MAS":  2800, "SBC":  2000, "ADI":  2200, "PUNE": 1800,
    "SC":   2000, "JP":   1500,
}

# 24-hour base occupancy curve (% of capacity, index = hour 0-23)
BASE_OCCUPANCY_CURVE = [
    10, 8, 6, 5, 5, 8,       # 00:00–05:00 — very quiet
    20, 45, 75, 80, 65, 55,   # 06:00–11:00 — morning rush
    50, 48, 45, 50, 55, 70,   # 12:00–17:00 — midday
    85, 90, 80, 60, 40, 20,   # 18:00–23:00 — evening rush
]

FESTIVAL_MULTIPLIER = 3.2   # Diwali / Kumbh / Holi mode

WARNING_THRESHOLD  = 85.0   # %
CRITICAL_THRESHOLD = 95.0   # %


def _current_base_pct() -> float:
    """Return the base occupancy % for the current hour with small noise."""
    hour = datetime.now().hour
    base = BASE_OCCUPANCY_CURVE[hour]
    return base + random.uniform(-5, 5)


def _forecast_pct(current_pct: float) -> float:
    """Predict occupancy 30 min ahead (next half-hour slot)."""
    hour = datetime.now().hour
    next_hour = (hour + 1) % 24
    next_base = BASE_OCCUPANCY_CURVE[next_hour]
    # Blend current and next
    blend = (current_pct + next_base) / 2.0
    return max(0, min(100, blend + random.uniform(-3, 3)))


def calculate_and_save() -> list[dict]:
    """
    Recalculate occupancy for all monitored stations and upsert into DB.
    When any platform forecast > 85%, fires call_crowd() for AI suggestions.
    Returns a list of dicts ready for the API response.
    """
    db: Session = SessionLocal()
    results = []
    warning_rows: list[dict] = []   # collected for AI calls after DB write
    try:
        for station_code, capacity_per_platform in MONITORED_STATIONS.items():
            station = next((s for s in STATIONS if s["code"] == station_code), None)
            if not station:
                continue

            num_platforms = station.get("platforms", 4)
            # Limit to first 6 platforms for display
            for pnum in range(1, min(num_platforms, 7)):
                base_pct = _current_base_pct()
                # Platforms further from entrance are slightly less crowded
                platform_factor = 1.0 - (pnum - 1) * 0.05
                pct = base_pct * platform_factor
                pct = max(0, min(100, pct))

                current_count = int(capacity_per_platform * pct / 100)
                forecast = _forecast_pct(pct)
                forecast_count = int(capacity_per_platform * forecast / 100)

                # Look up next arriving train for this platform
                next_train = (
                    db.query(Train)
                    .filter(Train.status != "stopped")
                    .order_by(Train.id)
                    .offset((pnum - 1) % 15)
                    .first()
                )

                # Upsert — check if record exists
                existing = (
                    db.query(PlatformOccupancy)
                    .filter(
                        PlatformOccupancy.station_code == station_code,
                        PlatformOccupancy.platform_number == pnum,
                    )
                    .first()
                )

                row_data = dict(
                    station_name      = station["name"],
                    current_count     = current_count,
                    capacity          = capacity_per_platform,
                    occupancy_pct     = round(pct, 1),
                    forecast_count    = forecast_count,
                    forecast_pct      = round(forecast, 1),
                    warning_active    = pct >= WARNING_THRESHOLD,
                    critical_active   = pct >= CRITICAL_THRESHOLD,
                    next_train_id     = next_train.id if next_train else None,
                    next_train_eta_min= random.randint(5, 45),
                )

                if existing:
                    for k, v in row_data.items():
                        setattr(existing, k, v)
                    rec = existing
                else:
                    rec = PlatformOccupancy(
                        station_code    = station_code,
                        platform_number = pnum,
                        **row_data,
                    )
                    db.add(rec)

                db.commit()
                db.refresh(rec)
                result_dict = rec.to_dict()
                results.append(result_dict)

                # Queue AI crowd call if platform forecast exceeds warning threshold
                if forecast >= WARNING_THRESHOLD:
                    warning_rows.append({
                        "station":          station["name"],
                        "station_code":     station_code,
                        "platform":         pnum,
                        "current_percent":  round(pct, 1),
                        "forecast_percent": round(forecast, 1),
                        "festival_mode":    rec.is_festival_mode,
                    })

    except Exception as e:
        logger.error(f"[Crowd] calculate_and_save error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    # Fire AI crowd calls for all warning platforms (non-blocking)
    if warning_rows:
        asyncio.ensure_future(_call_ai_for_warnings(warning_rows))

    return results


async def _call_ai_for_warnings(warning_rows: list[dict]) -> None:
    """Call M4 crowd AI agent for each platform over 85% threshold."""
    for row in warning_rows:
        result = await call_crowd(
            station          = row["station"],
            platform         = row["platform"],
            current_percent  = row["current_percent"],
            forecast_percent = row["forecast_percent"],
            festival_mode    = row["festival_mode"],
        )
        if result:
            logger.warning(
                f"[Crowd] M4 AI — {row['station']} P{row['platform']} "
                f"{row['forecast_percent']}% — risk={result.get('risk_level')} "
                f"actions={len(result.get('actions', []))}"
            )
        else:
            logger.info(f"[Crowd] AI unavailable for {row['station']} P{row['platform']} — local warning flagged.")


def get_forecast() -> list[dict]:
    """Read current occupancy records from DB (no recalculation)."""
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(PlatformOccupancy)
            .order_by(PlatformOccupancy.station_code, PlatformOccupancy.platform_number)
            .all()
        )
        if not rows:
            # First call — populate
            return calculate_and_save()
        return [r.to_dict() for r in rows]
    finally:
        db.close()


def apply_festival_mode(station_code: str, enabled: bool) -> list[dict]:
    """Toggle festival mode for a station — multiplies occupancy 3.2×."""
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(PlatformOccupancy)
            .filter(PlatformOccupancy.station_code == station_code)
            .all()
        )
        for row in rows:
            row.is_festival_mode = enabled
            if enabled:
                row.occupancy_pct = min(100, row.occupancy_pct * FESTIVAL_MULTIPLIER)
                row.current_count = int(row.capacity * row.occupancy_pct / 100)
            row.warning_active  = row.occupancy_pct >= WARNING_THRESHOLD
            row.critical_active = row.occupancy_pct >= CRITICAL_THRESHOLD
        db.commit()
        return [r.to_dict() for r in rows]
    finally:
        db.close()
