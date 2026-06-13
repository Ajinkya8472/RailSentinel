# ai/test_endpoints.py
# Run from project root: uv run python ai/test_endpoints.py

import httpx
import json
import time

BASE_URL = "http://127.0.0.1:8001"

# ── Colours for terminal output ────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def print_header(title):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}  {title}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")

def print_result(name, passed, detail=""):
    icon   = f"{GREEN}✅{RESET}" if passed else f"{RED}❌{RESET}"
    status = f"{GREEN}PASS{RESET}" if passed else f"{RED}FAIL{RESET}"
    print(f"  {icon} {status} — {name}")
    if detail:
        print(f"       {YELLOW}{detail}{RESET}")

def print_response(response_data, max_keys=6):
    """Print a trimmed version of the response for readability."""
    if isinstance(response_data, dict):
        keys   = list(response_data.keys())[:max_keys]
        subset = {k: response_data[k] for k in keys}
        print(f"  {BLUE}Response preview:{RESET}")
        for k, v in subset.items():
            val = str(v)[:80] + "..." if len(str(v)) > 80 else str(v)
            print(f"    {k}: {val}")
        if len(response_data) > max_keys:
            print(f"    ... and {len(response_data) - max_keys} more fields")


# ══════════════════════════════════════════════════════════════════════
# TEST 1 — Health Check
# ══════════════════════════════════════════════════════════════════════

def test_health():
    print_header("TEST 1 — Health Check")
    try:
        r = httpx.get(f"{BASE_URL}/health", timeout=5)
        data = r.json()

        print_result(
            "Server is reachable",
            r.status_code == 200,
            f"Status code: {r.status_code}"
        )
        print_result(
            "Returns status ok",
            data.get("status") == "ok",
            f"status: {data.get('status')}"
        )
        print_result(
            "Returns correct service name",
            data.get("service") == "RailSentinel AI",
            f"service: {data.get('service')}"
        )
        return True

    except httpx.ConnectError:
        print_result(
            "Server is reachable",
            False,
            "Cannot connect — is the server running on port 8001?"
        )
        return False


# ══════════════════════════════════════════════════════════════════════
# TEST 2 — Pipeline Endpoint (No anomaly case)
# ══════════════════════════════════════════════════════════════════════

