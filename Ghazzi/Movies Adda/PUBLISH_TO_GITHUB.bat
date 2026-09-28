@echo off
setlocal enabledelayedexpansion
title Movies_Adda - Publish to GitHub and Auto Build APK
color 0A
cls

echo ======================================================================
echo           MOVIES_ADDA - PUBLISH TO GITHUB AND BUILD APK
echo ======================================================================
echo.

cd /d "%~dp0"

:: ── Step 1: Detect Git or common install paths ──
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Searching for Git in common Windows directories...
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "PATH=%PATH%;C:\Program Files\Git\cmd"
    ) else if exist "C:\Program Files (x86)\Git\cmd\git.exe" (
        set "PATH=%PATH%;C:\Program Files (x86)\Git\cmd"
    ) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Git\cmd"
    ) else if exist "%ProgramW6432%\Git\cmd\git.exe" (
        set "PATH=%PATH%;%ProgramW6432%\Git\cmd"
    )
)

:: Re-check if Git is found
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo ======================================================================
    echo  [!] Git is not currently installed or found on your computer.
    echo ======================================================================
    echo.
    echo  Hum Git ko automatically install kar sakte hain Windows Winget se!
    echo.
    set /p INSTALL_GIT="Kya aap Git install karna chahte hain? (Y/N): "
    if /i "!INSTALL_GIT!"=="Y" (
        echo.
        echo Installing Git via winget... Please wait 1 minute...
        winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
        if exist "C:\Program Files\Git\cmd\git.exe" (
            set "PATH=%PATH%;C:\Program Files\Git\cmd"
        ) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
            set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Git\cmd"
        )
    ) else (
        echo.
        echo [OK] Agar aap Git install nahi karna chahte:
        echo Aap bina Git ke bhi GitHub par direct files upload kar sakte hain:
        echo 1. Browser me kholein: https://github.com/mypresonal65-star/Movies-Addaa
        echo 2. "Add file" -^> "Upload files" par click karein.
        echo 3. Is folder ki files drag-and-drop karke "Commit" kar dein!
        echo 4. GitHub Actions tab me 2 minute me APK build ho jayega!
        echo.
        pause
        exit /b
    )
)

:: Re-verify Git
where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Git install hone ke baad terminal restart karna padta hai.
    echo Kripya is file ko dobara double-click karein!
    pause
    exit /b
)

echo [OK] Git found: 
git --version
echo.

:: ── Step 2: Sync Files ──
echo [Step 1/3] Syncing latest web and Android app files...
if exist "..\index.html" copy /y "..\index.html" "index.html" >nul
if exist "..\player.html" copy /y "..\player.html" "player.html" >nul
if exist "..\manifest.json" copy /y "..\manifest.json" "manifest.json" >nul

if exist "..\android-app" (
    echo Syncing android-app files...
    robocopy "..\android-app" "android-app" /E /XD .gradle build /NFL /NDL /NJH /NJS >nul 2>&1
)

if exist "..\.github" (
    echo Syncing .github workflows...
    robocopy "..\.github" ".github" /E /NFL /NDL /NJH /NJS >nul 2>&1
)

if not exist "android-app\app\src\main\assets\www" mkdir "android-app\app\src\main\assets\www"
if exist "index.html" copy /y "index.html" "android-app\app\src\main\assets\www\index.html" >nul
if exist "player.html" copy /y "player.html" "android-app\app\src\main\assets\www\player.html" >nul
if exist "manifest.json" copy /y "manifest.json" "android-app\app\src\main\assets\www\manifest.json" >nul

:: ── Step 3: Git Repo Check / Init ──
echo.
echo [Step 2/3] Checking Git Repository...
if not exist ".git" (
    echo Initializing Git repository...
    git init
    git branch -M main
    git remote add origin https://github.com/mypresonal65-star/Movies-Addaa.git
)

:: Verify remote origin
git remote get-url origin >nul 2>nul
if %ERRORLEVEL% neq 0 (
    git remote add origin https://github.com/mypresonal65-star/Movies-Addaa.git
)

echo Staging all files...
git add -A

:: ── Step 4: Commit and Push ──
echo.
echo [Step 3/3] Committing and Pushing to GitHub (origin main)...
git commit -m "Deploy Movies_Adda web app, Android TV app and automated APK builder"
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo        SUCCESS! MOVIES_ADDA HAS BEEN PUBLISHED TO GITHUB!
    echo ======================================================================
    echo.
    echo  1. Visit your GitHub Repo:
    echo     https://github.com/mypresonal65-star/Movies-Addaa
    echo.
    echo  2. Open the "Actions" tab:
    echo     https://github.com/mypresonal65-star/Movies-Addaa/actions
    echo.
    echo  3. GitHub is now automatically compiling your Android APK!
    echo     In 2-3 minutes, click on "Build Movies_Adda APK" and download:
    echo     "Movies_Adda-Debug-APK" from the Artifacts section.
    echo.
    echo ======================================================================
) else (
    echo.
    echo [INFO] Trying force push to main branch...
    git push -u origin main --force
    if %ERRORLEVEL% equ 0 (
        echo.
        echo Pushed successfully to main! Check GitHub Actions tab for your APK!
    ) else (
        echo.
        echo [NOTE] Agar GitHub login prompt manga jaye, toh browser me login confirm karein.
    )
)

echo.
echo Press any key to exit...
pause >nul
