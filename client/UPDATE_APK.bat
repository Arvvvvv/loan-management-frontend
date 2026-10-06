@echo off
title Business Loan - Update Downloadable APK
cd /d "%~dp0"
setlocal

set "SOURCE=%~dp0android\app\build\outputs\apk\debug\app-debug.apk"
set "TARGET=%~dp0public\Business-Loan.apk"

echo.
echo ============================================
echo   BUSINESS LOAN - UPDATE DOWNLOADABLE APK
echo ============================================
echo.

if not exist "%SOURCE%" (
  echo ERROR: New APK was not found.
  echo.
  echo Build it first in Android Studio:
  echo Build ^> Generate App Bundles or APKs ^> Generate APKs
  echo.
  echo Expected file:
  echo %SOURCE%
  pause
  exit /b 1
)

copy /Y "%SOURCE%" "%TARGET%" >nul
if errorlevel 1 (
  echo ERROR: Could not copy the APK.
  pause
  exit /b 1
)

echo.
echo SUCCESS: The new APK is now:
echo %TARGET%
echo.
echo Next steps:
echo 1. Open PowerShell in the Git repository.
echo 2. git status
echo 3. git add client/public/Business-Loan.apk client/src/main.jsx client/src/styles.css
echo 4. git commit -m "Update responsive mobile navigation and APK"
echo 5. git push origin main
 echo.
pause
endlocal
