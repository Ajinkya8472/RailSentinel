"""
incident_model.py — SQLAlchemy model for the `incidents` table.
"""

from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
from models.database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id                   = Column(Integer, primary_key=True, autoincrement=True)
    train_id             = Column(String,  nullable=False, index=True)
    train_name           = Column(String,  nullable=True)

    # Location
    location_km          = Column(Float,   nullable=True)
    location_lat         = Column(Float,   nullable=True)
    location_lng         = Column(Float,   nullable=True)
    near_station         = Column(String,  nullable=True)

    # Anomaly details (from Agent 1)
    anomaly_type         = Column(String,  nullable=False)
    # e.g. "track_vibration" | "bearing_overheat" | "rail_fracture" | "wheel_flat"
    deviation_sigma      = Column(Float,   nullable=True)
    description          = Column(Text,    nullable=True)

    # Verification (from Agent 2)
    confirmed            = Column(Boolean, nullable=False, default=True)
    confidence_percent   = Column(Float,   nullable=True)
    evidence_used        = Column(Text,    nullable=True)    # JSON array stored as text

    # Priority (from Agent 3)
    priority             = Column(Integer, nullable=False, default=3)
    # 1=Low, 2=Medium, 3=High, 4=Very High, 5=Critical
    priority_label       = Column(String,  nullable=False, default="High")
    requires_human_approval = Column(Boolean, nullable=False, default=False)

    # Actions (from Agent 4)
    immediate_actions    = Column(Text,    nullable=True)    # JSON array as text
    trains_to_stop       = Column(Text,    nullable=True)    # JSON array as text
    speed_restrictions   = Column(Text,    nullable=True)    # JSON array as text
    action_summary       = Column(Text,    nullable=True)

    # Report (from Agent 5)
    ai_recommendation    = Column(Text,    nullable=True)
    hindi_alert          = Column(Text,    nullable=True)
    sms_station_master   = Column(Text,    nullable=True)
    sms_drm              = Column(Text,    nullable=True)
    loco_pilot_message   = Column(Text,    nullable=True)

    # Workflow status
    status               = Column(String,  nullable=False, default="open")
    # "open" | "approved" | "rejected" | "resolved"
    approved_by          = Column(String,  nullable=True)
    resolution_notes     = Column(Text,    nullable=True)

    # Timestamps
    created_at           = Column(DateTime, server_default=func.now())
    approved_at          = Column(DateTime, nullable=True)
    resolved_at          = Column(DateTime, nullable=True)

    def to_dict(self):
        return {
            "id":                      self.id,
            "train_id":                self.train_id,
            "train_name":              self.train_name,
            "location_km":             self.location_km,
            "location_lat":            self.location_lat,
            "location_lng":            self.location_lng,
            "near_station":            self.near_station,
            "anomaly_type":            self.anomaly_type,
            "deviation_sigma":         self.deviation_sigma,
            "description":             self.description,
            "confirmed":               self.confirmed,
            "confidence_percent":      self.confidence_percent,
            "evidence_used":           self.evidence_used,
            "priority":                self.priority,
            "priority_label":          self.priority_label,
            "requires_human_approval": self.requires_human_approval,
            "immediate_actions":       self.immediate_actions,
            "trains_to_stop":          self.trains_to_stop,
            "speed_restrictions":      self.speed_restrictions,
            "action_summary":          self.action_summary,
            "ai_recommendation":       self.ai_recommendation,
            "hindi_alert":             self.hindi_alert,
            "sms_station_master":      self.sms_station_master,
            "sms_drm":                 self.sms_drm,
            "loco_pilot_message":      self.loco_pilot_message,
            "status":                  self.status,
            "approved_by":             self.approved_by,
            "resolution_notes":        self.resolution_notes,
            "created_at":              str(self.created_at),
            "approved_at":             str(self.approved_at) if self.approved_at else None,
            "resolved_at":             str(self.resolved_at) if self.resolved_at else None,
        }
