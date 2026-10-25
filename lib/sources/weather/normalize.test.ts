import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/hourly-forecast.json";
import { parseWindMph, toWeatherRows } from "./normalize";

const fetchedAt = "2026-10-25T06:30:00.000Z";

describe("toWeatherRows with a real NWS response", () => {
  const rows = toWeatherRows(fixture, fetchedAt);

  it("keys each hour by Chicago date and hour", () => {
    expect(rows).toHaveLength(156);
    expect(rows[0]).toEqual({
      date: "2026-10-25",
      hour: 1,
      tempF: 65,
      precipPct: 0,
      windMph: 0,
      shortForecast: "Mostly Clear",
      isDaytime: false,
      fetchedAt,
    });
  });

  it("produces unique keys", () => {
    expect(new Set(rows.map((r) => `${r.date}|${r.hour}`)).size).toBe(rows.length);
  });
});

describe("toWeatherRows edge cases", () => {
  const period = (startTime: string, temperature: number) => ({
    startTime,
    isDaytime: false,
    temperature,
    temperatureUnit: "F",
    probabilityOfPrecipitation: { value: null },
    windSpeed: "5 mph",
    shortForecast: "Clear",
  });

  it("keeps one row for the repeated 1 a.m. when DST ends", () => {
    const rows = toWeatherRows(
      { properties: { periods: [period("2026-11-01T01:00:00-05:00", 60), period("2026-11-01T01:00:00-06:00", 58)] } },
      fetchedAt,
    );
    expect(rows).toMatchObject([{ date: "2026-11-01", hour: 1, tempF: 58, precipPct: 0 }]);
  });

  it("rejects an empty forecast", () => {
    expect(() => toWeatherRows({ properties: { periods: [] } }, fetchedAt)).toThrow(/no forecast periods/);
  });

  it("rejects a Celsius forecast instead of storing wrong numbers", () => {
    const celsius = { ...period("2026-10-25T01:00:00-05:00", 18), temperatureUnit: "C" };
    expect(() => toWeatherRows({ properties: { periods: [celsius] } }, fetchedAt)).toThrow();
  });
});

describe("parseWindMph", () => {
  it.each([
    ["0 mph", 0],
    ["10 mph", 10],
    ["5 to 15 mph", 15],
  ])("%s → %d", (text, mph) => expect(parseWindMph(text)).toBe(mph));

  it("fails on text it can't read", () => {
    expect(() => parseWindMph("calm")).toThrow(/Unexpected NWS wind speed/);
  });
});
