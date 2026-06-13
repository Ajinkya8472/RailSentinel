# ai/agents/pipeline/agent4_planner.py

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

logger = logging.getLogger("railsentinel.agent4_planner")

REQUIRED_KEYS = [
    "action_summary",
    "action_steps",
    "reroute_needed",
    "affected_trains",
    "planner_notes"
]

def run(context: dict) -> dict:
    """
    Agent 4 — Action Planner.
    Generates a specific, actionable plan based on the verified
    and ranked anomaly. Fetches nearby trains, available crew,
    and alternate routes from the backend.
    Returns planning result dict.
    """

    trigger_data = context["trigger_data"]
    detection    = context["detection"]
    verification = context["verification"]
    ranking      = context["ranking"]
    pipeline_id  = context["pipeline_id"]
    mode         = context["mode"]

    logger.info(
        f"[{pipeline_id}] Agent 4 starting — "
        f"priority:{ranking.get('priority')} mode:{mode}"
    )

    # ── Fetch nearby trains ────────────────────────────────────────────────────
    nearby_trains = fetch_from_backend(
        "/api/trains/nearby",
        params={
            "lat":       safe_get(trigger_data.get("gps", {}), "lat"),
            "lng":       safe_get(trigger_data.get("gps", {}), "lng"),
            "radius_km": 50
        }
    )
    if nearby_trains is None:
        logger.warning(
            f"[{pipeline_id}] Agent 4 — nearby trains unavailable"
        )
        nearby_trains = {"available": False, "trains": []}

    # ── Fetch available maintenance crew ───────────────────────────────────────
    available_crew = fetch_from_backend(
        "/api/crew/available",
        params={
            "lat": safe_get(trigger_data.get("gps", {}), "lat"),
            "lng": safe_get(trigger_data.get("gps", {}), "lng")
        }
    )
    if available_crew is None:
        logger.warning(
            f"[{pipeline_id}] Agent 4 — crew data unavailable"
        )
        available_crew = {"available": False, "crews": []}

    # ── Fetch alternate routes ─────────────────────────────────────────────────
    alternate_routes = fetch_from_backend(
        "/api/routes/alternates",
        params={"train_id": trigger_data.get("train_id")}
    )
    if alternate_routes is None:
        logger.warning(
            f"[{pipeline_id}] Agent 4 — alternate routes unavailable"
        )
        alternate_routes = {"available": False, "routes": []}

    # ── Load prompt ────────────────────────────────────────────────────────────
    system_prompt = load_prompt("planner_prompt.txt")

    # ── Build user message ─────────────────────────────────────────────────────
    priority     = ranking.get("priority", 3)
    anomaly_type = detection.get("anomaly_type", "unknown")

    user_message = f"""
Generate a specific, actionable response plan for this verified railway incident.

INCIDENT SUMMARY:
- Train ID: {trigger_data.get('train_id')}
- Priority: {priority} out of 5
- Anomaly type: {anomaly_type}
- Mode: {mode}
- Speed at detection: {trigger_data.get('speed_kmph')} kmph
- Section type: {trigger_data.get('section_type')}
- Location: {json.dumps(trigger_data.get('gps'))}
- Estimated time to failure: {ranking.get('estimated_time_to_failure')}

AGENT REASONING:
{ranking.get('reasoning')}

KEY FACTORS:
{json.dumps(ranking.get('key_factors', []), indent=2)}

NEARBY TRAINS THAT MAY BE AFFECTED:
{json.dumps(nearby_trains, indent=2)}

AVAILABLE MAINTENANCE CREWS:
{json.dumps(available_crew, indent=2)}

ALTERNATE ROUTE OPTIONS:
{json.dumps(alternate_routes, indent=2)}

PLANNING RULES:
- Priority 1-2: schedule maintenance only, no speed restriction needed
- Priority 3: recommend speed reduction, schedule maintenance within 48h
- Priority 4: recommend stopping train OR severe speed restriction (30kmph),
              deploy nearest available crew, check if reroute is needed
- Priority 5: stop train immediately, deploy crew, close section,
              reroute ALL affected trains, notify everyone
- Predictive mode (mode=predictive): no emergency stop needed,
  recommend maintenance window instead
- If backend data is unavailable, generate reasonable plan based on priority alone
- action_steps must be ordered by urgency: immediate actions first

Respond ONLY in valid JSON with exactly this structure:
{{
    "action_summary": "one sentence — the primary action to take",
    "action_steps": [
        {{
            "step": 1,
            "action": "specific action description",
            "responsible_party": "Loco Pilot | Station Master | Maintenance Crew | DRM | RPF",
            "urgency": "immediate | within_1hr | within_6hr | within_48hr"
        }}
    ],
    "reroute_needed": true or false,
    "alternate_path": [
        {{"lat": float, "lng": float}}
    ],
    "affected_trains": ["list of train IDs that need action"],
    "crew_to_deploy": {{
        "crew_id": "string or null",
        "eta_minutes": integer or null
    }},
    "speed_restriction_kmph": integer or null,
    "section_closure_needed": true or false,
    "maintenance_window": "specific time string e.g. Tuesday 02:00-04:00 or null",
    "planner_notes": "one line summary"
}}
"""

    # ── Call Claude ────────────────────────────────────────────────────────────
    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "agent4_planner",
        pipeline_id   = pipeline_id,
        max_tokens    = 1500
    )

    result = parse_json_response(response["content"])

    # ── Validate required keys ─────────────────────────────────────────────────
    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(
            f"[{pipeline_id}] Agent 4 missing keys: {missing}. "
            f"Applying safe defaults."
        )
        result["action_summary"]  = result.get(
            "action_summary",
            f"Priority {priority} incident — manual review required"
        )
        result["action_steps"]    = result.get("action_steps", [
            {
                "step": 1,
                "action": "Manual review required — automated planning incomplete",
                "responsible_party": "Station Master",
                "urgency": "immediate" if priority >= 4 else "within_1hr"
            }
        ])
        result["reroute_needed"]  = result.get("reroute_needed", False)
        result["affected_trains"] = result.get(
            "affected_trains", [trigger_data.get("train_id")]
        )
        result["planner_notes"]   = result.get(
            "planner_notes", "Validation failed on planner output"
        )

    # ── Ensure alternate_path is None not missing ──────────────────────────────
    if "alternate_path" not in result:
        result["alternate_path"] = None
    if "crew_to_deploy" not in result:
        result["crew_to_deploy"] = None
    if "speed_restriction_kmph" not in result:
        result["speed_restriction_kmph"] = None
    if "section_closure_needed" not in result:
        result["section_closure_needed"] = False
    if "maintenance_window" not in result:
        result["maintenance_window"] = None

    logger.info(
        f"[{pipeline_id}] Agent 4 complete — "
        f"action:'{result.get('action_summary')}' "
        f"reroute:{result.get('reroute_needed')} "
        f"steps:{len(result.get('action_steps', []))}"
    )

    return result