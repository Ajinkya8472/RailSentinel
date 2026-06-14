"""
ai_client.py — Centralized HTTP client for all Backend → AI Service calls.

All six AI layer endpoints live here. Every service imports from this module
so there is ONE place to change the AI URL, add retries, or swap the model.

AI Service runs on: http://localhost:8001  (set AI_SERVICE_URL in .env)

Endpoints:
  POST /api/ai/pipeline  — 5-agent incident chain (sensor spike)
  POST /api/ai/predict   — M2 predictive trend agent
  POST /api/ai/crowd     — M4 crowd suggestion agent
  POST /api/ai/conflict  — M6 conflict resolution agent
  POST /api/ai/risk      — M8 compound risk agent
  POST /api/ai/chat      — Operator Q&A chat agent
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)

AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8001").rstrip("/")
_TIMEOUT       = httpx.Timeout(30.0, connect=5.0)   # 30s total, 5s connect


# ── Internal helper ────────────────────────────────────────────────── #

async def _post(endpoint: str, payload: dict) -> dict | None:
    """
    POST to the AI service. Returns parsed JSON on success, None on any failure.
    Never raises — callers fall back to local logic when AI is unavailable.
    """
    url = f"{AI_SERVICE_URL}{endpoint}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            result = resp.json()
            logger.info(f"[AI Client] {endpoint} -> OK ({resp.status_code})")
            return result
    except httpx.ConnectError:
        logger.warning(
            f"[AI Client] Cannot reach AI service at {AI_SERVICE_URL}. "
            f"Is railsentinel-ai running on port 8001?"
        )
    except httpx.TimeoutException:
        logger.warning(f"[AI Client] Timeout calling {url}")
    except httpx.HTTPStatusError as e:
        logger.error(f"[AI Client] HTTP {e.response.status_code} from {url}: {e.response.text[:200]}")
    except Exception as e:
        logger.error(f"[AI Client] Unexpected error calling {url}: {e}")
    return None


# ── Public endpoint methods ─────────────────────────────────────────── #

async def call_pipeline(sensor: dict, context: dict) -> dict | None:
    """
    POST /api/ai/pipeline — Runs the full 5-agent incident chain.

    Called by sensor_generator.py on every spike.
    Maps the backend's {sensor, context} format to the flat payload
    the AI service pipeline route expects.

    Args:
        sensor:  Raw sensor reading dict (train_id, vibration, temperature, etc.)
        context: Adjacent sensors, train_info, nearby_trains
    Returns:
        Pipeline result dict or None if AI unavailable.
    """
    from datetime import datetime
    train_info = context.get("train_info", {})
    return await _post("/api/ai/pipeline", {
        "train_id":                 sensor.get("train_id", train_info.get("id", "UNKNOWN")),
        "vibration":                sensor.get("vibration", 0.0),
        "temperature":              sensor.get("temperature", 0.0),
        "gps":                      {"lat": sensor.get("lat", 0.0), "lng": sensor.get("lng", 0.0)},
        "speed_kmph":               sensor.get("speed", train_info.get("speed", 0.0)),
        "section_type":             "open_track",   # backend can refine later
        "rolling_mean_vibration":   sensor.get("vibration", 0.0),    # best estimate without history
        "rolling_std_vibration":    sensor.get("deviation_sigma", 0.5),
        "rolling_mean_temperature": sensor.get("temperature", 0.0),
        "rolling_std_temperature":  2.0,            # safe default
        "timestamp":                datetime.utcnow().isoformat(),
        "mode":                     "reactive",
    })


async def call_predict(location: str, sensor_type: str, values: list[float],
                       current: float, threshold: float, rate_per_hour: float) -> dict | None:
    """
    POST /api/ai/predict — M2 predictive trend agent.

    Called by risk_aggregator.py when 72-hr rolling average is rising.

    Returns: {will_breach_threshold, estimated_breach_hours, urgency,
              recommended_action, maintenance_window}
    """
    return await _post("/api/ai/predict", {
        "location":      location,
        "sensor_type":   sensor_type,
        "values":        values,
        "current":       current,
        "threshold":     threshold,
        "rate_per_hour": rate_per_hour,
    })


async def call_crowd(station: str, platform: int, current_percent: float,
                     forecast_percent: float, festival_mode: bool,
                     rpf_available: bool = True) -> dict | None:
    """
    POST /api/ai/crowd — M4 crowd management agent.

    Called by crowd_calculator.py when platform forecast > 85%.

    Returns: {risk_level, actions[{action, reason, priority}], notification}
    """
    return await _post("/api/ai/crowd", {
        "station":          station,
        "platform":         platform,
        "current_percent":  current_percent,
        "forecast_percent": forecast_percent,
        "festival_mode":    festival_mode,
        "rpf_available":    rpf_available,
    })


async def call_conflict(train_a: dict, train_b: dict, station: str,
                        conflict_minutes: float, hold_minutes: int,
                        alt_platform: int) -> dict | None:
    """
    POST /api/ai/conflict — M6 schedule conflict resolution agent.

    Called by conflict_detector.py when 2 trains arrive within 10 min.

    Returns: {recommended_option 1-3, option_label, confidence_percent,
              reasoning, controller_message}
    """
    return await _post("/api/ai/conflict", {
        "train_a":          train_a,
        "train_b":          train_b,
        "platform":         station,
        "conflict_minutes": conflict_minutes,
        "hold_minutes":     hold_minutes,
        "alt_platform":     alt_platform,
    })


async def call_risk(bridge_stress: float, track_score: float,
                    conflicts: int, max_crowd: float,
                    open_incidents: int, weather: str,
                    rain_mm: float, **extra) -> dict | None:
    """
    POST /api/ai/risk — M8 compound risk agent.

    Called by risk_aggregator.py every 30 seconds.
    The AI service only accepts {zone_id} and does its own lookups
    via the backend. We derive a zone label from the current metrics.

    Returns: {status, zone_id, risk_level, affected_trains, assessment, timestamp}
    """
    # Build a human-readable zone_id from the worst current metric
    if open_incidents > 0 or bridge_stress > 70:
        zone_id = "NATIONAL_RAIL_ZONE_A"
    elif conflicts > 0 or max_crowd > 80:
        zone_id = "NATIONAL_RAIL_ZONE_B"
    else:
        zone_id = "NATIONAL_RAIL_ZONE_C"

    return await _post("/api/ai/risk", {
        "zone_id": zone_id,
    })


async def call_chat(question: str, system_state: dict) -> str | None:
    """
    POST /api/ai/chat — Operator Q&A agent.

    Called directly by the frontend via a backend proxy route.
    The AI service chat route accepts {message, conversation_history, context_filters}.
    We embed the system_state snapshot into the message so the agent has full context.
    Returns a plain-English answer string (not JSON).
    """
    import json
    # Embed live system state into the question for context
    enriched_message = (
        f"{question}\n\n"
        f"[Live System State: {json.dumps(system_state)}]"
    )
    result = await _post("/api/ai/chat", {
        "message":              enriched_message,
        "conversation_history": [],
        "context_filters":      {},
    })
    if result is None:
        return None
    # AI service returns {reply: "...", updated_history: [...], context_used: [...]}
    return result.get("reply") or result.get("answer") or result.get("response") or str(result)
