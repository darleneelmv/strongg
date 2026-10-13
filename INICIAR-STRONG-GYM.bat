@echo off
chcp 65001 >nul
title Strong Gym - servidor de recepcion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js. Se abrira la pagina de descarga:
  echo  descarga la version "LTS", instalala con Siguiente-Siguiente y vuelve a abrir este archivo.
  echo.
  start "" "https://nodejs.org/es/download"
  pause
  exit /b
)
node -e "process.exit(+process.versions.node.split('.')[0]>=22?0:1)"
if errorlevel 1 (
  echo.
  echo  Tu Node.js es muy viejo. Instala la version LTS mas reciente desde nodejs.org
  start "" "https://nodejs.org/es/download"
  pause
  exit /b
)

if not exist ".env" copy ".env.example" ".env" >nul

echo.
echo  Iniciando Strong Gym... NO cierres esta ventana mientras se usa el sistema.
echo  (puedes minimizarla)
echo.
start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000/app"
node --disable-warning=ExperimentalWarning server\index.js
echo.
echo  El servidor se detuvo. Revisa el mensaje de arriba.
pause
