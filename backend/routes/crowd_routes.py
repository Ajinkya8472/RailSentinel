"""
crowd_routes.py — GET /api/crowd/forecast
"""

from fastapi import APIRouter, Query
from services.crowd_calculator import get_forecast, apply_festival_mode, calculate_and_save

router = APIRouter(prefix="/api/crowd", tags=["Crowd"])


@router.get("/forecast")
def crowd_forecast():
    """Return current platform occupancy for all monitored stations."""
    data = get_forecast()
    warnings = [d for d in data if d["warning_active"]]
    return {
        "count":    len(data),
        "warnings": len(warnings),
        "forecast": data,
    }


@router.post("/refresh")
def refresh_crowd():
    """Trigger a fresh crowd calculation (normally runs on schedule)."""
    data = calculate_and_save()
    return {"refreshed": True, "count": len(data)}


@router.post("/festival")
def toggle_festival(station_code: str = Query(...), enabled: bool = Query(True)):
    """Toggle festival mode (3.2× crowd multiplier) for a station."""
    data = apply_festival_mode(station_code, enabled)
    return {
        "station_code":   station_code,
        "festival_mode":  enabled,
        "platforms":      data,
    }
