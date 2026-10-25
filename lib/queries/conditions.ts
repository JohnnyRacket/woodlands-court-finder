import { and, asc, eq, gt } from "drizzle-orm";
import { playingConditions, type Condition, type RainTotal } from "@/lib/conditions";
import { getDb, type Db } from "@/lib/db/client";
import { weatherAlerts } from "@/lib/sources/nws-alerts/table";
import { rainHours } from "@/lib/sources/rainfall/table";
import { townshipAlerts } from "@/lib/sources/township-alerts/table";
import { parkEvents, type ParkEvent } from "@/lib/sources/township-events/table";
import { weatherDetails } from "@/lib/sources/weather-details/table";
import { addDays } from "@/lib/time";

export interface HourDetails {
  gustMph: number | null;
  thunderPct: number | null;
  heatIndexF: number | null;
  wbgtF: number | null;
  conditions: Condition[];
}

/**
 * Conditions for every hour of a date. Rain that has fallen (rainfall source) is used
 * where it exists; later hours fall back to the forecast amount (weather-details).
 */
export function getDayConditions(date: string, db: Db = getDb()): Map<number, HourDetails> {
  const dates = [addDays(date, -1), date];
  const key = (d: string, hour: number) => (d === date ? hour : hour - 24);
  const observed = new Map<number, number>();
  const forecast = new Map<number, number>();
  for (const d of dates) {
    for (const row of db.select().from(rainHours).where(eq(rainHours.date, d)).all()) observed.set(key(d, row.hour), row.precipIn);
  }
  const details = new Map<number, typeof weatherDetails.$inferSelect>();
  for (const d of dates) {
    for (const row of db.select().from(weatherDetails).where(eq(weatherDetails.date, d)).all()) {
      if (row.rainIn !== null) forecast.set(key(d, row.hour), row.rainIn);
      if (d === date) details.set(row.hour, row);
    }
  }

  const rainBefore = (hour: number, span: number): RainTotal => {
    let inches = 0;
    let forecastRain = 0;
    for (let h = hour - span; h < hour; h++) {
      if (observed.has(h)) inches += observed.get(h)!;
      else forecastRain += forecast.get(h) ?? 0;
    }
    return { inches: inches + forecastRain, forecast: forecastRain > 0 };
  };

  const result = new Map<number, HourDetails>();
  for (let hour = 0; hour < 24; hour++) {
    const d = details.get(hour);
    const input = { gustMph: d?.gustMph ?? null, thunderPct: d?.thunderPct ?? null, heatIndexF: d?.heatIndexF ?? null, wbgtF: d?.wbgtF ?? null };
    result.set(hour, { ...input, conditions: playingConditions({ ...input, rainLast2h: rainBefore(hour, 2), rainLast6h: rainBefore(hour, 6) }) });
  }
  return result;
}

export interface Alert {
  id: string;
  source: "township" | "nws";
  title: string;
  body: string | null;
  level: "info" | "warning" | "danger";
  /** Parks the alert names; empty = area-wide */
  parkIds: string[];
  /** NWS hazard window (ISO); null for Township notices, which carry no dates */
  startsAt: string | null;
  endsAt: string | null;
}

const NWS_LEVEL: Record<string, Alert["level"]> = { Extreme: "danger", Severe: "danger", Moderate: "warning" };

/** Township court closures and NWS alerts in effect now. Notices about other facilities are left out. */
export function getActiveAlerts(now: Date, db: Db = getDb()): Alert[] {
  const township = db
    .select()
    .from(townshipAlerts)
    .where(and(eq(townshipAlerts.active, true), eq(townshipAlerts.aboutCourts, true)))
    .all()
    .map(
      (a): Alert => ({ id: `township:${a.id}`, source: "township", title: a.title, body: a.body || null, level: "warning", parkIds: a.parkIds, startsAt: null, endsAt: null }),
    );
  const nws = db
    .select()
    .from(weatherAlerts)
    .where(and(eq(weatherAlerts.active, true), gt(weatherAlerts.endsAt, now.toISOString())))
    .orderBy(asc(weatherAlerts.startsAt))
    .all()
    .map(
      (a): Alert => ({
        id: `nws:${a.id}`,
        source: "nws",
        title: a.event,
        body: a.headline ?? a.description,
        level: NWS_LEVEL[a.severity] ?? "info",
        parkIds: [],
        startsAt: a.startsAt,
        endsAt: a.endsAt,
      }),
    );
  return [...township, ...nws];
}

/** Township events at court parks on a date. */
export function getParkEvents(date: string, db: Db = getDb()): ParkEvent[] {
  return db.select().from(parkEvents).where(eq(parkEvents.date, date)).orderBy(asc(parkEvents.startMin)).all();
}
