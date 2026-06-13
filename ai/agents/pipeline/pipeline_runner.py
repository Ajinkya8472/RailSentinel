# ai/agents/pipeline/pipeline_runner.py

import time
import logging
from ai.agents.base_agent import (
    generate_id,
    current_timestamp,
    save_pipeline_result,
    safe_get
)
from ai.agents.pipeline.agent1_detector import run as run_detector
from ai.agents.pipeline.agent2_verifier import run as run_verifier
from ai.agents.pipeline.agent3_ranker   import run as run_ranker
from ai.agents.pipeline.agent4_planner  import run as run_planner
from ai.agents.pipeline.agent5_reporter import run as run_reporter

logger = logging.getLogger("railsentinel.pipeline_runner")

# ── Main Entry Point ───────────────────────────────────────────────────────────

def run_pipeline(trigger_data: dict, mode: str) -> dict:
    """
    Orchestrates all 5 agents in sequence.
    trigger_data = validated sensor reading dict from pipeline_routes.py
    mode = "reactive" | "predictive" | "crowd"
    Returns the complete pipeline result dict.
    """

    pipeline_id = generate_id()
    started_at  = time.time()

    logger.info(
        f"Pipeline START — id:{pipeline_id} "
        f"mode:{mode} train:{trigger_data.get('train_id')}"
    )

    # ── Shared context passed through every agent ──────────────────────────────
    context = {
        "pipeline_id":  pipeline_id,
        "mode":         mode,
        "trigger_data": trigger_data,
        "started_at":   started_at,
        "detection":    None,
        "verification": None,
        "ranking":      None,
        "planning":     None,
        "reporting":    None,
    }

    # ── Agent 1 — Detection ────────────────────────────────────────────────────
    logger.info(f"[{pipeline_id}] Running Agent 1 — Detector")
    try:
        detection = run_detector(context)
    except Exception as e:
        logger.error(f"[{pipeline_id}] Agent 1 crashed: {str(e)}")
        return _build_error_result(
            pipeline_id, trigger_data, mode, started_at,
            "agent1_detector_crash", str(e)
        )

    if not detection.get("anomaly_confirmed", False):
        logger.info(
            f"[{pipeline_id}] Agent 1 — no real anomaly. "
            f"Pipeline aborted."
        )
        result = {
            "pipeline_id":            pipeline_id,
            "train_id":               trigger_data.get("train_id"),
            "mode":                   mode,
            "status":                 "no_anomaly",
            "severity":               0,
            "confidence":             detection.get("confidence_pct", 0),
            "requires_human_approval": False,
            "recommended_action":     "No action required",
            "hindi_alert_text":       None,
            "pdf_content":            None,
            "sms_content":            None,
            "evidence_used":          None,
            "reasoning":              detection.get("detector_notes", ""),
            "reroute_needed":         False,
            "alternate_path":         None,
            "duration_seconds":       round(time.time() - started_at, 2),
            "timestamp":              current_timestamp()
        }
        save_pipeline_result(result)
        return result

    context["detection"] = detection
    logger.info(
        f"[{pipeline_id}] Agent 1 complete — "
        f"anomaly:{detection.get('anomaly_type')}"
    )

    # ── Agent 2 — Verification ─────────────────────────────────────────────────
    logger.info(f"[{pipeline_id}] Running Agent 2 — Verifier")
    try:
        verification = run_verifier(context)
    except Exception as e:
        logger.error(f"[{pipeline_id}] Agent 2 crashed: {str(e)}")
        return _build_error_result(
            pipeline_id, trigger_data, mode, started_at,
            "agent2_verifier_crash", str(e)
        )

    if not verification.get("verified", False):
        logger.info(
            f"[{pipeline_id}] Agent 2 — could not verify. "
            f"Flagged as false positive."
        )
        result = {
            "pipeline_id":            pipeline_id,
            "train_id":               trigger_data.get("train_id"),
            "mode":                   mode,
            "status":                 "false_positive",
            "severity":               0,
            "confidence":             verification.get(
                                          "confidence_in_verification", 0
                                      ),
            "requires_human_approval": False,
            "recommended_action":     "False positive — no action required",
            "hindi_alert_text":       None,
            "pdf_content":            None,
            "sms_content":            None,
            "evidence_used":          verification.get(
                                          "evidence_summary", ""
                                      ),
            "reasoning":              verification.get(
                                          "verifier_notes", ""
                                      ),
            "reroute_needed":         False,
            "alternate_path":         None,
            "duration_seconds":       round(time.time() - started_at, 2),
            "timestamp":              current_timestamp()
        }
        save_pipeline_result(result)
        return result

    context["verification"] = verification
    logger.info(
        f"[{pipeline_id}] Agent 2 complete — "
        f"pattern:{verification.get('pattern_match')}"
    )

    # ── Agent 3 — Ranking ──────────────────────────────────────────────────────
    logger.info(f"[{pipeline_id}] Running Agent 3 — Ranker")
    try:
        ranking = run_ranker(context)
    except Exception as e:
        logger.error(f"[{pipeline_id}] Agent 3 crashed: {str(e)}")
        return _build_error_result(
            pipeline_id, trigger_data, mode, started_at,
            "agent3_ranker_crash", str(e)
        )

    # Hard validate priority
    priority = ranking.get("priority", 3)
    if priority not in [1, 2, 3, 4, 5]:
        logger.warning(
            f"[{pipeline_id}] Agent 3 returned invalid priority "
            f"'{priority}' — defaulting to 3"
        )
        priority = 3
        ranking["priority"] = 3

    # Enforce consistency
    ranking["requires_immediate_action"] = priority >= 4

    context["ranking"] = ranking
    logger.info(
        f"[{pipeline_id}] Agent 3 complete — "
        f"priority:{priority} "
        f"confidence:{ranking.get('confidence_pct')}%"
    )

    # ── Agent 4 — Planning ─────────────────────────────────────────────────────
    logger.info(f"[{pipeline_id}] Running Agent 4 — Planner")
    try:
        planning = run_planner(context)
    except Exception as e:
        logger.error(f"[{pipeline_id}] Agent 4 crashed: {str(e)}")
        return _build_error_result(
            pipeline_id, trigger_data, mode, started_at,
            "agent4_planner_crash", str(e)
        )

    context["planning"] = planning
    logger.info(
        f"[{pipeline_id}] Agent 4 complete — "
        f"action:{planning.get('action_summary')}"
    )

    # ── Agent 5 — Reporting ────────────────────────────────────────────────────
    logger.info(f"[{pipeline_id}] Running Agent 5 — Reporter")
    try:
        reporting = run_reporter(context)
    except Exception as e:
        logger.error(f"[{pipeline_id}] Agent 5 crashed: {str(e)}")
        return _build_error_result(
            pipeline_id, trigger_data, mode, started_at,
            "agent5_reporter_crash", str(e)
        )

    context["reporting"] = reporting
    logger.info(f"[{pipeline_id}] Agent 5 complete — reports generated")

    # ── Build Final Result ─────────────────────────────────────────────────────
    duration = round(time.time() - started_at, 2)

    final_result = {
        "pipeline_id":             pipeline_id,
        "train_id":                trigger_data.get("train_id"),
        "mode":                    mode,
        "status":                  "completed",

        # Severity and confidence from Agent 3
        "severity":                priority,
        "confidence":              safe_get(ranking, "confidence_pct", 0),
        "requires_human_approval": priority >= 4,

        # Action from Agent 4
        "recommended_action":      safe_get(
                                       planning, "action_summary",
                                       "See action steps"
                                   ),
        "action_steps":            safe_get(planning, "action_steps", []),
        "reroute_needed":          safe_get(
                                       planning, "reroute_needed", False
                                   ),
        "alternate_path":          safe_get(
                                       planning, "alternate_path", None
                                   ),
        "affected_trains":         safe_get(
                                       planning, "affected_trains", []
                                   ),
        "crew_to_deploy":          safe_get(
                                       planning, "crew_to_deploy", None
                                   ),
        "speed_restriction_kmph":  safe_get(
                                       planning,
                                       "speed_restriction_kmph", None
                                   ),
        "section_closure_needed":  safe_get(
                                       planning,
                                       "section_closure_needed", False
                                   ),
        "maintenance_window":      safe_get(
                                       planning, "maintenance_window", None
                                   ),

        # Outputs from Agent 5
        "hindi_alert_text":        safe_get(
                                       reporting, "hindi_text", None
                                   ),
        "sms_content":             safe_get(
                                       reporting, "sms_content", None
                                   ),
        "pdf_content":             safe_get(
                                       reporting, "pdf_content", None
                                   ),
        "escalation_chain":        safe_get(
                                       reporting, "escalation_chain", []
                                   ),

        # Explainability from Agents 2 and 3
        "evidence_used":           safe_get(
                                       verification,
                                       "evidence_summary", ""
                                   ),
        "reasoning":               safe_get(ranking, "reasoning", ""),
        "key_factors":             safe_get(ranking, "key_factors", []),
        "confidence_in_verification": safe_get(
                                          verification,
                                          "confidence_in_verification", 0
                                      ),

        # Detection metadata
        "anomaly_type":            safe_get(
                                       detection, "anomaly_type", "unknown"
                                   ),
        "affected_sensors":        safe_get(
                                       detection, "affected_sensors", []
                                   ),

        # Timing
        "duration_seconds":        duration,
        "timestamp":               current_timestamp()
    }

    # ── Save to audit log ──────────────────────────────────────────────────────
    save_pipeline_result(final_result)

    logger.info(
        f"Pipeline COMPLETE — id:{pipeline_id} "
        f"severity:{priority} "
        f"duration:{duration}s "
        f"human_approval:{priority >= 4}"
    )

    return final_result


