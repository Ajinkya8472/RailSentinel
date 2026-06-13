# ai/main.py

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai.agents.base_agent import init_db
from ai.routes.pipeline_routes  import router as pipeline_router
from ai.routes.predictive_routes import router as predictive_router
from ai.routes.crowd_routes      import router as crowd_router
from ai.routes.conflict_routes   import router as conflict_router
from ai.routes.risk_routes       import router as risk_router
from ai.routes.chat_routes       import router as chat_router
from ai.routes.notify_routes     import router as notify_router

# ── Logging ────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(asctime)s] [%(levelname)s] [%(name)s] → %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("railsentinel.main")

# ── Startup ────────────────────────────────────────────────────────────────────

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RailSentinel AI starting up...")
    init_db()
    logger.info("All systems ready.")
    yield

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "RailSentinel AI API",
    description = (
        "Multi-agent AI backend for RailSentinel — "
        "India's Autonomous Railway Intelligence Platform. "
        "FAR AWAY 2026 Hackathon."
    ),
    version     = "1.0.0",
    lifespan    = lifespan
)

# ── CORS — allow frontend and backend to call this ─────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"]
)

# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", summary="Health check")
def health():
    return {
        "status":  "ok",
        "service": "RailSentinel AI",
        "version": "1.0.0"
    }

# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(pipeline_router,   prefix="/api/ai", tags=["Pipeline"])
app.include_router(predictive_router, prefix="/api/ai", tags=["Predictive"])
app.include_router(crowd_router,      prefix="/api/ai", tags=["Crowd"])
app.include_router(conflict_router,   prefix="/api/ai", tags=["Conflict"])
app.include_router(risk_router,       prefix="/api/ai", tags=["Risk"])
app.include_router(chat_router,       prefix="/api/ai", tags=["Chat"])
app.include_router(notify_router,     prefix="/api/ai", tags=["Notify"])


@app.get("/debug/agent1")
def debug_agent1():
    try:
        from ai.agents.pipeline.agent1_detector import run
        return {"status": "import_ok"}
    except Exception as e:
        return {"status": "import_failed", "error": str(e)}