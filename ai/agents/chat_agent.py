# ai/agents/chat_agent.py
# Uses Google Gemini via the new google-genai SDK

import os
import json
import logging
from google import genai
from google.genai import types
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
    Maintains multi-turn conversation history using Gemini Chat.
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

    # ── Set up Gemini client ───────────────────────────────────────────────────
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY missing from .env")

    client = genai.Client(api_key=api_key)

    # ── Convert history to Gemini format ──────────────────────────────────────
    # Gemini history format: [Content(role="user"/"model", parts=[Part(text=...)])]
    gemini_history = []
    for msg in trimmed_history:
        role = "model" if msg.get("role") == "assistant" else "user"
        gemini_history.append(
            types.Content(
                role=role,
                parts=[types.Part(text=msg.get("content", ""))]
            )
        )

    # ── Start chat with history and send message ───────────────────────────────
    try:
        chat = client.chats.create(
            model=MODEL_NAME,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                max_output_tokens=500,
                temperature=0.2,
            ),
            history=gemini_history
        )
        response = chat.send_message(operator_message)
        reply = response.text or ""

    except Exception as e:
        logger.error(f"Chat agent Gemini call failed: {str(e)}")
        raise

    # ── Update conversation history (keep in OpenAI-style format for API compat)
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
    Gemini answers from this data — never invents.
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