# ── Private Helpers ────────────────────────────────────────────────────────────

def _build_error_result(
    pipeline_id, trigger_data, mode, started_at, error_type, error_msg
):
    """
    Builds a standardised error result when any agent crashes.
    Saves it to the audit log and returns it so the route
    can still send a meaningful response to the backend.
    """
    result = {
        "pipeline_id":             pipeline_id,
        "train_id":                trigger_data.get("train_id"),
        "mode":                    mode,
        "status":                  f"error_{error_type}",
        "severity":                0,
        "confidence":              0,
        "requires_human_approval": False,
        "recommended_action":      "Pipeline error — manual review required",
        "action_steps":            [],
        "reroute_needed":          False,
        "alternate_path":          None,
        "affected_trains":         [],
        "crew_to_deploy":          None,
        "speed_restriction_kmph":  None,
        "section_closure_needed":  False,
        "maintenance_window":      None,
        "hindi_alert_text":        None,
        "sms_content":             None,
        "pdf_content":             None,
        "escalation_chain":        [],
        "evidence_used":           None,
        "reasoning":               error_msg,
        "key_factors":             [],
        "anomaly_type":            "unknown",
        "affected_sensors":        [],
        "duration_seconds":        round(time.time() - started_at, 2),
        "timestamp":               current_timestamp(),
        "error_detail":            error_msg
    }
    save_pipeline_result(result)
    logger.error(
        f"Pipeline ERROR — id:{pipeline_id} "
        f"type:{error_type} detail:{error_msg}"
    )
    return result