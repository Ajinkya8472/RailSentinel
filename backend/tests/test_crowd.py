"""
test_crowd.py — Tests for crowd calculator and routes.
Run: pytest tests/test_crowd.py -v
"""

import os
os.environ["DATABASE_URL"] = "sqlite:///./test_railsentinel.db"

import pytest
from fastapi.testclient import TestClient
from main import app
from models.database import init_db, Base, engine

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def setup_db():
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


def test_crowd_forecast_returns_data():
    r = client.get("/api/crowd/forecast")
    assert r.status_code == 200
    data = r.json()
    assert "forecast" in data
    assert "count" in data


def test_crowd_forecast_structure():
    r = client.get("/api/crowd/forecast")
    forecast = r.json()["forecast"]
    if forecast:
        item = forecast[0]
        assert "station_code"    in item
        assert "platform_number" in item
        assert "occupancy_pct"   in item
        assert "warning_active"  in item
        assert 0 <= item["occupancy_pct"] <= 100


def test_crowd_festival_toggle():
    r = client.post("/api/crowd/festival?station_code=NDLS&enabled=true")
    assert r.status_code == 200
    data = r.json()
    assert data["festival_mode"] is True
    assert data["station_code"] == "NDLS"


def test_crowd_refresh():
    r = client.post("/api/crowd/refresh")
    assert r.status_code == 200
    assert r.json()["refreshed"] is True
