@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo Business Loan - Android APK Build
echo ========================================
call npm install
if errorlevel 1 goto :error
call npm run build
if errorlevel 1 goto :error
call npx cap sync android
if errorlevel 1 goto :error
echo.
echo Web build and Capacitor sync completed.
echo Now Android Studio will open.
call npx cap open android
exit /b 0
:error
echo.
echo BUILD FAILED. Read the error above.
pause
exit /b 1
