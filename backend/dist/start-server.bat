@echo off
chcp 65001 >nul
title Hospital Queue Management System

echo.
echo ========================================
echo    HOSPITAL QUEUE MANAGEMENT SYSTEM
echo ========================================
echo.

REM Set console encoding for proper symbol display
setlocal enabledelayedexpansion

REM Set colors
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do (
  set "DEL=%%a"
)

set "RED=!DEL![91m"
set "GREEN=!DEL![92m"
set "YELLOW=!DEL![93m"
set "BLUE=!DEL![94m"
set "MAGENTA=!DEL![95m"
set "CYAN=!DEL![96m"
set "WHITE=!DEL![97m"
set "RESET=!DEL![0m"

REM Function to print colored text
set "printGreen=echo.!GREEN!%~1!RESET!"
set "printYellow=echo.!YELLOW!%~1!RESET!"
set "printRed=echo.!RED!%~1!RESET!"
set "printBlue=echo.!BLUE!%~1!RESET!"
set "printCyan=echo.!CYAN!%~1!RESET!"

call :printCyan "🏥 Hospital Queue Management System v2.0"
call :printCyan "📅 %date% %time%"
echo.

REM Check if running as administrator
call :checkAdmin

REM Check if .env file exists
if not exist ".env" (
    call :printYellow "⚠️  Environment file (.env) not found"
    call :printYellow "📝 Creating default configuration..."
    
    echo MONGODB_URI=mongodb://localhost:27017/hospital_queue > .env
    echo PORT=5000 >> .env
    echo NODE_ENV=production >> .env
    echo JWT_SECRET=hospital-queue-system-secret-key-change-in-production >> .env
    echo REACT_APP_API_URL=http://localhost:5000/api >> .env
    echo REACT_APP_SOCKET_URL=http://localhost:5000 >> .env
    
    call :printGreen "✅ Created default .env file"
)

REM Check MongoDB connection
call :checkMongoDB

REM Check required ports
call :checkPorts

REM Create necessary directories
call :createDirectories

REM Display system information
call :systemInfo

REM Start the main application
call :startApplication

goto :eof

:checkAdmin
net session >nul 2>&1
if %errorLevel% neq 0 (
    call :printYellow "⚠️  Not running as administrator"
    call :printYellow "💡 Some features may require admin privileges"
)
exit /b

:checkMongoDB
call :printBlue "🔍 Checking MongoDB connection..."

REM Try multiple ways to check MongoDB
mongod --version >nul 2>&1
if %errorLevel% equ 0 (
    call :printGreen "✅ MongoDB is installed"
    
    REM Check if MongoDB service is running
    sc query MongoDB >nul 2>&1
    if %errorLevel% equ 0 (
        sc query MongoDB | find "RUNNING" >nul
        if %errorLevel% equ 0 (
            call :printGreen "✅ MongoDB service is running"
        ) else (
            call :printYellow "⚠️  MongoDB service exists but not running"
            call :startMongoDB
        )
    ) else (
        call :printYellow "⚠️  MongoDB service not found"
        call :startMongoDBManual
    )
) else (
    call :printRed "❌ MongoDB is not installed or not in PATH"
    call :printYellow "💡 Please install MongoDB from: https://www.mongodb.com/try/download/community"
    call :printYellow "📋 Or update MONGODB_URI in .env file to use remote MongoDB"
    echo.
)
exit /b

:startMongoDB
call :printYellow "🔄 Attempting to start MongoDB service..."
net start MongoDB >nul 2>&1
if %errorLevel% equ 0 (
    call :printGreen "✅ MongoDB service started successfully"
) else (
    call :printRed "❌ Failed to start MongoDB service automatically"
    call :startMongoDBManual
)
exit /b

:startMongoDBManual
call :printYellow "📋 Manual MongoDB options:"
call :printYellow "   1. Install MongoDB Community Edition"
call :printYellow "   2. Use MongoDB Atlas (cloud)"
call :printYellow "   3. Update MONGODB_URI in .env for remote server"
echo.
timeout /t 5 /nobreak >nul
exit /b

:checkPorts
call :printBlue "🔍 Checking required ports..."

REM Check port 5000 (main application)
netstat -an | find ":5000" >nul
if %errorLevel% equ 0 (
    call :printRed "❌ Port 5000 is already in use"
    call :printYellow "💡 Please close other applications using port 5000"
    timeout /t 3 /nobreak >nul
) else (
    call :printGreen "✅ Port 5000 is available"
)

