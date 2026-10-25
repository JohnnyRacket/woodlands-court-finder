import { z } from "zod";
import { chicagoDateHour } from "@/lib/time";

export const hourlyForecastSchema = z.object({
  properties: z.object({
    periods: z.array(
      z.object({
        startTime: z.iso.datetime({ offset: true }),
        isDaytime: z.boolean(),
        temperature: z.number(),
        temperatureUnit: z.literal("F"),
        probabilityOfPrecipitation: z.object({ value: z.number().nullable() }),
        windSpeed: z.string(),
        shortForecast: z.string(),
      }),
    ),
  }),
});

export interface WeatherRow {
  date: string;
  hour: number;
  tempF: number;
  precipPct: number;
  windMph: number;
  shortForecast: string;
  isDaytime: boolean;
  fetchedAt: string;
}

/** "10 mph" → 10, "5 to 15 mph" → 15 (the higher end matters for play). */
export function parseWindMph(text: string): number {
  const numbers = text.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) throw new Error(`Unexpected NWS wind speed "${text}"`);
  return Math.max(...numbers);
}

export function toWeatherRows(json: unknown, fetchedAt: string): WeatherRow[] {
  const { periods } = hourlyForecastSchema.parse(json).properties;
  if (periods.length === 0) throw new Error("NWS returned no forecast periods");
  // When DST ends, 1 a.m. happens twice; keep the later hour so each (date, hour) appears once.
  const byKey = new Map<string, WeatherRow>();
  for (const period of periods) {
    const key = chicagoDateHour(new Date(period.startTime));
    byKey.set(`${key.date}|${key.hour}`, {
      ...key,
      tempF: period.temperature,
      precipPct: period.probabilityOfPrecipitation.value ?? 0,
      windMph: parseWindMph(period.windSpeed),
      shortForecast: period.shortForecast,
      isDaytime: period.isDaytime,
      fetchedAt,
    });
  }
  return [...byKey.values()];
}
