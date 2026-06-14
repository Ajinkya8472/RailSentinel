"""
energy_routes.py — GET /api/energy/profile/{train_id}
"""

from fastapi import APIRouter, HTTPException
from services.energy_calculator import get_energy_profile

router = APIRouter(prefix="/api/energy", tags=["Energy"])


@router.get("/profile/{train_id}")
def energy_profile(train_id: str):
    """Return the physics-based optimal speed advisory for a train."""
    result = get_energy_profile(train_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
