# ai/agents/base_agent.py
# Uses Google Gemini via the new google-genai SDK

from google import genai
from google.genai import types
import os
import json
import sqlite3
import time
import uuid
import logging
import re
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# ── Constants ──────────────────────────────────────────────────────────────────

BASE_DIR       = Path(__file__).resolve().parent.parent
PROMPTS_DIR    = BASE_DIR / "prompts"
CONTEXT_DIR    = BASE_DIR / "context"
DB_PATH        = BASE_DIR / "railsentinel_audit.db"
MODEL_NAME     = "gemini-2.0-flash"   # fast, capable — swap to gemini-1.5-pro for heavier tasks
DEFAULT_TOKENS = 1000
MAX_RETRIES    = 2
RETRY_DELAY    = 5

# ── Logging ────────────────────────────────────────────────────────────────────

logger = logging.getLogger("railsentinel.base")
logger.setLevel(logging.DEBUG)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] → %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)

# ── Database Initialisation ────────────────────────────────────────────────────

def init_db():
    """
    Creates SQLite audit database and all tables if they don't exist.
    Call this once when the FastAPI app starts.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS pipeline_runs (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            pipeline_id             TEXT NOT NULL UNIQUE,
            train_id                TEXT NOT NULL,
            mode                    TEXT NOT NULL,
            severity                INTEGER,
            confidence_pct          INTEGER,
            recommended_action      TEXT,
            hindi_alert_text        TEXT,
            requires_human_approval INTEGER DEFAULT 0,
            status                  TEXT NOT NULL,
            duration_seconds        REAL,
            timestamp               TEXT NOT NULL,
            created_at              TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS agent_calls (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            call_id       TEXT NOT NULL UNIQUE,
            pipeline_id   TEXT,
            agent_name    TEXT NOT NULL,
            tokens_used   INTEGER,
            duration_ms   REAL,
            success       INTEGER DEFAULT 1,
            error_message TEXT,
            timestamp     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notification_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            pipeline_id TEXT NOT NULL,
            recipient   TEXT NOT NULL,
            channel     TEXT NOT NULL,
            content     TEXT,
            sent_at     TEXT NOT NULL
        );
    """)

    conn.commit()
    conn.close()
    logger.info(f"Database initialised at {DB_PATH}")

# ── Core Gemini API Call ───────────────────────────────────────────────────────

def call_claude(
    system_prompt,
    user_message,
    tools=None,
    max_tokens=DEFAULT_TOKENS,
    agent_name="unknown",
    pipeline_id=None
):
    """
    Single entry point for every Gemini API call in the system.
    Function kept as call_claude() so all existing agents work without changes.
    Returns dict: { type, content, tokens_used }
    """

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment")
        raise EnvironmentError("GEMINI_API_KEY missing from .env")

    client = genai.Client(api_key=api_key)

    call_id    = str(uuid.uuid4())
    start_time = time.time()
    attempt    = 0

    while attempt < MAX_RETRIES:
        try:
            logger.debug(
                f"Gemini call → agent:{agent_name} "
                f"attempt:{attempt + 1} pipeline:{pipeline_id}"
            )

            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=user_message,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    max_output_tokens=max_tokens,
                    temperature=0.2,
                )
            )

            duration_ms = (time.time() - start_time) * 1000

            # Gemini returns usage metadata
            try:
                tokens_used = (
                    response.usage_metadata.prompt_token_count +
                    response.usage_metadata.candidates_token_count
                )
            except Exception:
                tokens_used = 0

            text_content = response.text if response.text else ""

            result = {
                "type":        "text",
                "content":     text_content,
                "tokens_used": tokens_used
            }

            _log_agent_call(
                call_id=call_id, pipeline_id=pipeline_id,
                agent_name=agent_name, tokens_used=tokens_used,
                duration_ms=duration_ms, success=True, error=None
            )

            logger.debug(
                f"Gemini call success → tokens:{tokens_used} "
                f"duration:{duration_ms:.0f}ms"
            )
            return result

        except Exception as e:
            err_str = str(e).lower()
            attempt += 1

            if "quota" in err_str or "rate" in err_str or "429" in err_str:
                logger.warning(
                    f"Rate limit hit — waiting {RETRY_DELAY}s "
                    f"(attempt {attempt}/{MAX_RETRIES})"
                )
                if attempt >= MAX_RETRIES:
                    _log_agent_call(
                        call_id=call_id, pipeline_id=pipeline_id,
                        agent_name=agent_name, tokens_used=0,
                        duration_ms=(time.time() - start_time) * 1000,
                        success=False, error="RateLimitError after retries"
                    )
                    raise RuntimeError("Gemini rate limit exceeded after retries")
                time.sleep(RETRY_DELAY)

            elif "connect" in err_str or "network" in err_str or "unreachable" in err_str:
                _log_agent_call(
                    call_id=call_id, pipeline_id=pipeline_id,
                    agent_name=agent_name, tokens_used=0,
                    duration_ms=(time.time() - start_time) * 1000,
                    success=False, error=f"ConnectionError: {str(e)}"
                )
                logger.error(f"Gemini API unreachable: {str(e)}")
                raise ConnectionError(f"Cannot reach Gemini API: {str(e)}")

            else:
                _log_agent_call(
                    call_id=call_id, pipeline_id=pipeline_id,
                    agent_name=agent_name, tokens_used=0,
                    duration_ms=(time.time() - start_time) * 1000,
                    success=False, error=f"Unexpected: {str(e)}"
                )
                logger.error(f"Unexpected error in Gemini call: {str(e)}")
                raise

