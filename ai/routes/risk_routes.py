# ai/routes/risk_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ai.agents.risk_agent import run_risk_assessment

logger = logging.getLogger("railsentinel.routes.risk")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class RiskRequest(BaseModel):
    zone_id: str

# ── Response Model ─────────────────────────────────────────────────────────────

class RiskResponse(BaseModel):
    status:          str
    zone_id:         str
    risk_level:      Optional[str]
    affected_trains: list = []
    assessment:      Optional[dict]
    timestamp:       Optional[str]

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/risk",
    response_model=RiskResponse,
    summary="Run compound risk assessment",
    description=(
        "Backend calls this every 5 minutes per zone when "
        "2 or more active alerts exist simultaneously. "
        "Detects dangerous combinations of signals that are "
        "individually low priority but collectively high risk."
    )
)
def run_risk_route(request: RiskRequest):
    """
    POST /api/ai/risk
    Called by backend every 5 minutes per zone IF 2+ active alerts.
    Returns compound risk assessment.
    """

    logger.info(f"Risk route called — zone:{request.zone_id}")

    try:
        result = run_risk_assessment(request.zone_id)
    except ConnectionError as e:
        logger.error(f"Claude API unreachable: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service unreachable: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Risk assessment error for zone {request.zone_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Risk assessment error: {str(e)}"
        )

    logger.info(
        f"Risk route complete — "
        f"zone:{request.zone_id} "
        f"status:{result.get('status')}"
    )

    return result