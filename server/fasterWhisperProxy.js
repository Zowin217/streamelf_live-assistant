/**
 * Faster-Whisper Proxy Server
 * 使用 faster-whisper 提供更准确的语音识别服务
 * 
 * 安装依赖:
 * pip install faster-whisper
 */

import express from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ 
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const PORT = process.env.FASTER_WHISPER_PORT || 4001;
const PYTHON_SCRIPT = path.join(__dirname, 'fasterWhisperTranscribe.py');

// 检查 Python 脚本是否存在
if (!fs.existsSync(PYTHON_SCRIPT)) {
  console.error(`❌ Python script not found: ${PYTHON_SCRIPT}`);
  process.exit(1);
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'faster-whisper-proxy' });
});

// 语音转录接口
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const audioPath = req.file.path;
  const language = req.body.language || 'en';
  const modelSize = req.body.model || 'base'; // base, small, medium, large-v3, turbo
  const device = req.body.device || 'cpu'; // cpu or cuda
  const computeType = req.body.compute_type || 'int8'; // int8, float16, float32

  console.log(`[Faster-Whisper] Transcribing: ${audioPath}`);
  console.log(`[Faster-Whisper] Language: ${language}, Model: ${modelSize}, Device: ${device}`);

  try {
    // 调用 Python 脚本进行转录
    const pythonProcess = spawn('python', [
      PYTHON_SCRIPT,
      '--audio', audioPath,
      '--language', language,
      '--model', modelSize,
      '--device', device,
      '--compute_type', computeType,
    ], {
      env: {
        ...process.env,
        KMP_DUPLICATE_LIB_OK: 'TRUE',
        HF_HUB_DISABLE_SYMLINKS_WARNING: '1',
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Faster-Whisper] Python stderr: ${data.toString()}`);
    });

    pythonProcess.on('close', (code) => {
      // 清理临时文件
      fs.unlink(audioPath, (err) => {
        if (err) console.error(`[Faster-Whisper] Error deleting temp file: ${err}`);
      });

      if (code !== 0) {
        console.error(`[Faster-Whisper] Python process exited with code ${code}`);
        console.error(`[Faster-Whisper] stderr: ${stderr}`);
        return res.status(500).json({ 
          error: 'Transcription failed', 
          detail: stderr || `Process exited with code ${code}` 
        });
      }

      try {
        const result = JSON.parse(stdout);
        console.log(`[Faster-Whisper] Success: ${result.text?.substring(0, 50)}...`);
        res.json(result);
      } catch (parseError) {
        console.error(`[Faster-Whisper] Failed to parse result: ${parseError}`);
        console.error(`[Faster-Whisper] stdout: ${stdout}`);
        res.status(500).json({ 
          error: 'Failed to parse transcription result', 
          detail: stdout 
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error(`[Faster-Whisper] Failed to start Python process: ${error}`);
      // 清理临时文件
      fs.unlink(audioPath, (err) => {
        if (err) console.error(`[Faster-Whisper] Error deleting temp file: ${err}`);
      });
      res.status(500).json({ 
        error: 'Failed to start transcription process', 
        detail: error.message 
      });
    });

  } catch (error) {
    console.error(`[Faster-Whisper] Error: ${error}`);
    // 清理临时文件
    fs.unlink(audioPath, (err) => {
      if (err) console.error(`[Faster-Whisper] Error deleting temp file: ${err}`);
    });
    res.status(500).json({ 
      error: 'Transcription error', 
      detail: error.message 
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 Faster-Whisper Proxy Server running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🎤 Transcription: POST http://localhost:${PORT}/api/transcribe\n`);
});

