@echo off
chcp 65001 >nul
echo ========================================
echo   StreamElf - 启动开发服务器
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js
    echo 请先安装 Node.js: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js 已安装

echo.
echo [2/3] 检查依赖...
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)
echo ✅ 依赖已就绪

echo.
echo [3/3] 检查 API Key...
if not exist ".env.local" (
    echo ⚠️  警告: 未找到 .env.local 文件
    echo.
    echo 请创建 .env.local 文件并添加:
    echo DEEPSEEK_API_KEY=你的API密钥
    echo VITE_DEEPSEEK_API_KEY=你的API密钥
    echo.
    echo 获取 API Key: https://platform.deepseek.com/api_keys
    echo.
    pause
)

echo.
echo ========================================
echo   正在启动开发服务器...
echo ========================================
echo.
echo 启动后，请在浏览器中打开显示的地址
echo 通常是: http://localhost:3000
echo.
echo 按 Ctrl+C 可以停止服务器
echo ========================================
echo.

call npm run dev

pause

