import { createUIMessageStreamResponse, safeValidateUIMessages, toUIMessageStream } from "ai";
import type { NextRequest } from "next/server";
import { historyTooLong, streamChat } from "@/lib/ai/chat";
import { clientIp } from "@/lib/client-ip";
import { assistantEnabled } from "@/lib/flags";

// Simple per-IP limit; fine for a single container.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const requestsByIp = new Map<string, number[]>();
/** The client sends the whole conversation; only the last messages are used, but none of it should be huge. */
const MAX_BODY_BYTES = 2_000_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (requestsByIp.size > 1000) {
    for (const [key, times] of requestsByIp) if (now - times[times.length - 1] >= WINDOW_MS) requestsByIp.delete(key);
  }
  const recent = (requestsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return true;
  recent.push(now);
  requestsByIp.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  if (!assistantEnabled) return Response.json({ error: "Not found" }, { status: 404 });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[chat] NEXT_PUBLIC_ASSISTANT_ENABLED is on but ANTHROPIC_API_KEY isn't set");
    return Response.json({ error: "The assistant isn't available right now." }, { status: 503 });
  }
  if (rateLimited(clientIp(request.headers))) {
    return Response.json({ error: "Too many questions; try again in a few minutes." }, { status: 429 });
  }
  // Checked before parsing; historyTooLong below is the real limit.
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
    return Response.json({ error: "This conversation is too long. Close the assistant and start a new one." }, { status: 413 });
  }
  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const parsed = await safeValidateUIMessages({ messages: body?.messages });
  if (!parsed.success || parsed.data.length === 0) return Response.json({ error: "Invalid request" }, { status: 400 });
  if (historyTooLong(parsed.data)) {
    return Response.json({ error: "This conversation is too long. Close the assistant and start a new one." }, { status: 413 });
  }

  const result = await streamChat(parsed.data, { abortSignal: request.signal });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // streamText logs the underlying error; this is what the person sees.
      onError: () => "The assistant couldn't answer just now. Try again in a moment.",
    }),
  });
}
