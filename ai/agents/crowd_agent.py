# ai/agents/m4_crowd_agent.py

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

logger = logging.getLogger("railsentinel.m4_crowd")

REQUIRED_KEYS = [
    "urgency",
    "recommended_actions",
    "hindi_advisory",
    "crowd_notes"
]

CROWD_THRESHOLD    = 85.0   # percent — trigger advisory above this
FESTIVAL_MULTIPLIER = 1.4   # scale occupancy up during festival mode
FORECAST_MINUTES   = 30     # how far ahead to forecast

# ── Main Entry Point ───────────────────────────────────────────────────────────

def run_crowd_check(platform_id: str, festival_mode: bool = False) -> dict:
    """
    Main entry point called by crowd_routes.py.
    Fetches platform occupancy history, forecasts 30 min ahead
    using weighted moving average, calls Claude if > 85%.
    """

    logger.info(
        f"Crowd check starting — "
        f"platform:{platform_id} festival:{festival_mode}"
    )

    # ── Fetch occupancy history from backend ───────────────────────────────────
    history = fetch_from_backend(
        "/api/platforms/occupancy",
        params={"platform_id": platform_id, "minutes": 180}
    )

    if history is None:
        logger.warning(
            f"Crowd check — backend unavailable for platform:{platform_id}"
        )
        return {
            "status":                  "backend_unavailable",
            "platform_id":             platform_id,
            "current_occupancy_pct":   None,
            "predicted_occupancy_pct": None,
            "minutes_until_threshold": None,
            "festival_mode":           festival_mode,
            "recommendation":          None
        }

    readings = history if isinstance(history, list) else history.get(
        "readings", []
    )

    if len(readings) < 5:
        logger.info(
            f"Crowd check — insufficient data for platform:{platform_id}"
        )
        return {
            "status":                  "insufficient_data",
            "platform_id":             platform_id,
            "current_occupancy_pct":   None,
            "predicted_occupancy_pct": None,
            "minutes_until_threshold": None,
            "festival_mode":           festival_mode,
            "recommendation":          None
        }

    # ── Python does the forecasting ────────────────────────────────────────────
    max_capacity = safe_get(readings[0], "capacity", 1000)
    if max_capacity == 0:
        max_capacity = 1000

    forecast = _compute_occupancy_forecast(
        readings, festival_mode, max_capacity
    )

    logger.info(
        f"Crowd check — platform:{platform_id} "
        f"current:{forecast['current_pct']}% "
        f"predicted:{forecast['predicted_pct']}%"
    )

    # ── Below threshold — return normal ────────────────────────────────────────
    if forecast["predicted_pct"] < CROWD_THRESHOLD:
        return {
            "status":                  "normal",
            "platform_id":             platform_id,
            "current_occupancy_pct":   forecast["current_pct"],
            "predicted_occupancy_pct": forecast["predicted_pct"],
            "minutes_until_threshold": None,
            "festival_mode":           festival_mode,
            "recommendation":          None
        }

    # ── Above threshold — get Claude recommendation ────────────────────────────
    recommendation = _call_crowd_agent(
        platform_id, forecast, festival_mode
    )

    return {
        "status":                  "crowd_advisory",
        "platform_id":             platform_id,
        "current_occupancy_pct":   forecast["current_pct"],
        "predicted_occupancy_pct": forecast["predicted_pct"],
        "minutes_until_threshold": forecast.get("minutes_until_85pct"),
        "festival_mode":           festival_mode,
        "recommendation":          recommendation
    }


# ── Forecast Computation ───────────────────────────────────────────────────────

def _compute_occupancy_forecast(
    readings: list,
    festival_mode: bool,
    max_capacity: int
) -> dict:
    """
    Weighted moving average forecast.
    Recent readings are weighted more than older ones.
    Festival mode applies a 1.4x multiplier.
    """

    counts = np.array([
        r.get("occupancy_count", 0) for r in readings
    ], dtype=float)

    current_count = counts[-1]
    current_pct   = round(float(current_count / max_capacity * 100), 1)

    # Exponential weights — recent readings weighted more
    n       = len(counts)
    weights = np.exp(np.linspace(-1, 0, n))
    weighted_avg = float(np.average(counts, weights=weights))

    # Festival multiplier
    if festival_mode:
        weighted_avg *= FESTIVAL_MULTIPLIER

    predicted_count = weighted_avg
    predicted_pct   = round(float(predicted_count / max_capacity * 100), 1)

    # Estimate minutes until 85% threshold
    minutes_until_85 = None
    if predicted_pct > current_pct and current_pct < CROWD_THRESHOLD:
        rate_per_min = (predicted_pct - current_pct) / FORECAST_MINUTES
        if rate_per_min > 0:
            minutes_until_85 = round(
                (CROWD_THRESHOLD - current_pct) / rate_per_min, 1
            )

    return {
        "current_pct":       current_pct,
        "predicted_pct":     predicted_pct,
        "weighted_avg_count": round(weighted_avg),
        "minutes_until_85pct": minutes_until_85
    }


