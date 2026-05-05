#!/usr/bin/env bash
# BCG U Studio launcher (macOS) — opens backend + frontend in their
# own Terminal windows. Mirrors launch.bat for Windows.
#
# Per-LD localhost dev rig. The backend (FastAPI + WebSocket) listens
# on 8766; the Vite frontend listens on 5173. Both windows survive on
# their own; close them via stop.sh or by ⌘W'ing them.

cd "$(dirname "$0")"

# Always pull latest before launching — strategy chat's architectural
# commitment: LDs see the latest version on every launch. Quiet on
# success; non-fatal if the LD has a non-fast-forward situation
# (we don't want to block their launch).
echo "Pulling latest..."
if git pull --ff-only 2>/dev/null; then
    echo "  done."
else
    echo "  (skipped — not a fast-forward, no remote, or no git checkout)"
fi
echo

echo "Starting BCG U Studio..."
echo

ROOT="$(pwd)"

# Open backend in a new Terminal window via osascript. Quoting:
# the AppleScript string uses escaped single-quotes around $ROOT so
# the path survives when it contains spaces (e.g. "BCG Studio").
osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$ROOT/agent-backend' && python3 run.py"
end tell
EOF

# Brief gap before launching the frontend so the two windows don't
# fight for terminal focus on first paint. Backend prints its bind
# line within ~2-3s; frontend takes ~30-60s on a cold vite cache.
sleep 3

osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$ROOT/app' && npm run dev"
end tell
EOF

echo
echo "Both servers launching. Wait ~60s for vite to be ready."
echo "Then open: http://localhost:5173/bcg-u-studio/"
echo
echo "Close this window when both server windows are visible."