# ── JSON Parsing ───────────────────────────────────────────────────────────────

def parse_json_response(raw_text):
    """
    Safely extracts JSON from Gemini's response.
    Handles markdown fences, mixed text, and malformed output.
    Returns a Python dict always — never raises.
    """
    if not raw_text or not raw_text.strip():
        logger.warning("parse_json_response received empty text")
        return {"error": "empty_response", "raw": ""}

    cleaned = raw_text.strip()

    # Strip ```json ... ``` fences
    match = re.search(r'```json\s*([\s\S]*?)\s*```', cleaned)
    if match:
        cleaned = match.group(1).strip()
    else:
        # Strip plain ``` ... ``` fences
        match = re.search(r'```\s*([\s\S]*?)\s*```', cleaned)
        if match:
            cleaned = match.group(1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Try to find a JSON object anywhere in the text
        match = re.search(r'\{[\s\S]*\}', cleaned)
        if match:
            try:
                parsed = json.loads(match.group(0))
                logger.warning("JSON extracted from mixed response")
                return parsed
            except json.JSONDecodeError:
                pass

        logger.error(f"JSON parse failed: {str(e)}")
        logger.debug(f"Raw text that failed: {raw_text[:300]}")
        return {
            "error":     "json_parse_failed",
            "raw":       raw_text[:500],
            "parse_err": str(e)
        }


def validate_json_keys(parsed_dict, required_keys):
    """
    Checks that a parsed JSON dict has all required keys.
    Returns (is_valid: bool, missing_keys: list)
    """
    if "error" in parsed_dict:
        return False, ["__parse_error__"]

    missing = [k for k in required_keys if k not in parsed_dict]

    if missing:
        logger.warning(f"JSON missing required keys: {missing}")
        return False, missing

    return True, []

# ── Prompt Loading ─────────────────────────────────────────────────────────────

def load_prompt(filename):
    """
    Reads a .txt prompt file from the /prompts/ directory.
    Raises FileNotFoundError with a clear message if missing.
    """
    path = PROMPTS_DIR / filename

    if not path.exists():
        logger.error(f"Prompt file not found: {path}")
        raise FileNotFoundError(
            f"Prompt file missing: {filename}. Expected at: {path}"
        )

    with open(path, encoding="utf-8") as f:
        content = f.read()

    if not content.strip():
        logger.warning(f"Prompt file is empty: {filename}")

    logger.debug(f"Loaded prompt: {filename} ({len(content)} chars)")
    return content

# ── Few-Shot Example Loading ───────────────────────────────────────────────────

def load_few_shot_examples(filename):
    """
    Reads a .json file from context/few_shot/.
    Returns list of example dicts.
    Returns empty list if file missing — non-fatal.
    """
    path = CONTEXT_DIR / "few_shot" / filename

    if not path.exists():
        logger.warning(
            f"Few-shot file not found: {filename}. "
            f"Proceeding without examples."
        )
        return []

    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, list):
            logger.warning(
                f"Few-shot file {filename} is not a list. Wrapping."
            )
            return [data]

        logger.debug(
            f"Loaded {len(data)} few-shot examples from {filename}"
        )
        return data

    except json.JSONDecodeError as e:
        logger.error(
            f"Few-shot file {filename} has invalid JSON: {str(e)}"
        )
        return []


def format_few_shot_examples(examples):
    """
    Converts list of few-shot example dicts into a
    readable string to inject into the user message.
    """
    if not examples:
        return ""

    lines = ["--- REFERENCE EXAMPLES ---"]
    for i, example in enumerate(examples):
        lines.append(f"Example {i + 1}:")
        lines.append(json.dumps(example, indent=2))
        lines.append("")
    lines.append("--- END OF EXAMPLES ---")

    return "\n".join(lines)