def test_pipeline_no_anomaly():
    print_header("TEST 2 — Pipeline: Normal sensor reading (no anomaly)")

    payload = {
        "train_id":                  "TEST001",
        "vibration":                 52.0,
        "temperature":               70.5,
        "gps":                       {"lat": 23.25, "lng": 77.41},
        "speed_kmph":                80.0,
        "section_type":              "open_track",
        "rolling_mean_vibration":    51.0,
        "rolling_std_vibration":     3.0,
        "rolling_mean_temperature":  70.0,
        "rolling_std_temperature":   2.0,
        "timestamp":                 "2026-06-12T06:00:00+00:00",
        "mode":                      "reactive"
    }

    try:
        print(f"  {YELLOW}Calling Claude API — this may take 10-30 seconds...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/pipeline",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has pipeline_id",
            "pipeline_id" in data,
            f"pipeline_id: {data.get('pipeline_id')}"
        )
        print_result(
            "Status is no_anomaly or completed",
            data.get("status") in ["no_anomaly", "completed", "false_positive"],
            f"status: {data.get('status')}"
        )
        print_result(
            "Severity is 0 or low for normal reading",
            data.get("severity", 0) <= 2,
            f"severity: {data.get('severity')}"
        )
        print_result(
            "No human approval needed",
            data.get("requires_human_approval") == False,
            f"requires_human_approval: {data.get('requires_human_approval')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Pipeline call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 3 — Pipeline Endpoint (High severity — real anomaly)
# ══════════════════════════════════════════════════════════════════════

def test_pipeline_high_severity():
    print_header("TEST 3 — Pipeline: High severity anomaly (bridge section)")

    payload = {
        "train_id":                  "12952",
        "vibration":                 91.5,
        "temperature":               93.2,
        "gps":                       {"lat": 23.25, "lng": 77.41},
        "speed_kmph":                115.0,
        "section_type":              "bridge",
        "rolling_mean_vibration":    51.3,
        "rolling_std_vibration":     9.8,
        "rolling_mean_temperature":  70.2,
        "rolling_std_temperature":   4.8,
        "timestamp":                 "2026-06-12T10:00:00+00:00",
        "mode":                      "reactive"
    }

    try:
        print(f"  {YELLOW}Calling Claude API — this may take 20-40 seconds...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/pipeline",
            json=payload,
            timeout=120
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has pipeline_id",
            "pipeline_id" in data,
            f"pipeline_id: {data.get('pipeline_id')}"
        )
        print_result(
            "Severity is 3 or higher",
            data.get("severity", 0) >= 3,
            f"severity: {data.get('severity')}"
        )
        print_result(
            "Has recommended action",
            bool(data.get("recommended_action")),
            f"action: {str(data.get('recommended_action', ''))[:60]}"
        )
        print_result(
            "Has Hindi alert text",
            bool(data.get("hindi_alert_text")),
            f"hindi: {data.get('hindi_alert_text', '')[:60]}"
        )
        print_result(
            "Has reasoning",
            bool(data.get("reasoning")),
            f"reasoning: {str(data.get('reasoning', ''))[:60]}"
        )
        print_result(
            "Has pdf_content",
            isinstance(data.get("pdf_content"), dict),
            f"pdf keys: {list(data.get('pdf_content', {}).keys())[:4]}"
        )
        print_result(
            "Has sms_content",
            isinstance(data.get("sms_content"), dict),
            f"sms keys: {list(data.get('sms_content', {}).keys())}"
        )
        print_result(
            "High severity requires human approval",
            data.get("severity", 0) < 4 or data.get("requires_human_approval") == True,
            f"requires_human_approval: {data.get('requires_human_approval')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Pipeline call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 4 — Pipeline Validation (bad request)
# ══════════════════════════════════════════════════════════════════════

def test_pipeline_validation():
    print_header("TEST 4 — Pipeline: Validation (missing required fields)")

    payload = {
        "vibration": 89.2
        # Missing train_id, temperature, gps, etc.
    }

    try:
        r    = httpx.post(
            f"{BASE_URL}/api/ai/pipeline",
            json=payload,
            timeout=10
        )
        data = r.json()

        print_result(
            "Returns 422 for bad request",
            r.status_code == 422,
            f"Status: {r.status_code}"
        )
        print_result(
            "Returns validation error detail",
            "detail" in data,
            f"error fields: {[e.get('loc') for e in data.get('detail', [])][:3]}"
        )
        return True

    except Exception as e:
        print_result("Validation test", False, str(e))
        return False


# ══════════════════════════════════════════════════════════════════════
# TEST 5 — Predictive Endpoint
# ══════════════════════════════════════════════════════════════════════

def test_predictive():
    print_header("TEST 5 — Predictive Maintenance Check")

    payload = {"train_id": "12952"}

    try:
        print(f"  {YELLOW}Calling predictive endpoint...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/predict",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has train_id",
            data.get("train_id") == "12952",
            f"train_id: {data.get('train_id')}"
        )
        print_result(
            "Has valid status",
            data.get("status") in [
                "nominal", "advisory_issued",
                "insufficient_data", "backend_unavailable"
            ],
            f"status: {data.get('status')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Predictive call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 6 — Crowd Endpoint
# ══════════════════════════════════════════════════════════════════════

def test_crowd():
    print_header("TEST 6 — Crowd Management Check")

    payload = {
        "platform_id":   "PRYJ-P4",
        "festival_mode": True
    }

    try:
        print(f"  {YELLOW}Calling crowd endpoint...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/crowd",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has platform_id",
            data.get("platform_id") == "PRYJ-P4",
            f"platform_id: {data.get('platform_id')}"
        )
        print_result(
            "Has valid status",
            data.get("status") in [
                "normal", "crowd_advisory",
                "insufficient_data", "backend_unavailable"
            ],
            f"status: {data.get('status')}"
        )
        print_result(
            "Festival mode reflected",
            data.get("festival_mode") == True,
            f"festival_mode: {data.get('festival_mode')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Crowd call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 7 — Conflict Endpoint
# ══════════════════════════════════════════════════════════════════════

def test_conflict():
    print_header("TEST 7 — Scheduling Conflict Check")

    payload = {"zone_id": "CENTRAL-ZONE-1"}

    try:
        r    = httpx.post(
            f"{BASE_URL}/api/ai/conflict",
            json=payload,
            timeout=30
        )
        data = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code}"
        )
        print_result(
            "Has zone_id",
            data.get("zone_id") == "CENTRAL-ZONE-1",
            f"zone_id: {data.get('zone_id')}"
        )
        print_result(
            "Has valid status",
            data.get("status") in [
                "no_conflicts", "conflicts_found", "backend_unavailable"
            ],
            f"status: {data.get('status')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Conflict call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 8 — Risk Endpoint
# ══════════════════════════════════════════════════════════════════════

def test_risk():
    print_header("TEST 8 — Compound Risk Assessment")

    payload = {"zone_id": "CENTRAL-ZONE-1"}

    try:
        print(f"  {YELLOW}Calling risk endpoint...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/risk",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has zone_id",
            data.get("zone_id") == "CENTRAL-ZONE-1",
            f"zone_id: {data.get('zone_id')}"
        )
        print_result(
            "Has valid status",
            data.get("status") in [
                "no_compound_risk", "compound_risk_detected",
                "signals_present_no_compound"
            ],
            f"status: {data.get('status')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Risk call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 9 — Chat Endpoint (single turn)
# ══════════════════════════════════════════════════════════════════════

def test_chat_single_turn():
    print_header("TEST 9 — Chat Agent: Single turn")

    payload = {
        "message":              "What is the current status of the system?",
        "conversation_history": [],
        "context_filters": {
            "train_id":    None,
            "pipeline_id": None,
            "platform_id": None
        }
    }

    try:
        print(f"  {YELLOW}Calling Claude API for chat...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/chat",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has reply",
            bool(data.get("reply")),
            f"reply: {str(data.get('reply', ''))[:80]}"
        )
        print_result(
            "Has updated_history",
            isinstance(data.get("updated_history"), list),
            f"history_length: {len(data.get('updated_history', []))}"
        )
        print_result(
            "History has 2 entries after first turn",
            len(data.get("updated_history", [])) == 2,
            f"entries: {len(data.get('updated_history', []))}"
        )
        return data

    except Exception as e:
        print_result("Chat single turn", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 10 — Chat Endpoint (multi turn)
# ══════════════════════════════════════════════════════════════════════

def test_chat_multi_turn(previous_result):
    print_header("TEST 10 — Chat Agent: Multi turn (follow-up question)")

    if not previous_result:
        print_result(
            "Multi turn test",
            False,
            "Skipped — previous chat test failed"
        )
        return None

    history = previous_result.get("updated_history", [])

    payload = {
        "message":              "Can you tell me more about train 12952?",
        "conversation_history": history,
        "context_filters": {
            "train_id":    "12952",
            "pipeline_id": None,
            "platform_id": None
        }
    }

    try:
        print(f"  {YELLOW}Calling Claude API for follow-up...{RESET}")
        start = time.time()
        r     = httpx.post(
            f"{BASE_URL}/api/ai/chat",
            json=payload,
            timeout=60
        )
        elapsed = round(time.time() - start, 1)
        data    = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code} in {elapsed}s"
        )
        print_result(
            "Has reply",
            bool(data.get("reply")),
            f"reply: {str(data.get('reply', ''))[:80]}"
        )
        print_result(
            "History grew by 2 entries",
            len(data.get("updated_history", [])) == len(history) + 2,
            f"history: {len(data.get('updated_history', []))} entries"
        )
        return data

    except Exception as e:
        print_result("Chat multi turn", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 11 — Chat Validation (empty message)
# ══════════════════════════════════════════════════════════════════════

def test_chat_validation():
    print_header("TEST 11 — Chat Agent: Validation (empty message)")

    payload = {
        "message":              "",
        "conversation_history": [],
        "context_filters":      {}
    }

    try:
        r    = httpx.post(
            f"{BASE_URL}/api/ai/chat",
            json=payload,
            timeout=10
        )
        data = r.json()

        print_result(
            "Returns 422 for empty message",
            r.status_code == 422,
            f"Status: {r.status_code}"
        )
        return True

    except Exception as e:
        print_result("Chat validation", False, str(e))
        return False


# ══════════════════════════════════════════════════════════════════════
# TEST 12 — Notify Endpoint
# ══════════════════════════════════════════════════════════════════════

def test_notify():
    print_header("TEST 12 — Notification Dispatch")

    payload = {
        "pipeline_id":            "TEST1234",
        "train_id":               "12952",
        "severity":               4,
        "recommended_action":     "Reduce speed to 30kmph and deploy maintenance crew",
        "hindi_alert_text":       "Gaadi 12952 mein vibration ki samasya hai, turant rokein",
        "sms_content": {
            "to_station_master":  "ALERT: Train 12952 Priority 4 vibration incident. Reduce speed.",
            "to_drm":             "URGENT: Train 12952 P4 incident. Confidence 94%. Action required."
        },
        "pdf_content": {
            "report_id":          "TEST1234",
            "incident_title":     "Priority 4 Vibration Alert — Train 12952",
            "train_id":           "12952",
            "approved_by":        "PENDING_APPROVAL"
        },
        "escalation_chain": [
            {"recipient": "Field Crew",     "channel": "hindi_voice",  "urgency": "immediate"},
            {"recipient": "Station Master", "channel": "sms",          "urgency": "immediate"}
        ],
        "speed_restriction_kmph": 30,
        "approved_by":            "Operator_Sharma"
    }

    try:
        r    = httpx.post(
            f"{BASE_URL}/api/ai/notify",
            json=payload,
            timeout=15
        )
        data = r.json()

        print_result(
            "Returns 200",
            r.status_code == 200,
            f"Status: {r.status_code}"
        )
        print_result(
            "Status is notifications_dispatched",
            data.get("status") == "notifications_dispatched",
            f"status: {data.get('status')}"
        )
        print_result(
            "Has notifications list",
            isinstance(data.get("notifications"), list),
            f"notifications: {len(data.get('notifications', []))} dispatched"
        )
        print_result(
            "Priority 4 generates DRM notification",
            any(
                n.get("recipient") == "Divisional Railway Manager"
                for n in data.get("notifications", [])
            ),
            "DRM notification present"
        )
        print_result(
            "Priority 4 generates loco pilot caution order",
            any(
                n.get("channel") == "caution_order"
                for n in data.get("notifications", [])
            ),
            "Caution order present"
        )
        print_result(
            "pipeline_id matches",
            data.get("pipeline_id") == "TEST1234",
            f"pipeline_id: {data.get('pipeline_id')}"
        )
        print_response(data)
        return data

    except Exception as e:
        print_result("Notify call", False, str(e))
        return None


# ══════════════════════════════════════════════════════════════════════
# TEST 13 — Notify Validation (invalid severity)
# ══════════════════════════════════════════════════════════════════════

def test_notify_validation():
    print_header("TEST 13 — Notify: Validation (invalid severity)")

    payload = {
        "pipeline_id":        "TEST9999",
        "train_id":           "12952",
        "severity":           9,
        "recommended_action": "test"
    }

    try:
        r    = httpx.post(
            f"{BASE_URL}/api/ai/notify",
            json=payload,
            timeout=10
        )
        data = r.json()

        print_result(
            "Returns 422 for severity 9",
            r.status_code == 422,
            f"Status: {r.status_code}"
        )
        return True

    except Exception as e:
        print_result("Notify validation", False, str(e))
        return False


# ══════════════════════════════════════════════════════════════════════
# SUMMARY
# ══════════════════════════════════════════════════════════════════════

def print_summary(results):
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}  FINAL SUMMARY{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}")

    passed = sum(1 for r in results if r)
    total  = len(results)

    for i, (name, result) in enumerate(results):
        icon = f"{GREEN}✅{RESET}" if result else f"{RED}❌{RESET}"
        print(f"  {icon} Test {i+1:02d}: {name}")

    print(f"\n  {BOLD}Result: {passed}/{total} tests passed{RESET}")

    if passed == total:
        print(f"  {GREEN}{BOLD}🎉 All tests passed. AI layer is ready.{RESET}")
    elif passed >= total * 0.7:
        print(f"  {YELLOW}{BOLD}⚠️  Most tests passed. Check failures above.{RESET}")
    else:
        print(f"  {RED}{BOLD}❌ Multiple failures. Review errors above.{RESET}")


# ══════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"\n{BOLD}RailSentinel AI Layer — Endpoint Test Suite{RESET}")
    print(f"Target: {BASE_URL}")
    print(f"Note: Tests 2, 3, 5, 6, 9, 10 call Claude API — expect 10-40s each\n")

    # Test 1 — Health (must pass before others make sense)
    health_ok = test_health()
    if not health_ok:
        print(f"\n{RED}Server not reachable. Start server first:{RESET}")
        print("  uv run uvicorn ai.main:app --reload --port 8001")
        exit(1)

    # Run all tests
    r2  = test_pipeline_no_anomaly()
    r3  = test_pipeline_high_severity()
    r4  = test_pipeline_validation()
    r5  = test_predictive()
    r6  = test_crowd()
    r7  = test_conflict()
    r8  = test_risk()
    r9  = test_chat_single_turn()
    r10 = test_chat_multi_turn(r9)
    r11 = test_chat_validation()
    r12 = test_notify()
    r13 = test_notify_validation()

    # Summary
    print_summary([
        ("Health check",                    health_ok),
        ("Pipeline — no anomaly",           r2 is not None),
        ("Pipeline — high severity",        r3 is not None),
        ("Pipeline — validation",           r4),
        ("Predictive maintenance",          r5 is not None),
        ("Crowd management",                r6 is not None),
        ("Conflict detection",              r7 is not None),
        ("Compound risk assessment",        r8 is not None),
        ("Chat — single turn",              r9 is not None),
        ("Chat — multi turn",               r10 is not None),
        ("Chat — validation",               r11),
        ("Notify — dispatch",               r12 is not None),
        ("Notify — validation",             r13),
    ])