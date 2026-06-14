"""
risk_routes.py — GET /api/risk/composite
"""

from fastapi import APIRouter
from services.risk_aggregator import get_latest, compute_and_cache
import asyncio

router = APIRouter(prefix="/api/risk", tags=["Risk"])


@router.get("/composite")
def composite_risk():
    """Return the latest cached M8 composite risk scores and zone breakdown."""
    return get_latest()


@router.post("/compute")
async def force_compute():
    """Force an immediate risk recomputation (for testing)."""
    result = await compute_and_cache()
    return result
