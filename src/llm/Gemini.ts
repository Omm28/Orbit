import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "../types";
import { LLMClient } from "./LLMClient";
import { logger } from "../utils/logger";

export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");
    this.model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    this.client = new GoogleGenAI({ apiKey });
    logger.info(`LLM: Gemini / ${this.model}`);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    let systemInstruction = "";
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction += msg.content + "\n";
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    const maxRetries = 3;
    let attempt = 0;

    while (true) {
      try {
        logger.dim(`Sending ${messages.length} message(s) to Gemini (Attempt ${attempt + 1}/${maxRetries}) …`);
        
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: systemInstruction.trim() || undefined,
            temperature: 0,
            responseMimeType: "application/json",
          },
        });

        const content = response.text ?? "";
        logger.dim(`LLM responded (${content.length} chars).`);
        return content;

      } catch (error: any) {
        attempt++;
        const errorStr = error.message || String(error);
        const isRateLimit =
          errorStr.includes("429") ||
          errorStr.includes("RESOURCE_EXHAUSTED") ||
          errorStr.includes("quota") ||
          errorStr.includes("Quota");

        if (isRateLimit && attempt < maxRetries) {
          let waitMs = 20_000; // default 20s
          const match = errorStr.match(/retry in ([\d.]+)\s*s/i);
          if (match && match[1]) {
            waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 2000; // add a 2s buffer
          }
          
          logger.warn(`Gemini rate limit exceeded (429/ResourceExhausted). Waiting ${Math.round(waitMs / 1000)}s before retrying…`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        logger.error(`Gemini request failed: ${errorStr}`);
        throw error;
      }
    }
  }
}
