# ai/agents/pipeline/agent1_detector.py

import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    validate_json_keys,
    load_prompt,
    load_few_shot_examples,
    format_few_shot_examples,
    safe_get
)

logger = logging.getLogger("railsentinel.agent1_detector")

REQUIRED_KEYS = [
    "anomaly_confirmed",
    "anomaly_type",
    "affected_sensors",
    "raw_deviation",
    "detector_notes"
]

def run(context: dict) -> dict:
    """
    Agent 1 — Sensor Anomaly Detector.
    Reads raw sensor data from context and decides if a real
    anomaly exists or if it is statistical noise.
    Returns detection result dict.
    """

    trigger_data = context["trigger_data"]
    pipeline_id  = context["pipeline_id"]
    mode         = context["mode"]

    logger.info(
        f"[{pipeline_id}] Agent 1 starting — "
        f"train:{trigger_data.get('train_id')} mode:{mode}"
    )

    # ── Load prompt and few-shot examples ─────────────────────────────────────
    system_prompt = load_prompt("detector_prompt.txt")
    examples      = load_few_shot_examples("detector_examples.json")
    examples_text = format_few_shot_examples(examples)

    # ── Compute deviation metrics in Python (not Claude) ──────────────────────
    vibration       = trigger_data.get("vibration", 0)
    temperature     = trigger_data.get("temperature", 0)
    mean_vib        = trigger_data.get("rolling_mean_vibration", 0)
    std_vib         = trigger_data.get("rolling_std_vibration", 1)
    mean_temp       = trigger_data.get("rolling_mean_temperature", 0)
    std_temp        = trigger_data.get("rolling_std_temperature", 1)

    # Protect against division by zero
    std_vib  = std_vib  if std_vib  > 0 else 1.0
    std_temp = std_temp if std_temp > 0 else 1.0

    vibration_zscore    = round((vibration - mean_vib) / std_vib, 3)
    temperature_zscore  = round((temperature - mean_temp) / std_temp, 3)

    sensor_summary = {
        "train_id":             trigger_data.get("train_id"),
        "mode":                 mode,
        "vibration":            vibration,
        "temperature":          temperature,
        "rolling_mean_vibration":   mean_vib,
        "rolling_std_vibration":    std_vib,
        "rolling_mean_temperature": mean_temp,
        "rolling_std_temperature":  std_temp,
        "vibration_zscore":     vibration_zscore,
        "temperature_zscore":   temperature_zscore,
        "speed_kmph":           trigger_data.get("speed_kmph"),
        "section_type":         trigger_data.get("section_type"),
        "gps":                  trigger_data.get("gps"),
        "timestamp":            trigger_data.get("timestamp")
    }

    # ── Build user message ─────────────────────────────────────────────────────
    import json
    user_message = f"""
{examples_text}

Now analyse this sensor reading and determine if it is a real anomaly
or statistical noise.

SENSOR DATA:
{json.dumps(sensor_summary, indent=2)}

THRESHOLDS FOR REFERENCE:
- Vibration raw threshold: > 75 is physically significant
- Temperature raw threshold: > 88 is physically significant
- Z-score threshold: > 2.0 standard deviations is statistically significant
- A real anomaly requires BOTH statistical AND physical significance

Respond ONLY in valid JSON with exactly this structure:
{{
    "anomaly_confirmed": true or false,
    "anomaly_type": "vibration_spike" | "temperature_spike" | "combined" | "none",
    "affected_sensors": ["list of sensor names that are anomalous"],
    "raw_deviation": {{
        "vibration_zscore": {vibration_zscore},
        "temperature_zscore": {temperature_zscore}
    }},
    "detector_notes": "one line explanation of your decision",
    "confidence_pct": integer between 0 and 100
}}
"""

    # ── Call Claude ────────────────────────────────────────────────────────────
    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "agent1_detector",
        pipeline_id   = pipeline_id
    )

    result = parse_json_response(response["content"])

    # ── Validate required keys ─────────────────────────────────────────────────
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(
            f"[{pipeline_id}] Agent 1 missing keys: {missing}. "
            f"Defaulting anomaly_confirmed to False."
        )
        result["anomaly_confirmed"] = result.get("anomaly_confirmed", False)
        result["anomaly_type"]      = result.get("anomaly_type", "none")
        result["affected_sensors"]  = result.get("affected_sensors", [])
        result["raw_deviation"]     = result.get("raw_deviation", {
            "vibration_zscore":   vibration_zscore,
            "temperature_zscore": temperature_zscore
        })
        result["detector_notes"]    = result.get(
            "detector_notes", "Validation failed — defaulting to no anomaly"
        )

    # ── Safety override: if zscores are extreme, force confirm ─────────────────
    # Prevents Claude from dismissing a genuine emergency
    if vibration_zscore > 4.0 or temperature_zscore > 4.0:
        if not result.get("anomaly_confirmed"):
            logger.warning(
                f"[{pipeline_id}] Agent 1 safety override — "
                f"z-score extreme (vib:{vibration_zscore} "
                f"temp:{temperature_zscore}) forcing anomaly_confirmed=True"
            )
            result["anomaly_confirmed"] = True
            result["anomaly_type"]      = "combined" \
                if vibration_zscore > 4.0 and temperature_zscore > 4.0 \
                else ("vibration_spike" if vibration_zscore > 4.0
                      else "temperature_spike")
            result["detector_notes"] += " [Safety override: extreme z-score]"

    logger.info(
        f"[{pipeline_id}] Agent 1 complete — "
        f"confirmed:{result.get('anomaly_confirmed')} "
        f"type:{result.get('anomaly_type')} "
        f"vib_z:{vibration_zscore} temp_z:{temperature_zscore}"
    )

    return result