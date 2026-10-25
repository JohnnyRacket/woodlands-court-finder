export const TIME_ZONE = "America/Chicago";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date in The Woodlands, as YYYY-MM-DD. */
export function chicagoDate(at: Date): string {
  return dateFormat.format(at);
}

const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

/** The Chicago-local date and hour of an instant: the key every dataset is stored under. */
export function chicagoDateHour(at: Date): { date: string; hour: number } {
  return { date: chicagoDate(at), hour: Number(hourFormat.format(at)) };
}

const minuteFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "numeric", hourCycle: "h23" });

/** Minutes since Chicago-local midnight, e.g. 6:40 p.m. → 1120. */
export function chicagoMinuteOfDay(at: Date): number {
  const [h, m] = minuteFormat.format(at).split(":").map(Number);
  return h * 60 + m;
}

/** Calendar arithmetic on a YYYY-MM-DD string (no time zone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** `count` consecutive dates starting at `from`. */
export function dateRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** How far ahead recurring schedules are expanded into concrete events. */
export const EVENT_WINDOW_DAYS = 14;
