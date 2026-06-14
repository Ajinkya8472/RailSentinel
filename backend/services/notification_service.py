"""
notification_service.py — Formats and persists all alert notifications.

In production this would call Twilio for SMS, but here we log everything
to the notifications table and make them available via GET /api/notifications.
"""

import logging
from datetime import datetime
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.notification_model import Notification

logger = logging.getLogger(__name__)


def _save(db: Session, **kwargs) -> Notification:
    n = Notification(**kwargs)
    db.add(n)
    db.commit()
    db.refresh(n)
    logger.info(f"[Notify] [{n.type}] → {n.recipient}: {n.message[:60]}…")
    return n


def dispatch_incident_notifications(incident_dict: dict) -> list[dict]:
    """
    Given a fully-resolved incident dict (from pipeline_runner or incident_routes),
    dispatch and log all notifications.
    Returns list of notification dicts.
    """
    db: Session = SessionLocal()
    sent = []
    try:
        inc_id    = incident_dict.get("id")
        train_id  = incident_dict.get("train_id", "")
        priority  = incident_dict.get("priority", 3)

        # 1. Loco Pilot Radio message
        loco_msg = incident_dict.get("loco_pilot_message", "")
        if loco_msg:
            n = _save(db,
                incident_id    = inc_id,
                train_id       = train_id,
                type           = "loco_pilot_radio",
                recipient      = f"Loco Pilot — {incident_dict.get('train_name', train_id)}",
                recipient_role = "Loco Pilot",
                message        = loco_msg,
                language       = "en",
                priority       = priority,
                delivered      = True,
            )
            sent.append(n.to_dict())

        # 2. Station Master SMS
        sm_msg = incident_dict.get("sms_station_master", "")
        if sm_msg:
            n = _save(db,
                incident_id    = inc_id,
                train_id       = train_id,
                type           = "sms_station_master",
                recipient      = f"Station Master — {incident_dict.get('near_station', 'En Route')}",
                recipient_role = "Station Master",
                message        = sm_msg,
                language       = "en",
                priority       = priority,
                delivered      = True,
            )
            sent.append(n.to_dict())

        # 3. DRM SMS (only for priority >= 4)
        drm_msg = incident_dict.get("sms_drm", "")
        if drm_msg and priority >= 4:
            n = _save(db,
                incident_id    = inc_id,
                train_id       = train_id,
                type           = "sms_drm",
                recipient      = "Divisional Railway Manager",
                recipient_role = "DRM",
                message        = drm_msg,
                language       = "en",
                priority       = priority,
                delivered      = True,
            )
            sent.append(n.to_dict())

        # 4. Hindi voice alert log
        hindi_msg = incident_dict.get("hindi_alert", "")
        if hindi_msg:
            n = _save(db,
                incident_id    = inc_id,
                train_id       = train_id,
                type           = "hindi_voice",
                recipient      = "Control Room + Public Announcement",
                recipient_role = "Public",
                message        = hindi_msg,
                language       = "hi",
                priority       = priority,
                delivered      = True,
            )
            sent.append(n.to_dict())

        # 5. WebSocket broadcast log
        n = _save(db,
            incident_id    = inc_id,
            train_id       = train_id,
            type           = "websocket_broadcast",
            recipient      = "All Frontend Clients",
            recipient_role = "Operator",
            message        = f"Incident #{inc_id} broadcast to all connected dashboards.",
            language       = "en",
            priority       = priority,
            delivered      = True,
        )
        sent.append(n.to_dict())

    except Exception as e:
        logger.error(f"[Notify] dispatch error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()

    return sent


def get_recent_notifications(limit: int = 50) -> list[dict]:
    """Return the N most recent notifications."""
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(Notification)
            .order_by(Notification.id.desc())
            .limit(limit)
            .all()
        )
        return [r.to_dict() for r in rows]
    finally:
        db.close()
