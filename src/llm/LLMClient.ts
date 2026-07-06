import { ChatMessage } from "../types";

export interface LLMClient {
  chat(messages: ChatMessage[]): Promise<string>;
}
