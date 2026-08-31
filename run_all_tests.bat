@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo           RUNNING ALL TELEBIRDING TESTS
echo ===================================================

set "ROOT_DIR=%~dp0"
set "WEBAPP_FAILED=0"
set "ANDROID_FAILED=0"

:: ---------------------------------------------------
:: 1. Web Application Unit Tests (Vitest)
:: ---------------------------------------------------
echo.
echo [1/2] Running Web Application Tests (Vitest)...
echo ---------------------------------------------------
cd /d "%ROOT_DIR%webapp"
call npm test
if %errorlevel% neq 0 (
    echo [ERROR] Web application tests failed!
    set "WEBAPP_FAILED=1"
) else (
    echo [SUCCESS] Web application tests passed!
)

:: ---------------------------------------------------
:: 2. Android App Unit Tests (Gradle)
:: ---------------------------------------------------
echo.
echo [2/2] Running Android App Unit Tests (Gradle)...
echo ---------------------------------------------------
cd /d "%ROOT_DIR%telebirding-android-app"
if exist "gradlew.bat" (
    call gradlew.bat test
    if !errorlevel! neq 0 (
        echo [ERROR] Android unit tests failed!
        set "ANDROID_FAILED=1"
    ) else (
        echo [SUCCESS] Android unit tests passed!
    )
) else (
    echo [WARNING] gradlew.bat not found in telebirding-android-app!
    set "ANDROID_FAILED=1"
)

:: Return to repository root
cd /d "%ROOT_DIR%"

:: ---------------------------------------------------
:: Summary
:: ---------------------------------------------------
echo.
echo ===================================================
echo                    TEST SUMMARY
echo ===================================================
if %WEBAPP_FAILED% equ 0 (
    echo Webapp Tests:   PASSED
) else (
    echo Webapp Tests:   FAILED
)

if %ANDROID_FAILED% equ 0 (
    echo Android Tests:  PASSED
) else (
    echo Android Tests:  FAILED
)
echo ===================================================

if %WEBAPP_FAILED% neq 0 exit /b 1
if %ANDROID_FAILED% neq 0 exit /b 1

exit /b 0
