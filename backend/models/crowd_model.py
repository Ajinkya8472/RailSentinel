"""
crowd_model.py — SQLAlchemy model for the `platform_occupancy` table.
Stores real-time and forecasted crowd levels per platform per station.
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
from sqlalchemy.sql import func
from models.database import Base


class PlatformOccupancy(Base):
    __tablename__ = "platform_occupancy"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    station_code    = Column(String,  nullable=False, index=True)
    station_name    = Column(String,  nullable=False)
    platform_number = Column(Integer, nullable=False)

    # Occupancy
    current_count   = Column(Integer, nullable=False, default=0)
    capacity        = Column(Integer, nullable=False, default=2000)
    occupancy_pct   = Column(Float,   nullable=False, default=0.0)   # 0.0–100.0

    # Forecast (next 30 min)
    forecast_count  = Column(Integer, nullable=True)
    forecast_pct    = Column(Float,   nullable=True)

    # Flags
    is_festival_mode = Column(Boolean, nullable=False, default=False)
    # If True, crowd 3× multiplier is applied
    warning_active  = Column(Boolean, nullable=False, default=False)   # > 85%
    critical_active = Column(Boolean, nullable=False, default=False)   # > 95%

    # Incoming train
    next_train_id   = Column(String,  nullable=True)
    next_train_eta_min = Column(Integer, nullable=True)

    recorded_at     = Column(DateTime, server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id":                  self.id,
            "station_code":        self.station_code,
            "station_name":        self.station_name,
            "platform_number":     self.platform_number,
            "current_count":       self.current_count,
            "capacity":            self.capacity,
            "occupancy_pct":       round(self.occupancy_pct, 1),
            "forecast_count":      self.forecast_count,
            "forecast_pct":        round(self.forecast_pct, 1) if self.forecast_pct else None,
            "is_festival_mode":    self.is_festival_mode,
            "warning_active":      self.warning_active,
            "critical_active":     self.critical_active,
            "next_train_id":       self.next_train_id,
            "next_train_eta_min":  self.next_train_eta_min,
            "recorded_at":         str(self.recorded_at),
        }
