# ai/agents/m6_conflict_agent.py

import json
import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    load_prompt,
    fetch_from_backend,
    current_timestamp,
    safe_get
)

logger = logging.getLogger("railsentinel.m6_conflict")

CONFLICT_WINDOW_MINUTES = 10

def run_conflict_check(zone_id: str) -> dict:
    """
    Detects scheduling conflicts in a zone.
    Skeleton — activates fully when real scheduling data available.
    """

    logger.info(f"Conflict check starting — zone:{zone_id}")

    active_trains = fetch_from_backend(
        "/api/trains/zone",
        params={"zone_id": zone_id}
    )

    if active_trains is None:
        return {
            "status":         "backend_unavailable",
            "zone_id":        zone_id,
            "conflict_count": 0,
            "resolutions":    []
        }

    trains = active_trains if isinstance(
        active_trains, list
    ) else active_trains.get("trains", [])

    if len(trains) < 2:
        return {
            "status":         "no_conflicts",
            "zone_id":        zone_id,
            "conflict_count": 0,
            "resolutions":    []
        }

    conflicts = _detect_conflicts(trains)

    if not conflicts:
        logger.info(
            f"Conflict check — zone:{zone_id} no conflicts found"
        )
        return {
            "status":         "no_conflicts",
            "zone_id":        zone_id,
            "conflict_count": 0,
            "resolutions":    []
        }

    logger.info(
        f"Conflict check — zone:{zone_id} "
        f"found {len(conflicts)} conflicts"
    )

    resolutions = []
    for conflict in conflicts:
        resolution = _call_conflict_agent(conflict)
        resolutions.append(resolution)

    return {
        "status":         "conflicts_found",
        "zone_id":        zone_id,
        "conflict_count": len(conflicts),
        "resolutions":    resolutions
    }


def _detect_conflicts(trains: list) -> list:
    """
    Simple time-window overlap detection.
    Checks if two trains are predicted at the same platform
    within CONFLICT_WINDOW_MINUTES of each other.
    """

    conflicts = []

    for i in range(len(trains)):
        for j in range(i + 1, len(trains)):
            train_a = trains[i]
            train_b = trains[j]

            platform_a = safe_get(train_a, "next_platform")
            platform_b = safe_get(train_b, "next_platform")

            if not platform_a or not platform_b:
                continue

            if platform_a != platform_b:
                continue

            eta_a = safe_get(train_a, "eta_minutes", 999)
            eta_b = safe_get(train_b, "eta_minutes", 999)

            time_gap = abs(float(eta_a) - float(eta_b))

            if time_gap < CONFLICT_WINDOW_MINUTES:
                conflicts.append({
                    "train_a":                train_a.get("train_id"),
                    "train_b":                train_b.get("train_id"),
                    "conflict_platform":      platform_a,
                    "eta_train_a_minutes":    eta_a,
                    "eta_train_b_minutes":    eta_b,
                    "time_gap_minutes":       round(time_gap, 1),
                    "conflict_type":          "platform_clash"
                })

    return conflicts


def _call_conflict_agent(conflict: dict) -> dict:
    """
    Calls Claude to resolve a detected scheduling conflict.
    """

    system_prompt = load_prompt("conflict_prompt.txt")

    user_message = f"""
A scheduling conflict has been detected between two trains.
Recommend the best resolution with minimum passenger impact.

CONFLICT DETAILS:
{json.dumps(conflict, indent=2)}

RESOLUTION OPTIONS TO EVALUATE:
1. hold: Hold one train for N minutes to create safe gap
2. reroute: Reroute one train to alternate platform
3. speed_adjust: Adjust speed of one train to recover or lose time

Evaluate all three options and recommend the best one.

Respond ONLY in valid JSON with exactly this structure:
{{
    "resolution_type": "hold" | "reroute" | "speed_adjust",
    "recommended_action": "specific action description",
    "affected_train": "train_id of the train that should change",
    "delay_impact_minutes": integer,
    "passengers_affected": integer,
    "confidence_pct": integer between 0 and 100,
    "alternative_options": [
        "brief description of option 2",
        "brief description of option 3"
    ],
    "conflict_notes": "one line summary"
}}
"""

    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "m6_conflict_agent",
        max_tokens    = 600
    )

    result = parse_json_response(response["content"])

    if "resolution_type" not in result:
        result = {
            "resolution_type":    "hold",
            "recommended_action": (
                f"Hold train {conflict.get('train_b')} "
                f"for {CONFLICT_WINDOW_MINUTES} minutes"
            ),
            "affected_train":     conflict.get("train_b"),
            "delay_impact_minutes": CONFLICT_WINDOW_MINUTES,
            "passengers_affected": 0,
            "confidence_pct":     60,
            "alternative_options": [],
            "conflict_notes":     "Default resolution applied"
        }

    return result