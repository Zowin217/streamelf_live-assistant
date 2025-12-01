/**
 * Translation Service
 * 使用 DeepSeek API 进行中英文翻译
 */

import OpenAI from 'openai';

// Helper to get DeepSeek client
const getClient = () => {
  const apiKey = (typeof process !== 'undefined' && process.env?.DEEPSEEK_API_KEY) ||
                 import.meta.env?.DEEPSEEK_API_KEY ||
                 import.meta.env?.VITE_DEEPSEEK_API_KEY ||
                 (window as any).__DEEPSEEK_API_KEY__;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    return null;
  }
  
  return new OpenAI({
    apiKey: String(apiKey),
    baseURL: "https://api.deepseek.com",
    dangerouslyAllowBrowser: true,
  });
};

/**
 * 将英文翻译成中文
 */
export const translateToChinese = async (text: string): Promise<string> => {
  const client = getClient();
  if (!client) return "";

  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a translator. Translate the given English text to Chinese. Only return the translation, no explanations."
        },
        {
          role: "user",
          content: `Translate to Chinese: "${text}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 100,
      stream: false,
    });

    const translation = response.choices[0]?.message?.content?.trim() || "";
    return translation;
  } catch (error) {
    console.error("Translation failed:", error);
    return "";
  }
};

