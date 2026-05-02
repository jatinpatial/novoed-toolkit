@echo off
REM Cleanly kill anything listening on the BCG U Studio dev ports.
REM
REM Use this after closing the launcher windows by accident, or when a
REM stuck process holds 8766 / 5173 and you can't restart cleanly. Safe to
REM run multiple times — taskkill on a missing PID is a no-op.

echo Stopping BCG U Studio servers...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8766 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

echo Done.
timeout /t 2 /nobreak >nul
