@echo off
setlocal
title Ray Studio
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required to run Ray Studio.
  echo Install the LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
node "%~dp0serve.cjs" --open
if errorlevel 1 (
  echo.
  echo Ray Studio could not start. See the message above.
  pause
  exit /b 1
)
endlocal
