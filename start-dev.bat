@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

title AI Dropzone Launcher

echo ========================================
echo   AI Dropzone - One Click Launcher
echo ========================================
echo Project root: %ROOT%
echo.

if not exist "%ROOT%venv\Scripts\activate.bat" (
    echo [ERROR] Python virtual env not found: venv\
    echo.
    echo Run these commands first:
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

if not exist "%ROOT%frontend\node_modules\" (
    echo [ERROR] frontend\node_modules not found
    echo Run this command in frontend folder: npm install
    echo.
    pause
    exit /b 1
)

echo [1/2] Starting backend window (uvicorn :8000)...
start "AI Dropzone - Backend" cmd /k "cd /d ""%ROOT%"" && call venv\Scripts\activate.bat && echo Backend docs: http://127.0.0.1:8000/docs && uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

echo [2/2] Waiting for backend startup...
timeout /t 4 /nobreak >nul

echo [2/2] Starting frontend window (electron:dev:full)...
start "AI Dropzone - Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm run electron:dev:full"

echo.
echo Two CMD windows should now be open:
echo   - AI Dropzone - Backend   (keep running)
echo   - AI Dropzone - Frontend  (Electron app)
echo.
echo Close those windows to stop services.
timeout /t 6 >nul
endlocal
