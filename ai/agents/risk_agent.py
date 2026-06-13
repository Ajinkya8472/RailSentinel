# ai/agents/m8_risk_agent.py

import json
import logging
from ai.agents.base_agent import (
    call_claude,
    parse_json_response,
    validate_json_keys,
    load_prompt,
    fetch_from_backend,
    current_timestamp,
    safe_get
)

logger = logging.getLogger("railsentinel.m8_risk")

REQUIRED_KEYS = [
    "compound_risk_level",
    "risk_summary",
    "affected_trains",
    "immediate_recommendations",
    "escalate_to_human",
    "confidence_pct"
]

def run_risk_assessment(zone_id: str) -> dict:
    """
    Compound risk detector.
    Looks for dangerous combinations of simultaneous signals
    that are individually low-priority but collectively critical.
    """

    logger.info(f"Risk assessment starting — zone:{zone_id}")

    # ── Fetch active incidents ─────────────────────────────────────────────────
    active_incidents = fetch_from_backend(
        "/api/incidents/active",
        params={"zone_id": zone_id}
    )
    if active_incidents is None:
        active_incidents = []
    if isinstance(active_incidents, dict):
        active_incidents = active_incidents.get("incidents", [])

    # ── Fetch active advisories ────────────────────────────────────────────────
    active_advisories = fetch_from_backend(
        "/api/advisories/active",
        params={"zone_id": zone_id}
    )
    if active_advisories is None:
        active_advisories = []
    if isinstance(active_advisories, dict):
        active_advisories = active_advisories.get("advisories", [])

    total_signals = len(active_incidents) + len(active_advisories)

    logger.info(
        f"Risk assessment — zone:{zone_id} "
        f"incidents:{len(active_incidents)} "
        f"advisories:{len(active_advisories)}"
    )

    if total_signals < 2:
        return {
            "status":          "no_compound_risk",
            "zone_id":         zone_id,
            "risk_level":      None,
            "affected_trains": [],
            "assessment":      None,
            "timestamp":       current_timestamp()
        }

    # ── Identify dangerous combinations ───────────────────────────────────────
    risk_combinations = _identify_risk_combinations(
        active_incidents, active_advisories
    )

    if not risk_combinations:
        logger.info(
            f"Risk assessment — zone:{zone_id} "
            f"signals present but no compound risk patterns"
        )
        return {
            "status":          "signals_present_no_compound",
            "zone_id":         zone_id,
            "risk_level":      None,
            "affected_trains": [],
            "assessment":      None,
            "timestamp":       current_timestamp()
        }

    # ── Call Claude to assess compound risk ───────────────────────────────────
    assessment = _call_risk_agent(
        zone_id, risk_combinations, active_incidents
    )

    logger.info(
        f"Risk assessment complete — zone:{zone_id} "
        f"level:{assessment.get('compound_risk_level')} "
        f"escalate:{assessment.get('escalate_to_human')}"
    )

    return {
        "status":          "compound_risk_detected",
        "zone_id":         zone_id,
        "risk_level":      assessment.get("compound_risk_level"),
        "affected_trains": assessment.get("affected_trains", []),
        "assessment":      assessment,
        "timestamp":       current_timestamp()
    }


def _identify_risk_combinations(
    active_incidents: list,
    active_advisories: list
) -> list:
    """
    Looks for known dangerous combinations of simultaneous signals.
    """

    combinations = []

    crowd_advisories      = [
        a for a in active_advisories
        if a.get("type") == "crowd"
    ]
    predictive_advisories = [
        a for a in active_advisories
        if a.get("type") == "predictive"
    ]

    # Pattern 1: Incident on same route as platform overcrowding
    for incident in active_incidents:
        incident_route = safe_get(incident, "route_id")
        for advisory in crowd_advisories:
            advisory_route = safe_get(advisory, "route_id")
            if incident_route and advisory_route == incident_route:
                combinations.append({
                    "type":             "incident_plus_crowd",
                    "incident":         incident,
                    "advisory":         advisory,
                    "risk_description": (
                        "Train incident on route to overcrowded platform — "
                        "passengers cannot be safely rerouted"
                    )
                })

    # Pattern 2: Multiple signals on same train
    incidents_by_train = {}
    for incident in active_incidents:
        tid = safe_get(incident, "train_id", "unknown")
        incidents_by_train.setdefault(tid, []).append(incident)

    for train_id, train_incidents in incidents_by_train.items():
        if len(train_incidents) >= 2:
            combinations.append({
                "type":             "multi_signal_same_train",
                "train_id":         train_id,
                "incidents":        train_incidents,
                "risk_description": (
                    f"Multiple concurrent anomalies on train {train_id} "
                    f"— individually low priority but collectively critical"
                )
            })

    # Pattern 3: Predictive advisory + crowd advisory in same zone
    if crowd_advisories and predictive_advisories:
        combinations.append({
            "type":                "predictive_plus_crowd",
            "crowd_advisories":    crowd_advisories,
            "predictive_advisories": predictive_advisories,
            "risk_description": (
                "Predicted equipment fault coincides with platform "
                "overcrowding — emergency response capacity may be reduced"
            )
        })

    return combinations


def _call_risk_agent(
    zone_id: str,
    risk_combinations: list,
    active_incidents: list
) -> dict:
    """
    Calls Claude to assess the overall compound risk level
    and generate recommendations.
    """

    system_prompt = load_prompt("risk_prompt.txt")

    user_message = f"""
Multiple simultaneous signals have been detected in zone {zone_id}.
Assess the compound risk level and recommend immediate actions.

ACTIVE INCIDENTS:
{json.dumps(active_incidents, indent=2)}

IDENTIFIED RISK COMBINATIONS:
{json.dumps(risk_combinations, indent=2)}

COMPOUND RISK LEVELS:
- elevated: signals are concerning together but manageable
- high: combination requires immediate coordinated response
- critical: combination represents a serious safety threat —
            escalate to human immediately

Respond ONLY in valid JSON with exactly this structure:
{{
    "compound_risk_level": "elevated" | "high" | "critical",
    "risk_summary": "2 sentences explaining why these signals together are dangerous",
    "affected_trains": ["list of train IDs involved"],
    "immediate_recommendations": [
        "specific action 1",
        "specific action 2",
        "specific action 3"
    ],
    "escalate_to_human": true or false,
    "hindi_compound_alert": "short Hindi alert under 20 words",
    "confidence_pct": integer between 0 and 100,
    "risk_notes": "one line summary"
}}
"""

    response = call_claude(
        system_prompt = system_prompt,
        user_message  = user_message,
        agent_name    = "m8_risk_agent",
        max_tokens    = 700
    )

    result = parse_json_response(response["content"])

    is_valid, missing = validate_json_keys(result, REQUIRED_KEYS)
    if not is_valid:
        logger.warning(f"Risk agent missing keys: {missing}")
        result["compound_risk_level"]       = result.get(
            "compound_risk_level", "elevated"
        )
        result["risk_summary"]              = result.get(
            "risk_summary",
            "Multiple simultaneous signals detected — manual review required"
        )
        result["affected_trains"]           = result.get(
            "affected_trains", []
        )
        result["immediate_recommendations"] = result.get(
            "immediate_recommendations",
            ["Review all active incidents immediately"]
        )
        result["escalate_to_human"]         = result.get(
            "escalate_to_human", True
        )
        result["confidence_pct"]            = result.get(
            "confidence_pct", 50
        )

    # Enforce: critical always escalates to human
    if result.get("compound_risk_level") == "critical":
        result["escalate_to_human"] = True

    return result