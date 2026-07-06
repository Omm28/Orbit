// ──────────────────────────────────────────────────
//  Orbit – OpenAI LLM client
// ──────────────────────────────────────────────────

import OpenAI from "openai";
import { ChatMessage } from "../types";
import { logger } from "../utils/logger";
import { LLMClient } from "./LLMClient";

export class OpenAIClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set in environment variables.");
    this.model  = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    this.client = new OpenAI({ apiKey });
    logger.info(`LLM: OpenAI / ${this.model}`);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    logger.dim(`Sending ${messages.length} message(s) to ${this.model} …`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content ?? "";
    logger.dim(`LLM responded (${content.length} chars).`);
    return content;
  }
}
