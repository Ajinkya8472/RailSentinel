# ai/agents/pipeline/agent5_reporter.py

import json
import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    validate_json_keys,
    load_prompt,
    generate_id,
    current_timestamp,
    safe_get
)

logger = logging.getLogger("railsentinel.agent5_reporter")

REQUIRED_KEYS = [
    "hindi_text",
    "sms_content",
    "pdf_content",
    "escalation_chain"
]

def run(context: dict) -> dict:
    """
    Agent 5 — Report Generator.
    Takes the complete pipeline context and generates all output
    artifacts: Hindi voice alert text, SMS content for Station Master
    and DRM, PDF authority report content, and escalation chain.
    Returns reporting result dict.
    """

    trigger_data = context["trigger_data"]
    detection    = context["detection"]
    verification = context["verification"]
    ranking      = context["ranking"]
    planning     = context["planning"]
    pipeline_id  = context["pipeline_id"]
    mode         = context["mode"]

    priority = ranking.get("priority", 3)

    logger.info(
        f"[{pipeline_id}] Agent 5 starting — "
        f"priority:{priority} mode:{mode}"
    )

    # ── Load prompt ────────────────────────────────────────────────────────────
    system_prompt = load_prompt("reporter_prompt.txt")

    # ── Build user message ─────────────────────────────────────────────────────
    report_id = generate_id()

    user_message = f"""
Generate all communication artifacts for this completed railway incident analysis.

INCIDENT DETAILS:
- Report ID: {report_id}
- Pipeline ID: {pipeline_id}
- Train ID: {trigger_data.get('train_id')}
- Timestamp: {trigger_data.get('timestamp')}
- Location GPS: {json.dumps(trigger_data.get('gps'))}
- Section type: {trigger_data.get('section_type')}
- Speed at detection: {trigger_data.get('speed_kmph')} kmph
- Mode: {mode}

ANOMALY:
- Type: {detection.get('anomaly_type')}
- Affected sensors: {json.dumps(detection.get('affected_sensors', []))}
- Vibration z-score: {safe_get(detection.get('raw_deviation', {}), 'vibration_zscore')}
- Temperature z-score: {safe_get(detection.get('raw_deviation', {}), 'temperature_zscore')}

VERIFICATION:
- Verified: {verification.get('verified')}
- Pattern: {verification.get('pattern_match')}
- Evidence: {verification.get('evidence_summary')}
- Confidence: {verification.get('confidence_in_verification')}%

PRIORITY:
- Priority: {priority} out of 5
- Reasoning: {ranking.get('reasoning')}
- Key factors: {json.dumps(ranking.get('key_factors', []))}
- Estimated time to failure: {ranking.get('estimated_time_to_failure')}

ACTION PLAN:
- Primary action: {planning.get('action_summary')}
- Steps: {json.dumps(planning.get('action_steps', []), indent=2)}
- Reroute needed: {planning.get('reroute_needed')}
- Speed restriction: {planning.get('speed_restriction_kmph')} kmph
- Section closure: {planning.get('section_closure_needed')}
- Crew deployed: {json.dumps(planning.get('crew_to_deploy'))}
- Maintenance window: {planning.get('maintenance_window')}

HINDI TEXT RULES:
- Simple Hindi understandable by a field worker with basic education
- Under 20 words maximum
- Must mention the train number
- Must mention the problem type in simple terms
- Must end with the action they need to take
- Example: "Gaadi 12952 mein vibration ki samasya hai, turant rokein aur crew ko bhejein"

SMS RULES:
- Under 160 characters each
- Include train ID and priority level
- Station Master SMS: operational tone, include primary action
- DRM SMS: formal tone, include confidence percentage, only send if priority >= 4

PDF CONTENT RULES:
- approved_by field must always be "PENDING_APPROVAL"
  (backend fills this after operator approves)
- Include all evidence and reasoning
- Professional formal language

ESCALATION CHAIN RULES:
- Field Crew always gets hindi_voice (all priorities)
- Station Master always gets sms (all priorities)
- Loco Pilot gets caution_order if priority >= 3
- DRM gets pdf_authority_report only if priority >= 4
- Order in chain = order of notification (most urgent first)

Respond ONLY in valid JSON with exactly this structure:
{{
    "hindi_text": "Hindi sentence for field crew voice alert",
    "sms_content": {{
        "to_station_master": "SMS text under 160 chars",
        "to_drm": "Formal SMS under 160 chars or null if priority < 4"
    }},
    "pdf_content": {{
        "report_id": "{report_id}",
        "incident_title": "string",
        "incident_time": "{trigger_data.get('timestamp')}",
        "train_id": "{trigger_data.get('train_id')}",
        "location_description": "human readable location description",
        "anomaly_description": "2-3 sentences describing the anomaly",
        "evidence_used": "summary of verification evidence",
        "priority_justification": "why this priority was assigned",
        "action_plan": "formatted action steps as a string",
        "approved_by": "PENDING_APPROVAL",
        "pipeline_id": "{pipeline_id}"
    }},
    "escalation_chain": [
        {{
            "recipient": "Field Crew",
            "channel": "hindi_voice",
            "urgency": "immediate"
        }},
        {{
            "recipient": "Station Master",
            "channel": "sms",
            "urgency": "immediate"
        }}
    ]
}}
"""

    # ── Call Claude ────────────────────────────────────────────────────────────
    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "agent5_reporter",
        pipeline_id   = pipeline_id,
        max_tokens    = 1500
    )

    result = parse_json_response(response["content"])

    # ── Validate required keys ─────────────────────────────────────────────────
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(
            f"[{pipeline_id}] Agent 5 missing keys: {missing}. "
            f"Applying safe defaults."
        )
        result["hindi_text"] = result.get(
            "hindi_text",
            f"Gaadi {trigger_data.get('train_id')} mein samasya hai, "
            f"turant dhyan dein"
        )
        result["sms_content"] = result.get("sms_content", {
            "to_station_master": (
                f"ALERT: Train {trigger_data.get('train_id')} "
                f"Priority {priority} incident detected."
            ),
            "to_drm": (
                f"URGENT: Train {trigger_data.get('train_id')} "
                f"Priority {priority} — immediate action required."
            ) if priority >= 4 else None
        })
        result["pdf_content"] = result.get("pdf_content", {
            "report_id":             report_id,
            "incident_title":        (
                f"Priority {priority} Incident — "
                f"Train {trigger_data.get('train_id')}"
            ),
            "incident_time":         trigger_data.get("timestamp"),
            "train_id":              trigger_data.get("train_id"),
            "location_description":  "See GPS coordinates",
            "anomaly_description":   detection.get("detector_notes", ""),
            "evidence_used":         verification.get("evidence_summary", ""),
            "priority_justification": ranking.get("reasoning", ""),
            "action_plan":           planning.get("action_summary", ""),
            "approved_by":           "PENDING_APPROVAL",
            "pipeline_id":           pipeline_id
        })
        result["escalation_chain"] = result.get("escalation_chain", [
            {
                "recipient": "Field Crew",
                "channel":   "hindi_voice",
                "urgency":   "immediate"
            },
            {
                "recipient": "Station Master",
                "channel":   "sms",
                "urgency":   "immediate"
            }
        ])

    # ── Add DRM to escalation chain if priority >= 4 and not already there ─────
    recipients_in_chain = [
        e.get("recipient") for e in result.get("escalation_chain", [])
    ]
    if priority >= 4 and "DRM" not in recipients_in_chain:
        result["escalation_chain"].append({
            "recipient": "Divisional Railway Manager",
            "channel":   "pdf_authority_report",
            "urgency":   "within_30_min"
        })

    # ── Add loco pilot caution order if priority >= 3 ──────────────────────────
    if priority >= 3 and "Loco Pilot" not in recipients_in_chain:
        speed = planning.get("speed_restriction_kmph", 30)
        result["escalation_chain"].insert(1, {
            "recipient": "Loco Pilot",
            "channel":   "caution_order",
            "urgency":   "immediate",
            "content": (
                f"CAUTION: {planning.get('action_summary')}. "
                f"Speed limit: {speed} kmph. "
                f"Incident: {pipeline_id}"
            )
        })

    logger.info(
        f"[{pipeline_id}] Agent 5 complete — "
        f"hindi:'{result.get('hindi_text', '')[:40]}...' "
        f"escalation_chain_length:"
        f"{len(result.get('escalation_chain', []))}"
    )

    return result