@echo off
setlocal enabledelayedexpansion
title Movies_Adda - Ek Click Me Sara Code GitHub Pe Dalein
color 0A
cls

echo ======================================================================
echo           MOVIES_ADDA - EK BAR ME SARA CODE GITHUB PE DALEIN
echo ======================================================================
echo.

cd /d "%~dp0"

:: ── Step 1: Detect or Install Git ──
set "GIT_CMD="
if exist "C:\Program Files\Git\cmd\git.exe" set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

if "!GIT_CMD!"=="" (
    where git >nul 2>nul
    if !ERRORLEVEL! equ 0 set "GIT_CMD=git"
)

if "!GIT_CMD!"=="" (
    echo [Step 1] Aapke PC par Git command installed nahi mila.
    echo Windows Winget se Git ko automatic install kar rahe hain (Sirf 30 seconds)...
    echo.
    winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
    
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_CMD=C:\Program Files\Git\cmd\git.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
    )
)

if "!GIT_CMD!"=="" (
    echo.
    echo ======================================================================
    echo  [!] Agar Git automatic install nahi hua, toh sabse aasan tarika:
    echo ======================================================================
    echo  GitHub Desktop download karein (100%% Free aur 1-Click tool):
    echo  Link: https://desktop.github.com
    echo.
    echo  1. GitHub Desktop install karein aur login karein.
    echo  2. File -^> Add Local Repository -^> Is folder ko select karein:
    echo     "%~dp0"
    echo  3. "Push origin" button par click kar dein!
    echo ======================================================================
    pause
    exit /b
)

echo [OK] Git ready hai: "!GIT_CMD!"
echo.

:: ── Step 2: Sync All Code ──
echo [Step 2] Saara code sync kiya ja raha hai...
if exist "..\index.html" copy /y "..\index.html" "index.html" >nul
if exist "..\player.html" copy /y "..\player.html" "player.html" >nul
if exist "..\manifest.json" copy /y "..\manifest.json" "manifest.json" >nul

if exist "..\android-app" (
    robocopy "..\android-app" "android-app" /E /XD .gradle build /NFL /NDL /NJH /NJS >nul 2>&1
)

if exist "..\.github" (
    robocopy "..\.github" ".github" /E /NFL /NDL /NJH /NJS >nul 2>&1
)

if not exist "android-app\app\src\main\assets\www" mkdir "android-app\app\src\main\assets\www"
if exist "index.html" copy /y "index.html" "android-app\app\src\main\assets\www\index.html" >nul
if exist "player.html" copy /y "player.html" "android-app\app\src\main\assets\www\player.html" >nul
if exist "manifest.json" copy /y "manifest.json" "android-app\app\src\main\assets\www\manifest.json" >nul

:: ── Step 3: Git Init & Remote ──
echo.
echo [Step 3] Git repository prepare ho rahi hai...
if not exist ".git" (
    "!GIT_CMD!" init
    "!GIT_CMD!" branch -M main
    "!GIT_CMD!" remote add origin https://github.com/mypresonal65-star/Movies-Addaa.git
)

"!GIT_CMD!" remote set-url origin https://github.com/mypresonal65-star/Movies-Addaa.git >nul 2>&1

echo Sabhi files add ki ja rahi hain...
"!GIT_CMD!" add -A

:: ── Step 4: Commit & Push ──
echo.
echo [Step 4] GitHub par sara code upload ho raha hai...
"!GIT_CMD!" commit -m "Upload all Movies_Adda web app, Android TV app & APK builder"
"!GIT_CMD!" push -u origin main

if !ERRORLEVEL! neq 0 (
    echo.
    echo [INFO] Force push kar rahe hain...
    "!GIT_CMD!" push -u origin main --force
)

echo.
echo ======================================================================
echo  MUBARAK HO! SARA CODE GITHUB PAR EK BAAR ME CHALA GAYA HAI!
echo ======================================================================
echo.
echo  Ab 2 minute intezar karein aur is link se apna APK download karein:
echo  https://github.com/mypresonal65-star/Movies-Addaa/actions
echo.
echo ======================================================================
pause
