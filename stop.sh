#!/usr/bin/env bash
# Cleanly kill anything listening on the BCG U Studio dev ports.
# Mirrors stop.bat for Windows.
#
# Use this after closing the launcher windows by accident, or when a
# stuck process holds 8766 / 5173 and you can't restart cleanly. Safe
# to run multiple times — kill on a missing PID is a no-op.

echo "Stopping BCG U Studio servers..."

# Backend (8766) and frontend (5173). lsof -ti returns just PIDs,
# pipe to xargs kill. -r skips kill when the input is empty so we
# don't error on already-stopped servers.
lsof -ti tcp:8766 2>/dev/null | xargs -r kill -9 2>/dev/null || true
lsof -ti tcp:5173 2>/dev/null | xargs -r kill -9 2>/dev/null || true

echo "Done."
