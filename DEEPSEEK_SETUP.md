# DeepSeek API 配置说明

## ✅ 已完成的集成

项目已成功集成 DeepSeek API，替换了原来的 Gemini API。

## 🔑 配置 API Key

### 方法 1: 直接编辑 .env.local 文件

在项目根目录的 `.env.local` 文件中添加：

```
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
VITE_DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
```

### 方法 2: 如果 .env.local 不存在

1. 在项目根目录创建 `.env.local` 文件
2. 添加以下内容：

```
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
VITE_DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY
```

## 📝 文件说明

- **services/deepseekService.ts** - DeepSeek API 服务文件
- **components/ProductManager.tsx** - 已更新为使用 DeepSeek
- **components/LiveDashboard.tsx** - 已更新为使用 DeepSeek
- **vite.config.ts** - 已添加 DEEPSEEK_API_KEY 环境变量支持

## 🚀 使用方法

配置完成后，重启开发服务器：

```bash
npm run dev
```

现在所有的 AI 功能都会使用 DeepSeek API！

## 🔄 切换回 Gemini（可选）

如果你想切换回 Gemini，只需要：

1. 在 `.env.local` 中配置 `GEMINI_API_KEY`
2. 将组件中的导入改回：
   - `components/ProductManager.tsx`: `import { generateProductScript } from '../services/geminiService';`
   - `components/LiveDashboard.tsx`: `import { generateElfReply } from '../services/geminiService';`

## 📚 API 文档

DeepSeek API 文档: https://platform.deepseek.com/docs




