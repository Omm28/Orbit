import { ChatMessage } from "../types";
import { LLMClient } from "./LLMClient";
import { logger } from "../utils/logger";

export class OllamaClient implements LLMClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    this.model = process.env.OLLAMA_MODEL ?? "llama3.1";
    logger.info(`LLM: Ollama / ${this.model} at ${this.baseUrl}`);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    logger.dim(`Sending ${messages.length} message(s) to Ollama …`);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          format: "json",
          stream: false,
          options: {
            temperature: 0,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.message?.content ?? "";
      logger.dim(`LLM responded (${content.length} chars).`);
      return content;
    } catch (error) {
      logger.error(`Ollama request failed: ${error}`);
      throw error;
    }
  }
}
