# ai/routes/conflict_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ai.agents.conflict_agent import run_conflict_check

logger = logging.getLogger("railsentinel.routes.conflict")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class ConflictRequest(BaseModel):
    zone_id: str

# ── Response Model ─────────────────────────────────────────────────────────────

class ConflictResponse(BaseModel):
    status:         str
    zone_id:        str
    conflict_count: int  = 0
    resolutions:    list = []

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/conflict",
    response_model=ConflictResponse,
    summary="Run scheduling conflict detection",
    description=(
        "Backend calls this every 5 minutes per zone. "
        "Detects when two trains are predicted to need the "
        "same platform or track section simultaneously and "
        "recommends resolution. Currently skeleton — "
        "activates when real scheduling data is available."
    )
)
def run_conflict_route(request: ConflictRequest):
    """
    POST /api/ai/conflict
    Called by backend every 5 minutes per zone.
    Returns conflict list with resolutions.
    """

    logger.info(f"Conflict route called — zone:{request.zone_id}")

    try:
        result = run_conflict_check(request.zone_id)
    except Exception as e:
        logger.error(
            f"Conflict check error for zone {request.zone_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Conflict check error: {str(e)}"
        )

    logger.info(
        f"Conflict route complete — "
        f"zone:{request.zone_id} "
        f"status:{result.get('status')}"
    )

    return result