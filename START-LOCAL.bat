@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 22 LTS from https://nodejs.org/ and reopen VS Code.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm included.
  pause
  exit /b 1
)
if not exist "node_modules\.bin\vite.cmd" (
  echo Installing project dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 goto failed
)
echo Starting the Student Attendance app and local database API...
call npm run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo The app did not start. Read the error above and share a screenshot if you need help.
pause
exit /b 1
