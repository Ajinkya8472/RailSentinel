"""
notification_model.py — SQLAlchemy model for the `notifications` table.
Every alert dispatched (SMS, voice, PDF email) is logged here.
"""

from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.sql import func
from models.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    incident_id     = Column(Integer, nullable=True, index=True)
    train_id        = Column(String,  nullable=True)

    # Notification metadata
    type            = Column(String,  nullable=False)
    # "sms_station_master" | "sms_drm" | "loco_pilot_radio"
    # "hindi_voice" | "pdf_report" | "websocket_broadcast"

    recipient       = Column(String,  nullable=True)  # name/role/number
    recipient_role  = Column(String,  nullable=True)  # "Station Master" | "DRM" | "Loco Pilot"

    message         = Column(Text,    nullable=False)
    language        = Column(String,  nullable=False, default="en")  # "en" | "hi"

    priority        = Column(Integer, nullable=True)   # mirrors incident priority
    delivered       = Column(Boolean, nullable=False, default=False)
    delivery_error  = Column(String,  nullable=True)

    sent_at         = Column(DateTime, server_default=func.now())

    def to_dict(self):
        return {
            "id":             self.id,
            "incident_id":    self.incident_id,
            "train_id":       self.train_id,
            "type":           self.type,
            "recipient":      self.recipient,
            "recipient_role": self.recipient_role,
            "message":        self.message,
            "language":       self.language,
            "priority":       self.priority,
            "delivered":      self.delivered,
            "delivery_error": self.delivery_error,
            "sent_at":        str(self.sent_at),
        }
