@echo off
cd /d "%~dp0"
start "" http://localhost:8091/login.html
node server.js
