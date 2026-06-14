"""
sensor_model.py — SQLAlchemy model for the `sensor_logs` table.
Every reading (normal + spike) is stored here. Used by M2 trend charts.
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
from sqlalchemy.sql import func
from models.database import Base


class SensorLog(Base):
    __tablename__ = "sensor_logs"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    train_id        = Column(String,  nullable=False, index=True)

    # Position at time of reading
    location_km     = Column(Float,   nullable=True)
    location_lat    = Column(Float,   nullable=True)
    location_lng    = Column(Float,   nullable=True)

    # Sensor values
    vibration       = Column(Float,   nullable=False)   # g-force equivalent
    temperature     = Column(Float,   nullable=False)   # degrees Celsius
    speed           = Column(Float,   nullable=True)    # km/h at time of reading

    # Derived
    deviation_sigma = Column(Float,   nullable=True)    # how many σ above baseline
    is_spike        = Column(Boolean, nullable=False, default=False)
    source          = Column(String,  nullable=False, default="simulated")
    # "simulated" | "arduino" | "iot_sensor"

    # Link to incident if this reading triggered one
    incident_id     = Column(Integer, nullable=True)

    timestamp       = Column(DateTime, server_default=func.now(), index=True)

    def to_dict(self):
        return {
            "id":             self.id,
            "train_id":       self.train_id,
            "location_km":    self.location_km,
            "location_lat":   self.location_lat,
            "location_lng":   self.location_lng,
            "vibration":      self.vibration,
            "temperature":    self.temperature,
            "speed":          self.speed,
            "deviation_sigma": self.deviation_sigma,
            "is_spike":       self.is_spike,
            "source":         self.source,
            "incident_id":    self.incident_id,
            "timestamp":      str(self.timestamp),
        }
