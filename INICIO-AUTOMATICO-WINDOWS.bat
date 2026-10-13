@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Crea un acceso directo en "Inicio" para que Strong Gym arranque solo al prender la computadora
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\Strong Gym.lnk');" ^
  "$s.TargetPath='%~dp0INICIAR-STRONG-GYM.bat';$s.WorkingDirectory='%~dp0';$s.WindowStyle=7;$s.Save()"
if errorlevel 1 (
  echo No se pudo crear el acceso directo. Hazlo a mano: Win+R, escribe shell:startup y pega ahi un acceso directo a INICIAR-STRONG-GYM.bat
) else (
  echo Listo: Strong Gym arrancara solo cada vez que se prenda esta computadora.
)
pause
