"""
run.py — RailSentinel AI Service Launcher

Starts the AI service on port 8001.
Run with:  python run.py

This launcher ensures the module path is set correctly so that
`from ai.xxx import ...` imports resolve properly.
"""
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    print("=" * 60)
    print("  RailSentinel AI Service starting...")
    print(f"  Listening on: http://localhost:{port}")
    print(f"  API Docs:     http://localhost:{port}/docs")
    print(f"  Health:       http://localhost:{port}/health")
    print("=" * 60)
    uvicorn.run(
        "ai.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
