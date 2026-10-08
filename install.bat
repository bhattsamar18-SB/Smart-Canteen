@echo off
chcp 65001 >nul
title Smart Canteen - Installer
cd /d "%~dp0"
setlocal enabledelayedexpansion

echo ============================================
echo   Smart Canteen - Setup / Installer
echo ============================================
echo.

REM ------------------------------------------------
REM 1/3  Node.js (install automatically if missing)
REM ------------------------------------------------
set "NODE_OK="
where node >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
  for /f "tokens=1 delims=." %%m in ("!NODE_VER!") do set "NODE_MAJOR=%%m"
  set "NODE_MAJOR=!NODE_MAJOR:v=!"
  if !NODE_MAJOR! GEQ 18 set "NODE_OK=1"
)

if defined NODE_OK (
  echo [1/3] Node.js found: !NODE_VER!
) else (
  echo [1/3] Node.js not found. Installing Node.js LTS...
  call :install_node
  if errorlevel 1 (
    echo.
    echo [ERROR] Could not install Node.js automatically.
    echo         Please install it manually from https://nodejs.org and re-run install.bat
    pause
    exit /b 1
  )
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  for /f "delims=" %%v in ('node -v 2^>nul') do set "NODE_VER=%%v"
  echo       Node.js installed: !NODE_VER!
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is still not available on PATH.
  echo         Close this window, open a NEW one and run install.bat again.
  pause
  exit /b 1
)

echo.
echo [2/3] Installing project dependencies (npm install)...
echo.
call npm install
if errorlevel 1 (
  echo.
  echo [ERROR] npm install failed. Check your internet connection and try again.
  pause
  exit /b 1
)

echo.
echo [3/3] Preparing the database...
if exist "data\smartcanteen.db" (
  echo       Database already exists - keeping existing data.
) else (
  call npm run db:init
  if errorlevel 1 (
    echo.
    echo [ERROR] Database initialisation failed.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Installation complete.
echo ============================================
echo.
echo   1. Double-click start.bat to run the app.
echo   2. Open http://localhost:1311
echo.
echo   Admin login: admin@smartcanteen.com / admin123
echo.
pause
exit /b 0

REM ================================================
REM Subroutine: install Node.js LTS
REM ================================================
:install_node
where winget >nul 2>nul
if not errorlevel 1 (
  echo       Trying winget (package manager)...
  winget install --id OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
  if exist "%ProgramFiles%\nodejs\node.exe" (
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    exit /b 0
  )
  where node >nul 2>nul
  if not errorlevel 1 exit /b 0
)

echo       Downloading the Node.js LTS installer...
set "NODE_MSI=%TEMP%\node-lts-x64.msi"
if exist "%NODE_MSI%" del /q "%NODE_MSI%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $ErrorActionPreference='Stop'; $idx=Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $lts=$idx ^| Where-Object { $_.lts } ^| Select-Object -First 1; $url='https://nodejs.org/dist/' + $lts.version + '/node-' + $lts.version + '-x64.msi'; Write-Host ('      Downloading ' + $url); Invoke-WebRequest -Uri $url -OutFile '%NODE_MSI%' -UseBasicParsing"
if not exist "%NODE_MSI%" exit /b 1

echo       Installing Node.js (a Windows administrator prompt may appear)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process msiexec.exe -ArgumentList '/i', '%NODE_MSI%', '/qn', '/norestart' -Verb RunAs -Wait"
if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
where node >nul 2>nul
if not errorlevel 1 exit /b 0
exit /b 1
