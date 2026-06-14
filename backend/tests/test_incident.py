"""
test_incident.py — Tests for incident creation, save, and approve workflow.
Run: pytest tests/test_incident.py -v
"""

import pytest
from fastapi.testclient import TestClient

# Ensure we use a test database
import os
os.environ["DATABASE_URL"] = "sqlite:///./test_railsentinel.db"

from main import app
from models.database import init_db, Base, engine

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    """Create all tables before tests, drop after."""
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_incidents_empty():
    r = client.get("/api/incidents")
    assert r.status_code == 200
    assert r.json()["count"] == 0


def test_save_incident():
    payload = {
        "train_id":          "T001",
        "train_name":        "Rajdhani Express",
        "anomaly_type":      "track_vibration",
        "deviation_sigma":   3.2,
        "priority":          5,
        "priority_label":    "Critical",
        "requires_human_approval": True,
        "hindi_alert":       "पटरी में खराबी, गाड़ी 12951 को रोकें",
        "ai_recommendation": "Stop train immediately and dispatch inspection crew.",
        "description":       "Vibration 3.2σ above baseline. Bearing failure suspected.",
        "action_summary":    "1. Stop train. 2. Inspect track section. 3. Divert following trains.",
    }
    r = client.post("/api/incidents/save", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["saved"] is True
    inc = data["incident"]
    assert inc["priority"] == 5
    assert inc["status"] == "open"
    return inc["id"]


def test_list_incidents_after_save():
    r = client.get("/api/incidents")
    assert r.status_code == 200
    assert r.json()["count"] >= 1


def test_approve_incident():
    # First save one
    payload = {
        "train_id":       "T002",
        "anomaly_type":   "bearing_overheat",
        "priority":       4,
        "priority_label": "Very High",
        "requires_human_approval": True,
    }
    save_r = client.post("/api/incidents/save", json=payload)
    inc_id = save_r.json()["incident"]["id"]

    # Approve it
    approve_r = client.post(
        f"/api/incidents/{inc_id}/approve",
        json={"approved_by": "Test Controller", "resolution_notes": "Verified by patrol crew."},
    )
    assert approve_r.status_code == 200
    assert approve_r.json()["approved"] is True
    assert approve_r.json()["incident"]["status"] == "approved"


def test_reject_incident():
    payload = {"train_id": "T003", "anomaly_type": "false_positive", "priority": 2, "priority_label": "Medium"}
    save_r = client.post("/api/incidents/save", json=payload)
    inc_id = save_r.json()["incident"]["id"]

    reject_r = client.post(
        f"/api/incidents/{inc_id}/reject",
        json={"rejected_by": "Controller", "reason": "Sensor glitch confirmed."},
    )
    assert reject_r.status_code == 200
    assert reject_r.json()["incident"]["status"] == "rejected"


def test_get_incident_not_found():
    r = client.get("/api/incidents/99999")
    assert r.status_code == 404
