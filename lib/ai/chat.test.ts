import { simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { seedSampleDb } from "@/lib/db/test-seed";
import { streamChat } from "./chat";
import { createTools, systemPrompt } from "./tools";

// 2026-10-26 6:30 a.m. in Chicago: "today" is the seeded date and courts open at 7.
const now = new Date("2026-10-26T11:30:00Z");
const db = seedSampleDb();
const tools = createTools(now, db);
const run = <T,>(t: { execute?: (input: T, options: never) => unknown }, input: T) => t.execute!(input, {} as never);

describe("assistant tools", () => {
  it("finds open play and walk-up courts, and says how fresh the data is", async () => {
    const result = (await run(tools.findCourts, { sport: "pickleball", date: "2026-10-26", startHour: 8 })) as {
      hours: { hour: string; parks: { park: string; playable: number; courts: { court: string; status: string; event?: string }[] }[] }[];
      reservationsUpdatedAt: string | null;
      note: string;
    };
    const falconwing = result.hours[0].parks[0];
    expect(result.hours[0].hour).toBe("8 AM");
    expect(falconwing.playable).toBe(3);
    expect(falconwing.courts.find((c) => c.court === "pb-1")).toMatchObject({ status: "Open play", event: "Pickleball drop-in play (8 AM–10 AM)" });
    expect(result.note).toMatch(/aren't occupancy/);
    expect(result).toHaveProperty("reservationsUpdatedAt");
  });

  it("only accepts dates residents can book", () => {
    const schema = tools.findCourts.inputSchema as unknown as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse({ sport: "tennis", date: "2026-10-28", startHour: 8 }).success).toBe(true);
    expect(schema.safeParse({ sport: "tennis", date: "2026-10-29", startHour: 8 }).success).toBe(false);
    expect(schema.safeParse({ sport: "tennis", date: "2026-10-30", startHour: 8 }).success).toBe(false);
  });

  it("returns a park's whole day", async () => {
    const day = (await run(tools.getParkSchedule, { parkId: "falconwing", date: "2026-10-26" })) as { courts: Record<string, string[]>; events: string[] };
    expect(day.courts["pb-1"]).toHaveLength(16);
    expect(day.courts["pb-1"][1]).toBe("8 AM: Open play");
    expect(day.events).toEqual(["Pickleball drop-in play, 8 AM–10 AM, open to everyone"]);
  });

  it("reports unknown parks instead of throwing", async () => {
    expect(await run(tools.getParkSchedule, { parkId: "nowhere", date: "2026-10-26" })).toEqual({ error: expect.stringMatching(/Unknown park/) });
  });

  it("reads the forecast, with gusts, thunder and warnings", async () => {
    expect(await run(tools.getWeather, { date: "2026-10-26", startHour: 8 })).toMatchObject({
      hours: [{ hour: "8 AM", tempF: 60, chanceOfRain: "10%", forecast: "Sunny", gustMph: 12, chanceOfThunder: "0%", warnings: [expect.stringMatching(/Courts may be wet/)] }],
    });
  });

  it("reports closures, weather alerts and Township events", async () => {
    const result = (await run(tools.getAlerts, { date: "2026-10-26" })) as { alerts: { from: string; title: string }[]; parkEvents: { title: string; time: string }[] };
    expect(result.alerts.map((a) => [a.from, a.title])).toEqual([
      ["Township", "Falconwing tennis courts closed"],
      ["National Weather Service", "Heat Advisory"],
    ]);
    expect(result.parkEvents).toEqual([expect.objectContaining({ title: "Flashlight Candy Hunt", time: "7:30 PM" })]);
  });

  it("puts a park's notices and events in its schedule", async () => {
    const day = (await run(tools.getParkSchedule, { parkId: "falconwing", date: "2026-10-26" })) as { alerts: string[]; townshipEvents: { title: string }[] };
    expect(day.alerts).toEqual(["Falconwing tennis courts closed: Resurfacing this week."]);
    expect(day.townshipEvents.map((e) => e.title)).toEqual(["Flashlight Candy Hunt"]);
  });
});

describe("streamChat", () => {
  const usage = {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 5, text: 5, reasoning: undefined },
  };
  const finish = (unified: "tool-calls" | "stop") => ({ type: "finish" as const, finishReason: { unified, raw: undefined }, usage });

  it("calls a tool, feeds the result back, and answers", async () => {
    const model = new MockLanguageModelV4({
      doStream: [
        {
          stream: simulateReadableStream({
            chunks: [
              { type: "tool-call", toolCallId: "call-1", toolName: "findCourts", input: JSON.stringify({ sport: "pickleball", date: "2026-10-26", startHour: 8 }) },
              finish("tool-calls"),
            ],
          }),
        },
        {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "t" },
              { type: "text-delta", id: "t", delta: "Falconwing has open play at 8 AM." },
              { type: "text-end", id: "t" },
              finish("stop"),
            ],
          }),
        },
      ],
    });
    const messages: UIMessage[] = [{ id: "1", role: "user", parts: [{ type: "text", text: "Where can I play pickleball at 8?" }] }];

    const result = await streamChat(messages, { now, model, db });

    expect(await result.text).toBe("Falconwing has open play at 8 AM.");
    const steps = await result.steps;
    expect(steps[0].toolResults[0]).toMatchObject({ toolName: "findCourts", output: { date: "2026-10-26", sport: "pickleball" } });
    // The tool result went back to the model on the second call.
    expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain("Pickleball drop-in play (8 AM–10 AM)");
  });

  it("gives the model the rules and today's dates", () => {
    const prompt = systemPrompt(now);
    expect(prompt).toContain("today is 2026-10-26, tomorrow is 2026-10-27");
    expect(prompt).toContain("Residents can book tennis 2 days ahead, pickleball 1 day ahead");
    expect(prompt).toMatch(/never "empty"/);
    expect(prompt).toMatch(/Answer only from tool results/);
  });
});
