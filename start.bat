@echo off
chcp 65001 >nul
title Smart Canteen Management System
cd /d "%~dp0"

echo ============================================
echo   Smart Canteen Management System
echo ============================================
echo.

REM ---------- Node.js check ----------
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo         Please run install.bat first.
  pause
  exit /b 1
)

REM ---------- Dependencies check ----------
if not exist "node_modules" (
  echo [ERROR] Dependencies are not installed.
  echo         Please run install.bat first.
  pause
  exit /b 1
)
if not exist "node_modules\better-sqlite3" (
  echo [ERROR] The database driver is missing.
  echo         Please run install.bat first.
  pause
  exit /b 1
)

REM ---------- Database check ----------
if not exist "data\smartcanteen.db" (
  echo [1/2] Creating database and demo data...
  call npm run db:init
  if errorlevel 1 (
    echo [ERROR] Database initialisation failed.
    pause
    exit /b 1
  )
) else (
  echo [1/2] Database ready.
)

echo [2/2] Starting server...
echo.
echo   Open your browser at:  http://localhost:1311
echo   Press Ctrl+C to stop the server.
echo.

REM Open the browser as soon as the server is answering
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\open-browser.ps1" -Url "http://localhost:1311"

call npm start

pause
