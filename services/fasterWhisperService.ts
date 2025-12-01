/**
 * Faster-Whisper Service
 * 使用 faster-whisper 进行更准确的语音识别
 */

export interface FasterWhisperConfig {
  serverUrl?: string;
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large-v3' | 'turbo';
  device?: 'cpu' | 'cuda';
  computeType?: 'int8' | 'float16' | 'float32';
  language?: string;
}

const DEFAULT_CONFIG: FasterWhisperConfig = {
  serverUrl: ((import.meta as any).env?.VITE_FASTER_WHISPER_URL as string) || 'http://localhost:4001',
  model: 'base', // Use 'base' for better accuracy (was 'tiny' for speed)
  device: 'cpu',
  computeType: 'int8',
  language: 'en',
};

/**
 * 使用 faster-whisper 转录音频
 */
export const transcribeWithFasterWhisper = async (
  audioBlob: Blob,
  config: FasterWhisperConfig = {}
): Promise<string | null> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');
    formData.append('language', finalConfig.language || 'en');
    formData.append('model', finalConfig.model || 'base');
    formData.append('device', finalConfig.device || 'cpu');
    formData.append('compute_type', finalConfig.computeType || 'int8');

    console.log(`[Faster-Whisper] Sending audio: ${audioBlob.size} bytes, model: ${finalConfig.model}`);

    const response = await fetch(`${finalConfig.serverUrl}/api/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorDetail;
      try {
        const errorData = await response.json();
        errorDetail = errorData.detail || errorData.error || 'Unknown error';
        console.error('[Faster-Whisper] Server error:', errorData);
      } catch {
        errorDetail = await response.text();
        console.error('[Faster-Whisper] Server error (text):', errorDetail);
      }
      console.error(`[Faster-Whisper] Failed with status ${response.status}:`, errorDetail);
      return null;
    }

    const data = await response.json();
    const transcript = data?.text || null;
    
    if (transcript) {
      console.log(`[Faster-Whisper] Success: "${transcript.substring(0, 50)}..."`);
      console.log(`[Faster-Whisper] Language: ${data.language} (prob: ${data.language_probability?.toFixed(2)})`);
    }
    
    return transcript;
  } catch (error) {
    console.error('[Faster-Whisper] Network/parse error:', error);
    if (error instanceof Error) {
      console.error('[Faster-Whisper] Error message:', error.message);
    }
    return null;
  }
};

/**
 * 检查 faster-whisper 服务是否可用
 */
export const checkFasterWhisperHealth = async (serverUrl?: string): Promise<boolean> => {
  const url = serverUrl || DEFAULT_CONFIG.serverUrl;
  
  try {
    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000), // 3秒超时
    });
    return response.ok;
  } catch (error) {
    console.warn('[Faster-Whisper] Health check failed:', error);
    return false;
  }
};

