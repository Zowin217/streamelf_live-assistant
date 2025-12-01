import OpenAI from 'openai';
import { ElfPersonality, Product, ProductScript } from "../types";

// Helper to get DeepSeek client
const getClient = () => {
  // Try multiple ways to get the API key (Vite injects via define in vite.config.ts)
  // @ts-ignore - These are injected by Vite's define
  const apiKey = (typeof process !== 'undefined' && process.env?.DEEPSEEK_API_KEY) ||
                 import.meta.env?.DEEPSEEK_API_KEY ||
                 import.meta.env?.VITE_DEEPSEEK_API_KEY ||
                 (window as any).__DEEPSEEK_API_KEY__;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
    console.error("❌ DEEPSEEK_API_KEY is missing!");
    console.error("请执行以下步骤:");
    console.error("1. 确认 .env.local 文件存在并包含: DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY");
    console.error("2. 停止开发服务器 (Ctrl+C)");
    console.error("3. 重新启动: npm run dev");
    console.error("4. 查看终端启动日志，应该显示: ✅ Found");
    return null;
  }
  
  const keyStr = String(apiKey);
  if (!keyStr.startsWith('sk-')) {
    console.warn("⚠️ API Key 格式可能不正确（应该以 'sk-' 开头）");
    console.warn("当前值:", keyStr.substring(0, 20) + '...');
  }
  
  return new OpenAI({
    apiKey: keyStr,
    baseURL: "https://api.deepseek.com",
    dangerouslyAllowBrowser: true, // Required for browser usage, but be aware of security risks
  });
};

// --- Script Generation ---

export const generateProductScript = async (
  product: Product,
  elf: ElfPersonality
): Promise<ProductScript | null> => {
  const client = getClient();
  if (!client) return null;

  const prompt = `Create a livestream selling script for the following product:
Product Name: ${product.name}
Description: ${product.description}

The script must be written in the voice of a livestreamer who is assisted by an elf named ${elf.name}.
Personality Style: ${elf.promptModifier}

Please return the response in JSON format with the following structure:
{
  "intro": "Hook and introduction",
  "features": "Key features explanation",
  "objections": "Handling common objections",
  "cta": "Call to Action",
  "fullText": "A continuous conversational script merging the above sections"
}

Make sure to return ONLY valid JSON, no other text.`;

  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are an expert copywriter for live commerce. Create engaging, natural-sounding scripts that feel conversational and authentic. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return null;
    }

    try {
      const parsed = JSON.parse(content) as ProductScript;
      // Validate that all required fields exist
      if (parsed.intro && parsed.features && parsed.cta) {
        // Ensure fullText exists, if not generate it
        if (!parsed.fullText) {
          parsed.fullText = `${parsed.intro} ${parsed.features} ${parsed.objections || ''} ${parsed.cta}`;
        }
        return parsed;
      }
    } catch (parseError) {
      console.error("Failed to parse script response:", parseError);
      // Try to extract JSON from the response if it's wrapped in markdown
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as ProductScript;
          if (parsed.intro && parsed.features && parsed.cta) {
            if (!parsed.fullText) {
              parsed.fullText = `${parsed.intro} ${parsed.features} ${parsed.objections || ''} ${parsed.cta}`;
            }
            return parsed;
          }
        }
      } catch (e) {
        console.error("Failed to extract JSON from response:", e);
      }
      return null;
    }
    return null;

  } catch (error: any) {
    console.error("Script generation failed:", error);
    // Provide more specific error messages
    if (error?.message?.includes('API_KEY') || error?.message?.includes('api key') || error?.status === 401) {
      throw new Error("❌ API Key 无效或缺失。请检查 .env.local 文件中的 DEEPSEEK_API_KEY，并确保已重启开发服务器。");
    }
    if (error?.message?.includes('quota') || error?.message?.includes('limit') || error?.status === 429) {
      throw new Error("❌ API 配额已用完。请检查你的 DeepSeek API 使用限制。");
    }
    if (error?.code === 'ENOTFOUND' || error?.message?.includes('network')) {
      throw new Error("❌ 网络连接失败。请检查网络连接或稍后重试。");
    }
    throw new Error(`❌ 生成脚本失败: ${error?.message || '未知错误'}`);
  }
};

// --- Elf Chat / Auto-Reply ---

export const generateElfReply = async (
  message: string,
  elf: ElfPersonality,
  context?: string
): Promise<string> => {
  const client = getClient();
  if (!client) return "Connectivity issue... *fizz*";

  const prompt = `User Comment: "${message}"
Context: ${context || "Just chilling in the stream."}

Reply as the elf character to the user (or to the streamer). 
IMPORTANT: 
1. Listen to and understand the COMPLETE message before replying
2. Consider the full context and meaning of what the user said
3. Keep responses brief and conversational (under 20 words)
4. Respond naturally to the complete thought, not just keywords`;

  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `${elf.promptModifier} You are a helpful assistant. Always reply in natural, friendly English only (no Chinese). Listen to and understand the COMPLETE message before replying. Consider the full context and meaning. Keep responses brief and conversational (under 20 words).`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7, // Slightly lower for faster, more consistent responses
      max_tokens: 60, // Balanced for faster response while maintaining quality
      stream: false, // Ensure non-streaming for faster completion
    });

    return response.choices[0]?.message?.content || "Hmm, let me think about that...";
  } catch (error: any) {
    console.error("Elf reply failed:", error);
    // Return a fallback message that matches the elf's personality
    if (elf.id === 'sarcastic') {
      return "Well, that didn't work. *shrug*";
    } else if (elf.id === 'pro') {
      return "Processing... Please try again.";
    } else if (elf.id === 'gentle') {
      return "Oh, I'm having a little trouble right now...";
    } else {
      return "Oops! Something went wrong! 😅";
    }
  }
};

// --- Topic Sentence Generation ---

export const generateTopicSentence = async (
  product: Product,
  elf: ElfPersonality,
  existingSentences: string[] = []
): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;

  const existingText = existingSentences.length > 0 
    ? `\n\nExisting topic sentences (DO NOT repeat these):\n${existingSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : '';

  const prompt = `Generate ONE new conversation topic sentence for a livestream about this product:
Product Name: ${product.name}
Description: ${product.description}
${existingText}

Requirements:
1. Create a NEW, DIFFERENT topic sentence that is NOT in the existing list
2. Make it natural and conversational (like a streamer would say)
3. Keep it short (under 15 words)
4. Focus on the product but make it engaging
5. Do NOT repeat any existing sentences

Return ONLY the sentence, no numbering, no quotes, no explanation.`;

  try {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: "You are a creative copywriter. Generate unique, engaging conversation topics for livestreams. Always return only the sentence, nothing else."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8, // Higher temperature for more variety
      max_tokens: 30, // Short sentences
      stream: false,
    });

    const sentence = response.choices[0]?.message?.content?.trim();
    if (sentence) {
      // Remove quotes if present
      return sentence.replace(/^["']|["']$/g, '');
    }
    return null;
  } catch (error: any) {
    console.error("Topic sentence generation failed:", error);
    return null;
  }
};


