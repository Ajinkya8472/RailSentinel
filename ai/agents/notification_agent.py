# ai/agents/m5_notification_agent.py

import json
import logging
from ai.agents.base_agent import (
    current_timestamp,
    save_notification_log,
    safe_get
)

logger = logging.getLogger("railsentinel.m5_notification")

def run_notification(pipeline_result: dict) -> dict:
    """
    Takes a completed pipeline result and dispatches
    the full escalation chain.
    Called by notify_routes.py after operator approval
    for P4/P5, or immediately for P1/P2/P3.
    Returns dispatch log.
    """

    pipeline_id = pipeline_result.get("pipeline_id")
    priority    = pipeline_result.get("severity", 0)
    approved_by = pipeline_result.get("approved_by", "AUTO")
    train_id    = pipeline_result.get("train_id", "unknown")

    logger.info(
        f"Notification dispatch starting — "
        f"pipeline:{pipeline_id} priority:{priority} "
        f"approved_by:{approved_by}"
    )

    notifications = []
    now = current_timestamp()

    # ── Layer 1: Field Crew — Hindi voice (always, all priorities) ─────────────
    hindi_text = pipeline_result.get("hindi_alert_text")
    if hindi_text:
        notifications.append({
            "recipient": "Field Crew",
            "channel":   "hindi_voice",
            "content":   hindi_text,
            "urgency":   "immediate",
            "sent_at":   now
        })
        logger.info(
            f"[{pipeline_id}] Hindi voice queued — '{hindi_text[:50]}'"
        )

    # ── Layer 2: Station Master — SMS (always, all priorities) ────────────────
    sms_content = pipeline_result.get("sms_content", {})
    sm_sms      = safe_get(sms_content, "to_station_master")
    if sm_sms:
        notifications.append({
            "recipient": "Station Master",
            "channel":   "sms_simulated",
            "content":   sm_sms,
            "urgency":   "immediate",
            "sent_at":   now
        })
        logger.info(f"[{pipeline_id}] Station Master SMS queued")

    # ── Layer 3: Loco Pilot — caution order (priority >= 3) ───────────────────
    if priority >= 3:
        speed_restriction = pipeline_result.get(
            "speed_restriction_kmph", 30
        )
        caution_content = (
            f"CAUTION ORDER: {pipeline_result.get('recommended_action', '')}. "
            f"Reduce speed to {speed_restriction} kmph immediately. "
            f"Incident ID: {pipeline_id}"
        )
        notifications.append({
            "recipient": "Loco Pilot",
            "channel":   "caution_order",
            "content":   caution_content,
            "urgency":   "immediate",
            "sent_at":   now
        })
        logger.info(f"[{pipeline_id}] Loco Pilot caution order queued")

    # ── Layer 4: DRM — PDF authority report (priority >= 4 only) ─────────────
    if priority >= 4:
        pdf_content = pipeline_result.get("pdf_content", {})
        if pdf_content:
            # Stamp approved_by into the PDF content
            pdf_content["approved_by"] = approved_by
            pdf_content["dispatched_at"] = now
            notifications.append({
                "recipient": "Divisional Railway Manager",
                "channel":   "pdf_authority_report",
                "content":   pdf_content,
                "urgency":   "within_30_min",
                "sent_at":   now
            })
            logger.info(f"[{pipeline_id}] DRM PDF report queued")

        # DRM also gets an SMS
        drm_sms = safe_get(sms_content, "to_drm")
        if drm_sms:
            notifications.append({
                "recipient": "Divisional Railway Manager",
                "channel":   "sms_simulated",
                "content":   drm_sms,
                "urgency":   "immediate",
                "sent_at":   now
            })
            logger.info(f"[{pipeline_id}] DRM SMS queued")

    # ── Layer 5: Process escalation chain from pipeline result ────────────────
    # Add any extra recipients from Agent 5's escalation_chain
    # that aren't already covered above
    existing_recipients = {n["recipient"] for n in notifications}
    escalation_chain    = pipeline_result.get("escalation_chain", [])

    for entry in escalation_chain:
        recipient = entry.get("recipient", "")
        if recipient not in existing_recipients:
            notifications.append({
                "recipient": recipient,
                "channel":   entry.get("channel", "sms_simulated"),
                "content":   entry.get(
                    "content",
                    f"Incident alert — Pipeline {pipeline_id}"
                ),
                "urgency":   entry.get("urgency", "within_1hr"),
                "sent_at":   now
            })
            existing_recipients.add(recipient)
            logger.info(
                f"[{pipeline_id}] Extra escalation — {recipient}"
            )

    # ── Save all notifications to audit log ────────────────────────────────────
    save_notification_log(pipeline_id, notifications)

    logger.info(
        f"Notification dispatch complete — "
        f"pipeline:{pipeline_id} "
        f"dispatched:{len(notifications)} notifications"
    )

    return {
        "status":              "notifications_dispatched",
        "pipeline_id":         pipeline_id,
        "notifications_count": len(notifications),
        "notifications":       notifications,
        "timestamp":           now
    }