# ── Audit Logging ──────────────────────────────────────────────────────────────

def _log_agent_call(
    call_id, pipeline_id, agent_name,
    tokens_used, duration_ms, success, error
):
    """
    Private. Writes one record to agent_calls table.
    Non-fatal — if this fails the pipeline continues.
    """
    try:
        conn   = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO agent_calls
            (call_id, pipeline_id, agent_name, tokens_used,
             duration_ms, success, error_message, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            call_id,
            pipeline_id,
            agent_name,
            tokens_used,
            round(duration_ms, 2),
            1 if success else 0,
            error,
            current_timestamp()
        ))
        conn.commit()
    except Exception as e:
        logger.warning(f"Failed to write agent call log: {str(e)}")
    finally:
        try:
            conn.close()
        except Exception:
            pass


def save_pipeline_result(result_dict):
    """
    Writes a completed pipeline result to pipeline_runs table.
    Called by pipeline_runner after all 5 agents complete.
    Raises on failure — losing a pipeline result is serious.
    """
    try:
        conn   = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO pipeline_runs
            (pipeline_id, train_id, mode, severity, confidence_pct,
             recommended_action, hindi_alert_text,
             requires_human_approval, status,
             duration_seconds, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result_dict.get("pipeline_id"),
            result_dict.get("train_id"),
            result_dict.get("mode"),
            result_dict.get("severity"),
            result_dict.get("confidence"),
            result_dict.get("recommended_action"),
            result_dict.get("hindi_alert_text"),
            1 if result_dict.get("requires_human_approval") else 0,
            result_dict.get("status"),
            result_dict.get("duration_seconds"),
            result_dict.get("timestamp")
        ))
        conn.commit()
        logger.info(
            f"Pipeline result saved: {result_dict.get('pipeline_id')}"
        )
    except Exception as e:
        logger.error(f"Failed to save pipeline result: {str(e)}")
        raise
    finally:
        try:
            conn.close()
        except Exception:
            pass


def save_notification_log(pipeline_id, notifications):
    """
    Writes each notification to notification_log table.
    Called by m5_notification_agent after dispatching.
    Non-fatal.
    """
    try:
        conn   = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        for n in notifications:
            cursor.execute("""
                INSERT INTO notification_log
                (pipeline_id, recipient, channel, content, sent_at)
                VALUES (?, ?, ?, ?, ?)
            """, (
                pipeline_id,
                n.get("recipient"),
                n.get("channel"),
                json.dumps(n.get("content")),
                n.get("sent_at")
            ))
        conn.commit()
        logger.info(
            f"Saved {len(notifications)} notifications "
            f"for pipeline {pipeline_id}"
        )
    except Exception as e:
        logger.warning(f"Failed to save notification log: {str(e)}")
    finally:
        try:
            conn.close()
        except Exception:
            pass

# ── Backend HTTP Helper ────────────────────────────────────────────────────────

def get_backend_url():
    """Returns backend base URL from environment."""
    return os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")


def fetch_from_backend(endpoint, params=None):
    """
    Makes a synchronous GET request to the backend.
    Returns parsed JSON dict or None on failure.
    """
    import httpx

    url = get_backend_url() + endpoint

    try:
        response = httpx.get(url, params=params, timeout=10.0)

        if response.status_code != 200:
            logger.warning(
                f"Backend returned {response.status_code} for {endpoint}"
            )
            return None

        return response.json()

    except httpx.TimeoutException:
        logger.warning(f"Backend timeout on {endpoint}")
        return None

    except httpx.ConnectError:
        logger.error(f"Cannot connect to backend at {url}")
        return None

    except Exception as e:
        logger.error(
            f"Unexpected error fetching {endpoint}: {str(e)}"
        )
        return None

# ── Utilities ──────────────────────────────────────────────────────────────────

def generate_id():
    """
    Generates a short unique ID.
    Format: 8 uppercase hex characters. Example: A3F9B12C
    """
    return str(uuid.uuid4()).replace("-", "")[:8].upper()


def current_timestamp():
    """
    Returns current UTC time as ISO 8601 string.
    Example: 2026-06-09T10:45:32.123456+00:00
    """
    return datetime.now(timezone.utc).isoformat()


def safe_get(dictionary, key, default=None):
    """
    Safe dict access with a default.
    Prevents KeyError crashes in agent output parsing.
    """
    try:
        value = dictionary[key]
        return default if value is None else value
    except (KeyError, TypeError):
        return default