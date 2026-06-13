# ai/agents/m2_predictive_agent.py

import json
import logging
import numpy as np
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    validate_json_keys,
    load_prompt,
    fetch_from_backend,
    current_timestamp,
    safe_get
)

logger = logging.getLogger("railsentinel.m2_predictive")

REQUIRED_KEYS = [
    "advisory_level",
    "maintenance_window",
    "recommended_actions",
    "hindi_advisory_text",
    "confidence_pct"
]

ZSCORE_THRESHOLD      = 2.5
ZSCORE_WARNING        = 3.0
ZSCORE_URGENT         = 4.0
WINDOW_SIZE           = 144   # 144 readings = ~72 hours at 30-min intervals
FAULT_ZSCORE_ESTIMATE = 5.0   # estimated z-score at which fault occurs

# ── Main Entry Point ───────────────────────────────────────────────────────────

def run_predictive_check(train_id: str) -> dict:
    """
    Main entry point called by predictive_routes.py.
    Fetches 72h sensor history, computes z-scores in Python,
    and calls Claude only if threshold is crossed.
    Returns predictive advisory or nominal status dict.
    """

    logger.info(f"Predictive check starting — train:{train_id}")

    # ── Fetch 72h history from backend ────────────────────────────────────────
    history = fetch_from_backend(
        "/api/sensors/history",
        params={"train_id": train_id, "hours": 72}
    )

    if history is None:
        logger.warning(
            f"Predictive check — backend unavailable for train:{train_id}"
        )
        return {
            "status":                      "backend_unavailable",
            "train_id":                    train_id,
            "max_zscore":                  None,
            "trend_direction":             None,
            "hours_until_predicted_fault": None,
            "recommendation":              None
        }

    readings = history if isinstance(history, list) else history.get(
        "readings", []
    )

    if len(readings) < 20:
        logger.info(
            f"Predictive check — insufficient data for train:{train_id} "
            f"({len(readings)} readings)"
        )
        return {
            "status":                      "insufficient_data",
            "train_id":                    train_id,
            "max_zscore":                  None,
            "trend_direction":             None,
            "hours_until_predicted_fault": None,
            "recommendation":              None
        }

    # ── Python does the math — not Claude ─────────────────────────────────────
    z_scores     = _compute_rolling_zscores(readings)
    trend        = _analyse_trend(readings, z_scores)

    logger.info(
        f"Predictive check — train:{train_id} "
        f"max_z:{trend['max_zscore']} "
        f"direction:{trend['direction']}"
    )

    # ── If below threshold return nominal ──────────────────────────────────────
    if trend["max_zscore"] < ZSCORE_THRESHOLD:
        return {
            "status":                      "nominal",
            "train_id":                    train_id,
            "max_zscore":                  round(trend["max_zscore"], 3),
            "trend_direction":             trend["direction"],
            "hours_until_predicted_fault": None,
            "recommendation":              None
        }

    # ── Threshold crossed — call Claude for recommendation ────────────────────
    recommendation = _call_predictive_agent(train_id, trend)

    return {
        "status":                      "advisory_issued",
        "train_id":                    train_id,
        "max_zscore":                  round(trend["max_zscore"], 3),
        "trend_direction":             trend["direction"],
        "hours_until_predicted_fault": trend.get("eta_hours"),
        "recommendation":              recommendation
    }


# ── Z-Score Computation ────────────────────────────────────────────────────────

def _compute_rolling_zscores(readings: list) -> dict:
    """
    Computes rolling z-scores for vibration and temperature.
    Uses NumPy. Claude is not involved here.
    """

    vibration   = np.array([
        r.get("vibration", 0) for r in readings
    ], dtype=float)
    temperature = np.array([
        r.get("temperature", 0) for r in readings
    ], dtype=float)

    window = min(WINDOW_SIZE, len(readings))

    def rolling_zscore(arr, w):
        zscores = np.zeros_like(arr)
        for i in range(len(arr)):
            start = max(0, i - w + 1)
            window_data = arr[start:i + 1]
            if len(window_data) < 2:
                zscores[i] = 0.0
                continue
            mean = np.mean(window_data)
            std  = np.std(window_data)
            if std == 0:
                zscores[i] = 0.0
            else:
                zscores[i] = (arr[i] - mean) / std
        return zscores

    vib_zscores  = rolling_zscore(vibration,   window)
    temp_zscores = rolling_zscore(temperature, window)

    return {
        "vibration_zscores":   vib_zscores,
        "temperature_zscores": temp_zscores,
        "max_vibration_z":     float(np.max(np.abs(vib_zscores))),
        "max_temperature_z":   float(np.max(np.abs(temp_zscores))),
        "max_zscore":          float(
            max(np.max(np.abs(vib_zscores)),
                np.max(np.abs(temp_zscores)))
        ),
        "current_vibration_z":   float(vib_zscores[-1]),
        "current_temperature_z": float(temp_zscores[-1])
    }


