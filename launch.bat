@echo off
REM BCG U Studio launcher — opens backend + frontend in their own windows.
REM
REM Per-LD localhost dev rig. The backend (FastAPI + WebSocket) listens on
REM 8766; the Vite frontend listens on 5173. Both windows survive on their
REM own; close them via stop.bat or by Xing them out.
REM
REM %~dp0 resolves to this script's directory, so launch.bat works from any
REM cwd — double-click in Explorer, or run from any prompt.

title BCG U Studio Launcher
echo Starting BCG U Studio...
echo.

start "BCG U Studio - Backend" cmd /k "cd /d %~dp0agent-backend && python run.py"

REM Brief gap before launching the frontend so the two windows don't fight
REM for terminal focus on first paint. Backend prints its bind line within
REM ~2-3s; frontend takes ~30-60s on a cold vite cache.
timeout /t 3 /nobreak >nul

start "BCG U Studio - Frontend" cmd /k "cd /d %~dp0app && npm run dev"

echo.
echo Both servers launching. Wait ~60s for vite to be ready.
echo Then open: http://localhost:5173/bcg-u-studio/
echo.
echo Close this window when both servers are visible.
pause
