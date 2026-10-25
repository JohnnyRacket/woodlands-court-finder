import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, isStepCount, streamText, type LanguageModel, type UIMessage } from "ai";
import type { Db } from "@/lib/db/client";
import { createTools, systemPrompt } from "./tools";

export const CHAT_MODEL = "claude-sonnet-5-5";
const MAX_MESSAGES = 20;
/** Real conversations stay well under this (~75k tokens) even with tool results; the client sends the history, so it's capped. */
const MAX_HISTORY_CHARS = 300_000;

/** The history the model would see is too large to send. */
export function historyTooLong(messages: UIMessage[]): boolean {
  return JSON.stringify(messages.slice(-MAX_MESSAGES)).length > MAX_HISTORY_CHARS;
}

/** One assistant turn. The model is injectable so tests can use a mock. */
export async function streamChat(messages: UIMessage[], options: { now?: Date; model?: LanguageModel; db?: Db; abortSignal?: AbortSignal } = {}) {
  const now = options.now ?? new Date();
  return streamText({
    model: options.model ?? anthropic(CHAT_MODEL),
    system: systemPrompt(now),
    messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
    tools: createTools(now, options.db),
    stopWhen: isStepCount(6),
    maxOutputTokens: 800,
    abortSignal: options.abortSignal,
  });
}