# ── Trend Analysis ─────────────────────────────────────────────────────────────

def _analyse_trend(readings: list, z_scores: dict) -> dict:
    """
    Determines trend direction and estimates hours until fault.
    Uses simple linear regression on last 10 z-score readings.
    """

    vib_z = z_scores["vibration_zscores"]

    # Direction from last 10 readings
    last_10 = vib_z[-10:] if len(vib_z) >= 10 else vib_z

    if len(last_10) >= 2:
        x    = np.arange(len(last_10), dtype=float)
        slope = np.polyfit(x, last_10, 1)[0]

        if slope > 0.05:
            direction = "worsening"
        elif slope < -0.05:
            direction = "improving"
        else:
            direction = "fluctuating"
    else:
        slope     = 0.0
        direction = "insufficient_data"

    # ETA to fault via linear extrapolation
    eta_hours = None
    if direction == "worsening" and slope > 0:
        current_z    = float(vib_z[-1])
        steps_needed = (FAULT_ZSCORE_ESTIMATE - current_z) / slope
        # Each reading = 0.5 hours (30-min intervals)
        eta_hours = round(max(0, steps_needed * 0.5), 1)

    return {
        "direction":   direction,
        "slope":       round(float(slope), 4),
        "eta_hours":   eta_hours,
        "max_zscore":  z_scores["max_zscore"],
        "current_vibration_z":   z_scores["current_vibration_z"],
        "current_temperature_z": z_scores["current_temperature_z"],
        "max_vibration_z":       z_scores["max_vibration_z"],
        "max_temperature_z":     z_scores["max_temperature_z"]
    }


# ── Claude Call ────────────────────────────────────────────────────────────────

def _call_predictive_agent(train_id: str, trend: dict) -> dict:
    """
    Calls Claude to generate a human-readable maintenance recommendation.
    Claude receives pre-computed math results — not raw sensor arrays.
    """

    system_prompt = load_prompt("predictive_prompt.txt")

    # Determine advisory level from z-score
    max_z = trend["max_zscore"]
    if max_z >= ZSCORE_URGENT:
        advisory_level_hint = "urgent"
    elif max_z >= ZSCORE_WARNING:
        advisory_level_hint = "warning"
    else:
        advisory_level_hint = "watch"

    user_message = f"""
A predictive maintenance analysis has been completed for Train {train_id}.
The Z-score analysis shows a trend that requires attention.

ANALYSIS RESULTS:
- Train ID: {train_id}
- Current time: {current_timestamp()}
- Max z-score detected: {round(trend['max_zscore'], 3)}
- Current vibration z-score: {round(trend['current_vibration_z'], 3)}
- Current temperature z-score: {round(trend['current_temperature_z'], 3)}
- Trend direction: {trend['direction']}
- Trend slope (per reading): {trend['slope']}
- Estimated hours until fault threshold: {trend.get('eta_hours', 'unknown')}
- Advisory level hint: {advisory_level_hint}

ADVISORY LEVEL GUIDE:
- watch: z-score 2.5 to 3.0 — monitor closely, plan maintenance soon
- warning: z-score 3.0 to 4.0 — schedule maintenance within 24-48 hours
- urgent: z-score above 4.0 — schedule maintenance immediately, 
          consider speed restriction

Generate a maintenance advisory for railway officials.

Respond ONLY in valid JSON with exactly this structure:
{{
    "advisory_level": "watch" | "warning" | "urgent",
    "maintenance_window": "specific time e.g. Tuesday 02:00-04:00 IST",
    "immediate_speed_restriction_kmph": integer or null,
    "recommended_actions": [
        "specific action 1",
        "specific action 2"
    ],
    "hindi_advisory_text": "short Hindi advisory under 20 words",
    "predicted_fault_description": "what component will fail and how",
    "confidence_pct": integer between 0 and 100,
    "predictive_notes": "one line summary"
}}
"""

    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "m2_predictive_agent",
        max_tokens    = 800
    )

    result = parse_json_response(response["content"])

    # Validate and apply defaults if needed
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(f"Predictive agent missing keys: {missing}")
        result["advisory_level"]      = result.get(
            "advisory_level", advisory_level_hint
        )
        result["maintenance_window"]  = result.get(
            "maintenance_window", "Within 48 hours"
        )
        result["recommended_actions"] = result.get(
            "recommended_actions",
            ["Schedule inspection", "Monitor sensor readings closely"]
        )
        result["hindi_advisory_text"] = result.get(
            "hindi_advisory_text",
            f"Gaadi {train_id} ki jaanch zaruri hai"
        )
        result["confidence_pct"]      = result.get("confidence_pct", 60)

    logger.info(
        f"Predictive agent complete — "
        f"train:{train_id} "
        f"level:{result.get('advisory_level')} "
        f"window:{result.get('maintenance_window')}"
    )

    return result