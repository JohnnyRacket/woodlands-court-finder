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

/** Calendar arithmetic on a YYYY-MM-DD string (no time zone involved). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
