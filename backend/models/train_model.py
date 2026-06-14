"""
train_model.py — SQLAlchemy model for the `trains` table.
"""

from sqlalchemy import Column, String, Float, Integer, DateTime
from sqlalchemy.sql import func
from models.database import Base


class Train(Base):
    __tablename__ = "trains"

    id              = Column(String,  primary_key=True, index=True)   # e.g. "T001"
    number          = Column(String,  nullable=False)                  # e.g. "12951"
    name            = Column(String,  nullable=False)                  # e.g. "Rajdhani Express"
    from_station    = Column(String,  nullable=False)
    to_station      = Column(String,  nullable=False)

    # Live position
    lat             = Column(Float,   nullable=False, default=0.0)
    lng             = Column(Float,   nullable=False, default=0.0)
    speed           = Column(Float,   nullable=False, default=0.0)    # km/h
    heading         = Column(Float,   nullable=False, default=0.0)    # degrees

    # Status
    status          = Column(String,  nullable=False, default="normal")
    # Values: "normal" | "delayed" | "incident" | "stopped" | "maintenance"

    passenger_count = Column(Integer, nullable=False, default=0)
    passenger_capacity = Column(Integer, nullable=False, default=1000)

    # Route tracking
    route_index     = Column(Integer, nullable=False, default=0)       # current waypoint index
    next_station    = Column(String,  nullable=True)
    distance_km     = Column(Float,   nullable=False, default=0.0)     # km from start

    # Sensor snapshot (latest reading)
    last_vibration  = Column(Float,   nullable=True)
    last_temperature = Column(Float,  nullable=True)

    last_updated    = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def to_dict(self):
        return {
            "id":                 self.id,
            "number":             self.number,
            "name":               self.name,
            "from_station":       self.from_station,
            "to_station":         self.to_station,
            "lat":                self.lat,
            "lng":                self.lng,
            "speed":              self.speed,
            "heading":            self.heading,
            "status":             self.status,
            "passenger_count":    self.passenger_count,
            "passenger_capacity": self.passenger_capacity,
            "route_index":        self.route_index,
            "next_station":       self.next_station,
            "distance_km":        self.distance_km,
            "last_vibration":     self.last_vibration,
            "last_temperature":   self.last_temperature,
            "last_updated":       str(self.last_updated),
        }
