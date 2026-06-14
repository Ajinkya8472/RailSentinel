"""
train_simulator.py — Seeds trains into DB and moves them along routes every 3 s.

Call once at startup:
    seed_trains()
    asyncio.create_task(move_trains())
"""

import json
import math
import random
import asyncio
import logging
from pathlib import Path
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.train_model import Train

logger = logging.getLogger(__name__)

# ── Load route data once at module import ────────────────────────────── #
_DATA_PATH = Path(__file__).parent.parent / "data" / "train_routes.json"

with open(_DATA_PATH, "r", encoding="utf-8") as f:
    TRAIN_ROUTES: list[dict] = json.load(f)

# Speed range per train (km/h) — used for display only
SPEED_RANGE = {
    "T001": (110, 130), "T002": (80, 100),  "T003": (100, 120),
    "T004": (80, 100),  "T005": (90, 110),  "T006": (120, 140),
    "T007": (100, 120), "T008": (90, 110),  "T009": (90, 110),
    "T010": (110, 130), "T011": (70, 90),   "T012": (80, 100),
    "T013": (90, 110),  "T014": (100, 120), "T015": (80, 100),
}


# ────────────────────────────────────────────────────────────────────── #
# Helpers                                                                  #
# ────────────────────────────────────────────────────────────────────── #

def _bearing(lat1, lng1, lat2, lng2) -> float:
    """Compass bearing in degrees from point 1 → point 2."""
    d_lng = math.radians(lng2 - lng1)
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    x = math.sin(d_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance in km."""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(d_lng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _passenger_count(capacity: int) -> int:
    """Random occupancy between 60%–95% of capacity."""
    return random.randint(int(capacity * 0.60), int(capacity * 0.95))


# ────────────────────────────────────────────────────────────────────── #
# Seed                                                                     #
# ────────────────────────────────────────────────────────────────────── #

def seed_trains() -> None:
    """
    Insert all trains from train_routes.json into the DB.
    Each train starts at a random waypoint on its route so the map
    looks populated from the first second.
    Skips trains that already exist (idempotent).
    """
    db: Session = SessionLocal()
    try:
        for route_data in TRAIN_ROUTES:
            train_id = route_data["id"]
            if db.query(Train).filter(Train.id == train_id).first():
                continue  # already seeded

            waypoints = route_data["waypoints"]
            # Start at a random mid-route waypoint (not the last one)
            start_idx = random.randint(0, len(waypoints) - 2)
            wp = waypoints[start_idx]
            next_wp = waypoints[start_idx + 1]

            speed_min, speed_max = SPEED_RANGE.get(train_id, (80, 110))

            train = Train(
                id                = train_id,
                number            = route_data["number"],
                name              = route_data["name"],
                from_station      = route_data["from"],
                to_station        = route_data["to"],
                lat               = wp["lat"],
                lng               = wp["lng"],
                speed             = random.uniform(speed_min, speed_max),
                heading           = _bearing(wp["lat"], wp["lng"], next_wp["lat"], next_wp["lng"]),
                status            = "normal",
                passenger_count   = _passenger_count(route_data["passenger_capacity"]),
                passenger_capacity= route_data["passenger_capacity"],
                route_index       = start_idx,
                next_station      = next_wp["station"],
                distance_km       = 0.0,
                last_vibration    = round(random.gauss(1.0, 0.15), 3),
                last_temperature  = round(random.gauss(45.0, 2.0), 2),
            )
            db.add(train)

        db.commit()
        count = db.query(Train).count()
        logger.info(f"[Simulator] Seeded trains. Total in DB: {count}")
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────── #
# Async movement loop                                                       #
# ────────────────────────────────────────────────────────────────────── #

# Build a route lookup keyed by train_id
_ROUTE_MAP: dict[str, list] = {r["id"]: r["waypoints"] for r in TRAIN_ROUTES}

# Fractional progress (0.0–1.0) between current waypoint and next
_progress: dict[str, float] = {}


async def move_trains() -> None:
    """
    Background task: interpolates each train 1% toward its next waypoint
    every 3 seconds.  When a waypoint is reached, advances route_index.
    When the final waypoint is reached, loops back to the start.
    Also broadcasts updated positions via the WebSocket manager.
    """
    from websocket.ws_manager import manager  # late import avoids circular dep

    logger.info("[Simulator] move_trains loop started.")

    while True:
        db: Session = SessionLocal()
        try:
            trains = db.query(Train).all()

            for train in trains:
                waypoints = _ROUTE_MAP.get(train.id)
                if not waypoints:
                    continue

                idx = train.route_index
                if idx >= len(waypoints) - 1:
                    # Reset to start
                    train.route_index = 0
                    train.lat = waypoints[0]["lat"]
                    train.lng = waypoints[0]["lng"]
                    train.next_station = waypoints[1]["station"] if len(waypoints) > 1 else waypoints[0]["station"]
                    _progress[train.id] = 0.0
                    continue

                curr_wp = waypoints[idx]
                next_wp = waypoints[idx + 1]

                # Step = 1% of segment per tick (reaches waypoint after ~100 ticks = 5 min)
                step = 0.01
                train.lat += (next_wp["lat"] - curr_wp["lat"]) * step
                train.lng += (next_wp["lng"] - curr_wp["lng"]) * step

                # Check if close enough to next waypoint (within 0.05 deg)
                dist = _haversine_km(train.lat, train.lng, next_wp["lat"], next_wp["lng"])
                if dist < 2.0:
                    # Snap to waypoint and advance
                    train.lat = next_wp["lat"]
                    train.lng = next_wp["lng"]
                    train.route_index = idx + 1
                    new_next_idx = idx + 2
                    if new_next_idx < len(waypoints):
                        train.next_station = waypoints[new_next_idx]["station"]
                    else:
                        train.next_station = waypoints[0]["station"]  # wrap

                # Update bearing and simulate slight speed variation
                train.heading = _bearing(train.lat, train.lng, next_wp["lat"], next_wp["lng"])
                speed_min, speed_max = SPEED_RANGE.get(train.id, (80, 110))
                train.speed = round(
                    max(speed_min, min(speed_max, train.speed + random.uniform(-2, 2))), 1
                )

            db.commit()

            # Broadcast positions to all WS clients
            live = [t.to_dict() for t in trains]
            await manager.broadcast_train_update(live)

        except Exception as e:
            logger.error(f"[Simulator] move_trains error: {e}", exc_info=True)
        finally:
            db.close()

        await asyncio.sleep(3)
