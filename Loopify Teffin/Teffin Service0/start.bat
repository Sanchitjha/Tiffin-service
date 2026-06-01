@echo off
REM DabbaBox Tiffin CRM — Windows launcher
setlocal

cd /d "%~dp0\backend"

REM Check Node
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node.js not found. Please install Node.js v18 or newer from:
    echo    https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM First-run setup
if not exist "node_modules" (
    echo Installing dependencies (one-time, ~30s)...
    call npm install
    if errorlevel 1 (
        echo.
        echo Install failed. Please check the error above.
        pause
        exit /b 1
    )
)

REM Create .env from template if missing
if not exist ".env" (
    if exist ".env.example" copy ".env.example" ".env" >nul
)

REM Start server and open browser
start "" "http://localhost:4000"
call npm start

pause
