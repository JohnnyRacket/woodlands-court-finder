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
