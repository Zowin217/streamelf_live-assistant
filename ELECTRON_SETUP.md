# Electron 悬浮窗口使用指南

## 问题排查

如果 `electronAPI available: false`，请按以下步骤排查：

### 1. 确认 Electron 正确启动

**重要**：必须使用 Electron 窗口，而不是浏览器窗口！

- Electron 窗口有标题栏和菜单栏
- 浏览器窗口没有 Electron 的菜单栏

### 2. 启动方式

#### 方式一：使用 npm script（推荐）
```bash
npm run electron:dev
```

这会同时启动 Vite 开发服务器和 Electron。

#### 方式二：分别启动（两个终端）

**终端 1：**
```bash
npm run dev
```
等待看到 `VITE v6.x.x  ready in xxx ms` 和 `Local: http://localhost:3000`

**终端 2：**
```bash
npm run electron
```

### 3. 检查日志

#### 在 Electron 控制台查看日志：
1. Electron 窗口应该自动打开开发者工具
2. 如果没有，按 `Ctrl+Shift+I` (Windows) 或 `Cmd+Option+I` (Mac)
3. 查看 Console 标签页

#### 应该看到的日志：
- `[Electron] Starting application...`
- `[Electron] Preload path: ...`
- `[Preload] Preload script loaded`
- `[Preload] electronAPI exposed to window`
- `[LiveDashboard] electronAPI available: true`

#### 在终端查看日志：
- `[Electron] Creating prompter window...`
- `[Electron] Prompter window created successfully`

### 4. 常见问题

#### 问题 1：preload.js 路径错误
**症状**：没有 `[Preload]` 日志

**解决**：
- 确认 `electron/preload.js` 文件存在
- 检查 `electron/main.js` 中的 preload 路径

#### 问题 2：端口不匹配
**症状**：窗口加载失败

**解决**：
- 确认 Vite 运行在 `http://localhost:3000`
- 检查 `vite.config.ts` 中的端口配置

#### 问题 3：contextBridge 错误
**症状**：有 `[Preload]` 日志但没有 `electronAPI exposed`

**解决**：
- 检查 Electron 版本是否支持 contextBridge
- 确认 `contextIsolation: true` 已设置

### 5. 手动测试

在 Electron 开发者工具的控制台中运行：
```javascript
console.log('electronAPI:', window.electronAPI);
```

如果输出 `undefined`，说明 preload 脚本没有正确加载。

### 6. 重新安装依赖

如果以上都不行，尝试：
```bash
npm install
# 或者
rm -rf node_modules package-lock.json
npm install
```

## 验证步骤

1. ✅ 运行 `npm run electron:dev`
2. ✅ 看到 Electron 窗口（不是浏览器）
3. ✅ 在 Electron 控制台看到 `[Preload] Preload script loaded`
4. ✅ 在 Electron 控制台看到 `[LiveDashboard] electronAPI available: true`
5. ✅ 点击"提示词"或"小精灵"按钮
6. ✅ 在终端看到 `[Electron] Creating ... window...`
7. ✅ 看到悬浮窗口出现在桌面上

