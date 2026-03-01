@echo off
title iDotMatrix Web Controller
echo.
echo  ========================================
echo    iDotMatrix Web Controller
echo    متحكم شاشة البكسل
echo  ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [!] Node.js غير مثبت
    echo  [!] افتح index.html مباشرة في Chrome
    echo.
    start "" "index.html"
    pause
    exit
)

echo  [*] جاري تشغيل السيرفر...
echo.
echo  ========================================
echo    افتح في المتصفح:
echo    http://localhost:8888
echo  ========================================
echo.
start "" "http://localhost:8888"
npx -y http-server . -p 8888 -c-1
pause
