# ai/routes/pipeline_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from ai.agents.pipeline.pipeline_runner import run_pipeline

logger = logging.getLogger("railsentinel.routes.pipeline")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class PipelineRequest(BaseModel):
    train_id:                  str
    vibration:                 float
    temperature:               float
    gps:                       dict
    speed_kmph:                float
    section_type:              str   = Field(
                                   default="open_track",
                                   description="bridge | tunnel | open_track | station"
                               )
    rolling_mean_vibration:    float
    rolling_std_vibration:     float
    rolling_mean_temperature:  float
    rolling_std_temperature:   float
    timestamp:                 str
    mode:                      str   = Field(
                                   default="reactive",
                                   description="reactive | predictive | crowd"
                               )

# ── Response Model ─────────────────────────────────────────────────────────────

class PipelineResponse(BaseModel):
    pipeline_id:               str
    train_id:                  str
    mode:                      str
    status:                    str
    severity:                  int
    confidence:                int
    requires_human_approval:   bool
    recommended_action:        str
    action_steps:              list
    reroute_needed:            bool
    alternate_path:            Optional[list]
    affected_trains:           list
    crew_to_deploy:            Optional[dict]
    speed_restriction_kmph:    Optional[int]
    section_closure_needed:    bool
    maintenance_window:        Optional[str]
    hindi_alert_text:          Optional[str]
    sms_content:               Optional[dict]
    pdf_content:               Optional[dict]
    escalation_chain:          list
    evidence_used:             Optional[str]
    reasoning:                 str
    key_factors:               list
    anomaly_type:              str
    affected_sensors:          list
    duration_seconds:          float
    timestamp:                 str

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/pipeline",
    response_model=PipelineResponse,
    summary="Run the 5-agent incident pipeline",
    description=(
        "Backend calls this when a sensor spike is detected. "
        "Runs all 5 agents in sequence and returns the complete "
        "incident analysis with action plan and report artifacts."
    )
)
def run_pipeline_route(request: PipelineRequest):
    """
    POST /api/ai/pipeline
    Called by backend on sensor spike detection.
    Returns complete pipeline result.
    """

    logger.info(
        f"Pipeline route called — "
        f"train:{request.train_id} mode:{request.mode}"
    )

    # ── Validate mode ──────────────────────────────────────────────────────────
    valid_modes = ["reactive", "predictive", "crowd"]
    if request.mode not in valid_modes:
        logger.warning(
            f"Invalid mode '{request.mode}' — defaulting to reactive"
        )
        mode = "reactive"
    else:
        mode = request.mode

    # ── Validate section_type ──────────────────────────────────────────────────
    valid_sections = ["bridge", "tunnel", "open_track", "station"]
    section_type = (
        request.section_type
        if request.section_type in valid_sections
        else "open_track"
    )

    # ── Validate GPS ───────────────────────────────────────────────────────────
    gps = request.gps
    if "lat" not in gps or "lng" not in gps:
        raise HTTPException(
            status_code=422,
            detail="gps must contain 'lat' and 'lng' keys"
        )

    # ── Build trigger_data dict ────────────────────────────────────────────────
    trigger_data = {
        "train_id":                 request.train_id,
        "vibration":                request.vibration,
        "temperature":              request.temperature,
        "gps":                      gps,
        "speed_kmph":               request.speed_kmph,
        "section_type":             section_type,
        "rolling_mean_vibration":   request.rolling_mean_vibration,
        "rolling_std_vibration":    request.rolling_std_vibration,
        "rolling_mean_temperature": request.rolling_mean_temperature,
        "rolling_std_temperature":  request.rolling_std_temperature,
        "timestamp":                request.timestamp
    }

    # ── Run pipeline ───────────────────────────────────────────────────────────
    try:
        result = run_pipeline(trigger_data, mode)
    except ConnectionError as e:
        logger.error(f"Claude API unreachable: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service unreachable: {str(e)}"
        )
    except RuntimeError as e:
        logger.error(f"Pipeline runtime error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Pipeline error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected pipeline error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

    logger.info(
        f"Pipeline route complete — "
        f"id:{result.get('pipeline_id')} "
        f"severity:{result.get('severity')} "
        f"status:{result.get('status')}"
    )

    return result