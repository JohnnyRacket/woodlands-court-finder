import { afterEach, describe, expect, it, vi } from "vitest";
import { bootSources, retryDelay } from "./scheduler";
import { syncProfile } from "./sync-profile";
import type { SourceModule } from "./sources/types";

const source = (name: string): SourceModule => ({ name, title: name, origin: "test", schedule: { live: "* * * * *", gentle: "* * * * *" }, run: async () => ({ rows: 0 }) });
const list = [source("fresh"), source("stale"), source("never")];
const now = new Date("2026-10-25T12:00:00Z");
const freshness = [
  { source: "fresh", lastSuccessAt: "2026-10-25T09:00:00Z" },
  { source: "stale", lastSuccessAt: "2026-10-23T09:00:00Z" },
];

describe("bootSources", () => {
  it("in live mode, only re-fetches data that is missing or missed its last scheduled run", () => {
    const hourly = (name: string): SourceModule => ({ ...source(name), schedule: { live: "0 * * * *", gentle: "0 * * * *" } });
    const hourlyList = [hourly("ran-since-slot"), hourly("missed-slot"), hourly("never")];
    const at = new Date("2026-10-25T12:30:00Z");
    const seen = [
      { source: "ran-since-slot", lastSuccessAt: "2026-10-25T12:05:00Z" },
      { source: "missed-slot", lastSuccessAt: "2026-10-25T11:30:00Z" },
    ];
    expect(bootSources(hourlyList, "live", at, seen).map((s) => s.name)).toEqual(["missed-slot", "never"]);
  });

  it("in gentle mode, only re-fetches data that is missing or over a day old", () => {
    expect(bootSources(list, "gentle", now, freshness).map((s) => s.name)).toEqual(["stale", "never"]);
  });
});

describe("retryDelay", () => {
  const at = new Date("2026-10-25T09:00:00Z");
  const inMinutes = (minutes: number) => new Date(at.getTime() + minutes * 60_000);

  it("retries a failed daily run twice, then leaves it to the schedule", () => {
    expect(retryDelay(0, inMinutes(24 * 60), at)).toBe(5 * 60_000);
    expect(retryDelay(1, inMinutes(24 * 60), at)).toBe(20 * 60_000);
    expect(retryDelay(2, inMinutes(24 * 60), at)).toBeNull();
  });

  it("doesn't retry when the next scheduled run comes first", () => {
    expect(retryDelay(0, inMinutes(5), at)).toBeNull();
    expect(retryDelay(1, inMinutes(15), at)).toBeNull();
  });
});

describe("syncProfile", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is gentle outside production unless told otherwise", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(syncProfile()).toBe("gentle");
    vi.stubEnv("SYNC_PROFILE", "live");
    expect(syncProfile()).toBe("live");
  });

  it("is live in production, and can be forced gentle", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(syncProfile()).toBe("live");
    vi.stubEnv("SYNC_PROFILE", "gentle");
    expect(syncProfile()).toBe("gentle");
  });
});
