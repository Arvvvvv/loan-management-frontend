@echo off
title Business Loan - Build APK
cd /d "%~dp0"

setlocal

echo.
echo ============================================
echo   BUSINESS LOAN - APK BUILD
echo ============================================

echo.
echo [1/4] Building the React app...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please read the error above.
  pause
  exit /b 1
)

echo.
echo [2/4] Syncing the Capacitor Android project...
call npx cap sync android
if errorlevel 1 (
  echo.
  echo Capacitor sync failed. Please read the error above.
  pause
  exit /b 1
)

echo.
echo [3/4] Opening Android Studio...
call npx cap open android

 echo.
echo [4/4] After Android Studio builds the APK:
echo     Build ^> Generate App Bundles or APKs ^> Generate APKs
echo.
echo The debug APK will normally be here:
echo     android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo Copy the new APK to:
echo     public\Business-Loan.apk
echo.
echo Then redeploy Vercel so the Dashboard Download APK button
echo points to the latest build.
echo.
pause
endlocal
