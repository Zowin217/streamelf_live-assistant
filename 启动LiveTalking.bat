@echo off
chcp 65001 >nul
echo ========================================
echo   启动 LiveTalking 数字人服务
echo ========================================
echo.

REM 检查是否在 LiveTalking 目录
if not exist "app.py" (
    echo [错误] 请在 LiveTalking 项目目录下运行此脚本
    echo 或者修改脚本中的路径
    echo.
    pause
    exit /b 1
)

REM 激活 conda 环境（如果使用 conda）
REM conda activate nerfstream

echo [信息] 启动 LiveTalking 服务...
echo [信息] 服务地址: http://localhost:8010
echo [信息] 模型: wav2lip
echo [信息] Avatar: wav2lip256_avatar1
echo.

python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1

pause

