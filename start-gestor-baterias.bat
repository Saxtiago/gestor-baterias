@echo off
REM Script para iniciar Backend y Frontend en el servidor local.
REM Ajusta el nombre del entorno virtual si no es venv o .venv.
set "BACKEND_DIR=C:\Users\epsistemas199001\Desktop\Servidor\gestor-baterias\Backend"
set "FRONTEND_DIR=C:\Users\epsistemas199001\Desktop\Servidor\gestor-baterias\Frontend"

cd /d "%BACKEND_DIR%"
if exist "%BACKEND_DIR%\venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=%BACKEND_DIR%\venv\Scripts\activate.bat"
) else if exist "%BACKEND_DIR%\.venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=%BACKEND_DIR%\.venv\Scripts\activate.bat"
) else (
    echo No se encontro un entorno virtual en Backend.
    echo Crea uno en "Backend\venv" o "Backend\.venv" y vuelve a ejecutar este script.
    pause
    exit /b 1
)

start "Backend" /min cmd /k "call ""%VENV_ACTIVATE%"" && python app.py"

cd /d "%FRONTEND_DIR%"
start "Frontend" /min cmd /k "npx ng serve --host 172.19.72.16 --port 4200 --proxy-config proxy.conf.json --allowed-hosts=172.19.72.16"
