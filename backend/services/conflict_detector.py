"""
conflict_detector.py — Detects when two trains are predicted to arrive
at the same platform within a configurable window (default 10 minutes).

Called by schedule_routes.py GET /api/schedule/conflicts
and periodically by risk_aggregator.py.
"""

import math
import random
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.train_model import Train
from services.ai_client import call_conflict

logger = logging.getLogger(__name__)

# Trains within this time window at same station = conflict
CONFLICT_WINDOW_MIN = 10
# Average train speed assumption for ETA estimation (km/h)
ASSUMED_SPEED_KMH   = 90.0


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(d_lng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _eta_minutes(train: Train, station_lat: float, station_lng: float) -> float:
    """Rough ETA in minutes based on current distance and speed."""
    dist_km = _haversine_km(train.lat, train.lng, station_lat, station_lng)
    speed   = train.speed if train.speed > 10 else ASSUMED_SPEED_KMH
    return (dist_km / speed) * 60


def detect_conflicts() -> list[dict]:
    """
    Find pairs of trains heading to the same next_station within CONFLICT_WINDOW_MIN.
    Returns a list of conflict dicts ready for the API + AI agent.
    """
    db: Session = SessionLocal()
    conflicts = []

    try:
        trains = db.query(Train).filter(Train.status != "stopped").all()

        # Group trains by their next_station
        station_groups: dict[str, list[Train]] = {}
        for t in trains:
            if t.next_station:
                station_groups.setdefault(t.next_station, []).append(t)

        for station_name, group in station_groups.items():
            if len(group) < 2:
                continue

            # Find the station lat/lng from stations.json (best effort)
            # For simplicity, use the second train's current position as proxy
            # In production this would look up stations.json
            station_lat = group[0].lat
            station_lng = group[0].lng

            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    t_a = group[i]
                    t_b = group[j]

                    eta_a = _eta_minutes(t_a, station_lat, station_lng)
                    eta_b = _eta_minutes(t_b, station_lat, station_lng)

                    gap_min = abs(eta_a - eta_b)

                    if gap_min <= CONFLICT_WINDOW_MIN:
                        # Determine alternate platform suggestion
                        alt_platform = random.randint(2, 8)
                        hold_minutes = max(5, int(gap_min) + 5)

                        conflicts.append({
                            "conflict_id":     f"CF-{t_a.id}-{t_b.id}",
                            "station":         station_name,
                            "train_a": {
                                "id":              t_a.id,
                                "name":            t_a.name,
                                "number":          t_a.number,
                                "eta_min":         round(eta_a, 1),
                                "passenger_count": t_a.passenger_count,
                                "status":          t_a.status,
                            },
                            "train_b": {
                                "id":              t_b.id,
                                "name":            t_b.name,
                                "number":          t_b.number,
                                "eta_min":         round(eta_b, 1),
                                "passenger_count": t_b.passenger_count,
                                "status":          t_b.status,
                            },
                            "gap_minutes":         round(gap_min, 1),
                            "conflict_minutes":    round(CONFLICT_WINDOW_MIN - gap_min, 1),
                            "hold_minutes":        hold_minutes,
                            "alt_platform":        alt_platform,
                            "severity":            "high" if gap_min < 5 else "medium",
                            "detected_at":         str(datetime.utcnow()),
                            # Option labels for AI agent M6
                            "options": [
                                {"id": 1, "label": f"Hold {t_b.name} at previous station for {hold_minutes} min"},
                                {"id": 2, "label": f"Divert {t_a.name} to Platform {alt_platform}"},
                                {"id": 3, "label": f"Reduce {t_a.name} speed to 30 km/h — create {hold_minutes} min gap"},
                            ],
                        })

    except Exception as e:
        logger.error(f"[ConflictDetector] Error: {e}", exc_info=True)
    finally:
        db.close()

    logger.info(f"[ConflictDetector] Found {len(conflicts)} conflict(s).")
    return conflicts


async def resolve_conflicts_with_ai(conflicts: list[dict]) -> list[dict]:
    """
    Enrich a list of conflicts with AI M6 recommendations.
    Call this after detect_conflicts() when you need AI suggestions attached.
    Returns the same list with 'ai_recommendation' added to each conflict.
    """
    for conflict in conflicts:
        ai = await call_conflict(
            train_a          = conflict["train_a"],
            train_b          = conflict["train_b"],
            station          = conflict["station"],
            conflict_minutes = conflict["conflict_minutes"],
            hold_minutes     = conflict["hold_minutes"],
            alt_platform     = conflict["alt_platform"],
        )
        if ai:
            conflict["ai_recommendation"] = {
                "recommended_option":  ai.get("recommended_option"),
                "option_label":        ai.get("option_label"),
                "confidence_percent":  ai.get("confidence_percent"),
                "reasoning":           ai.get("reasoning"),
                "controller_message": ai.get("controller_message"),
            }
            logger.info(
                f"[ConflictDetector] M6 AI resolved {conflict['conflict_id']} — "
                f"option={ai.get('recommended_option')} confidence={ai.get('confidence_percent')}%"
            )
        else:
            conflict["ai_recommendation"] = None   # AI offline, frontend shows options list
    return conflicts
