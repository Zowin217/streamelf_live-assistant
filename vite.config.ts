import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';

// Helper to load .env.local manually if needed
const loadEnvLocal = () => {
  try {
    const envContent = readFileSync(path.resolve(__dirname, '.env.local'), 'utf-8');
    const env: Record<string, string> = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    return env;
  } catch (e) {
    return {};
  }
};

export default defineConfig(({ mode }) => {
    // Try multiple ways to load env
    const rootDir = process.cwd();
    const viteEnv = loadEnv(mode, rootDir, '');
    const manualEnv = loadEnvLocal();
    
    // Merge: manual read takes priority
    const env = { ...viteEnv, ...manualEnv };
    
    // Try to get API key from multiple sources
    let deepseekKey = env.DEEPSEEK_API_KEY || env.VITE_DEEPSEEK_API_KEY;
    
    if (!deepseekKey || deepseekKey === 'undefined' || deepseekKey === 'null') {
      console.warn('\n⚠️  警告: 未从环境变量加载到 DEEPSEEK_API_KEY');
      console.warn('请在 .env.local 中配置 DEEPSEEK_API_KEY / VITE_DEEPSEEK_API_KEY');
      deepseekKey = '';
    }
    
    console.log('\n🔍 Vite Config - Environment Variables:');
    console.log('  Working directory:', rootDir);
    const envLocalPath = path.resolve(rootDir, '.env.local');
    console.log('  .env.local path:', envLocalPath);
    console.log('  .env.local exists:', existsSync(envLocalPath) ? '✅' : '❌');
    console.log('  loadEnv result:', Object.keys(viteEnv).length > 0 ? `✅ (${Object.keys(viteEnv).length} vars)` : '❌ Empty');
    console.log('  manual read result:', Object.keys(manualEnv).length > 0 ? `✅ (${Object.keys(manualEnv).length} vars)` : '❌ Empty');
    console.log('  DEEPSEEK_API_KEY:', deepseekKey ? `✅ Found (${deepseekKey.substring(0, 15)}...)` : '❌ Missing');
    console.log('  ✅ 配置成功！API Key 已加载\n');
    
    const shouldOpen = process.env.VITE_DEV_SERVER_OPEN !== 'false';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        strictPort: false, // 如果端口被占用，自动尝试其他端口
        open: shouldOpen, // 在 Electron 模式下不自动打开浏览器
        proxy: {
          '/api': 'http://localhost:4000',
          '/faster-whisper': {
            target: 'http://localhost:4001',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/faster-whisper/, '')
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(deepseekKey),
        'import.meta.env.DEEPSEEK_API_KEY': JSON.stringify(deepseekKey),
        'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(deepseekKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
