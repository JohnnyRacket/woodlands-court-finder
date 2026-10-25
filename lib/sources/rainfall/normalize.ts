import { z } from "zod";
import { chicagoDateHour } from "@/lib/time";

export const hourlyPrecipitationSchema = z.object({
  utc_offset_seconds: z.literal(0),
  hourly_units: z.object({ time: z.literal("iso8601"), precipitation: z.literal("inch") }),
  hourly: z.object({
    // UTC, without a zone suffix: "2026-10-23T00:00"
    time: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:00$/)),
    precipitation: z.array(z.number().nullable()),
  }),
});

export interface RainRow {
  date: string;
  /** Chicago-local hour the rain fell in */
  hour: number;
  precipIn: number;
  fetchedAt: string;
}

const HOUR_MS = 60 * 60 * 1000;

/** Rain in hours that have already ended. Upcoming hours are forecast, which weather-details covers. */
export function toRainRows(json: unknown, now: Date, fetchedAt: string): RainRow[] {
  const { hourly } = hourlyPrecipitationSchema.parse(json);
  if (hourly.time.length !== hourly.precipitation.length) throw new Error("Open-Meteo returned mismatched time and precipitation arrays");

  // Open-Meteo labels an hour's total by its start. When DST ends, the later 1 a.m. wins.
  const byKey = new Map<string, RainRow>();
  hourly.time.forEach((time, i) => {
    const start = new Date(`${time}:00Z`);
    const amount = hourly.precipitation[i];
    if (start.getTime() + HOUR_MS > now.getTime() || amount === null) return;
    const key = chicagoDateHour(start);
    byKey.set(`${key.date}|${key.hour}`, { ...key, precipIn: amount, fetchedAt });
  });
  if (byKey.size === 0) throw new Error("Open-Meteo returned no past hours");
  return [...byKey.values()];
}
