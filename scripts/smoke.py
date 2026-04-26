"""Smoke test for BCG U Studio agent-backend.

Boots the backend on :8766, hits /health, opens a WebSocket to /ws,
closes, and exits 0 on success / 1 on failure. Does NOT talk to Claude
— it only proves the wiring is good (FastAPI up, CORS configured, WS
upgrade works). For an LLM round-trip check, use
agent-backend/scripts/ws_smoke.py instead.

Usage:  python scripts/smoke.py

Requires the agent-backend package to be installed (see docs/RUN.md).
"""
from __future__ import annotations

import asyncio
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "agent-backend"
PORT = 8766
HEALTH_URL = f"http://127.0.0.1:{PORT}/health"
WS_URL = f"ws://127.0.0.1:{PORT}/ws"
BOOT_TIMEOUT_SECONDS = 20.0


def wait_for_health(timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(HEALTH_URL, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except (urllib.error.URLError, ConnectionError, TimeoutError):
            pass
        time.sleep(0.5)
    return False


async def ws_handshake() -> bool:
    try:
        import websockets
    except ImportError:
        print(
            "ERROR: websockets package not installed. "
            "Install agent-backend deps (pip install -e ./agent-backend).",
            file=sys.stderr,
        )
        return False
    try:
        async with websockets.connect(WS_URL, open_timeout=5.0):
            return True
    except Exception as exc:
        print(f"ERROR: WS handshake failed: {exc}", file=sys.stderr)
        return False


def main() -> int:
    if not BACKEND_DIR.exists():
        print(f"ERROR: agent-backend not found at {BACKEND_DIR}", file=sys.stderr)
        return 1

    print(f"booting agent-backend ({BACKEND_DIR})...")
    proc = subprocess.Popen(
        [sys.executable, "run.py"],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        if not wait_for_health(BOOT_TIMEOUT_SECONDS):
            print(
                f"FAIL: /health did not respond within {BOOT_TIMEOUT_SECONDS:.0f}s",
                file=sys.stderr,
            )
            print(
                "      try `cd agent-backend && python run.py` to see logs",
                file=sys.stderr,
            )
            return 1
        print(f"PASS: GET {HEALTH_URL} -> 200")

        if not asyncio.run(ws_handshake()):
            print(f"FAIL: WS handshake to {WS_URL} did not complete", file=sys.stderr)
            return 1
        print(f"PASS: WS {WS_URL} handshake OK")

        print("smoke test passed")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


if __name__ == "__main__":
    sys.exit(main())
