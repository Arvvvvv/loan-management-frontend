@echo off
setlocal
cd /d "%~dp0"
if not exist "android\app\build\outputs\apk\debug\app-debug.apk" (
  echo APK not found:
  echo android\app\build\outputs\apk\debug\app-debug.apk
  pause
  exit /b 1
)
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "public\Business-Loan.apk"
echo.
echo Updated client\public\Business-Loan.apk
pause
