@echo off
title RADAR TASTYTRADE PRO IA
echo ===================================================
echo   INICIANDO RADAR TASTYTRADE PRO IA + GEX ENGINE
echo ===================================================
echo.
cd /d "%~dp0"

echo [1/3] Verificando e liberando porta 3000 se necessario...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Abrindo o navegador em http://localhost:3000 ...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

echo [3/3] Iniciando servidor Next.js em tempo real...
echo.
npm run dev
pause
