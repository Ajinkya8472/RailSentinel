# ai/agents/pipeline/agent2_verifier.py

import json
import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    validate_json_keys,
    load_prompt,
    fetch_from_backend,
    safe_get
)

logger = logging.getLogger("railsentinel.agent2_verifier")

REQUIRED_KEYS = [
    "verified",
    "confidence_in_verification",
    "corroborating_sensors",
    "pattern_match",
    "evidence_summary",
    "verifier_notes"
]

def run(context: dict) -> dict:
    """
    Agent 2 — Evidence Verifier.
    Cross-checks the detected anomaly against adjacent sensor data
    and recent history to confirm it is real, not a fluke.
    Returns verification result dict.
    """

    trigger_data = context["trigger_data"]
    detection    = context["detection"]
    pipeline_id  = context["pipeline_id"]

    logger.info(
        f"[{pipeline_id}] Agent 2 starting — "
        f"anomaly_type:{detection.get('anomaly_type')}"
    )

    # ── Fetch adjacent sensor data from backend ────────────────────────────────
    adjacent_data = fetch_from_backend(
        "/api/sensors/adjacent",
        params={
            "train_id":  trigger_data.get("train_id"),
            "timestamp": trigger_data.get("timestamp")
        }
    )

    if adjacent_data is None:
        logger.warning(
            f"[{pipeline_id}] Agent 2 — backend unavailable for "
            f"adjacent data. Using fallback."
        )
        adjacent_data = {
            "available": False,
            "note": "Backend unavailable — single sensor reading only"
        }

    # ── Fetch recent 30-minute history from backend ────────────────────────────
    recent_history = fetch_from_backend(
        "/api/sensors/history",
        params={
            "train_id": trigger_data.get("train_id"),
            "minutes":  30
        }
    )

    if recent_history is None:
        logger.warning(
            f"[{pipeline_id}] Agent 2 — backend unavailable for "
            f"recent history. Using fallback."
        )
        recent_history = {
            "available": False,
            "note": "Backend unavailable — no historical context"
        }

    # ── Load prompt ────────────────────────────────────────────────────────────
    system_prompt = load_prompt("verifier_prompt.txt")

    # ── Build user message ─────────────────────────────────────────────────────
    user_message = f"""
You must verify whether the following detected anomaly is real or a false positive.

ORIGINAL SENSOR READING:
{json.dumps(trigger_data, indent=2)}

DETECTION RESULT FROM AGENT 1:
{json.dumps(detection, indent=2)}

ADJACENT SENSOR READINGS AT SAME TIMESTAMP:
{json.dumps(adjacent_data, indent=2)}

LAST 30 MINUTES OF READINGS FOR THIS TRAIN:
{json.dumps(recent_history, indent=2)}

VERIFICATION RULES:
- A single isolated spike with NO corroboration from adjacent sensors = likely false positive
- If 2 or more sensors show abnormality in the same time window = almost certainly real
- A sustained trend over 20+ minutes is always real regardless of magnitude
- Railway vibration sensors commonly give isolated spikes on track joints — this is known noise
- If backend data is unavailable, rely on the z-score values from Agent 1 detection result

Respond ONLY in valid JSON with exactly this structure:
{{
    "verified": true or false,
    "confidence_in_verification": integer between 0 and 100,
    "corroborating_sensors": ["list of sensor names that corroborate"],
    "pattern_match": "isolated_spike" | "sustained_trend" | "multi_sensor_event" | "known_false_positive",
    "evidence_summary": "2-3 sentence human-readable explanation of your decision",
    "verifier_notes": "one line summary"
}}
"""

    # ── Call Claude ────────────────────────────────────────────────────────────
    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "agent2_verifier",
        pipeline_id   = pipeline_id
    )

    result = parse_json_response(response["content"])

    # ── Validate required keys ─────────────────────────────────────────────────
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(
            f"[{pipeline_id}] Agent 2 missing keys: {missing}. "
            f"Defaulting to verified=True to avoid missing real incidents."
        )
        result["verified"] = result.get("verified", True)
        result["confidence_in_verification"] = result.get(
            "confidence_in_verification", 50
        )
        result["corroborating_sensors"] = result.get(
            "corroborating_sensors", []
        )
        result["pattern_match"]    = result.get("pattern_match", "unknown")
        result["evidence_summary"] = result.get(
            "evidence_summary",
            "Verification incomplete — proceeding with caution"
        )
        result["verifier_notes"]   = result.get(
            "verifier_notes", "Validation failed on verifier output"
        )

    # ── Safety override: high z-score always gets verified ─────────────────────
    raw_deviation    = safe_get(detection, "raw_deviation", {})
    vibration_zscore = safe_get(raw_deviation, "vibration_zscore", 0)
    temp_zscore      = safe_get(raw_deviation, "temperature_zscore", 0)

    if (vibration_zscore > 3.5 or temp_zscore > 3.5):
        if not result.get("verified"):
            logger.warning(
                f"[{pipeline_id}] Agent 2 safety override — "
                f"z-score too high to dismiss "
                f"(vib:{vibration_zscore} temp:{temp_zscore})"
            )
            result["verified"] = True
            result["verifier_notes"] += " [Safety override: extreme z-score]"

    logger.info(
        f"[{pipeline_id}] Agent 2 complete — "
        f"verified:{result.get('verified')} "
        f"confidence:{result.get('confidence_in_verification')}% "
        f"pattern:{result.get('pattern_match')}"
    )

    return result