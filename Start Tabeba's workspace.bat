@echo off
title Tabeba's workspace - keep this window open
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install the LTS version from https://nodejs.org and try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First start: installing Tabeba's workspace. This takes a few minutes...
  call npm install
  if errorlevel 1 goto failed
)

rem Downloads the caption engine the first time; afterwards it only checks and takes a second.
call npm run setup --silent
if errorlevel 1 goto failed

call npm run build --silent
if errorlevel 1 goto failed

echo.
echo  Tabeba's workspace is starting. Your browser will open by itself.
echo  Keep this window open while you work. Close it when you are done.
echo.
set OPEN_BROWSER=1
call npm start --silent
pause
exit /b 0

:failed
echo.
echo Something went wrong while starting Tabeba's workspace. Take a photo of this window and send it to whoever set this up for you.
pause
exit /b 1
