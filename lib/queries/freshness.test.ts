import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/tables";
import { getFreshness, lastSuccessAt } from "./freshness";

describe("getFreshness", () => {
  it("reports each source's latest run and latest success, most recently run first", () => {
    const db = openDb(":memory:");
    const run = (source: string, finishedAt: string, ok: boolean) =>
      db.insert(syncRuns).values({ source, startedAt: finishedAt, finishedAt, ok, error: ok ? null : "boom" }).run();
    run("weather", "2026-10-25T08:00:00Z", true);
    run("slots", "2026-10-25T08:10:00Z", true);
    run("weather", "2026-10-25T09:00:00Z", true);
    run("slots", "2026-10-25T09:10:00Z", false);
    run("never-ok", "2026-10-25T09:20:00Z", false);

    expect(getFreshness(db)).toEqual([
      { source: "never-ok", lastSuccessAt: null, lastRun: expect.objectContaining({ ok: false, error: "boom" }) },
      { source: "slots", lastSuccessAt: "2026-10-25T08:10:00Z", lastRun: expect.objectContaining({ ok: false, finishedAt: "2026-10-25T09:10:00Z" }) },
      { source: "weather", lastSuccessAt: "2026-10-25T09:00:00Z", lastRun: expect.objectContaining({ ok: true, notes: [] }) },
    ]);
    expect(lastSuccessAt("slots", db)).toBe("2026-10-25T08:10:00Z");
    expect(lastSuccessAt("never-ok", db)).toBeNull();
    expect(lastSuccessAt("unknown", db)).toBeNull();
  });
});
