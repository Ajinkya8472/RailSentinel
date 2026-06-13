# ai/agents/m7_energy_agent.py

import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    load_prompt,
    fetch_from_backend,
    current_timestamp,
    safe_get
)

logger = logging.getLogger("railsentinel.m7_energy")

def run_energy_optimization(train_id: str, route_segment_id: str) -> dict:
    """
    Computes optimal speed profile for energy efficiency.
    Skeleton — activates fully when real traction/elevation data arrives.
    """

    logger.info(
        f"Energy optimization starting — "
        f"train:{train_id} segment:{route_segment_id}"
    )

    train_data = fetch_from_backend(
        "/api/trains/specs",
        params={"train_id": train_id}
    )
    if train_data is None:
        train_data = {
            "train_id":        train_id,
            "mass_tonnes":     500,
            "max_speed_kmph":  130,
            "motor_type":      "electric"
        }

    route_data = fetch_from_backend(
        "/api/routes/segment",
        params={"segment_id": route_segment_id}
    )
    if route_data is None:
        route_data = {
            "segment_id":                   route_segment_id,
            "distance_to_next_station_km":  25,
            "gradient":                     "flat",
            "speed_limit_kmph":             130
        }

    current_state = fetch_from_backend(
        "/api/trains/state",
        params={"train_id": train_id}
    )
    if current_state is None:
        current_state = {
            "current_speed":    100,
            "schedule_status":  "on_time"
        }

    # Python computes the speed profile — not Claude
    speed_profile = _compute_speed_profile(
        train_data, route_data, current_state
    )

    # Claude generates human-readable coaching for loco pilot
    coaching = _call_energy_agent(
        train_id, speed_profile, current_state
    )

    return {
        "status":                 "coaching_active",
        "train_id":               train_id,
        "current_speed_kmph":     current_state.get("current_speed"),
        "optimal_speed_kmph":     speed_profile["target_speed"],
        "phase":                  speed_profile["phase"],
        "coaching":               coaching,
        "estimated_saving_kwh":   speed_profile["estimated_saving_kwh"],
        "timestamp":              current_timestamp()
    }


def _compute_speed_profile(
    train_data: dict,
    route_data: dict,
    current_state: dict
) -> dict:
    """
    Simplified physics model.
    Flat track assumption until real gradient data available.
    """

    distance_remaining = safe_get(
        route_data, "distance_to_next_station_km", 25
    )
    max_speed    = safe_get(train_data, "max_speed_kmph", 130)
    current_speed = safe_get(current_state, "current_speed", 100)
    schedule      = safe_get(current_state, "schedule_status", "on_time")

    if distance_remaining > 20:
        phase        = "cruise"
        target_speed = min(max_speed, 130)
    elif distance_remaining > 8:
        phase        = "coast"
        target_speed = current_speed * 0.85
    else:
        phase        = "brake"
        target_speed = 30

    # Schedule-aware adjustment
    if schedule == "late":
        target_speed = min(target_speed * 1.1, max_speed)
    elif schedule == "early":
        target_speed = target_speed * 0.9

    # Stub energy saving estimate
    estimated_saving_kwh = 340 if phase == "coast" else 0

    return {
        "phase":                  phase,
        "target_speed":           round(float(target_speed)),
        "estimated_saving_kwh":   estimated_saving_kwh
    }


def _call_energy_agent(
    train_id: str,
    speed_profile: dict,
    current_state: dict
) -> dict:
    """
    Claude generates a simple coaching display for the loco pilot.
    Stub response until module is fully activated.
    """

    # Stub — return coaching without calling Claude
    # until real traction data is available
    phase = speed_profile.get("phase", "cruise")

    color_map = {
        "cruise": "green",
        "coast":  "blue",
        "brake":  "amber"
    }

    instruction_map = {
        "cruise": "Maintain current speed. Running optimally.",
        "coast":  "Cut traction now. Coast using momentum.",
        "brake":  "Begin gentle braking. Regenerative mode active."
    }

    return {
        "display_color":      color_map.get(phase, "green"),
        "pilot_instruction":  instruction_map.get(
            phase, "Maintain current speed."
        ),
        "reason":             (
            f"Phase 2 energy module active — "
            f"stub coaching for {phase} phase."
        ),
        "estimated_saving_kwh": speed_profile.get(
            "estimated_saving_kwh", 0
        ),
        "energy_notes":       "STUB — awaiting real traction data"
    }