@echo off
chcp 65001 >nul
title Yanki Sunucusu
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js bulunamadi. https://nodejs.org adresinden kurup tekrar dene. & pause & exit /b)
if not exist node_modules (
  echo Ilk calistirma: gerekli paketler kuruluyor...
  call npm.cmd install --omit=dev
)
node --no-warnings tools\host.js
pause
