# Faster-Whisper 语音识别集成指南

本项目已集成 [faster-whisper](https://github.com/SYSTRAN/faster-whisper) 提供更准确的语音识别服务，作为 Web Speech API 的替代方案。

## 为什么使用 Faster-Whisper？

- ✅ **更高的准确性**: 基于 OpenAI Whisper 模型，识别准确率更高
- ✅ **更好的多语言支持**: 支持多种语言，包括中文
- ✅ **离线运行**: 不需要网络连接，保护隐私
- ✅ **可配置模型**: 可以选择不同大小的模型平衡速度和准确性

## 安装步骤

### 1. 安装 Python 依赖

```bash
pip install faster-whisper
```

如果需要 GPU 加速（推荐，速度更快）：

```bash
# 确保已安装 CUDA
pip install faster-whisper
# GPU 版本会自动使用 CUDA（如果可用）
```

### 2. 启动 Faster-Whisper 代理服务

```bash
npm run server:faster-whisper
```

或者直接运行：

```bash
node server/fasterWhisperProxy.js
```

服务将在 `http://localhost:4001` 启动。

### 3. 配置前端

前端会自动检测 faster-whisper 服务是否可用。如果服务运行在非默认端口，可以在 `.env.local` 中配置：

```env
VITE_FASTER_WHISPER_URL=http://localhost:4001
```

## 使用方法

1. **启动 faster-whisper 服务**（确保在 `http://localhost:4001` 运行）

2. **打开前端应用**，进入直播页面

3. **切换到"互动模式"**

4. **点击"Faster-Whisper"按钮**启用 faster-whisper 识别

5. **开始说话**，系统会使用 faster-whisper 进行识别

## 模型选择

可以在 `services/fasterWhisperService.ts` 中修改默认模型：

- `tiny`: 最快，但准确率较低
- `base`: 平衡速度和准确性（默认）
- `small`: 更准确，但稍慢
- `medium`: 高准确率
- `large-v3`: 最高准确率，但最慢
- `turbo`: 优化的快速模型

### 修改模型

在 `components/LiveDashboard.tsx` 中找到 `transcribeWithFasterWhisper` 调用，修改 `model` 参数：

```typescript
const transcript = await transcribeWithFasterWhisper(audioBlob, {
  model: 'small', // 改为你想要的模型
  device: 'cpu', // 或 'cuda' 如果有 GPU
  computeType: 'int8', // 或 'float16', 'float32'
  language: 'en',
});
```

## 性能优化

### CPU 模式

- 使用 `int8` 计算类型（默认）
- 推荐模型：`base` 或 `small`
- 预期延迟：2-5 秒

### GPU 模式（推荐）

- 使用 `cuda` 设备和 `float16` 计算类型
- 推荐模型：`base`, `small`, 或 `medium`
- 预期延迟：0.5-2 秒

修改 `device` 和 `computeType`：

```typescript
const transcript = await transcribeWithFasterWhisper(audioBlob, {
  model: 'base',
  device: 'cuda', // 使用 GPU
  computeType: 'float16', // GPU 推荐使用 float16
  language: 'en',
});
```

## 故障排除

### 1. 服务无法启动

**问题**: `npm run server:faster-whisper` 报错

**解决方案**:
- 确保已安装 `faster-whisper`: `pip install faster-whisper`
- 检查 Python 版本（推荐 Python 3.8+）
- 查看错误日志

### 2. 识别延迟很高

**问题**: 从说话到显示文本需要很长时间

**解决方案**:
- 使用 GPU 模式（如果可用）
- 使用更小的模型（`tiny` 或 `base`）
- 减少录音块大小（在代码中修改 `recordingIntervalRef` 的间隔）

### 3. 识别准确率不高

**问题**: 识别结果不准确

**解决方案**:
- 使用更大的模型（`small`, `medium`, `large-v3`）
- 确保环境安静，减少背景噪音
- 说话清晰，语速适中
- 使用 GPU 模式提高处理速度，可以使用更大的模型

### 4. 内存不足

**问题**: 运行大模型时内存不足

**解决方案**:
- 使用更小的模型（`tiny`, `base`）
- 使用 `int8` 计算类型减少内存占用
- 关闭其他占用内存的程序

## 与 Web Speech API 对比

| 特性 | Web Speech API | Faster-Whisper |
|------|----------------|---------------|
| 准确性 | 中等 | 高 |
| 速度 | 实时（< 1秒） | 2-5秒（CPU）或 0.5-2秒（GPU） |
| 离线支持 | 否（需要网络） | 是 |
| 多语言 | 有限 | 支持多种语言 |
| 隐私 | 数据发送到云端 | 本地处理 |
| 配置 | 简单 | 需要安装和配置 |

## 推荐使用场景

- **使用 Faster-Whisper**: 需要高准确率、多语言支持、或离线使用
- **使用 Web Speech API**: 需要实时响应、简单配置、或网络环境良好

## 更多资源

- **Faster-Whisper GitHub**: https://github.com/SYSTRAN/faster-whisper
- **OpenAI Whisper**: https://github.com/openai/whisper

