# LiveTalking 数字人集成指南

本项目已集成 [LiveTalking](https://github.com/lipku/LiveTalking) 实时交互流式数字人，实现与主播的实时对话交互。

## 功能特点

- ✅ 实时音视频同步对话
- ✅ 支持多种数字人模型（wav2lip、musetalk、ernerf、Ultralight-Digital-Human）
- ✅ WebRTC 实时视频流
- ✅ 支持打断对话
- ✅ 与现有互动模式无缝集成

## 安装步骤

### 1. 安装 LiveTalking 后端服务

#### 方式一：使用 Docker（推荐）

```bash
docker run --gpus all -it --network=host --rm registry.cn-beijing.aliyuncs.com/codewithgpu2/lipku-metahuman-stream:2K9qaMBu8v
```

#### 方式二：本地安装

```bash
# 克隆 LiveTalking 仓库
git clone https://github.com/lipku/LiveTalking.git
cd LiveTalking

# 创建 conda 环境
conda create -n nerfstream python=3.10
conda activate nerfstream

# 安装 PyTorch（根据你的 CUDA 版本）
# CUDA 12.4:
conda install pytorch==2.5.0 torchvision==0.20.0 torchaudio==2.5.0 pytorch-cuda=12.4 -c pytorch -c nvidia

# 安装依赖
pip install -r requirements.txt
```

### 2. 下载模型文件

从以下地址下载模型文件：

- **夸克云盘**: https://pan.quark.cn/s/83a750323ef0
- **Google Drive**: https://drive.google.com/drive/folders/1FOC_MD6wdogyyX_7V1d4NDIO7P9NlSAJ?usp=sharing

将以下文件放置到对应目录：

1. `wav2lip256.pth` → `LiveTalking/models/wav2lip.pth`
2. `wav2lip256_avatar1.tar.gz` 解压后 → `LiveTalking/data/avatars/wav2lip256_avatar1/`

### 3. 启动 LiveTalking 服务

```bash
cd LiveTalking
python app.py --transport webrtc --model wav2lip --avatar_id wav2lip256_avatar1
```

服务将在 `http://localhost:8010` 启动。

**重要**: 确保服务器开放以下端口：
- TCP: 8010
- UDP: 1-65536（用于 WebRTC）

### 4. 配置前端环境变量

在项目根目录创建或编辑 `.env.local` 文件：

```env
# LiveTalking 服务器地址
VITE_LIVETALKING_URL=http://localhost:8010
```

如果 LiveTalking 服务运行在其他机器上，请使用对应的 IP 地址：

```env
VITE_LIVETALKING_URL=http://192.168.1.100:8010
```

### 5. 启动前端应用

```bash
npm run dev
```

## 使用方法

1. **启动 LiveTalking 后端服务**（确保在 `http://localhost:8010` 运行）

2. **打开前端应用**，进入直播页面

3. **切换到"互动模式"**

4. **点击"数字人"按钮**启用 LiveTalking（按钮会显示连接状态）

5. **开始对话**：
   - 说话时，你的语音会被识别并显示在屏幕上
   - 小精灵会生成回复并通过 LiveTalking 数字人视频播放
   - 数字人会实时同步口型和语音

## 功能说明

### LiveTalking vs TTS

- **LiveTalking 模式**：显示真实的数字人视频，口型同步，更真实
- **TTS 模式**：使用浏览器语音合成，只有声音，显示静态头像

在互动模式下，可以通过顶部的"数字人"/"TTS"按钮切换。

### 连接状态指示

- 🟢 **绿色"数字人"**：LiveTalking 已连接，可以使用
- 🟡 **黄色"连接中..."**：正在连接 LiveTalking 服务
- ⚪ **灰色"TTS"**：使用 TTS 模式（LiveTalking 未启用）

## 故障排除

### 1. 无法连接到 LiveTalking

**问题**: 按钮显示"连接中..."或"LiveTalking 未连接"

**解决方案**:
- 检查 LiveTalking 服务是否在运行：访问 `http://localhost:8010`
- 检查 `.env.local` 中的 `VITE_LIVETALKING_URL` 是否正确
- 检查防火墙是否阻止了端口 8010
- 查看浏览器控制台的错误信息

### 2. 视频不显示

**问题**: 数字人视频区域为黑色或空白

**解决方案**:
- 检查 WebRTC 连接是否建立（查看浏览器控制台日志）
- 确认模型文件已正确下载并放置
- 检查 GPU 是否可用（LiveTalking 需要 GPU）

### 3. 数字人不说话

**问题**: 视频显示但数字人不说话

**解决方案**:
- 检查文本是否成功发送到 LiveTalking（查看控制台日志）
- 确认 TTS 服务在 LiveTalking 后端正常运行
- 尝试切换到 TTS 模式测试语音合成是否正常

### 4. 延迟较高

**问题**: 从说话到数字人回复延迟很长

**解决方案**:
- 使用更快的 GPU（推荐 RTX 3080Ti 或更高）
- 使用 `wav2lip256` 模型（比 musetalk 更快）
- 检查网络延迟（如果 LiveTalking 在远程服务器）

## 性能要求

### 最低配置

- **GPU**: NVIDIA RTX 3060 或更高
- **CPU**: 4 核以上
- **内存**: 8GB 以上

### 推荐配置

- **GPU**: NVIDIA RTX 3080Ti / 3090 / 4090
- **CPU**: 8 核以上
- **内存**: 16GB 以上

### 性能参考

| 模型 | GPU | FPS |
|------|-----|-----|
| wav2lip256 | RTX 3060 | 60 |
| wav2lip256 | RTX 3080Ti | 120 |
| musetalk | RTX 3080Ti | 42 |
| musetalk | RTX 4090 | 72 |

## 更多资源

- **LiveTalking GitHub**: https://github.com/lipku/LiveTalking
- **LiveTalking 文档**: https://livetalking-doc.readthedocs.io/
- **国内镜像**: https://gitee.com/lipku/LiveTalking

## 注意事项

1. **GPU 要求**: LiveTalking 需要 NVIDIA GPU 和 CUDA 支持
2. **端口开放**: 确保服务器开放 TCP 8010 和 UDP 端口范围
3. **网络延迟**: 如果 LiveTalking 在远程服务器，网络延迟会影响实时性
4. **浏览器兼容**: 需要支持 WebRTC 的现代浏览器（Chrome、Edge、Firefox）

## 商业版功能

如果需要更高级的功能（高清模型、完全语音交互、实时字幕等），可以联系 LiveTalking 商业版：
- 文档: https://livetalking-doc.readthedocs.io/zh-cn/latest/service.html

