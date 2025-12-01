import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ElfPersonality, Product, ProductScript } from "../types";

// Helper to get client safely
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is missing. AI features will not work.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

// --- Script Generation ---

export const generateProductScript = async (
  product: Product,
  elf: ElfPersonality
): Promise<ProductScript | null> => {
  const client = getClient();
  if (!client) return null;

  const prompt = `
    Create a livestream selling script for the following product:
    Product Name: ${product.name}
    Description: ${product.description}
    
    The script must be written in the voice of a livestreamer who is assisted by an elf named ${elf.name}.
    Personality Style: ${elf.promptModifier}
    
    Return the response in JSON format with specific sections.
  `;

  // Define the schema for the script
  const scriptSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      intro: { type: Type.STRING, description: "Hook and introduction" },
      features: { type: Type.STRING, description: "Key features explanation" },
      objections: { type: Type.STRING, description: "Handling common objections" },
      cta: { type: Type.STRING, description: "Call to Action" },
      fullText: { type: Type.STRING, description: "A continuous conversational script merging the above" },
    },
    required: ["intro", "features", "objections", "cta", "fullText"],
  };

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: scriptSchema,
        systemInstruction: "You are an expert copywriter for live commerce. Create engaging, natural-sounding scripts that feel conversational and authentic.",
      },
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text) as ProductScript;
        // Validate that all required fields exist
        if (parsed.intro && parsed.features && parsed.cta) {
          return parsed;
        }
      } catch (parseError) {
        console.error("Failed to parse script response:", parseError);
        return null;
      }
    }
    return null;

  } catch (error: any) {
    console.error("Script generation failed:", error);
    // Provide more specific error messages
    if (error?.message?.includes('API_KEY') || error?.message?.includes('api key')) {
      throw new Error("Invalid or missing API key. Please check your GEMINI_API_KEY in .env.local");
    }
    if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
      throw new Error("API quota exceeded. Please check your Gemini API usage limits.");
    }
    throw error;
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

  const prompt = `
    User Comment: "${message}"
    Context: ${context || "Just chilling in the stream."}
    
    Reply as the elf character to the user (or to the streamer). Keep it short (under 20 words).
  `;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: elf.promptModifier,
        maxOutputTokens: 50, // Keep it snappy
      },
    });

    return response.text || "Hmm, let me think about that...";
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