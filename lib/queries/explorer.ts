import { and, asc, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { scheduleEvents, type ScheduleEvent } from "@/lib/db/tables";
import { covers } from "@/lib/labels";
import { weatherHours } from "@/lib/sources/weather/table";
import { sunTimes } from "@/lib/sun";
import { allBookingDates } from "@/lib/booking-window";
import { chicagoDateHour, FIRST_HOUR, LAST_HOUR } from "@/lib/time";
import type { Condition } from "@/lib/conditions";
import type { ParkEvent } from "@/lib/sources/township-events/table";
import { getActiveAlerts, getDayConditions, getParkEvents, type Alert, type HourDetails } from "./conditions";
import { getCourtStatuses, type HourStatus } from "./court-status";
import { lastSuccessAt } from "./freshness";

export interface ExplorerData {
  date: string;
  hour: number;
  /** The current Chicago date and hour; `open` is false outside court hours. */
  now: { date: string; hour: number; open: boolean };
  /** Dates residents can book: the longest window (see lib/booking-window.ts). */
  dates: string[];
  hours: number[];
  weather:
    | ({ tempF: number; precipPct: number; windMph: number; shortForecast: string } & Omit<HourDetails, "conditions">)
    | null;
  /** Wet courts, storms, heat, wind for this hour (lib/conditions.ts). */
  conditions: Condition[];
  /** Township court closures and NWS alerts in effect now. */
  alerts: Alert[];
  /** Township events at court parks this date: crowds and parking, not court bookings. */
  parkEvents: ParkEvent[];
  sunset: string;
  /** When reservation data was last refreshed successfully. */
  reservationsUpdatedAt: string | null;
  /** Each court's label this hour; what the courts are comes once from getCourts (/api/courts/catalog). */
  courts: HourStatus[];
  /** Every drop-in, program and tournament running at this hour (a court label shows only one). */
  events: ScheduleEvent[];
}

/** Everything the map view needs for one date and hour. */
export function getExplorerData(date: string, hour: number, now: Date, db: Db = getDb()): ExplorerData {
  const current = chicagoDateHour(now);
  const today = current.date;
  const { conditions, ...detail } = getDayConditions(date, db).get(hour)!;
  const forecast =
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
    dates: allBookingDates(today),
    hours: Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i),
    weather: forecast && { ...forecast, ...detail },
    conditions,
    alerts: getActiveAlerts(now, db),
    parkEvents: getParkEvents(date, db),
    sunset: sunTimes(date).sunset.toISOString(),
    reservationsUpdatedAt: lastSuccessAt("activenet-slots", db),
    courts: getCourtStatuses(date, hour, now, db).map(({ id, label, bookingClosed, dark }) => ({ id, label, bookingClosed, dark })),
    events: db
      .select()
      .from(scheduleEvents)
      .where(eq(scheduleEvents.date, date))
      .orderBy(asc(scheduleEvents.startMin))
      .all()
      .filter((event) => covers(event, hour)),
  };
}
