import { createUIMessageStreamResponse, safeValidateUIMessages, toUIMessageStream } from "ai";
import type { NextRequest } from "next/server";
import { streamChat } from "@/lib/ai/chat";

// Simple per-IP limit; fine for a single container.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const requestsByIp = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestsByIp.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The assistant isn't configured: set ANTHROPIC_API_KEY." }, { status: 503 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return Response.json({ error: "Too many questions; try again in a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const parsed = await safeValidateUIMessages({ messages: body?.messages });
  if (!parsed.success || parsed.data.length === 0) return Response.json({ error: "Invalid request" }, { status: 400 });

  const result = await streamChat(parsed.data);
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
