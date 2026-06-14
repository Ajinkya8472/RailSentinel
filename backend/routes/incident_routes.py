"""
incident_routes.py — Incident CRUD + approve/reject workflow.

POST /api/incidents/trigger   — manually trigger a fake spike (demo)
POST /api/incidents/save      — called by AI service after pipeline completes
GET  /api/incidents           — list 20 most recent incidents
GET  /api/incidents/{id}      — single incident
POST /api/incidents/{id}/approve
POST /api/incidents/{id}/reject
GET  /api/incidents/{id}/pdf  — download authority report PDF
"""

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.incident_model import Incident
from models.sensor_model import SensorLog
from websocket.ws_manager import manager
from services.notification_service import dispatch_incident_notifications
from services.pdf_generator import generate_incident_pdf

router = APIRouter(prefix="/api/incidents", tags=["Incidents"])


# ── Pydantic schemas ─────────────────────────────────────────────────── #

class SaveIncidentRequest(BaseModel):
    """Payload posted by the AI pipeline_runner after all 5 agents complete."""
    train_id:               str
    train_name:             str | None = None
    location_km:            float | None = None
    location_lat:           float | None = None
    location_lng:           float | None = None
    near_station:           str | None = None
    anomaly_type:           str = "track_vibration"
    deviation_sigma:        float | None = None
    description:            str | None = None
    confirmed:              bool = True
    confidence_percent:     float | None = None
    evidence_used:          str | None = None
    priority:               int = 3
    priority_label:         str = "High"
    requires_human_approval: bool = False
    immediate_actions:      str | None = None
    trains_to_stop:         str | None = None
    speed_restrictions:     str | None = None
    action_summary:         str | None = None
    ai_recommendation:      str | None = None
    hindi_alert:            str | None = None
    sms_station_master:     str | None = None
    sms_drm:                str | None = None
    loco_pilot_message:     str | None = None
    sensor_log_id:          int | None = None


class ApproveRequest(BaseModel):
    approved_by:      str = "Controller"
    resolution_notes: str | None = None


class RejectRequest(BaseModel):
    rejected_by:  str = "Controller"
    reason:       str | None = None


# ── Endpoints ────────────────────────────────────────────────────────── #

@router.post("/trigger")
async def trigger_incident(
    train_id: str = "T001",
    db: Session = Depends(get_db),
):
    """
    Demo endpoint — manually inject a P5 spike for the given train.
    Useful for live demos without waiting 60 ticks.
    """
    from models.train_model import Train
    from services.sensor_generator import _spike_reading, inject_reading

    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")

    reading = _spike_reading(train_id)
    await inject_reading(train, reading, db, source="manual_trigger")
    return {"triggered": True, "train_id": train_id, "reading": reading}


@router.post("/save")
async def save_incident(
    payload: SaveIncidentRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Called by AI service after pipeline completes. Saves + broadcasts."""
    incident = Incident(
        train_id                = payload.train_id,
        train_name              = payload.train_name,
        location_km             = payload.location_km,
        location_lat            = payload.location_lat,
        location_lng            = payload.location_lng,
        near_station            = payload.near_station,
        anomaly_type            = payload.anomaly_type,
        deviation_sigma         = payload.deviation_sigma,
        description             = payload.description,
        confirmed               = payload.confirmed,
        confidence_percent      = payload.confidence_percent,
        evidence_used           = payload.evidence_used,
        priority                = payload.priority,
        priority_label          = payload.priority_label,
        requires_human_approval = payload.requires_human_approval,
        immediate_actions       = payload.immediate_actions,
        trains_to_stop          = payload.trains_to_stop,
        speed_restrictions      = payload.speed_restrictions,
        action_summary          = payload.action_summary,
        ai_recommendation       = payload.ai_recommendation,
        hindi_alert             = payload.hindi_alert,
        sms_station_master      = payload.sms_station_master,
        sms_drm                 = payload.sms_drm,
        loco_pilot_message      = payload.loco_pilot_message,
        status                  = "open",
    )

    # Link sensor log if provided
    if payload.sensor_log_id:
        log = db.query(SensorLog).filter(SensorLog.id == payload.sensor_log_id).first()
        if log:
            log.incident_id = incident.id   # updated after flush

    db.add(incident)
    db.commit()
    db.refresh(incident)

    inc_dict = incident.to_dict()

    # Broadcast to all WebSocket clients
    await manager.broadcast_new_incident(inc_dict)

    # Dispatch SMS / notifications in background
    background_tasks.add_task(dispatch_incident_notifications, inc_dict)

    return {"saved": True, "incident": inc_dict}


@router.get("")
def list_incidents(
    limit: int = 20,
    status: str | None = None,
    priority: int | None = None,
    db: Session = Depends(get_db),
):
    """List most recent incidents. Optional filters: status, priority."""
    q = db.query(Incident)
    if status:
        q = q.filter(Incident.status == status)
    if priority:
        q = q.filter(Incident.priority == priority)
    incidents = q.order_by(Incident.id.desc()).limit(limit).all()
    return {
        "count":     len(incidents),
        "incidents": [i.to_dict() for i in incidents],
    }


@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident #{incident_id} not found")
    return inc.to_dict()


@router.post("/{incident_id}/approve")
async def approve_incident(
    incident_id: int,
    body: ApproveRequest,
    db: Session = Depends(get_db),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident #{incident_id} not found")
    if inc.status not in ("open",):
        raise HTTPException(status_code=400, detail=f"Incident is already {inc.status}")

    inc.status           = "approved"
    inc.approved_by      = body.approved_by
    inc.resolution_notes = body.resolution_notes
    inc.approved_at      = datetime.utcnow()
    db.commit()
    db.refresh(inc)

    await manager.broadcast_incident_update(incident_id, "approved", inc.to_dict())
    return {"approved": True, "incident": inc.to_dict()}


@router.post("/{incident_id}/reject")
async def reject_incident(
    incident_id: int,
    body: RejectRequest,
    db: Session = Depends(get_db),
):
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident #{incident_id} not found")

    inc.status           = "rejected"
    inc.approved_by      = body.rejected_by
    inc.resolution_notes = body.reason
    db.commit()
    db.refresh(inc)

    await manager.broadcast_incident_update(incident_id, "rejected", inc.to_dict())
    return {"rejected": True, "incident": inc.to_dict()}


@router.get("/{incident_id}/pdf")
def download_pdf(incident_id: int, db: Session = Depends(get_db)):
    """Generate and stream the authority report PDF."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident #{incident_id} not found")

    pdf_bytes = generate_incident_pdf(inc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="incident_{incident_id}_report.pdf"',
        },
    )
