import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/gridpoint.json";
import { durationHours, toWeatherDetailRows } from "./normalize";

const fetchedAt = "2026-10-25T18:20:00.000Z";

describe("toWeatherDetailRows with a real NWS gridpoint", () => {
  const rows = toWeatherDetailRows(fixture, fetchedAt);
  const at = (date: string, hour: number) => rows.find((r) => r.date === date && r.hour === hour);

  it("expands intervals into Chicago-local hours, converting units", () => {
    // 06:00Z = 1 a.m. CDT: gust 7.4 km/h, WBGT 17.8 °C, no heat index overnight
    expect(at("2026-10-25", 1)).toEqual({ date: "2026-10-25", hour: 1, gustMph: 5, thunderPct: 0, heatIndexF: null, wbgtF: 64, rainIn: 0, fetchedAt });
    expect(at("2026-10-25", 10)?.heatIndexF).toBe(70); // 21.1 °C
    expect(at("2026-10-27", 7)?.thunderPct).toBe(2); // a 6-hour block starting 12:00Z
  });

  it("spreads a multi-hour rain amount evenly over its hours", () => {
    // 0.254 mm over 6 hours from 06:00Z Oct 31
    expect(at("2026-10-31", 1)?.rainIn).toBe(0.002);
    expect(at("2026-10-31", 6)?.rainIn).toBe(0.002);
  });

  it("produces unique keys", () => {
    expect(new Set(rows.map((r) => `${r.date}|${r.hour}`)).size).toBe(rows.length);
  });

  it("fails loudly when a unit changes", () => {
    const changed = structuredClone(fixture);
    changed.properties.windGust.uom = "wmoUnit:m_s-1";
    expect(() => toWeatherDetailRows(changed, fetchedAt)).toThrow();
  });
});

describe("durationHours", () => {
  it("reads the NWS durations", () => {
    expect([durationHours("PT1H"), durationHours("PT6H"), durationHours("P2DT6H"), durationHours("P1D")]).toEqual([1, 6, 54, 24]);
  });

  it("rejects anything else", () => {
    expect(() => durationHours("PT30M")).toThrow();
    expect(() => durationHours("6H")).toThrow();
  });
});
