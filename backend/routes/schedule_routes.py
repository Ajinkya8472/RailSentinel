"""
schedule_routes.py — GET /api/schedule/conflicts

Returns conflicts with optional AI M6 recommendations attached.
Use ?ai=true to trigger the AI conflict resolution agent per conflict.
"""

from fastapi import APIRouter, Query
from services.conflict_detector import detect_conflicts, resolve_conflicts_with_ai

router = APIRouter(prefix="/api/schedule", tags=["Schedule"])


@router.get("/conflicts")
async def get_conflicts(ai: bool = Query(default=False)):
    """
    Detect and return all active train platform conflicts.

    ?ai=false  (default) — fast, returns 3 resolution options without AI
    ?ai=true            — calls M6 agent per conflict, attaches ai_recommendation
    """
    conflicts = detect_conflicts()

    if ai and conflicts:
        conflicts = await resolve_conflicts_with_ai(conflicts)

    return {
        "count":     len(conflicts),
        "ai_used":   ai,
        "conflicts": conflicts,
    }
