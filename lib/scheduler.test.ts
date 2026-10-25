import { afterEach, describe, expect, it, vi } from "vitest";
import { bootSources } from "./scheduler";
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
  it("runs everything on boot in live mode", () => {
    expect(bootSources(list, "live", now, freshness).map((s) => s.name)).toEqual(["fresh", "stale", "never"]);
  });

  it("in gentle mode, only re-fetches data that is missing or over a day old", () => {
    expect(bootSources(list, "gentle", now, freshness).map((s) => s.name)).toEqual(["stale", "never"]);
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
