@echo off
rem Infinite Canvas local proxy launcher (Windows).
rem Runs index.js from this folder when present, otherwise falls back to npx.
title Infinite Canvas 本地代理

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本：https://nodejs.org/zh-cn
    echo.
    pause
    exit /b 1
)

set "NODE_MAJOR="
for /f "tokens=1 delims=v." %%v in ('node --version') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR set "NODE_MAJOR=0"
if %NODE_MAJOR% LSS 18 (
    echo [错误] Node.js 版本过低（当前主版本 %NODE_MAJOR%），请升级到 18 或更高版本：https://nodejs.org/zh-cn
    echo.
    pause
    exit /b 1
)

echo 正在启动 Infinite Canvas 本地代理，关闭本窗口或按 Ctrl+C 即可停止。
echo 启动后在 Infinite Canvas 的「配置 - 本地代理」中打开开关，地址保持默认 http://127.0.0.1:23210
echo 如需自定义端口或地址，可在命令行运行：canvas-proxy.bat --port 端口 --host 地址
echo.

if exist "%~dp0index.js" (
    node "%~dp0index.js" %*
) else (
    npx --yes @basketikun/canvas-proxy@latest %*
)

echo.
echo 本地代理已停止。
pause
