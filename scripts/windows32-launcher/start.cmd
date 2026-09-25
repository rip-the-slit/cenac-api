@echo off
cd /d "%~dp0"
node.exe bootstrap.cjs
if errorlevel 1 pause
