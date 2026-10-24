@echo off
rem Double-click in Explorer to start God's Eye View in your browser.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node 24 LTS from https://nodejs.org/ and double-click this file again.
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

node scripts\launch.mjs
if errorlevel 1 (
  echo Launch failed.
  pause
  exit /b 1
)
