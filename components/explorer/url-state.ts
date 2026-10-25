import { allBookingDates } from "@/lib/booking-window";
import { chicagoDate, currentPlayHour, FIRST_HOUR, LAST_HOUR } from "@/lib/time";
import { SPORTS, type Filters, type Sport } from "./park-summary";

// What the map shows lives in the URL, so a view can be shared, bookmarked, reloaded and
// stepped back through: /?date=2026-10-26&hour=19&park=…&court=…&sport=tennis&open=1&lit=1
// Every parameter is optional; without date and hour the map follows the current hour.

export interface ExplorerView {
  /** null = follow the current play hour */
  time: { date: string; hour: number } | null;
  parkId: string | null;
  /** Only with a park: the selected court, whose day is shown */
  courtId: string | null;
  filters: Filters;
}

/** The time has passed: the shown hour is before the current play hour. */
export function isPastTime(time: { date: string; hour: number }, now: Date): boolean {
  const current = currentPlayHour(now);
  return time.date < current.date || (time.date === current.date && time.hour < current.hour);
}

/** A bookable date and court hour that hasn't passed, or null (follow now). */
function parseTime(date: string | null, hour: string | null, now: Date): ExplorerView["time"] {
  if (!date || !hour || !/^\d+$/.test(hour)) return null;
  const time = { date, hour: Number(hour) };
  if (time.hour < FIRST_HOUR || time.hour > LAST_HOUR || !allBookingDates(chicagoDate(now)).includes(date)) return null;
  return isPastTime(time, now) ? null : time;
}

export function parseView(params: URLSearchParams, now: Date): ExplorerView {
  const parkId = params.get("park") || null;
  const sport = params.get("sport");
  return {
    time: parseTime(params.get("date"), params.get("hour"), now),
    parkId,
    courtId: parkId ? params.get("court") || null : null,
    filters: {
      sports: SPORTS.includes(sport as Sport) ? [sport as Sport] : SPORTS,
      joinableOnly: params.get("open") === "1",
      litOnly: params.get("lit") === "1",
    },
  };
}

/** The query string for a view ("" for the default view), with parameters in a fixed order. */
export function viewSearch(view: ExplorerView): string {
  const params = new URLSearchParams();
  if (view.time) {
    params.set("date", view.time.date);
    params.set("hour", String(view.time.hour));
  }
  if (view.parkId) {
    params.set("park", view.parkId);
    if (view.courtId) params.set("court", view.courtId);
  }
  if (view.filters.sports.length === 1) params.set("sport", view.filters.sports[0]);
  if (view.filters.joinableOnly) params.set("open", "1");
  if (view.filters.litOnly) params.set("lit", "1");
  const search = params.toString();
  return search ? `?${search}` : "";
}
