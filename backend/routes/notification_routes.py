"""
notification_routes.py — GET /api/notifications
"""

from fastapi import APIRouter, Query
from services.notification_service import get_recent_notifications

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(limit: int = Query(default=50, le=200)):
    """Return the N most recent dispatched notifications."""
    data = get_recent_notifications(limit=limit)
    return {
        "count":         len(data),
        "notifications": data,
    }
