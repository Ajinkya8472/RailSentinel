"""
database.py — SQLAlchemy engine, Base, session factory, and get_db() dependency.
All table models are imported from their individual files to register with Base.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./railsentinel.db")

# connect_args is needed for SQLite only (allows multi-thread access)
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,            # set True for SQL query logs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call once at app startup."""
    # import all models so Base knows about them before create_all()
    from models.train_model        import Train          # noqa: F401
    from models.incident_model     import Incident       # noqa: F401
    from models.sensor_model       import SensorLog      # noqa: F401
    from models.notification_model import Notification   # noqa: F401
    from models.crowd_model        import PlatformOccupancy  # noqa: F401

    Base.metadata.create_all(bind=engine)
    print("[DB] All tables created / verified.")
