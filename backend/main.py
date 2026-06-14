"""
main.py — RailSentinel Backend Entry Point

Starts FastAPI on port 8000 with:
  - CORS for frontend (localhost:5173)
  - All route routers mounted
  - WebSocket /ws/live endpoint
  - Lifespan: DB init, train seed, simulator loop, sensor loop, risk loop
  - Optional Arduino reader (set ARDUINO_PORT=COM3 in .env to enable)

Run: uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# ── Logging ──────────────────────────────────────────────────────────── #
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("railsentinel")


# ── Lifespan (replaces deprecated @app.on_event) ─────────────────────── #

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── STARTUP ─────────────────────────────────────────────────────── #
    logger.info("=" * 60)
    logger.info("  RailSentinel Backend starting up...")
    logger.info("=" * 60)

    # 1. Initialize database (create all tables)
    from models.database import init_db
    init_db()

    # 2. Seed trains from routes JSON (idempotent)
    from services.train_simulator import seed_trains
    seed_trains()

    # 3. Launch background tasks
    from services.train_simulator  import move_trains
    from services.sensor_generator import run_sensor_loop
    from services.risk_aggregator  import run_risk_loop

    tasks = [
        asyncio.create_task(move_trains(),     name="train-simulator"),
        asyncio.create_task(run_sensor_loop(), name="sensor-generator"),
        asyncio.create_task(run_risk_loop(),   name="risk-aggregator"),
    ]

    # 4. Optional Arduino hardware reader
    #    Only activates when ARDUINO_PORT is explicitly set (not COM3 default)
    arduino_port = os.getenv("ARDUINO_PORT", "").strip()
    if arduino_port:
        from hardware.arduino_reader import run_arduino_reader
        tasks.append(asyncio.create_task(run_arduino_reader(), name="arduino-reader"))
        logger.info(f"[Startup] Arduino reader started on port {arduino_port}")
    else:
        logger.info("[Startup] Arduino reader disabled (set ARDUINO_PORT in .env to enable).")

    # 5. Initial crowd calculation so first API call isn't empty
    from services.crowd_calculator import calculate_and_save
    calculate_and_save()

    logger.info("[Startup] All systems live.")
    logger.info("[Startup] API  -> http://localhost:8000")
    logger.info("[Startup] Docs -> http://localhost:8000/docs")
    logger.info("[Startup] WS   -> ws://localhost:8000/ws/live")

    yield  # ── server is running ──

    # ── SHUTDOWN ─────────────────────────────────────────────────────── #
    logger.info("[Shutdown] Cancelling background tasks...")
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("[Shutdown] RailSentinel Backend stopped cleanly.")


# ── App ──────────────────────────────────────────────────────────────── #

app = FastAPI(
    title="RailSentinel Backend",
    description="India's Autonomous Railway Intelligence Platform — Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────── #

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",    # Vite dev server
        "http://localhost:3000",    # fallback
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────── #

from routes.train_routes        import router as trains_router
from routes.incident_routes     import router as incidents_router
from routes.crowd_routes        import router as crowd_router
from routes.schedule_routes     import router as schedule_router
from routes.energy_routes       import router as energy_router
from routes.risk_routes         import router as risk_router
from routes.notification_routes import router as notifications_router
from routes.chat_routes         import router as chat_router

app.include_router(trains_router)
app.include_router(incidents_router)
app.include_router(crowd_router)
app.include_router(schedule_router)
app.include_router(energy_router)
app.include_router(risk_router)
app.include_router(notifications_router)
app.include_router(chat_router)

# ── WebSocket ────────────────────────────────────────────────────────── #

from websocket.ws_manager import manager


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """
    Primary WebSocket endpoint. Frontend connects here to receive:
      - connected       (handshake on join)
      - train_update    (every 3 s — all train positions)
      - new_incident    (when AI pipeline fires)
      - incident_update (approve / reject status change)
      - sensor_spike    (raw spike broadcast before AI completes)
      - risk_update     (every 30 s — composite risk scores)
    """
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive.
            # The frontend can optionally send ping messages; we ignore them.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("[WS] Client disconnected gracefully.")
    except Exception as e:
        manager.disconnect(websocket)
        logger.warning(f"[WS] Client dropped unexpectedly: {e}")


# ── Health & Root ────────────────────────────────────────────────────── #

@app.get("/health", tags=["Health"])
def health():
    """Quick liveness check — also returns active WebSocket client count."""
    return {
        "status":     "ok",
        "service":    "railsentinel-backend",
        "version":    "1.0.0",
        "ws_clients": manager.connection_count,
    }


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "RailSentinel Backend is running",
        "docs":    "http://localhost:8000/docs",
        "ws":      "ws://localhost:8000/ws/live",
    }
