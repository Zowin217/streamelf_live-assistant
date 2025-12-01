

# StreamElf - AI Live Assistant

A powerful live streaming assistant powered by DeepSeek AI. Create product scripts, manage your live stream, and get AI-powered assistance during your broadcasts.

## 🆕 LiveTalking 数字人集成

本项目已集成 [LiveTalking](https://github.com/lipku/LiveTalking) 实时交互流式数字人，实现与主播的实时对话交互！

**快速开始**: 查看 [LIVETALKING_SETUP.md](./LIVETALKING_SETUP.md) 了解详细安装和使用说明。

### 主要功能
- ✅ 实时音视频同步对话
- ✅ 支持多种数字人模型（wav2lip、musetalk 等）
- ✅ WebRTC 实时视频流
- ✅ 与现有互动模式无缝集成

## 操作流程：

### 1、选择一个小精灵（每个小精灵的性格不同）
<img width="2542" height="1377" alt="截图_20251201213753" src="https://github.com/user-attachments/assets/b03daffb-8b81-45df-9f8f-24d8b2c7ab0b" />

### 2、在产品tab，增加产品，并进一步生成逐字稿
<img width="2414" height="1223" alt="截图_20251201214012" src="https://github.com/user-attachments/assets/cfddf10d-d221-4a3a-a64a-c3d0a58bbe6c" />
可以修改或者重新生成逐字稿
<img width="1545" height="798" alt="截图_20251201214055" src="https://github.com/user-attachments/assets/0a3016e1-1ead-4906-a43f-793cada5be20" />

### 3、连接直播房间
<img width="2323" height="1155" alt="截图_20251201214135" src="https://github.com/user-attachments/assets/03f314de-0267-4c52-90bb-a496d41b155a" />

### 4、逐字稿模式：自动识别主播当前读稿内容，并驱动逐字稿自动滚动（也可以切换为匀速滚动）
<img width="2524" height="1299" alt="截图_20251201214204" src="https://github.com/user-attachments/assets/09c00a97-aacd-4e8c-b960-66f9c918227f" />

### 5、互动模式：与小精灵自然对话，页面中不断出现新话题，让主播一直有话聊
<img width="2502" height="1114" alt="截图_20251201214305" src="https://github.com/user-attachments/assets/241a3007-293e-464f-a356-4856a7c337d5" />

### 6、悬浮于桌面：逐字稿和小精灵模块可以悬浮在桌面上，随意改变位置
<img width="2132" height="1484" alt="截图_20251201214838" src="https://github.com/user-attachments/assets/b968ac4b-a356-4e87-a1dd-f009e9e4011f" />

## Features

✨ **AI-Powered Script Generation** - Generate engaging product scripts tailored to your chosen AI companion's personality  
🎭 **Multiple AI Personalities** - Choose from 4 unique AI companions (Sparkle, Puff, Glitch, Ace)  
📝 **Smart Teleprompter** - Voice-synced or timer-based auto-scrolling teleprompter  
💬 **Live Comment Integration** - AI assistant responds to viewer comments in real-time  
🎬 **LiveTalking Digital Human** - Real-time interactive digital human with lip-sync (NEW!)  
💾 **Data Persistence** - All your products and settings are automatically saved  
📤 **Export Scripts** - Download your generated scripts as text files  
✏️ **Edit Products** - Easily edit product information and regenerate scripts  

## Run Locally

**Prerequisites:** 
- Node.js (v18 or higher)  
- Modern browser with Web Speech API support (Chrome, Edge recommended)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file in the root directory and add your API key:
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   VITE_DEEPSEEK_API_KEY=your_api_key_here
   ```
   - Get your DeepSeek API key: https://platform.deepseek.com/api_keys

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Usage Guide

1. **Select Your AI Companion** - Choose from 4 unique personalities on the home screen
2. **Add Products** - Go to the Products tab and add products you want to sell
3. **Generate Scripts** - Click "Generate Script" to create AI-powered sales scripts
4. **Connect & Go Live** - Set up your stream connection and enter the live dashboard
5. **Use the Teleprompter** - Start the teleprompter and let it guide you through your script

## Project Structure

```
├── components/          # React components
│   ├── ElfSelector.tsx  # AI companion selection
│   ├── ProductManager.tsx  # Product and script management
│   ├── LiveDashboard.tsx  # Live streaming interface
│   └── Layout.tsx       # App layout and navigation
├── services/            # API services
│   ├── deepseekService.ts       # DeepSeek integration
│   ├── transcriptionService.ts  # (legacy) Whisper proxy client
│   └── geminiService.ts         # (legacy) Gemini integration
├── types.ts            # TypeScript type definitions
├── constants.ts        # App constants and mock data
└── App.tsx             # Main application component
```

## Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **DeepSeek** - AI text generation
- **Web Speech API** - Real-time speech recognition (browser-native)
- **Lucide React** - Icons

## Features in Detail

### Smart Teleprompter
- **Voice Sync Mode**: Real-time speech recognition using Web Speech API, automatically advances when you speak
- **Timer Mode**: Auto-scrolls based on estimated reading time
- **Manual Controls**: Navigate forward/backward, reset to start
- **Customizable**: Adjust font size and scroll speed

### AI Companions
- **Sparkle**: Energetic and enthusiastic, perfect for high-energy streams
- **Puff**: Gentle and caring, great for lifestyle and wellness products
- **Glitch**: Sarcastic and witty, adds humor to your stream
- **Ace**: Professional and data-driven, ideal for technical products

## License

This project is private and for personal use.

---

View your app in AI Studio: https://ai.studio/apps/drive/1R955-pke5H_TnXkm-MmGib__Q_Ljuuab
