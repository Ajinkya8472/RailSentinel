"""
sensor_generator.py — Generates realistic vibration + temperature readings
for every train every 2 seconds.

Every 60th tick per train triggers a spike (anomaly) and:
  1. Saves the reading to sensor_logs
  2. Broadcasts the spike via WebSocket
  3. Calls ai_client.call_pipeline()  (async, non-blocking)

Normal readings are saved to sensor_logs but NOT broadcast to reduce noise.

Usage:
    asyncio.create_task(run_sensor_loop())
"""

import json
import math
import random
import asyncio
import logging
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.train_model import Train
from models.sensor_model import SensorLog
from services.ai_client import call_pipeline

logger = logging.getLogger(__name__)

import os
SPIKE_INTERVAL = int(os.getenv("SPIKE_INTERVAL", "60"))   # ticks between spikes

# ── Load baseline config ─────────────────────────────────────────────── #
_BASELINE_PATH = Path(__file__).parent.parent / "data" / "baseline_sensors.json"
with open(_BASELINE_PATH, "r", encoding="utf-8") as f:
    BASELINE_CFG: dict = json.load(f)

_GLOBAL   = BASELINE_CFG["global_defaults"]
_ROUTE_BL = BASELINE_CFG["route_specific_baselines"]
_THRESHOLDS = BASELINE_CFG["alert_thresholds"]

# Per-train tick counter — incremented each reading
_tick_counter: dict[str, int] = {}


# ────────────────────────────────────────────────────────────────────── #
# Reading generators                                                        #
# ────────────────────────────────────────────────────────────────────── #

def _get_baseline(train_id: str) -> tuple[float, float]:
    """Return (vibration_mean, temperature_mean) for this train's route."""
    bl = _ROUTE_BL.get(train_id, {})
    vib_mean = bl.get("vibration_mean", _GLOBAL["vibration_mean"])
    tmp_mean = bl.get("temperature_mean", _GLOBAL["temperature_mean"])
    return vib_mean, tmp_mean


def _normal_reading(train_id: str) -> dict:
    vib_mean, tmp_mean = _get_baseline(train_id)
    vibration   = round(random.gauss(vib_mean,   _GLOBAL["vibration_std"]), 4)
    temperature = round(random.gauss(tmp_mean,    _GLOBAL["temperature_std"]), 2)
    vibration   = max(0.1, vibration)     # clamp — no negative vibration
    temperature = max(20.0, temperature)
    sigma = round((vibration - vib_mean) / _GLOBAL["vibration_std"], 2)
    return {
        "vibration":       vibration,
        "temperature":     temperature,
        "deviation_sigma": sigma,
        "is_spike":        False,
    }


def _spike_reading(train_id: str) -> dict:
    vib_mean, _ = _get_baseline(train_id)
    vibration   = round(random.uniform(
        _GLOBAL["spike_vibration_min"],
        _GLOBAL["spike_vibration_max"],
    ), 4)
    temperature = round(random.uniform(
        _GLOBAL["spike_temperature_min"],
        _GLOBAL["spike_temperature_max"],
    ), 2)
    sigma = round((vibration - vib_mean) / _GLOBAL["vibration_std"], 2)
    return {
        "vibration":       vibration,
        "temperature":     temperature,
        "deviation_sigma": sigma,
        "is_spike":        True,
    }


# ────────────────────────────────────────────────────────────────────── #
# Inject a reading (also called from arduino_reader.py)                    #
# ────────────────────────────────────────────────────────────────────── #

async def inject_reading(train: Train, reading: dict, db: Session, source: str = "simulated") -> SensorLog:
    """Persist a sensor reading and handle spike logic."""
    from websocket.ws_manager import manager  # late import

    log = SensorLog(
        train_id        = train.id,
        location_lat    = train.lat,
        location_lng    = train.lng,
        location_km     = train.distance_km,
        vibration       = reading["vibration"],
        temperature     = reading["temperature"],
        speed           = train.speed,
        deviation_sigma = reading["deviation_sigma"],
        is_spike        = reading["is_spike"],
        source          = source,
    )
    db.add(log)

    # Update train snapshot
    train.last_vibration    = reading["vibration"]
    train.last_temperature  = reading["temperature"]
    if reading["is_spike"]:
        train.status = "incident"
    db.commit()
    db.refresh(log)

    if reading["is_spike"]:
        logger.warning(
            f"[SensorGen] SPIKE on {train.id} ({train.name}): "
            f"vib={reading['vibration']} temp={reading['temperature']} σ={reading['deviation_sigma']}"
        )

        # Broadcast raw spike immediately (frontend turns dot red before AI finishes)
        spike_payload = {
            "train_id":        train.id,
            "train_name":      train.name,
            "lat":             train.lat,
            "lng":             train.lng,
            "vibration":       reading["vibration"],
            "temperature":     reading["temperature"],
            "deviation_sigma": reading["deviation_sigma"],
            "sensor_log_id":   log.id,
            "timestamp":       str(datetime.utcnow()),
        }
        await manager.broadcast_sensor_spike(spike_payload)

        # Fire-and-forget AI pipeline call via centralized ai_client
        asyncio.create_task(_trigger_pipeline(train, reading, log.id))

    return log


