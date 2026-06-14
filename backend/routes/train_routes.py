"""
train_routes.py — GET /api/trains/live  and  GET /api/trains/{train_id}
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.train_model import Train

router = APIRouter(prefix="/api/trains", tags=["Trains"])


@router.get("/live")
def get_live_trains(db: Session = Depends(get_db)):
    """Return all trains with their current position, speed, and status."""
    trains = db.query(Train).order_by(Train.id).all()
    return {
        "count":  len(trains),
        "trains": [t.to_dict() for t in trains],
    }


@router.get("/{train_id}")
def get_train(train_id: str, db: Session = Depends(get_db)):
    """Return detailed info for a single train."""
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")
    return train.to_dict()


@router.patch("/{train_id}/status")
def update_train_status(train_id: str, status: str, db: Session = Depends(get_db)):
    """Manually update a train status (e.g., stop a train after an incident approval)."""
    valid = {"normal", "delayed", "incident", "stopped", "maintenance"}
    if status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {valid}")
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")
    train.status = status
    db.commit()
    return {"success": True, "train_id": train_id, "new_status": status}
