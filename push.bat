@echo off
echo ==================================================
echo White Gold Analyzer - Force Pushing code to GitHub...
echo ==================================================
git push -f origin main
echo ==================================================
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Code pushed successfully to GitHub!
) else (
    echo [ERROR] Push failed. Please check your GitHub credentials/internet connection.
)
echo ==================================================
pause