async def _trigger_pipeline(train: Train, reading: dict, sensor_log_id: int) -> None:
    """Calls AI pipeline via ai_client (non-blocking, fire-and-forget)."""
    sensor_payload = {
        "train_id":        train.id,
        "train_name":      train.name,
        "vibration":       reading["vibration"],
        "temperature":     reading["temperature"],
        "deviation_sigma": reading["deviation_sigma"],
        "lat":             train.lat,
        "lng":             train.lng,
        "speed":           train.speed,
        "sensor_log_id":   sensor_log_id,
    }
    context_payload = {
        "adjacent_sensors": _get_adjacent_readings(train.id),
        "train_info": {
            "id":               train.id,
            "name":             train.name,
            "number":           train.number,
            "passenger_count":  train.passenger_count,
            "next_station":     train.next_station,
            "speed":            train.speed,
            "status":           train.status,
        },
        "nearby_trains": _get_nearby_trains(train.lat, train.lng),
    }
    result = await call_pipeline(sensor_payload, context_payload)
    if result:
        logger.info(f"[SensorGen] AI pipeline completed for {train.id} — fired={result.get('fired')}")
    else:
        logger.debug(f"[SensorGen] AI pipeline unavailable for {train.id} — continuing with WS spike only.")


# ────────────────────────────────────────────────────────────────────── #
# Context helpers                                                           #
# ────────────────────────────────────────────────────────────────────── #

def _get_adjacent_readings(train_id: str) -> list[dict]:
    """Returns last 3 sensor readings from adjacent trains for Agent 2 verification."""
    db: Session = SessionLocal()
    try:
        logs = (
            db.query(SensorLog)
            .filter(SensorLog.train_id != train_id)
            .order_by(SensorLog.id.desc())
            .limit(3)
            .all()
        )
        return [
            {
                "train_id":   l.train_id,
                "vibration":  l.vibration,
                "temperature": l.temperature,
                "is_spike":   l.is_spike,
                "timestamp":  str(l.timestamp),
            }
            for l in logs
        ]
    finally:
        db.close()


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(d_lng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _get_nearby_trains(lat: float, lng: float, radius_km: float = 100) -> list[dict]:
    """Returns trains within radius_km of the given coordinates."""
    db: Session = SessionLocal()
    try:
        all_trains = db.query(Train).all()
        nearby = []
        for t in all_trains:
            dist = _haversine_km(lat, lng, t.lat, t.lng)
            if dist <= radius_km:
                nearby.append({
                    "id":               t.id,
                    "name":             t.name,
                    "lat":              t.lat,
                    "lng":              t.lng,
                    "distance_km":      round(dist, 1),
                    "passenger_count":  t.passenger_count,
                    "status":           t.status,
                })
        return nearby
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────── #
# Main sensor loop                                                          #
# ────────────────────────────────────────────────────────────────────── #

async def run_sensor_loop() -> None:
    """
    Background task: generates one reading per train every 2 seconds.
    Every SPIKE_INTERVAL ticks for a given train, injects a spike.
    """
    logger.info(f"[SensorGen] Sensor loop started. Spike every {SPIKE_INTERVAL} ticks.")
    while True:
        db: Session = SessionLocal()
        try:
            trains = db.query(Train).all()
            for train in trains:
                tick = _tick_counter.get(train.id, 0) + 1
                _tick_counter[train.id] = tick

                is_spike_tick = (tick % SPIKE_INTERVAL == 0)
                reading = _spike_reading(train.id) if is_spike_tick else _normal_reading(train.id)

                await inject_reading(train, reading, db)

        except Exception as e:
            logger.error(f"[SensorGen] Loop error: {e}", exc_info=True)
        finally:
            db.close()

        await asyncio.sleep(2)