REM Check port 27017 (MongoDB)
netstat -an | find ":27017" >nul
if %errorLevel% equ 0 (
    call :printGreen "✅ MongoDB port 27017 is available"
) else (
    call :printYellow "⚠️  MongoDB port 27017 is in use (may be MongoDB running)"
)
exit /b

:createDirectories
call :printBlue "📁 Creating necessary directories..."

if not exist "uploads" mkdir uploads
if not exist "uploads\logo" mkdir uploads\logo
if not exist "uploads\videos" mkdir uploads\videos
if not exist "uploads\backgrounds" mkdir uploads\backgrounds
if not exist "logs" mkdir logs
if not exist "temp" mkdir temp

call :printGreen "✅ Directory structure created"
exit /b

:systemInfo
call :printBlue "📊 System Information:"

REM Get system info
for /f "tokens=1,2 delims=:" %%i in ('systeminfo ^| findstr /C:"OS Name" /C:"Total Physical Memory"') do (
    if "%%i"=="OS Name" (
        set "os=%%j"
        call :printCyan "   OS: !os!"
    )
    if "%%i"=="Total Physical Memory" (
        set "memory=%%j"
        call :printCyan "   RAM: !memory!"
    )
)

REM Get IP address
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4"') do (
    set "ip=%%i"
    set "ip=!ip:~1!"
    call :printCyan "   IP: !ip!"
    goto :ipDone
)
:ipDone

echo.
call :printGreen "🎯 Application Endpoints:"
call :printCyan "   🌐 Main Application: http://localhost:5000"
call :printCyan "   ⚙️  Admin Panel: http://localhost:5000/admin"
call :printCyan "   🎫 Ticket Dispenser: http://localhost:5000/dispenser"
call :printCyan "   📺 Waiting Screen: http://localhost:5000/waiting"
call :printCyan "   🖥️  Counter Interface: http://localhost:5000/counter/1"
echo.

call :printGreen "🔑 Default Login Credentials:"
call :printCyan "   👨‍💼 Admin: admin / admin123"
call :printCyan "   👩‍💼 Operator: operator / operator123"
call :printCyan "   🎫 Dispenser: dispenser / dispenser123"
echo.
exit /b

:startApplication
call :printBlue "🚀 Starting Hospital Queue System..."
echo.

REM Display countdown
call :printYellow "⏳ Application starting in:"
for /l %%i in (3,-1,1) do (
    call :printCyan "   %%i..."
    timeout /t 1 /nobreak >nul
)

call :printGreen "🎉 Launching application..."
call :printYellow "📖 Opening browser automatically..."
echo.

REM Set environment variables from .env file
if exist ".env" (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        if not "%%a"=="" if not "%%b"=="" set "%%a=%%b"
    )
)

REM Start the application
if exist "hospital-queue-system.exe" (
    call :printGreen "✅ Starting main executable..."
    
    REM Open browser after short delay
    start "" "hospital-queue-system.exe"
    
    timeout /t 3 /nobreak >nul
    
    REM Try to open browser
    start "" "http://localhost:5000"
    
    call :printGreen "🎯 Application is running!"
    call :printYellow "💡 Keep this window open while using the system"
    echo.
    call :printCyan "📋 Press Ctrl+C to stop the server"
    echo.
    
    REM Wait for user input to close
    pause >nul
    
) else (
    call :printRed "❌ Executable 'hospital-queue-system.exe' not found!"
    call :printYellow "💡 Please build the application first or check the file location"
    echo.
    pause
    exit /b 1
)

goto :eof

:printGreen
echo.%GREEN%%~1%RESET%
exit /b

:printYellow
echo.%YELLOW%%~1%RESET%
exit /b

:printRed
echo.%RED%%~1%RESET%
exit /b

:printBlue
echo.%BLUE%%~1%RESET%
exit /b

:printCyan
echo.%CYAN%%~1%RESET%
exit /b

:eof
call :printRed "❌ Server stopped"
call :printYellow "📋 Possible reasons:"
call :printYellow "   - MongoDB not available"
call :printYellow "   - Port 5000 already in use"
call :printYellow "   - Configuration error"
call :printYellow "   - Application crash"
echo.
call :printGreen "🔄 Restarting in 5 seconds..."
timeout /t 5 /nobreak >nul

REM Auto-restart
call :printBlue "🔄 Auto-restarting application..."
goto startApplication