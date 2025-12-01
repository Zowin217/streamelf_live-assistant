@echo off
chcp 65001 >nul
echo ========================================
echo   启动 Faster-Whisper 语音识别服务
echo ========================================
echo.

echo [信息] 启动 Faster-Whisper 代理服务...
echo [信息] 服务地址: http://localhost:4001
echo [信息] 确保已安装 faster-whisper: pip install faster-whisper
echo.

node server/fasterWhisperProxy.js

pause

