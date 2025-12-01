@echo off
chcp 65001 >nul
echo ========================================
echo   配置 DeepSeek API 密钥
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 .env.local 文件...
if exist ".env.local" (
    echo ✅ .env.local 文件已存在
    echo.
    echo 当前内容:
    type .env.local
    echo.
    set /p confirm="是否要重新配置? (Y/N): "
    if /i not "%confirm%"=="Y" (
        echo 已取消
        pause
        exit /b 0
    )
) else (
    echo ⚠️  .env.local 文件不存在，将创建新文件
)

echo.
echo [2/3] 创建/更新 .env.local 文件...
(
echo DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
echo VITE_DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
) > .env.local

if exist ".env.local" (
    echo ✅ 文件创建成功！
    echo.
    echo 文件内容:
    type .env.local
) else (
    echo ❌ 文件创建失败
    pause
    exit /b 1
)

echo.
echo [3/3] 配置完成！
echo.
echo ⚠️  重要提示:
echo    1. 如果开发服务器正在运行，请按 Ctrl+C 停止
echo    2. 然后重新运行: npm run dev
echo    3. 或者直接运行: 启动.bat
echo.
echo ========================================
pause





