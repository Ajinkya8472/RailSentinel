"""
test_conflict.py — Tests for conflict detector.
Run: pytest tests/test_conflict.py -v
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
    # Seed trains so conflict detector has data
    from services.train_simulator import seed_trains
    seed_trains()
    yield
    Base.metadata.drop_all(bind=engine)


def test_schedule_conflicts_endpoint():
    r = client.get("/api/schedule/conflicts")
    assert r.status_code == 200
    data = r.json()
    assert "count"     in data
    assert "conflicts" in data
    assert isinstance(data["conflicts"], list)


def test_conflict_structure():
    r = client.get("/api/schedule/conflicts")
    conflicts = r.json()["conflicts"]
    if conflicts:
        c = conflicts[0]
        assert "conflict_id" in c
        assert "station"     in c
        assert "train_a"     in c
        assert "train_b"     in c
        assert "options"     in c
        assert len(c["options"]) == 3   # always 3 resolution options


def test_trains_live():
    """Sanity check: trains were seeded correctly."""
    r = client.get("/api/trains/live")
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 15   # all 15 routes seeded
    for t in data["trains"]:
        assert "lat"    in t
        assert "lng"    in t
        assert "status" in t
