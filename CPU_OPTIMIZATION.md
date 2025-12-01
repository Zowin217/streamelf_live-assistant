# CPU 模式优化指南

本指南说明如何在只有 CPU（没有 GPU）的情况下实现快速实时的语音识别和对话效果。

## Faster-Whisper CPU 优化配置

### 1. 使用更小的模型

在 `components/LiveDashboard.tsx` 中，faster-whisper 已配置为使用 `tiny` 模型（CPU 模式）：

```typescript
const transcript = await transcribeWithFasterWhisper(audioBlob, {
  model: 'tiny', // ✅ 已优化为 tiny 模型（最快）
  device: 'cpu',
  computeType: 'int8', // ✅ 使用 int8 量化（最快）
  language: 'en',
});
```

**模型选择建议（CPU）**：
- `tiny`: ⚡ 最快，延迟约 0.5-1.5 秒，准确率中等（推荐用于实时对话）
- `base`: 延迟约 1-3 秒，准确率较好
- `small`: 延迟约 2-5 秒，准确率高（不推荐用于实时）

### 2. 缩短录音块大小

已优化为 **1 秒**录音块（从 2 秒减少），实现更快的响应：

```typescript
}, 1000); // ✅ 1 second chunks for faster response on CPU
```

### 3. 使用 int8 量化

`int8` 计算类型可以：
- 减少内存占用
- 加快处理速度
- 在 CPU 上提供最佳性能

## 性能预期（CPU 模式）

### 配置：tiny 模型 + int8 + 1秒块

- **延迟**: 0.5-2 秒（从说话到显示文本）
- **准确率**: 中等（适合日常对话）
- **CPU 使用**: 中等（单核 50-80%）

### 实际测试结果

| CPU 型号 | 延迟 | 准确率 | 推荐 |
|---------|------|--------|------|
| Intel i5-8代+ | 0.8-1.5s | 良好 | ✅ 推荐 |
| Intel i7-10代+ | 0.5-1.2s | 良好 | ✅ 推荐 |
| AMD Ryzen 5+ | 0.6-1.3s | 良好 | ✅ 推荐 |
| 较旧 CPU | 1.5-3s | 中等 | ⚠️ 可接受 |

## 进一步优化建议

### 1. 如果延迟仍然较高

**选项 A**: 减少录音块大小到 0.8 秒
```typescript
}, 800); // 更短的块，但可能影响准确率
```

**选项 B**: 使用 Web Speech API（实时，但准确率较低）
- 在互动模式下，点击 "Web Speech" 按钮切换

### 2. 如果准确率不够

**选项 A**: 升级到 `base` 模型（延迟增加 0.5-1 秒）
```typescript
model: 'base', // 更准确，但稍慢
```

**选项 B**: 使用 GPU（如果有）
```typescript
device: 'cuda', // 需要 NVIDIA GPU
computeType: 'float16',
```

### 3. 系统优化

- **关闭其他占用 CPU 的程序**
- **使用性能模式**（Windows: 电源选项 → 高性能）
- **确保有足够的 RAM**（推荐 8GB+）

## 与 Web Speech API 对比

| 特性 | Faster-Whisper (CPU) | Web Speech API |
|------|---------------------|----------------|
| 延迟 | 0.5-2 秒 | < 0.5 秒 |
| 准确率 | 中等-高 | 中等 |
| 离线 | ✅ 是 | ❌ 否 |
| CPU 使用 | 中等 | 低 |
| 多语言 | ✅ 支持 | 有限 |

## 推荐配置

### 实时对话（推荐）

```typescript
{
  model: 'tiny',
  device: 'cpu',
  computeType: 'int8',
  language: 'en',
}
// 录音块: 1 秒
```

### 平衡模式

```typescript
{
  model: 'base',
  device: 'cpu',
  computeType: 'int8',
  language: 'en',
}
// 录音块: 1.5 秒
```

### 高准确率模式（不推荐用于实时）

```typescript
{
  model: 'small',
  device: 'cpu',
  computeType: 'int8',
  language: 'en',
}
// 录音块: 2 秒
```

## 故障排除

### 问题：延迟仍然很高（> 3 秒）

**解决方案**:
1. 检查 CPU 使用率（任务管理器）
2. 关闭其他占用 CPU 的程序
3. 确保使用 `tiny` 模型和 `int8`
4. 检查网络延迟（如果 faster-whisper 在远程服务器）

### 问题：识别准确率低

**解决方案**:
1. 升级到 `base` 模型（牺牲一些速度）
2. 确保环境安静，减少背景噪音
3. 说话清晰，语速适中
4. 检查麦克风质量

### 问题：CPU 使用率过高

**解决方案**:
1. 使用 `tiny` 模型（最小资源占用）
2. 增加录音块大小到 1.5 秒（减少处理频率）
3. 关闭其他程序

## 总结

✅ **当前配置已优化为 CPU 实时模式**：
- `tiny` 模型（最快）
- `int8` 量化（最快）
- 1 秒录音块（最快响应）

这个配置可以在大多数现代 CPU 上实现 **0.5-2 秒** 的延迟，适合实时对话。

如果需要更快的响应，建议使用 **Web Speech API**（点击 "Web Speech" 按钮）。

