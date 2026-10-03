@echo off
title Business Loan - Build APK
cd /d "%~dp0"

echo.
echo [1/3] Building the React app...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please read the error above.
  pause
  exit /b 1
)

echo.
echo [2/3] Syncing the Capacitor Android project...
call npx cap sync android
if errorlevel 1 (
  echo.
  echo Capacitor sync failed. Please read the error above.
  pause
  exit /b 1
)

echo.
echo [3/3] Opening Android Studio...
call npx cap open android

echo.
echo Done. In Android Studio choose:
echo Build ^> Generate App Bundles or APKs ^> Generate APKs
echo.
pause
