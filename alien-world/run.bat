@echo off
setlocal
title Unfamiliar Ground

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required.
  echo Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo Node.js 20 or newer is required. Current version:
  node -v
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Created .env from .env.example.
  echo Add at least one provider key to .env for world generation.
  start "" notepad ".env"
  echo.
  echo Save .env after adding your key, then press any key to continue.
  pause >nul
)

if not exist "node_modules" (
  echo Installing game dependencies...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting Unfamiliar Ground...
start "" cmd /c "timeout /t 5 /nobreak ^>nul ^& start http://127.0.0.1:5173"
call npm run dev
if errorlevel 1 (
  echo The game stopped with an error.
  pause
)
endlocal
