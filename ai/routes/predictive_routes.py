# ai/routes/predictive_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ai.agents.predictive_agent import run_predictive_check

logger = logging.getLogger("railsentinel.routes.predictive")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class PredictiveRequest(BaseModel):
    train_id: str

# ── Response Model ─────────────────────────────────────────────────────────────

class PredictiveResponse(BaseModel):
    status:                          str
    train_id:                        str
    max_zscore:                      Optional[float]
    trend_direction:                 Optional[str]
    hours_until_predicted_fault:     Optional[float]
    recommendation:                  Optional[dict]

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/predict",
    response_model=PredictiveResponse,
    summary="Run predictive maintenance check",
    description=(
        "Backend calls this every 30 minutes per train. "
        "Analyses 72-hour sensor history using Z-score detection "
        "and returns maintenance advisory if trend is worsening."
    )
)
def run_predictive_route(request: PredictiveRequest):
    """
    POST /api/ai/predict
    Called by backend on a 30-minute schedule per train.
    Returns predictive maintenance advisory or nominal status.
    """

    logger.info(
        f"Predictive route called — train:{request.train_id}"
    )

    try:
        result = run_predictive_check(request.train_id)
    except ConnectionError as e:
        logger.error(f"Claude API unreachable: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service unreachable: {str(e)}"
        )
    except Exception as e:
        logger.error(
            f"Predictive check error for {request.train_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Predictive check error: {str(e)}"
        )

    logger.info(
        f"Predictive route complete — "
        f"train:{request.train_id} status:{result.get('status')}"
    )

    return result