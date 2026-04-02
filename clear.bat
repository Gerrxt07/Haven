@echo off
echo Resetting App Storage...
taskkill /f /im electron.exe 2>nul
rmdir /s /q "%APPDATA%\haven" 2>nul
rmdir /s /q "%APPDATA%\Electron" 2>nul
echo Storage cleared.
echo Starting development server...