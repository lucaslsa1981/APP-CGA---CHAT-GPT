@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 18 ou superior e tente novamente.
  pause
  exit /b 1
)
echo Abra http://127.0.0.1:8080 no Chrome ou Edge.
node tools\server.cjs
popd
pause
