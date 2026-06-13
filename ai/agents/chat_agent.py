# ai/agents/chat_agent.py

import os
import json
import logging
from anthropic import Anthropic
from ai.agents.base_agent import (
    fetch_from_backend,
    current_timestamp,
    safe_get,
    MODEL_NAME
)

logger = logging.getLogger("railsentinel.chat_agent")

MAX_HISTORY_TURNS = 10   # keep last 10 turns to avoid context overflow

def run_chat(
    operator_message: str,
    conversation_history: list,
    context_filters: dict
) -> dict:
    """
    Operator Q&A agent.
    Answers questions about active incidents, sensor readings,
    agent decisions and system status using real pipeline data.
    Maintains multi-turn conversation history.
    """

    logger.info(
        f"Chat agent starting — "
        f"message:'{operator_message[:50]}' "
        f"history_turns:{len(conversation_history)}"
    )

    # ── Fetch relevant context ─────────────────────────────────────────────────
    context_data, context_used = _fetch_relevant_context(
        operator_message, context_filters
    )

    # ── Build system prompt with injected data ─────────────────────────────────
    system_prompt = _build_system_prompt(context_data)

    # ── Trim history to avoid token overflow ───────────────────────────────────
    trimmed_history = conversation_history[-(MAX_HISTORY_TURNS * 2):]

    # ── Build full messages array ──────────────────────────────────────────────
    messages = trimmed_history + [
        {"role": "user", "content": operator_message}
    ]

    # ── Call Claude with full conversation ────────────────────────────────────
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY missing from .env")

    client = Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model      = MODEL_NAME,
            max_tokens = 500,
            system     = system_prompt,
            messages   = messages
        )
        reply = response.content[0].text

    except Exception as e:
        logger.error(f"Chat agent Claude call failed: {str(e)}")
        raise

    # ── Update conversation history ────────────────────────────────────────────
    updated_history = trimmed_history + [
        {"role": "user",      "content": operator_message},
        {"role": "assistant", "content": reply}
    ]

    logger.info(
        f"Chat agent complete — "
        f"reply:'{reply[:60]}' "
        f"new_history_turns:{len(updated_history) // 2}"
    )

    return {
        "reply":           reply,
        "updated_history": updated_history,
        "context_used":    context_used
    }


def _fetch_relevant_context(
    operator_message: str,
    context_filters: dict
) -> tuple:
    """
    Pulls only what's relevant to the operator's question.
    Returns (context_data dict, context_used list).
    """

    context      = {}
    context_used = []

    # Specific pipeline result
    pipeline_id = safe_get(context_filters, "pipeline_id")
    if pipeline_id:
        data = fetch_from_backend(
            "/api/incidents/detail",
            params={"pipeline_id": pipeline_id}
        )
        if data:
            context["pipeline_detail"] = data
            context_used.append("pipeline_detail")

    # Recent incidents for a specific train
    train_id = safe_get(context_filters, "train_id")
    if train_id:
        data = fetch_from_backend(
            "/api/incidents/by-train",
            params={"train_id": train_id, "limit": 5}
        )
        if data:
            context["train_recent_incidents"] = data
            context_used.append("train_recent_incidents")

    # Platform status
    platform_id = safe_get(context_filters, "platform_id")
    if platform_id:
        data = fetch_from_backend(
            "/api/platforms/status",
            params={"platform_id": platform_id}
        )
        if data:
            context["platform_status"] = data
            context_used.append("platform_status")

    # Always include last 3 active incidents for general questions
    recent = fetch_from_backend(
        "/api/incidents/active",
        params={"limit": 3}
    )
    if recent:
        context["recent_active_incidents"] = recent
        context_used.append("recent_active_incidents")

    return context, context_used


def _build_system_prompt(context_data: dict) -> str:
    """
    Builds system prompt with real data injected.
    Claude answers from this data — never invents.
    """

    base = """You are the RailSentinel AI assistant for Indian Railways control room operators.
You answer questions about active incidents, sensor readings, agent decisions, and system status.

STRICT RULES:
- Answer ONLY based on the data provided in the SYSTEM DATA section below
- If the data does not contain the answer, say exactly: "I don't have that information in the current system data."
- Never invent train IDs, sensor values, priority scores, or incident details
- Keep answers concise — operators are busy — maximum 3 sentences per answer
- If asked about a specific train or incident not in the data, say so clearly
- You may explain what the AI agents did and why based on the data provided
- Use simple, clear English — no jargon
"""

    if not context_data:
        base += "\n\nSYSTEM DATA: No current data available."
        return base

    context_section = "\n\nSYSTEM DATA:\n"
    context_section += "=" * 40 + "\n"

    for key, value in context_data.items():
        context_section += f"\n{key.upper().replace('_', ' ')}:\n"
        context_section += json.dumps(value, indent=2)
        context_section += "\n"

    context_section += "=" * 40

    return base + context_section