"""
chat_routes.py — POST /api/chat

Backend proxy for the operator chat agent.
Frontend calls this instead of hitting the AI service directly,
so the backend can inject live system state into the context.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.incident_model import Incident
from models.train_model import Train
from services.ai_client import call_chat
from services.risk_aggregator import get_latest as get_latest_risk

router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    question: str


@router.post("")
async def operator_chat(body: ChatRequest, db: Session = Depends(get_db)):
    """
    Proxy to AI chat agent. Automatically injects live system state so the
    operator gets context-aware answers without sending it manually.
    """
    # Build live system state snapshot
    trains        = db.query(Train).all()
    open_incidents = db.query(Incident).filter(Incident.status == "open").all()
    risk           = get_latest_risk()

    system_state = {
        "total_trains":      len(trains),
        "trains_in_incident": sum(1 for t in trains if t.status == "incident"),
        "open_incidents":     len(open_incidents),
        "critical_incidents": sum(1 for i in open_incidents if i.priority == 5),
        "composite_risk_score": risk.get("composite_score", 0),
        "risk_level":           risk.get("risk_level", "unknown"),
        "compound_alert":       risk.get("compound_alert", False),
        "recent_incidents": [
            {
                "id":          i.id,
                "train_id":    i.train_id,
                "anomaly":     i.anomaly_type,
                "priority":    i.priority,
                "near_station": i.near_station,
            }
            for i in open_incidents[:5]
        ],
    }

    answer = await call_chat(question=body.question, system_state=system_state)

    if answer is None:
        return {
            "answer": (
                "AI chat service is currently offline. "
                "Please check that railsentinel-ai is running on port 8001."
            ),
            "ai_available": False,
        }

    return {
        "answer":       answer,
        "ai_available": True,
        "context_used": {
            "total_trains":     system_state["total_trains"],
            "open_incidents":   system_state["open_incidents"],
            "risk_level":       system_state["risk_level"],
        },
    }
