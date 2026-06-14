"""
risk_aggregator.py — Collects scores from all modules and calls the AI
M8 compound risk agent every 30 seconds.

Exposed via risk_routes.py GET /api/risk/composite
"""

import os
import asyncio
import logging
import random
from datetime import datetime
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.incident_model import Incident
from models.crowd_model import PlatformOccupancy
from services.ai_client import call_risk, call_predict

logger = logging.getLogger(__name__)

# In-memory store — updated by background task
_latest_risk: dict = {}

# ── Risk zones (match what M8 frontend shows) ─────────────────────────── #
ZONES = ["North", "South", "East", "West", "Central"]


def _compute_raw_scores(db: Session) -> dict:
    """
    Collect raw module-level scores without calling AI.
    Returns a dict that feeds the AI M8 agent prompt.
    """
    # Count open incidents
    open_incidents = db.query(Incident).filter(Incident.status == "open").count()
    critical_count = (
        db.query(Incident)
        .filter(Incident.status == "open", Incident.priority == 5)
        .count()
    )

    # Max crowd across all platforms
    crowd_rows = db.query(PlatformOccupancy).all()
    max_crowd_pct = max((r.occupancy_pct for r in crowd_rows), default=0.0)

    # Simulated environmental inputs (would come from real sensors in production)
    rain_mm        = random.uniform(0, 25)
    bridge_stress  = random.uniform(20, 85)
    track_score    = random.uniform(60, 98)
    weather_code   = "rain" if rain_mm > 10 else "clear"

    # Schedule conflicts count
    from services.conflict_detector import detect_conflicts
    conflicts = detect_conflicts()

    return {
        "bridge_stress":   round(bridge_stress, 1),
        "track_score":     round(track_score, 1),
        "conflicts":       len(conflicts),
        "max_crowd":       round(max_crowd_pct, 1),
        "open_incidents":  open_incidents,
        "critical_count":  critical_count,
        "weather":         weather_code,
        "rain_mm":         round(rain_mm, 1),
        "raw_conflicts":   conflicts,
    }


def _local_composite(raw: dict) -> dict:
    """
    Fast local computation of composite risk score when AI is unavailable.
    Score 0-100 built from weighted module inputs.
    """
    score = 0.0
    score += min(raw["bridge_stress"], 100) * 0.25
    score += max(0, 100 - raw["track_score"]) * 0.20
    score += min(raw["max_crowd"], 100) * 0.15
    score += min(raw["open_incidents"] * 10, 30) * 0.20
    score += min(raw["conflicts"] * 15, 30) * 0.10
    score += (raw["rain_mm"] / 25 * 100) * 0.10

    score = min(100, score)
    risk_level = (
        "critical"  if score >= 80 else
        "high"      if score >= 60 else
        "medium"    if score >= 40 else
        "low"
    )
    compound = raw["bridge_stress"] > 70 and raw["rain_mm"] > 10

    return {
        "composite_score": round(score, 1),
        "risk_level":      risk_level,
        "compound_alert":  compound,
        "compound_reason": "High bridge stress + rain detected" if compound else None,
        "top_action":      _top_action(risk_level, raw),
        "source":          "local",
    }


def _top_action(risk_level: str, raw: dict) -> str:
    if raw["critical_count"] > 0:
        return "Approve pending P5 incidents immediately"
    if raw["bridge_stress"] > 70:
        return "Dispatch bridge inspection crew"
    if raw["max_crowd"] > 85:
        return "Activate crowd dispersal protocol"
    if raw["conflicts"] > 0:
        return "Resolve platform scheduling conflicts"
    if risk_level == "high":
        return "Increase patrol frequency on high-risk sections"
    return "Continue monitoring — all systems nominal"


def _per_zone_scores(composite: float) -> list[dict]:
    """Distribute composite score across zones with ±15 variance."""
    zones = []
    for zone in ZONES:
        zone_score = max(0, min(100, composite + random.uniform(-15, 15)))
        zones.append({
            "zone":       zone,
            "score":      round(zone_score, 1),
            "risk_level": (
                "critical" if zone_score >= 80 else
                "high"     if zone_score >= 60 else
                "medium"   if zone_score >= 40 else
                "low"
            ),
        })
    return zones


async def compute_and_cache() -> dict:
    """
    Recompute risk, call AI M8 agent via ai_client, update cache.
    Called by the 30s background task and also on-demand.
    """
    global _latest_risk
    db: Session = SessionLocal()
    try:
        raw = _compute_raw_scores(db)
    finally:
        db.close()

    # Call AI M8 risk agent via centralized ai_client
    ai_result = await call_risk(
        bridge_stress  = raw["bridge_stress"],
        track_score    = raw["track_score"],
        conflicts      = raw["conflicts"],
        max_crowd      = raw["max_crowd"],
        open_incidents = raw["open_incidents"],
        weather        = raw["weather"],
        rain_mm        = raw["rain_mm"],
    )
    if ai_result:
        ai_result["source"] = "ai_agent"

    result = ai_result if ai_result else _local_composite(raw)

    _latest_risk = {
        **result,
        "raw_inputs":  raw,
        "zones":       _per_zone_scores(result.get("composite_score", 50)),
        "updated_at":  str(datetime.utcnow()),
    }

    return _latest_risk


def get_latest() -> dict:
    """Return the cached risk result (or a default if never computed)."""
    if _latest_risk:
        return _latest_risk
    return {
        "composite_score": 0,
        "risk_level":      "unknown",
        "compound_alert":  False,
        "zones":           [{"zone": z, "score": 0, "risk_level": "unknown"} for z in ZONES],
        "updated_at":      str(datetime.utcnow()),
        "message":         "Risk engine starting up…",
    }


async def run_risk_loop() -> None:
    """Background task: recomputes risk every 30 seconds."""
    from websocket.ws_manager import manager
    logger.info("[Risk] Risk aggregation loop started (30s interval).")
    while True:
        try:
            risk = await compute_and_cache()
            await manager.broadcast_risk_update(risk)
            logger.debug(f"[Risk] Score: {risk.get('composite_score')} | Level: {risk.get('risk_level')}")
        except Exception as e:
            logger.error(f"[Risk] Loop error: {e}", exc_info=True)
        await asyncio.sleep(30)
