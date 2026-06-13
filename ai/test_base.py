# Add to ai/test_base.py temporarily

import unittest.mock as mock
import sys
from pathlib import Path

# Add project root directory to path so we can resolve the 'ai' package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Mock all 5 agent run() functions before importing runner
with mock.patch.dict('sys.modules', {
    'ai.agents.pipeline.agent1_detector': mock.MagicMock(
        run=mock.MagicMock(return_value={
            "anomaly_confirmed": True,
            "anomaly_type": "vibration_spike",
            "affected_sensors": ["vibration"],
            "raw_deviation": {"vibration_zscore": 3.1, "temp_zscore": 0.4},
            "detector_notes": "Vibration 3.1 sigma above baseline"
        })
    ),
    'ai.agents.pipeline.agent2_verifier': mock.MagicMock(
        run=mock.MagicMock(return_value={
            "verified": True,
            "confidence_in_verification": 91,
            "corroborating_sensors": ["vibration", "adjacent_vib"],
            "pattern_match": "sustained_trend",
            "evidence_summary": "Two sensors confirm sustained spike",
            "verifier_notes": "Multi-sensor confirmation"
        })
    ),
    'ai.agents.pipeline.agent3_ranker': mock.MagicMock(
        run=mock.MagicMock(return_value={
            "priority": 4,
            "confidence_pct": 94,
            "reasoning": "High vibration on bridge section at speed",
            "key_factors": ["bridge_section", "high_speed", "sustained"],
            "requires_immediate_action": True,
            "estimated_time_to_failure": "45 minutes",
            "ranker_notes": "Priority 4 confirmed"
        })
    ),
    'ai.agents.pipeline.agent4_planner': mock.MagicMock(
        run=mock.MagicMock(return_value={
            "action_summary": "Reduce speed to 30kmph, deploy crew",
            "action_steps": [
                {"step": 1, "action": "Reduce speed",
                 "responsible_party": "Loco Pilot",
                 "urgency": "immediate"}
            ],
            "reroute_needed": False,
            "alternate_path": None,
            "affected_trains": ["12952"],
            "crew_to_deploy": {"crew_id": "C7", "eta_minutes": 12},
            "speed_restriction_kmph": 30,
            "section_closure_needed": False,
            "maintenance_window": None,
            "planner_notes": "Speed restriction applied"
        })
    ),
    'ai.agents.pipeline.agent5_reporter': mock.MagicMock(
        run=mock.MagicMock(return_value={
            "hindi_text": "Gaadi 12952 mein vibration samasya hai",
            "sms_content": {
                "to_station_master": "ALERT: Train 12952 P4 vibration",
                "to_drm": "URGENT: Train 12952 Priority 4 incident"
            },
            "pdf_content": {"incident_title": "Vibration Alert 12952"},
            "escalation_chain": [
                {"recipient": "Field Crew", "channel": "hindi_voice"}
            ]
        })
    ),
}):
    from ai.agents.pipeline.pipeline_runner import run_pipeline

    test_trigger = {
        "train_id": "12952",
        "vibration": 89.2,
        "temperature": 72.1,
        "gps": {"lat": 23.25, "lng": 77.41},
        "speed_kmph": 110,
        "section_type": "bridge",
        "rolling_mean_vibration": 51.3,
        "rolling_std_vibration": 12.1,
        "rolling_mean_temperature": 70.2,
        "rolling_std_temperature": 4.8,
        "timestamp": "2026-06-12T06:00:00+00:00"
    }

    result = run_pipeline(test_trigger, "reactive")

    assert result["status"] == "completed",      f"❌ status: {result['status']}"
    assert result["severity"] == 4,              f"❌ severity: {result['severity']}"
    assert result["requires_human_approval"],    "❌ human approval should be True"
    assert result["pipeline_id"] is not None,    "❌ pipeline_id missing"
    assert result["hindi_alert_text"] is not None, "❌ hindi text missing"

    print(f"✅ Pipeline runner OK — id:{result['pipeline_id']} "
          f"severity:{result['severity']} "
          f"duration:{result['duration_seconds']}s")