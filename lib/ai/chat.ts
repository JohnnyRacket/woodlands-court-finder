import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, isStepCount, streamText, type LanguageModel, type UIMessage } from "ai";
import type { Db } from "@/lib/db/client";
import { createTools, systemPrompt } from "./tools";

export const CHAT_MODEL = "claude-sonnet-5-5";
const MAX_MESSAGES = 20;

/** One assistant turn. The model is injectable so tests can use a mock. */
export async function streamChat(messages: UIMessage[], options: { now?: Date; model?: LanguageModel; db?: Db } = {}) {
  const now = options.now ?? new Date();
  return streamText({
    model: options.model ?? anthropic(CHAT_MODEL),
    system: systemPrompt(now),
    messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
    tools: createTools(now, options.db),
    stopWhen: isStepCount(6),
    maxOutputTokens: 800,
  });
}
