# ai/routes/notify_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ai.agents.notification_agent import run_notification

logger = logging.getLogger("railsentinel.routes.notify")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class NotifyRequest(BaseModel):
    pipeline_id:              str
    train_id:                 str
    severity:                 int
    recommended_action:       str
    hindi_alert_text:         Optional[str] = None
    sms_content:              Optional[dict] = None
    pdf_content:              Optional[dict] = None
    escalation_chain:         list           = []
    speed_restriction_kmph:   Optional[int]  = None
    approved_by:              Optional[str]  = None

# ── Response Model ─────────────────────────────────────────────────────────────

class NotifyResponse(BaseModel):
    status:               str
    pipeline_id:          str
    notifications_count:  int
    notifications:        list
    timestamp:            str

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/notify",
    response_model=NotifyResponse,
    summary="Dispatch notifications and escalation chain",
    description=(
        "Backend calls this after operator approves a P4/P5 incident "
        "OR immediately after pipeline completes for P1/P2/P3. "
        "Dispatches Hindi voice alert, SMS, PDF report, and "
        "caution order to appropriate recipients."
    )
)
def run_notify_route(request: NotifyRequest):
    """
    POST /api/ai/notify
    Called by backend after pipeline result is approved.
    Dispatches all notifications in the escalation chain.
    """

    logger.info(
        f"Notify route called — "
        f"pipeline:{request.pipeline_id} "
        f"severity:{request.severity}"
    )

    if request.severity not in [1, 2, 3, 4, 5]:
        raise HTTPException(
            status_code=422,
            detail=f"severity must be 1-5, got {request.severity}"
        )

    try:
        result = run_notification(request.dict())
    except Exception as e:
        logger.error(
            f"Notification error for {request.pipeline_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Notification error: {str(e)}"
        )

    logger.info(
        f"Notify route complete — "
        f"pipeline:{request.pipeline_id} "
        f"dispatched:{result.get('notifications_count')} notifications"
    )

    return result