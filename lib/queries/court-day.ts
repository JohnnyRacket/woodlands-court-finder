import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { scheduleEvents, type ScheduleEvent } from "@/lib/db/tables";
import type { Condition } from "@/lib/conditions";
import type { SlotLabel } from "@/lib/labels";
import { weatherHours } from "@/lib/sources/weather/table";
import { sunTimes } from "@/lib/sun";
import { FIRST_HOUR, LAST_HOUR } from "@/lib/time";
import { getDayConditions } from "./conditions";
import { getCourtStatuses, type CourtStatus } from "./court-status";

export interface CourtHour {
  hour: number;
  label: SlotLabel;
  bookingClosed: boolean;
  dark: boolean;
  weather: { tempF: number; precipPct: number; shortForecast: string } | null;
  conditions: Condition[];
}

export interface CourtDay {
  court: Omit<CourtStatus, "label" | "bookingClosed" | "dark">;
  date: string;
  sunset: string;
  hours: CourtHour[];
  /** Everything scheduled at the park that day, for context. */
  events: ScheduleEvent[];
}

/** One court's 7 a.m.–11 p.m. timeline. Labels come from the same query as the map. */
export function getCourtDay(courtId: string, date: string, now: Date, db: Db = getDb()): CourtDay | null {
  const hours: CourtHour[] = [];
  let court: CourtStatus | undefined;

  const weather = new Map(
    db
      .select({ hour: weatherHours.hour, tempF: weatherHours.tempF, precipPct: weatherHours.precipPct, shortForecast: weatherHours.shortForecast })
      .from(weatherHours)
      .where(eq(weatherHours.date, date))
      .all()
      .map(({ hour, ...rest }) => [hour, rest]),
  );

  const conditions = getDayConditions(date, db);

  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
    const status = getCourtStatuses(date, hour, now, db).find((c) => c.id === courtId);
    if (!status) return null;
    court = status;
    hours.push({
      hour,
      label: status.label,
      bookingClosed: status.bookingClosed,
      dark: status.dark,
      weather: weather.get(hour) ?? null,
      conditions: conditions.get(hour)!.conditions,
    });
  }

  const { id, name, kind, parkId, parkName, lighted, geometry, parkLat, parkLng, reservable } = court!;
  const info = { id, name, kind, parkId, parkName, lighted, geometry, parkLat, parkLng, reservable };
  return {
    court: info,
    date,
    sunset: sunTimes(date).sunset.toISOString(),
    hours,
    events: db
      .select()
      .from(scheduleEvents)
      .where(and(eq(scheduleEvents.parkId, info.parkId), eq(scheduleEvents.date, date)))
      .orderBy(scheduleEvents.startMin)
      .all(),
  };
}
