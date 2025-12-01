/**
 * LiveTalking Service Integration
 * 集成 LiveTalking 数字人服务，实现实时音视频对话
 * 
 * LiveTalking 是一个实时交互流式数字人项目
 * GitHub: https://github.com/lipku/LiveTalking
 */

export interface LiveTalkingConfig {
  serverUrl: string; // LiveTalking 服务器地址，例如: http://localhost:8010
  model?: 'wav2lip' | 'musetalk' | 'ernerf' | 'ultralight';
  avatarId?: string; // 数字人形象 ID
  transport?: 'webrtc' | 'rtmp';
}

export interface LiveTalkingStatus {
  connected: boolean;
  speaking: boolean;
  error?: string;
}

class LiveTalkingService {
  private config: LiveTalkingConfig;
  private wsConnection: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private localVideoRef: HTMLVideoElement | null = null;
  private status: LiveTalkingStatus = {
    connected: false,
    speaking: false,
  };

  constructor(config: LiveTalkingConfig) {
    this.config = {
      serverUrl: config.serverUrl || 'http://localhost:8010',
      model: config.model || 'wav2lip',
      avatarId: config.avatarId || 'wav2lip256_avatar1',
      transport: config.transport || 'webrtc',
    };
  }

  /**
   * 初始化 WebRTC 连接
   */
  async initializeWebRTC(videoElement: HTMLVideoElement): Promise<void> {
    this.localVideoRef = videoElement;

    try {
      // 创建 RTCPeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      });

      // 处理远程视频流
      this.pc.ontrack = (event) => {
        console.log('[LiveTalking] Received remote track:', event.track.kind);
        if (event.track.kind === 'video' && this.localVideoRef) {
          this.localVideoRef.srcObject = event.streams[0];
          this.localVideoRef.play().catch(err => {
            console.error('[LiveTalking] Error playing video:', err);
          });
        }
      };

      // 处理 ICE 候选
      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[LiveTalking] ICE candidate:', event.candidate);
          // 发送 ICE 候选到服务器（如果需要）
        }
      };

      // 连接状态变化
      this.pc.onconnectionstatechange = () => {
        console.log('[LiveTalking] Connection state:', this.pc?.connectionState);
        if (this.pc?.connectionState === 'connected') {
          this.status.connected = true;
        } else if (this.pc?.connectionState === 'disconnected' || this.pc?.connectionState === 'failed') {
          this.status.connected = false;
        }
      };

      // 创建 WebSocket 连接用于信令
      await this.connectWebSocket();

    } catch (error) {
      console.error('[LiveTalking] Initialization error:', error);
      this.status.error = `初始化失败: ${error}`;
      throw error;
    }
  }

  /**
   * 连接 WebSocket 用于信令交换
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.serverUrl.replace('http', 'ws')}/ws`;
      console.log('[LiveTalking] Connecting to WebSocket:', wsUrl);

      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('[LiveTalking] WebSocket connected');
        resolve();
      };

      this.wsConnection.onerror = (error) => {
        console.error('[LiveTalking] WebSocket error:', error);
        reject(error);
      };

      this.wsConnection.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log('[LiveTalking] Received message:', message);

        if (message.type === 'offer') {
          await this.handleOffer(message.offer);
        } else if (message.type === 'answer') {
          await this.handleAnswer(message.answer);
        } else if (message.type === 'ice-candidate') {
          await this.handleIceCandidate(message.candidate);
        }
      };
    });
  }

  /**
   * 处理 SDP Offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;

    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // 发送 Answer 到服务器
    if (this.wsConnection) {
      this.wsConnection.send(JSON.stringify({
        type: 'answer',
        answer: answer,
      }));
    }
  }

  /**
   * 处理 SDP Answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(answer);
  }

  /**
   * 处理 ICE 候选
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.addIceCandidate(candidate);
  }

  /**
   * 发送文本到数字人，让数字人说话
   */
  async speakText(text: string): Promise<void> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      console.error('[LiveTalking] WebSocket not connected');
      throw new Error('WebSocket 未连接');
    }

    this.status.speaking = true;

    // 发送文本到服务器
    this.wsConnection.send(JSON.stringify({
      type: 'text',
      text: text,
      avatar_id: this.config.avatarId,
    }));

    console.log('[LiveTalking] Sent text to speak:', text);
  }

  /**
   * 停止说话
   */
  async stopSpeaking(): Promise<void> {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        type: 'stop',
      }));
    }
    this.status.speaking = false;
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.localVideoRef) {
      this.localVideoRef.srcObject = null;
    }

    this.status.connected = false;
    this.status.speaking = false;
  }

  /**
   * 获取当前状态
   */
  getStatus(): LiveTalkingStatus {
    return { ...this.status };
  }

  /**
   * 使用 HTTP API 方式发送文本（备用方案）
   * 如果 WebRTC 连接有问题，可以使用 HTTP API
   */
  async speakTextViaHTTP(text: string): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          avatar_id: this.config.avatarId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.status.speaking = true;
      console.log('[LiveTalking] Text sent via HTTP:', text);
    } catch (error) {
      console.error('[LiveTalking] HTTP speak error:', error);
      throw error;
    }
  }
}

// 导出单例实例
let liveTalkingInstance: LiveTalkingService | null = null;

export const getLiveTalkingService = (config?: LiveTalkingConfig): LiveTalkingService => {
  if (!liveTalkingInstance && config) {
    liveTalkingInstance = new LiveTalkingService(config);
  } else if (!liveTalkingInstance) {
    throw new Error('LiveTalkingService 需要先初始化配置');
  }
  return liveTalkingInstance;
};

export const initializeLiveTalking = (config: LiveTalkingConfig): LiveTalkingService => {
  liveTalkingInstance = new LiveTalkingService(config);
  return liveTalkingInstance;
};

