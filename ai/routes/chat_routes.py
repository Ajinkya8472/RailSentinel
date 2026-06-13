# ai/routes/chat_routes.py

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ai.agents.chat_agent import run_chat

logger = logging.getLogger("railsentinel.routes.chat")

router = APIRouter()

# ── Request Model ──────────────────────────────────────────────────────────────

class ContextFilters(BaseModel):
    train_id:    Optional[str] = None
    pipeline_id: Optional[str] = None
    platform_id: Optional[str] = None

class ChatRequest(BaseModel):
    message:              str
    conversation_history: list          = []
    context_filters:      ContextFilters = ContextFilters()

# ── Response Model ─────────────────────────────────────────────────────────────

class ChatResponse(BaseModel):
    reply:            str
    updated_history:  list
    context_used:     list

# ── Route ──────────────────────────────────────────────────────────────────────

@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Operator Q&A chat agent",
    description=(
        "Frontend calls this directly when operator types a question. "
        "Answers questions about active incidents, sensor readings, "
        "agent decisions and system status using real pipeline data. "
        "Maintains conversation history for multi-turn dialogue."
    )
)
def run_chat_route(request: ChatRequest):
    """
    POST /api/ai/chat
    Called directly by frontend when operator asks a question.
    Returns reply text and updated conversation history.
    """

    if not request.message or not request.message.strip():
        raise HTTPException(
            status_code=422,
            detail="message cannot be empty"
        )

    logger.info(
        f"Chat route called — "
        f"message:'{request.message[:50]}...' "
        f"history_length:{len(request.conversation_history)}"
    )

    try:
        result = run_chat(
            operator_message     = request.message.strip(),
            conversation_history = request.conversation_history,
            context_filters      = request.context_filters.dict()
        )
    except ConnectionError as e:
        logger.error(f"Claude API unreachable: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service unreachable: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Chat error: {str(e)}"
        )

    logger.info(
        f"Chat route complete — "
        f"reply:'{result.get('reply', '')[:50]}...'"
    )

    return result