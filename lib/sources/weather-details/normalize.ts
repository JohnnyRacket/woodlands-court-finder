import { z } from "zod";
import { chicagoDateHour } from "@/lib/time";

// NWS gridpoint data is a set of time series, each value covering an interval such as
// "2026-10-25T06:00:00+00:00/PT2H". Units are declared per series and checked, so a
// change upstream fails the run instead of silently mixing units.

const series = <U extends string>(uom: U) =>
  z.object({
    uom: z.literal(uom),
    values: z.array(z.object({ validTime: z.string(), value: z.number().nullable() })),
  });

export const gridpointSchema = z.object({
  properties: z.object({
    windGust: series("wmoUnit:km_h-1"),
    // NWS omits uom on this percentage series.
    probabilityOfThunder: z.object({ values: z.array(z.object({ validTime: z.string(), value: z.number().nullable() })) }),
    heatIndex: series("wmoUnit:degC"),
    wetBulbGlobeTemperature: series("wmoUnit:degC"),
    quantitativePrecipitation: series("wmoUnit:mm"),
  }),
});

export interface WeatherDetailRow {
  date: string;
  hour: number;
  gustMph: number | null;
  thunderPct: number | null;
  heatIndexF: number | null;
  /** Wet-bulb globe temperature: the heat-stress measure sports heat policies use. */
  wbgtF: number | null;
  /** Forecast rain for this hour, inches (the interval's amount spread evenly over its hours). */
  rainIn: number | null;
  fetchedAt: string;
}

const HOUR_MS = 60 * 60 * 1000;

/** "P2DT6H" → 54 */
export function durationHours(duration: string): number {
  const match = duration.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!match || duration === "P" || duration === "PT") throw new Error(`Unexpected NWS duration "${duration}"`);
  const [, days = "0", hours = "0", minutes = "0"] = match;
  if (Number(minutes) !== 0) throw new Error(`NWS duration "${duration}" isn't whole hours`);
  return Number(days) * 24 + Number(hours);
}

/** Each hour an interval covers, as instants, with the value and the interval's length. */
function expand(values: { validTime: string; value: number | null }[]) {
  const hours = new Map<number, { value: number | null; span: number }>();
  for (const { validTime, value } of values) {
    const [start, duration] = validTime.split("/");
    const startMs = Date.parse(start);
    if (!duration || Number.isNaN(startMs)) throw new Error(`Unexpected NWS validTime "${validTime}"`);
    const span = durationHours(duration);
    for (let i = 0; i < span; i++) hours.set(startMs + i * HOUR_MS, { value, span });
  }
  return hours;
}

const toF = (c: number) => Math.round((c * 9) / 5 + 32);
const toMph = (kmh: number) => Math.round(kmh / 1.609344);
const toInches = (mm: number) => Math.round((mm / 25.4) * 1000) / 1000;

export function toWeatherDetailRows(json: unknown, fetchedAt: string): WeatherDetailRow[] {
  const p = gridpointSchema.parse(json).properties;
  const gust = expand(p.windGust.values);
  const thunder = expand(p.probabilityOfThunder.values);
  const heat = expand(p.heatIndex.values);
  const wbgt = expand(p.wetBulbGlobeTemperature.values);
  const rain = expand(p.quantitativePrecipitation.values);

  const instants = [...new Set([...gust.keys(), ...thunder.keys(), ...heat.keys(), ...wbgt.keys(), ...rain.keys()])].sort((a, b) => a - b);
  if (instants.length === 0) throw new Error("NWS gridpoint returned no data");

  // When DST ends, 1 a.m. happens twice; the later hour wins so each (date, hour) appears once.
  const byKey = new Map<string, WeatherDetailRow>();
  for (const instant of instants) {
    const key = chicagoDateHour(new Date(instant));
    const at = (map: ReturnType<typeof expand>, convert: (value: number, span: number) => number) => {
      const slot = map.get(instant);
      return slot?.value == null ? null : convert(slot.value, slot.span);
    };
    byKey.set(`${key.date}|${key.hour}`, {
      ...key,
      gustMph: at(gust, toMph),
      thunderPct: at(thunder, Math.round),
      heatIndexF: at(heat, toF),
      wbgtF: at(wbgt, toF),
      rainIn: at(rain, (mm, span) => toInches(mm / span)),
      fetchedAt,
    });
  }
  return [...byKey.values()];
}
