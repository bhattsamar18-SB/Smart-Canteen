@echo off
chcp 65001 >nul
title Smart Canteen Management System
cd /d "%~dp0"

echo ============================================
echo   Smart Canteen Management System
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo         Download it from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Installing dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencies already installed.
)

if not exist "data\smartcanteen.db" (
  echo [2/3] Creating database and demo data...
  call npm run db:init
  if errorlevel 1 (
    echo [ERROR] Database initialisation failed.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Database already exists.
)

echo [3/3] Starting server...
echo.
echo   Open your browser at:  http://localhost:3000
echo   Press Ctrl+C to stop the server.
echo.

call npm start

pause
