@echo off
title Movies_Adda - Android APK Builder
color 0C

echo ======================================================================
echo                Movies_Adda - ANDROID APK BUILD SCRIPT                  
echo ======================================================================
echo.

where gradle >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] Gradle detected on system. Building Release APK...
    call gradle assembleRelease
    goto done
)

if exist "gradlew.bat" (
    echo [OK] Gradle wrapper found. Building Release APK...
    call gradlew.bat assembleRelease
    goto done
)

echo [!] Gradle not in PATH. Checking Android Studio setup...
echo.
echo ======================================================================
echo                HOW TO BUILD YOUR APK (EASIEST METHOD)                 
echo ======================================================================
echo 1. Open 'Android Studio' on your PC.
echo 2. Click on 'Open' and select this folder:
echo    "%~dp0"
echo 3. Wait 30 seconds for Gradle to sync.
echo 4. In the top menu, click:
echo    Build  -^>  Build Bundle(s) / APK(s)  -^>  Build APK(s)
echo 5. When finished, Android Studio will show a notification:
echo    "APK(s) generated successfully: locate"
echo    Click "locate" to get your 'app-debug.apk' or 'app-release.apk'!
echo ======================================================================
echo.

:done
pause
