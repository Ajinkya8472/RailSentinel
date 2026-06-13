# ai/routes/crowd_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ai.agents.crowd_agent import run_crowd_check

logger = logging.getLogger("railsentinel.routes.crowd")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class CrowdRequest(BaseModel):
    platform_id:   str
    festival_mode: bool = False

# ── Response Model ─────────────────────────────────────────────────────────────

class CrowdResponse(BaseModel):
    status:                    str
    platform_id:               str
    current_occupancy_pct:     Optional[float]
    predicted_occupancy_pct:   Optional[float]
    minutes_until_threshold:   Optional[float]
    festival_mode:             bool
    recommendation:            Optional[dict]

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/crowd",
    response_model=CrowdResponse,
    summary="Run platform crowd management check",
    description=(
        "Backend calls this every 10 minutes per platform. "
        "Forecasts occupancy 30 minutes ahead using weighted "
        "moving average and returns action recommendations "
        "when predicted occupancy exceeds 85 percent."
    )
)
def run_crowd_route(request: CrowdRequest):
    """
    POST /api/ai/crowd
    Called by backend every 10 minutes per platform.
    Returns crowd advisory or normal status.
    """

    logger.info(
        f"Crowd route called — "
        f"platform:{request.platform_id} "
        f"festival:{request.festival_mode}"
    )

    try:
        result = run_crowd_check(
            request.platform_id,
            request.festival_mode
        )
    except ConnectionError as e:
        logger.error(f"Claude API unreachable: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service unreachable: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Crowd check error for {request.platform_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Crowd check error: {str(e)}"
        )

    logger.info(
        f"Crowd route complete — "
        f"platform:{request.platform_id} "
        f"status:{result.get('status')}"
    )

    return result