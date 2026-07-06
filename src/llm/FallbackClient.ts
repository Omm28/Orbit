import { ChatMessage } from "../types";
import { LLMClient } from "./LLMClient";
import { GeminiClient } from "./Gemini";
import { OllamaClient } from "./Ollama";
import { OpenAIClient } from "./OpenAI";
import { logger } from "../utils/logger";

export class FallbackClient implements LLMClient {
  private primary: LLMClient | null = null;
  private backup: LLMClient | null = null;

  constructor(
    private readonly primaryProvider: string,
    private readonly backupProvider: string = "ollama"
  ) {
    // Attempt to initialize primary
    try {
      this.primary = this.createClient(this.primaryProvider);
    } catch (err: any) {
      logger.warn(`Failed to initialize primary LLM provider "${this.primaryProvider}": ${err.message || err}. Fallback to "${this.backupProvider}" will be used immediately.`);
    }

    // Attempt to initialize backup
    if (this.primaryProvider.toLowerCase() !== this.backupProvider.toLowerCase()) {
      try {
        this.backup = this.createClient(this.backupProvider);
      } catch (err: any) {
        logger.warn(`Failed to initialize backup LLM provider "${this.backupProvider}": ${err.message || err}.`);
      }
    }
  }

  private createClient(provider: string): LLMClient {
    switch (provider.toLowerCase()) {
      case "gemini":
        return new GeminiClient();
      case "ollama":
        return new OllamaClient();
      case "openai":
        return new OpenAIClient();
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    if (this.primary) {
      try {
        return await this.primary.chat(messages);
      } catch (error: any) {
        const errorMsg = error.message || String(error);
        logger.warn(`Primary LLM client (${this.primaryProvider}) failed: ${errorMsg}. Falling back to backup (${this.backupProvider})…`);
        
        // Disable primary so future steps in this agent run directly route to Ollama/Llama
        this.primary = null;
      }
    }

    if (this.backup) {
      return await this.backup.chat(messages);
    }

    throw new Error("No functional LLM client available (both primary and backup failed or were uninitialized).");
  }
}
