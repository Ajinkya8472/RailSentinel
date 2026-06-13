# ai/agents/pipeline/agent3_ranker.py

import json
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

logger = logging.getLogger("railsentinel.agent3_ranker")

REQUIRED_KEYS = [
    "priority",
    "confidence_pct",
    "reasoning",
    "key_factors",
    "requires_immediate_action",
    "estimated_time_to_failure",
    "ranker_notes"
]

PRIORITY_DESCRIPTIONS = {
    1: "Informational — log only, no action needed",
    2: "Advisory — schedule maintenance within 7 days",
    3: "Warning — maintenance within 48 hours, reduce speed 20kmph",
    4: "Urgent — human approval required, stop train if needed, maintenance within 6 hours",
    5: "Critical — human approval required, stop train immediately, deploy crew, notify DRM"
}

def run(context: dict) -> dict:
    """
    Agent 3 — Severity Ranker.
    Assigns Priority 1-5 with confidence percentage and full reasoning.
    Determines if human approval is required.
    Returns ranking result dict.
    """

    trigger_data = context["trigger_data"]
    detection    = context["detection"]
    verification = context["verification"]
    pipeline_id  = context["pipeline_id"]
    mode         = context["mode"]

    logger.info(
        f"[{pipeline_id}] Agent 3 starting — "
        f"pattern:{verification.get('pattern_match')}"
    )

    # ── Load prompt and few-shot examples ─────────────────────────────────────
    system_prompt = load_prompt("ranker_prompt.txt")
    examples      = load_few_shot_examples("ranker_examples.json")
    examples_text = format_few_shot_examples(examples)

    # ── Pull key values for context ────────────────────────────────────────────
    speed_kmph   = trigger_data.get("speed_kmph", 0)
    section_type = trigger_data.get("section_type", "open_track")
    raw_deviation = safe_get(detection, "raw_deviation", {})
    vib_zscore   = safe_get(raw_deviation, "vibration_zscore", 0)
    temp_zscore  = safe_get(raw_deviation, "temperature_zscore", 0)

    # ── Build user message ─────────────────────────────────────────────────────
    user_message = f"""
{examples_text}

Assign a Priority 1-5 severity score to this verified railway anomaly.

PRIORITY SCALE:
{json.dumps(PRIORITY_DESCRIPTIONS, indent=2)}

SENSOR DATA:
{json.dumps(trigger_data, indent=2)}

DETECTION RESULT:
{json.dumps(detection, indent=2)}

VERIFICATION RESULT:
{json.dumps(verification, indent=2)}

KEY CONTEXTUAL FACTORS TO CONSIDER:
- Train speed: {speed_kmph} kmph (higher speed = higher risk multiplier)
- Section type: {section_type} (bridge/tunnel = higher risk than open_track)
- Vibration z-score: {vib_zscore} (above 3.0 = serious, above 4.0 = critical)
- Temperature z-score: {temp_zscore} (above 3.0 = serious, above 4.0 = critical)
- Pattern: {verification.get('pattern_match')} (sustained_trend = more serious than isolated_spike)
- Mode: {mode} (predictive mode means fault has not happened yet — slightly lower urgency)
- Verification confidence: {verification.get('confidence_in_verification')}%

SCORING RULES:
- Bridge or tunnel section + speed > 80kmph + vibration > 3.0 sigma → minimum Priority 4
- Sustained trend on any section + speed > 60kmph → minimum Priority 3
- Isolated spike on open track + speed < 60kmph → maximum Priority 2
- Combined vibration AND temperature anomaly → add 1 to base priority
- Predictive mode → reduce final priority by 1 (minimum 1) since fault has not occurred

Respond ONLY in valid JSON with exactly this structure:
{{
    "priority": integer between 1 and 5,
    "confidence_pct": integer between 0 and 100,
    "reasoning": "2-3 sentences explaining exactly why this priority was chosen",
    "key_factors": [
        "factor 1 that drove the score",
        "factor 2 that drove the score",
        "factor 3 that drove the score"
    ],
    "requires_immediate_action": true or false,
    "estimated_time_to_failure": "e.g. 45 minutes | unknown | not applicable",
    "ranker_notes": "one line summary"
}}
"""

    # ── Call Claude ────────────────────────────────────────────────────────────
    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "agent3_ranker",
        pipeline_id   = pipeline_id
    )

    result = parse_json_response(response["content"])

    # ── Validate required keys ─────────────────────────────────────────────────
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(
            f"[{pipeline_id}] Agent 3 missing keys: {missing}. "
            f"Applying safe defaults."
        )
        result["priority"]                 = result.get("priority", 3)
        result["confidence_pct"]           = result.get("confidence_pct", 50)
        result["reasoning"]                = result.get(
            "reasoning",
            "Ranking incomplete — defaulting to Priority 3 for safety"
        )
        result["key_factors"]              = result.get("key_factors", [])
        result["requires_immediate_action"] = result.get(
            "requires_immediate_action", False
        )
        result["estimated_time_to_failure"] = result.get(
            "estimated_time_to_failure", "unknown"
        )
        result["ranker_notes"]             = result.get(
            "ranker_notes", "Validation failed on ranker output"
        )

    # ── Hard validate priority is 1-5 integer ─────────────────────────────────
    try:
        priority = int(result["priority"])
        if priority not in [1, 2, 3, 4, 5]:
            raise ValueError("Out of range")
        result["priority"] = priority
    except (ValueError, TypeError, KeyError):
        logger.warning(
            f"[{pipeline_id}] Agent 3 invalid priority value "
            f"'{result.get('priority')}' — defaulting to 3"
        )
        result["priority"] = 3

    # ── Enforce requires_immediate_action consistency ──────────────────────────
    result["requires_immediate_action"] = result["priority"] >= 4

    logger.info(
        f"[{pipeline_id}] Agent 3 complete — "
        f"priority:{result['priority']} "
        f"confidence:{result.get('confidence_pct')}% "
        f"immediate:{result['requires_immediate_action']}"
    )

    return result