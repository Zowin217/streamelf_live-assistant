# 快速启动指南

## ⚠️ 重要提示

这是一个 **Vite + React** 项目，**不能直接双击打开 HTML 文件**！

必须通过开发服务器运行。

## 🚀 启动步骤

### 1. 安装依赖（如果还没安装）
```bash
npm install
```

### 2. 配置 API Key

在项目根目录创建 `.env.local` 文件：

```
DEEPSEEK_API_KEY=sk-xxxx
VITE_DEEPSEEK_API_KEY=sk-xxxx
```

获取 API Key: https://platform.deepseek.com/api_keys

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 打开浏览器

服务器启动后，你会看到类似这样的输出：
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

在浏览器中打开 `http://localhost:3000` 即可看到应用！

## 🔧 常见问题

### Q: 为什么打开 HTML 文件是空白的？
A: 因为这是 Vite 项目，需要编译和打包。必须通过 `npm run dev` 启动开发服务器。

### Q: 提示找不到 API Key？
A: 确保在项目根目录创建了 `.env.local` 文件，并正确配置了 `DEEPSEEK_API_KEY`/`VITE_DEEPSEEK_API_KEY`。

### Q: 端口 3000 被占用？
A: Vite 会自动尝试其他端口，或者你可以在 `vite.config.ts` 中修改端口号。

## 📝 其他命令

- `npm run build` - 构建生产版本
- `npm run preview` - 预览生产构建

