import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const PORT = process.env.WHISPER_PROXY_PORT || 4000;
const PYTHON_BIN = process.env.WHISPER_PYTHON_BIN || 'python';
// Use 'tiny' model for fastest processing (near real-time)
// Options: 'tiny' (fastest, ~1s), 'base' (~2s), 'small' (~4s, more accurate)
// For real-time sync, 'tiny' is recommended
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'tiny';

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const runWhisper = (audioPath, language) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'whisperTranscribe.py');
    const args = [scriptPath, '--audio', audioPath, '--model', WHISPER_MODEL];
    if (language) {
      args.push('--language', language);
    }

    console.log(`[Whisper] Running: ${PYTHON_BIN} ${args.join(' ')}`);
    
    // Set UTF-8 encoding for stdout/stderr on Windows
    const process = spawn(PYTHON_BIN, args, { 
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    let stdout = '';
    let stderr = '';

    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');

    process.stdout.on('data', (data) => {
      const chunk = typeof data === 'string' ? data : data.toString('utf8');
      stdout += chunk;
      // Log progress in real-time
      if (!chunk.trim().startsWith('{')) {
        console.log(`[Whisper] stdout: ${chunk.trim()}`);
      }
    });

    process.stderr.on('data', (data) => {
      const chunk = typeof data === 'string' ? data : data.toString('utf8');
      stderr += chunk;
      // Log stderr in real-time (Whisper often outputs warnings to stderr)
      console.log(`[Whisper] stderr: ${chunk.trim()}`);
    });

    process.on('close', (code) => {
      console.log(`[Whisper] Process exited with code ${code}`);
      
      // Try to parse stdout first, even if exit code is non-zero
      // (Python script may output JSON error before exiting)
      const trimmed = stdout.trim();
      if (trimmed) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error) {
            // Python script returned a JSON error
            console.error(`[Whisper] Python error: ${parsed.error}`);
            return reject(new Error(parsed.error));
          }
          // Success - even if exit code was non-zero, we got valid JSON
          if (code === 0) {
            resolve(parsed);
          } else {
            console.warn(`[Whisper] Warning: exit code ${code} but got valid JSON output`);
            resolve(parsed);
          }
          return;
        } catch (parseError) {
          // stdout is not JSON, continue to error handling below
          console.log(`[Whisper] Stdout is not JSON, will use stderr instead`);
        }
      }
      
      // If we get here, either stdout was empty or not JSON
      if (code !== 0) {
        const errorMsg = stderr || `Whisper exited with code ${code}`;
        console.error(`[Whisper] Error output: ${errorMsg}`);
        if (stdout) {
          console.error(`[Whisper] Stdout was: ${stdout.substring(0, 500)}`);
        }
        return reject(new Error(errorMsg));
      }
      
      // Exit code 0 but no valid JSON output
      reject(new Error('Whisper returned empty or invalid output'));
    });

    process.on('error', (err) => {
      console.error(`[Whisper] Spawn error: ${err.message}`);
      reject(new Error(`Failed to start Whisper process: ${err.message}. Make sure Python and Whisper are installed.`));
    });
  });
};

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing audio file' });
  }

  const tempPath = path.join(os.tmpdir(), `whisper-${Date.now()}-${Math.random()}.webm`);

  try {
    console.log(`[Whisper] Received audio: ${req.file.size} bytes, type: ${req.file.mimetype}`);
    await fs.writeFile(tempPath, req.file.buffer);
    console.log(`[Whisper] Saved temp file: ${tempPath}`);
    
    const result = await runWhisper(tempPath, req.body?.language);
    console.log(`[Whisper] Transcription success: ${result.text?.substring(0, 50)}...`);
    res.json({ text: result.text || '', raw: result });
  } catch (error) {
    console.error('[Whisper] Proxy error:', error);
    console.error('[Whisper] Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Whisper transcription failed', 
      detail: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
});

app.listen(PORT, () => {
  console.log(`Whisper proxy listening on http://localhost:${PORT}`);
  console.log('Ensure you have installed openai-whisper & ffmpeg in your Python environment.');
});



