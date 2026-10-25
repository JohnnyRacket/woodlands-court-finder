import { and, asc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { scheduleEvents, type ScheduleEvent } from "@/lib/db/tables";
import { covers } from "@/lib/labels";
import { weatherHours } from "@/lib/sources/weather/table";
import { sunTimes } from "@/lib/sun";
import { addDays, chicagoDateHour, FIRST_HOUR, LAST_HOUR } from "@/lib/time";
import { getCourtStatuses, type CourtStatus } from "./court-status";
import { getFreshness } from "./freshness";

export interface ExplorerData {
  date: string;
  hour: number;
  /** The current Chicago date and hour; `open` is false outside court hours. */
  now: { date: string; hour: number; open: boolean };
  /** Dates with reservation data: residents can book today and tomorrow. */
  dates: string[];
  hours: number[];
  weather: { tempF: number; precipPct: number; windMph: number; shortForecast: string } | null;
  sunset: string;
  /** When reservation data was last refreshed successfully. */
  reservationsUpdatedAt: string | null;
  courts: CourtStatus[];
  /** Every drop-in, program and tournament running at this hour (a court label shows only one). */
  events: ScheduleEvent[];
}

/** Everything the map view needs for one date and hour. */
export function getExplorerData(date: string, hour: number, now: Date, db: Db = getDb()): ExplorerData {
  const current = chicagoDateHour(now);
  const today = current.date;
  const weather =
    db
      .select({
        tempF: weatherHours.tempF,
        precipPct: weatherHours.precipPct,
        windMph: weatherHours.windMph,
        shortForecast: weatherHours.shortForecast,
      })
      .from(weatherHours)
      .where(and(eq(weatherHours.date, date), eq(weatherHours.hour, hour)))
      .get() ?? null;

  return {
    date,
    hour,
    now: { ...current, open: current.hour >= FIRST_HOUR && current.hour <= LAST_HOUR },
    dates: [today, addDays(today, 1)],
    hours: Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i),
    weather,
    sunset: sunTimes(date).sunset.toISOString(),
    reservationsUpdatedAt: getFreshness(db).find((f) => f.source === "activenet-slots")?.lastSuccessAt ?? null,
    courts: getCourtStatuses(date, hour, db),
    events: db
      .select()
      .from(scheduleEvents)
      .where(eq(scheduleEvents.date, date))
      .orderBy(asc(scheduleEvents.startMin))
      .all()
      .filter((event) => covers(event, hour)),
  };
}
