@echo off
REM BCG U Studio one-click installer (Track-CC).
REM
REM Run once per LD laptop. Walks through the four prerequisites and
REM installs the project deps. Friendly prompts if any pre-req is
REM missing — opens the official download page in the default browser
REM and tells the LD to re-run after installing.
REM
REM Idempotent: safe to re-run if a step half-failed. Each step's
REM check returns early if the dep is already present.

setlocal enabledelayedexpansion
title BCG U Studio Installer

echo.
echo ==============================================================
echo   BCG U Studio - one-click installer
echo ==============================================================
echo.
echo This will install the four things the Studio needs:
echo   1. Python 3.11 or later  (you may already have this)
echo   2. Node.js 18 or later   (you may already have this)
echo   3. Claude Code CLI       (the agent backend uses this for auth)
echo   4. Project dependencies  (Python + Node packages)
echo.
echo Approx time: 5-10 minutes if some pieces are already installed,
echo up to 25 minutes on a fresh machine.
echo.
pause

REM ---- 1. Python check ----
echo.
echo [1/4] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo Python is NOT installed.
    echo.
    echo Opening the Python download page in your browser. Please:
    echo   1. Download Python 3.11 or later for Windows
    echo   2. Run the installer
    echo   3. CHECK the box that says "Add python.exe to PATH"
    echo   4. Re-run this install.bat after Python is installed
    echo.
    start "" "https://www.python.org/downloads/"
    goto :end
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYTHON_VERSION=%%v
echo Found Python !PYTHON_VERSION!.

REM ---- 2. Node check ----
echo.
echo [2/4] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo Node.js is NOT installed.
    echo.
    echo Opening the Node.js download page in your browser. Please:
    echo   1. Download the LTS version for Windows
    echo   2. Run the installer with default settings
    echo   3. Re-run this install.bat after Node.js is installed
    echo.
    start "" "https://nodejs.org/en/download/"
    goto :end
)
for /f %%v in ('node --version 2^>^&1') do set NODE_VERSION=%%v
echo Found Node.js !NODE_VERSION!.

REM ---- 3. Claude Code CLI ----
echo.
echo [3/4] Checking Claude Code CLI...
claude --version >nul 2>&1
if errorlevel 1 (
    echo Claude Code CLI not found. Installing globally via npm...
    echo This may take 1-2 minutes.
    call npm install -g @anthropic-ai/claude-code
    if errorlevel 1 (
        echo.
        echo Claude Code CLI install FAILED.
        echo See docs\LD_INSTALL.md for troubleshooting.
        goto :end
    )
    echo Claude Code CLI installed.
) else (
    for /f %%v in ('claude --version 2^>^&1') do set CLAUDE_VERSION=%%v
    echo Found Claude Code CLI !CLAUDE_VERSION!.
)

REM ---- 4. Project deps ----
echo.
echo [4/4] Installing project dependencies...

echo.
echo   Installing Python backend (agent-backend)...
echo   This takes 2-3 minutes the first time.
pushd "%~dp0agent-backend"
call python -m pip install -e . >nul 2>&1
if errorlevel 1 (
    echo.
    echo Python backend install FAILED.
    echo Try running manually:
    echo   cd agent-backend
    echo   python -m pip install -e .
    echo See docs\LD_INSTALL.md for help.
    popd
    goto :end
)
popd
echo   Python backend installed.

echo.
echo   Installing frontend (app/)...
echo   This takes 2-4 minutes the first time.
pushd "%~dp0app"
call npm install >nul 2>&1
if errorlevel 1 (
    echo.
    echo Frontend install FAILED.
    echo Try running manually:
    echo   cd app
    echo   npm install
    echo See docs\LD_INSTALL.md for help.
    popd
    goto :end
)
popd
echo   Frontend installed.

echo.
echo ==============================================================
echo   All set. BCG U Studio is ready.
echo ==============================================================
echo.
echo To start the Studio:
echo   1. Double-click launch.bat in this folder
echo   2. Wait ~60 seconds for both servers to come up
echo   3. Open http://localhost:5173 in your browser
echo   4. Sign in to Claude on the first launch (one-time)
echo.
echo Need help? See docs\LD_INSTALL.md.
echo.

:end
echo.
pause
endlocal
