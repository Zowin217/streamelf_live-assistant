#!/usr/bin/env python3
"""
Faster-Whisper Transcription Script
使用 faster-whisper 进行语音转录

安装依赖:
pip install faster-whisper
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({
        "error": "faster-whisper not installed",
        "detail": "Please install: pip install faster-whisper"
    }), file=sys.stderr)
    sys.exit(1)


def transcribe_audio(audio_path, language='en', model_size='base', device='cpu', compute_type='int8'):
    """
    使用 faster-whisper 转录音频
    
    Args:
        audio_path: 音频文件路径
        language: 语言代码 (en, zh, etc.)
        model_size: 模型大小 (tiny, base, small, medium, large-v3, turbo)
        device: 设备 (cpu, cuda)
        compute_type: 计算类型 (int8, float16, float32)
    """
    try:
        # 检查音频文件是否存在
        if not Path(audio_path).exists():
            return {
                "error": "Audio file not found",
                "detail": f"File not found: {audio_path}"
            }
        
        # 初始化模型
        print(f"[Faster-Whisper] Loading model: {model_size}, device: {device}, compute_type: {compute_type}", file=sys.stderr)
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        # 执行转录
        print(f"[Faster-Whisper] Transcribing audio: {audio_path}", file=sys.stderr)
        segments, info = model.transcribe(
            audio_path,
            language=language if language != 'auto' else None,
            beam_size=5,
            vad_filter=True,  # 启用 VAD 过滤，提高准确性
            vad_parameters=dict(min_silence_duration_ms=500),  # 最小静音时长
        )
        
        # 收集所有片段
        transcript_parts = []
        for segment in segments:
            transcript_parts.append(segment.text.strip())
        
        # 合并文本
        full_text = ' '.join(transcript_parts).strip()
        
        # 返回结果
        result = {
            "text": full_text,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
        }
        
        print(f"[Faster-Whisper] Transcription complete: {len(full_text)} characters", file=sys.stderr)
        return result
        
    except Exception as e:
        return {
            "error": "Transcription failed",
            "detail": str(e)
        }


def main():
    parser = argparse.ArgumentParser(description='Transcribe audio using faster-whisper')
    parser.add_argument('--audio', required=True, help='Path to audio file')
    parser.add_argument('--language', default='en', help='Language code (default: en)')
    parser.add_argument('--model', default='base', help='Model size (default: base)')
    parser.add_argument('--device', default='cpu', help='Device: cpu or cuda (default: cpu)')
    parser.add_argument('--compute_type', default='int8', help='Compute type: int8, float16, float32 (default: int8)')
    
    args = parser.parse_args()
    
    # 执行转录
    result = transcribe_audio(
        audio_path=args.audio,
        language=args.language,
        model_size=args.model,
        device=args.device,
        compute_type=args.compute_type
    )
    
    # 输出 JSON 结果
    print(json.dumps(result, ensure_ascii=False))
    
    # 如果有错误，返回非零退出码
    if 'error' in result:
        sys.exit(1)


if __name__ == '__main__':
    main()

