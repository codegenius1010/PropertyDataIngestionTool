@echo off
REM Setup script for Property Data Ingestion Tool (Windows)

echo 🚀 Setting up Property Data Ingestion Tool...
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Install root dependencies
echo 📦 Installing root dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)
echo.

REM Install client dependencies
echo 📦 Installing client dependencies...
cd client
call npm install
cd ..
if errorlevel 1 (
    echo ❌ Failed to install client dependencies
    pause
    exit /b 1
)
echo.

echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env file with your MariaDB credentials
echo 2. Create the database using MariaDB client
echo 3. Run "npm run dev" to start the backend (Terminal 1)
echo 4. Run "npm run client" to start the frontend (Terminal 2)
echo 5. Open http://localhost:3000 in your browser
echo.
pause
