@echo off
title Movies_Adda - Local APK Builder
color 0B
cls

echo ======================================================================
echo                 MOVIES_ADDA - LOCAL APK BUILDER
echo ======================================================================
echo.

cd /d "%~dp0"

echo Checking for Gradle or Android Studio environment...
where gradle >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Gradle found! Compiling Movies_Adda APK...
    echo.
    call gradle assembleDebug
    if %ERRORLEVEL% equ 0 (
        echo.
        echo ======================================================================
        echo  SUCCESS! APK generated successfully!
        echo  File: app\build\outputs\apk\debug\app-debug.apk
        echo ======================================================================
        explorer app\build\outputs\apk\debug
    ) else (
        echo [ERROR] Gradle build encountered an error.
    )
) else (
    echo [INFO] Gradle is not in system PATH.
    echo.
    echo Please either:
    echo  1. Open Android Studio -> File -> Open -> Select this 'android-app' folder -> Build -> Build APK(s)
    echo  OR
    echo  2. Push to GitHub! GitHub Actions will compile and give you the APK automatically!
)

echo.
pause