# ── Claude Call ────────────────────────────────────────────────────────────────

def _call_crowd_agent(
    platform_id: str,
    forecast: dict,
    festival_mode: bool
) -> dict:
    """
    Calls Claude to generate specific crowd management recommendations.
    Claude receives pre-computed forecast — not raw occupancy arrays.
    """

    # Fetch nearby trains for context
    nearby_trains = fetch_from_backend(
        "/api/platforms/nearby-trains",
        params={"platform_id": platform_id}
    )
    if nearby_trains is None:
        nearby_trains = {"available": False, "trains": []}

    # Fetch available coaches
    available_coaches = fetch_from_backend(
        "/api/coaches/available",
        params={"platform_id": platform_id}
    )
    if available_coaches is None:
        available_coaches = {"available": False, "coaches": []}

    system_prompt = load_prompt("crowd_prompt.txt")

    user_message = f"""
Platform {platform_id} is forecast to exceed safe capacity.
Generate specific crowd management recommendations.

FORECAST DATA:
- Platform ID: {platform_id}
- Current time: {current_timestamp()}
- Festival mode: {festival_mode}
- Current occupancy: {forecast['current_pct']}%
- Predicted occupancy in {FORECAST_MINUTES} minutes: {forecast['predicted_pct']}%
- Minutes until 85% threshold: {forecast.get('minutes_until_85pct', 'already exceeded')}
- Threshold: {CROWD_THRESHOLD}%

TRAINS ARRIVING IN NEXT 60 MINUTES:
{json.dumps(nearby_trains, indent=2)}

AVAILABLE COACHES FOR REALLOCATION:
{json.dumps(available_coaches, indent=2)}

RECOMMENDATION RULES:
- Be specific — name exact gates, coach numbers, train IDs
- If backend data unavailable, generate reasonable recommendations anyway
- Festival mode means 1.4x normal load — RPF deployment is mandatory
- urgency levels: watch (85-90%), advisory (90-95%), urgent (95%+)
- Always include at least one immediate action
- RPF deployment count: 2 for watch, 4 for advisory, 6+ for urgent

Respond ONLY in valid JSON with exactly this structure:
{{
    "urgency": "watch" | "advisory" | "urgent",
    "recommended_actions": [
        {{
            "action": "action description",
            "specific_detail": "exact detail e.g. Open Gate 7",
            "responsible_party": "Station Master | RPF | Platform Staff"
        }}
    ],
    "gates_to_open": ["Gate 7", "Gate 3"],
    "coaches_to_reallocate": [
        {{
            "from_train": "train_id",
            "count": 2,
            "to_platform": "platform description"
        }}
    ],
    "rpf_deployment": {{
        "location": "Platform 4 north end",
        "count": 4
    }},
    "hindi_advisory": "short Hindi PA announcement under 20 words",
    "crowd_notes": "one line summary"
}}
"""

    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "m4_crowd_agent",
        max_tokens    = 800
    )

    result = parse_json_response(response["content"])

    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(f"Crowd agent missing keys: {missing}")
        result["urgency"]              = result.get("urgency", "advisory")
        result["recommended_actions"]  = result.get(
            "recommended_actions",
            [{"action": "Open additional gates",
              "specific_detail": "Contact Station Master immediately",
              "responsible_party": "Station Master"}]
        )
        result["hindi_advisory"]       = result.get(
            "hindi_advisory",
            f"Platform {platform_id} par bahut bheed hai, "
            f"kripya door rehen"
        )
        result["crowd_notes"]          = result.get(
            "crowd_notes", "Validation failed on crowd agent output"
        )

    # Ensure optional fields exist
    if "gates_to_open"          not in result: result["gates_to_open"]          = []
    if "coaches_to_reallocate"  not in result: result["coaches_to_reallocate"]  = []
    if "rpf_deployment"         not in result: result["rpf_deployment"]         = None

    logger.info(
        f"Crowd agent complete — "
        f"platform:{platform_id} "
        f"urgency:{result.get('urgency')} "
        f"actions:{len(result.get('recommended_actions', []))}"
    )

    return result