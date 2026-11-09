@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem Paradise uses its own local ports alongside Voyager.
rem Default: build the app and serve it from the API port. "start.bat dev": Vite dev server + API with auto-restart.
rem Set HOST=0.0.0.0 before running to open it to a phone on the same network.
set "API_PORT=4317"
set "WEB_PORT=5187"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"
set "NOPAUSE=%~2"

echo Checking for an existing Paradise server on ports %API_PORT%/%WEB_PORT%...
for %%R in (%API_PORT% %WEB_PORT%) do (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%%R " ^| findstr "LISTENING"') do (
        echo Found existing process on port %%R ^(PID %%P^) - stopping it...
        taskkill /F /PID %%P >nul 2>&1
    )
)
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Paradise*" >nul 2>&1

for /l %%I in (1,1,20) do (
    netstat -ano | findstr ":%API_PORT% :%WEB_PORT% " | findstr "LISTENING" >nul 2>&1 || goto :portsfree
    ping -n 2 127.0.0.1 >nul
)
:portsfree

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo Install failed.
        if /i not "%NOPAUSE%"=="nopause" pause
        exit /b 1
    )
)

if /i "%MODE%"=="dev" (
    echo Starting Paradise in dev mode ^(API :%API_PORT%, UI :%WEB_PORT%^)...
    start "Paradise API" /min cmd /c "npm run dev:api"
    start "Paradise UI" /min cmd /c "npm run dev"
    echo Done. Open http://127.0.0.1:%WEB_PORT%
) else (
    echo Building Paradise...
    call npm run build
    if errorlevel 1 (
        echo Build failed.
        if /i not "%NOPAUSE%"=="nopause" pause
        exit /b 1
    )
    start "Paradise" /min cmd /c "npm start"
    echo Done. Open http://127.0.0.1:%API_PORT%
)

rem Open the app in a tall window (650x1200); it still resizes freely and the app fills it. Skipped with nopause.
if /i not "%NOPAUSE%"=="nopause" (
    ping -n 3 127.0.0.1 >nul
    if /i "%MODE%"=="dev" (set "URL=http://127.0.0.1:%WEB_PORT%") else set "URL=http://127.0.0.1:%API_PORT%"
    start "" msedge --app=!URL! --window-size=650,1200
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sizewin.ps1" 650 1200
)
if /i not "%NOPAUSE%"=="nopause" pause
