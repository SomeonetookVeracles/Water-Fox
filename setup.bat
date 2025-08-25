@echo off
echo Setting up Firefox CSS Customizer...
echo.
if not exist "public" mkdir public
if not exist "server.js" (
    echo ERROR: server.js not found!
    echo Please save the server code as server.js
    echo.
    pause
    exit /b 1
)

if not exist "public\index.html" (
    echo ERROR: public\index.html not found!
    echo Please save the HTML code as public\index.html
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Please save the package.json content as package.json
    echo.
    pause
    exit /b 1
)
echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Make sure Node.js is installed: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo.
echo Setup complete!
echo.
echo To start the server, run:
echo   npm start
echo.
echo Then open your browser to: http://localhost:3000
echo.
set /p start="Start the server now? (y/n): "
if /i "%start%"=="y" (
    echo Starting server...
    call npm start
)

pause