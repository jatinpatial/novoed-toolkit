#!/usr/bin/env bash
# BCG U Studio one-click installer (macOS).
#
# Mirrors install.bat for Windows. Run once per LD laptop. Walks
# through the four prerequisites and installs the project deps.
# Friendly prompts if any pre-req is missing — opens the official
# download page and tells the LD to re-run after installing.
#
# Idempotent: safe to re-run if a step half-failed. Each step's
# check returns early if the dep is already present.

set -e

cd "$(dirname "$0")"

echo
echo "=============================================================="
echo "  BCG U Studio - one-click installer"
echo "=============================================================="
echo
echo "This will install the four things the Studio needs:"
echo "  1. Python 3.11 or later  (you may already have this)"
echo "  2. Node.js 18 or later   (you may already have this)"
echo "  3. Claude Code CLI       (the agent backend uses this for auth)"
echo "  4. Project dependencies  (Python + Node packages)"
echo
echo "Approx time: 5-10 minutes if some pieces are already installed,"
echo "up to 25 minutes on a fresh machine."
echo
read -rp "Press Enter to continue..."

open_url() {
    open "$1" 2>/dev/null || xdg-open "$1" 2>/dev/null || true
}

# ---- 1. Python check ----
echo
echo "[1/4] Checking Python..."
if ! command -v python3 >/dev/null 2>&1; then
    echo
    echo "Python 3 is NOT installed."
    echo
    echo "Opening the Python download page in your browser. Please:"
    echo "  1. Download Python 3.11 or later for macOS"
    echo "  2. Run the installer"
    echo "  3. Re-run this install.sh after Python is installed"
    echo
    open_url "https://www.python.org/downloads/"
    exit 1
fi
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "Found Python $PYTHON_VERSION."

# ---- 2. Node check ----
echo
echo "[2/4] Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo
    echo "Node.js is NOT installed."
    echo
    echo "Opening the Node.js download page in your browser. Please:"
    echo "  1. Download the LTS version for macOS"
    echo "  2. Run the installer with default settings"
    echo "  3. Re-run this install.sh after Node.js is installed"
    echo
    open_url "https://nodejs.org/en/download/"
    exit 1
fi
NODE_VERSION=$(node --version 2>&1)
echo "Found Node.js $NODE_VERSION."

# ---- 3. Claude Code CLI ----
echo
echo "[3/4] Checking Claude Code CLI..."
if ! command -v claude >/dev/null 2>&1; then
    echo "Claude Code CLI not found. Installing globally via npm..."
    echo "This may take 1-2 minutes."
    if ! npm install -g @anthropic-ai/claude-code; then
        echo
        echo "Claude Code CLI install FAILED."
        echo "If you saw EACCES / permission errors, retry with:"
        echo "  sudo npm install -g @anthropic-ai/claude-code"
        echo "See docs/LD_INSTALL.md for troubleshooting."
        exit 1
    fi
    echo "Claude Code CLI installed."
else
    CLAUDE_VERSION=$(claude --version 2>&1)
    echo "Found Claude Code CLI $CLAUDE_VERSION."
fi

# ---- 4. Project deps ----
echo
echo "[4/4] Installing project dependencies..."

echo
echo "  Installing Python backend (agent-backend)..."
echo "  This takes 2-3 minutes the first time."
if ! (cd agent-backend && python3 -m pip install -e . >/dev/null 2>&1); then
    echo
    echo "Python backend install FAILED."
    echo "Try running manually:"
    echo "  cd agent-backend"
    echo "  python3 -m pip install -e ."
    echo "See docs/LD_INSTALL.md for help."
    exit 1
fi
echo "  Python backend installed."

echo
echo "  Installing frontend (app/)..."
echo "  This takes 2-4 minutes the first time."
if ! (cd app && npm install >/dev/null 2>&1); then
    echo
    echo "Frontend install FAILED."
    echo "Try running manually:"
    echo "  cd app"
    echo "  npm install"
    echo "See docs/LD_INSTALL.md for help."
    exit 1
fi
echo "  Frontend installed."

echo
echo "=============================================================="
echo "  All set. BCG U Studio is ready."
echo "=============================================================="
echo
echo "To start the Studio:"
echo "  1. Run ./launch.sh from this folder"
echo "  2. Wait ~60 seconds for both servers to come up"
echo "  3. Open http://localhost:5173 in your browser"
echo "  4. Sign in to Claude on the first launch (one-time)"
echo
echo "Need help? See docs/LD_INSTALL.md."
echo
