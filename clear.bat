@echo off
echo Resetting App Storage...
taskkill /f /im haven-tauri.exe 2>nul
taskkill /f /im bun.exe 2>nul
rmdir /s /q "%APPDATA%\com.haven.desktop" 2>nul
rmdir /s /q "dist" 2>nul
rmdir /s /q "release" 2>nul
rmdir /s /q "src-tauri\target" 2>nul
echo Storage cleared.

PAUSE
