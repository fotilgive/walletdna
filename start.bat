@echo off
title WalletDNA Launcher
color 0A

echo.
echo  ========================================
echo   WalletDNA - Smart Money Intelligence
echo  ========================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found.
    echo.
    echo  Please install Node.js from: https://nodejs.org
    echo  Download the LTS version, install it, then run this file again.
    echo.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules\" (
    echo  Installing dependencies... (this happens only once)
    call npm install
    if %errorlevel% neq 0 (
        echo  [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

:: Build frontend if dist folder doesn't exist
if not exist "dist\" (
    echo  Building frontend assets... (this happens only once)
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
)

echo.
echo  ========================================
echo   WalletDNA is starting!
echo   Dashboard: http://localhost:3001
echo  ========================================
echo.

:: Open dashboard in browser
start http://localhost:3001

:: Run server (keeps window open)
node server.js
