import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/hourly-precipitation.json";
import { toRainRows } from "./normalize";

const fetchedAt = "x";

describe("toRainRows with a real Open-Meteo response", () => {
  const now = new Date("2026-10-25T18:30:00Z"); // 1:30 p.m. CDT
  const rows = toRainRows(fixture, now, fetchedAt);

  it("keeps only hours that have ended, keyed by Chicago date and hour", () => {
    // 00:00Z Oct 23 (7 p.m. Oct 22 CDT) through the 17:00Z hour (noon CDT) that ended at 18:00Z
    expect(rows[0]).toEqual({ date: "2026-10-22", hour: 19, precipIn: 0, fetchedAt });
    expect(rows.at(-1)).toMatchObject({ date: "2026-10-25", hour: 12 });
    expect(rows).toHaveLength(48 + 18);
  });
});

describe("toRainRows", () => {
  const payload = (time: string[], precipitation: (number | null)[]) => ({
    utc_offset_seconds: 0,
    hourly_units: { time: "iso8601", precipitation: "inch" },
    hourly: { time, precipitation },
  });

  it("keeps amounts and skips missing hours", () => {
    const rows = toRainRows(payload(["2026-10-25T12:00", "2026-10-25T13:00"], [0.31, null]), new Date("2026-10-25T15:00:00Z"), fetchedAt);
    expect(rows).toEqual([{ date: "2026-10-25", hour: 7, precipIn: 0.31, fetchedAt }]);
  });

  it("fails loudly when the units or time zone change", () => {
    const local = { ...payload(["2026-10-25T12:00"], [0]), utc_offset_seconds: -18000 };
    expect(() => toRainRows(local, new Date("2026-10-26T00:00:00Z"), fetchedAt)).toThrow();
    const mm = { ...payload(["2026-10-25T12:00"], [0]), hourly_units: { time: "iso8601", precipitation: "mm" } };
    expect(() => toRainRows(mm, new Date("2026-10-26T00:00:00Z"), fetchedAt)).toThrow();
  });
});
