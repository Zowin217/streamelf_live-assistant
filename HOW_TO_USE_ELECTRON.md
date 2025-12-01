# 如何使用 Electron 版本

## ⚠️ 重要提示

如果你看到 `[UI] electronAPI not available`，说明你**不是在 Electron 窗口中**，而是在**浏览器**中查看应用。

## 如何区分 Electron 和浏览器

### Electron 窗口的特征：
- ✅ 有菜单栏（File, Edit, View, Window, Help）
- ✅ 窗口标题栏样式不同
- ✅ 可以按 `Ctrl+Shift+I` 打开开发者工具（但样式不同）
- ✅ 控制台日志会显示 `[Electron]` 和 `[Preload]` 前缀

### 浏览器窗口的特征：
- ❌ 没有菜单栏（或只有浏览器的菜单）
- ❌ 地址栏显示 `http://localhost:3000`
- ❌ 控制台日志**不会**显示 `[Electron]` 和 `[Preload]` 前缀

## 正确的启动步骤

### 方法 1：使用 npm script（推荐）

```bash
# 1. 确保在项目根目录
cd "E:\产品经理\AI产品经理学习\streamelf---live-assistant"

# 2. 安装依赖（如果还没安装）
npm install

# 3. （推荐）另开一个终端，先启动 Faster-Whisper
npm run server:faster-whisper

# 4. 在新的终端中启动 Electron（这会同时启动 Vite 和 Electron）
npm run electron:dev
```

**你应该看到：**
- 终端输出：`[Electron] main.js script loaded`
- 终端输出：`[Electron] App ready, creating main window...`
- 一个 Electron 窗口打开（不是浏览器）

### 方法 2：分别启动（两个终端）

**终端 1：**
```bash
npm run dev
```
等待看到：`VITE v6.x.x  ready in xxx ms` 和 `Local: http://localhost:3000`

**终端 2：**
```bash
npm run electron
```

## 验证 Electron 是否运行

### 1. 检查终端日志

运行 `npm run electron:dev` 后，终端应该显示：
```
========================================
[Electron] main.js script loaded
[Electron] Node version: ...
[Electron] Electron version: ...
[Electron] Platform: ...
[Electron] isDev: true
========================================
[Electron] Preload path: ...
[Electron] Preload exists: true
[Electron] ========== App ready, creating main window... ==========
```

### 2. 检查 Electron 窗口

- 打开 Electron 窗口（不是浏览器）
- 按 `Ctrl+Shift+I` 打开开发者工具
- 在 Console 中应该看到：
  ```
  [Preload] ========== Preload script STARTING ==========
  [Preload] contextBridge available: true
  [Preload] ✅ electronAPI exposed to window successfully
  ```

### 3. 手动测试

在 Electron 开发者工具的控制台中运行：
```javascript
console.log('electronAPI:', window.electronAPI);
console.log('typeof electronAPI:', typeof window.electronAPI);
```

如果输出 `undefined`，说明 preload 没有加载。

## 悬浮窗口的拖拽与关闭

- 提示词窗口顶部的黑色标题栏支持拖拽（鼠标按住顶部空白区域即可移动）
- 小精灵窗口的主体也可以直接拖拽；右上角的 `X` 用于关闭
- 所有按钮、文本区域都可以正常点击/选择，它们已经标记为可交互区域

## 常见问题

### Q: 我运行了 `npm run electron:dev`，但打开的是浏览器
**A:** 检查：
1. 终端中是否有 `[Electron]` 日志？
2. 是否有 Electron 窗口打开？
3. 如果只有浏览器打开，可能是 Vite 的 `open: true` 配置导致的

### Q: 终端中没有 `[Electron]` 日志
**A:** 说明 Electron 没有启动。检查：
1. `npm list electron` 是否显示 electron 已安装
2. `electron/main.js` 文件是否存在
3. `package.json` 中的 `main` 字段是否正确

### Q: Electron 窗口打开了，但没有 `[Preload]` 日志
**A:** 说明 preload 脚本没有加载。检查：
1. `electron/preload.js` 文件是否存在
2. 终端中 `[Electron] Preload exists:` 是否为 `true`
3. Electron 控制台中是否有错误信息

### Q: 在 Electron 中语音识别提示 `network` 错误
**A:** Web Speech API 依赖 Google 的云服务，某些网络或本地 `http` 环境下会被阻止。解决办法：
1. 在新的终端运行 `npm run server:faster-whisper`
2. 回到 Electron 页面，切换到“Faster-Whisper”模式
3. 确保麦克风权限已允许

## 快速测试

运行这个命令测试 Electron 是否正常工作：
```bash
node test-electron.js
```

如果 Electron 正常工作，应该会打开一个窗口。

