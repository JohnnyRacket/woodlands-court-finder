// Small helpers for the five-field cron expressions our sources use:
// plain-English descriptions, and when a schedule last should have fired.
// Supports numbers, *, lists (a,b), ranges (a-b) and steps (*/n, a-b/n).

import { TIME_ZONE } from "@/lib/time";

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function parseField(field: string, min: number, max: number): number[] {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepText] = part.split("/");
    const step = stepText ? Number(stepText) : 1;
    const [from, to] = range === "*" ? [min, max] : range.includes("-") ? range.split("-").map(Number) : [Number(range), stepText ? max : Number(range)];
    if ([from, to, step].some((n) => Number.isNaN(n)) || step < 1) throw new Error(`Unsupported cron field "${field}"`);
    for (let v = from; v <= to; v += step) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}

function parse(cron: string) {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Expected 5 cron fields: "${cron}"`);
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (dayOfMonth !== "*" || month !== "*") throw new Error(`Unsupported cron expression "${cron}"`);
  return {
    minutes: parseField(minute, 0, 59),
    hours: parseField(hour, 0, 23),
    days: parseField(dayOfWeek, 0, 6),
    fields: { minute, hour, dayOfWeek },
  };
}

const clock = (hour: number, minute = 0) =>
  `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""} ${hour < 12 ? "AM" : "PM"}`;

/** "*\/15 7-22 * * *" → "Every 15 minutes, 7 AM–11 PM" */
export function describeSchedule(cron: string): string {
  let parsed;
  try {
    parsed = parse(cron);
  } catch {
    return cron;
  }
  const { minutes, hours, days, fields } = parsed;
  const everyDay = days.length === 7;
  const onDays = everyDay ? "" : ` on ${days.map((d) => DAY_NAMES[d]).join(" and ")}`;
  const window = hours.length < 24 ? `, ${clock(hours[0])}–${clock((hours[hours.length - 1] + 1) % 24)}` : "";

  if (minutes.length > 1) {
    const step = minutes[1] - minutes[0];
    return `Every ${step} minutes${window}${onDays}`;
  }
  if (hours.length === 24) return `Every hour${onDays}`;
  if (hours.length > 1) {
    const step = hours[1] - hours[0];
    const allStepped = fields.hour.includes("/");
    // Stepped hours run last at the final hour, so the range ends there ("8 AM–8 PM").
    const range = `, ${clock(hours[0])}–${clock(hours[hours.length - 1])}`;
    return `Every ${step} hours${allStepped && hours.length < 24 / step ? range : ""}${onDays}`;
  }
  const at = clock(hours[0], minutes[0]);
  return everyDay ? `Daily at ${at}` : `Weekly${onDays} at ${at}`;
}

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The most recent time (America/Chicago) the schedule fired at or before `now`, looking back up to 8 days. */
export function previousRun(cron: string, now: Date): Date | null {
  const { minutes, hours, days } = parse(cron);
  const start = Math.floor(now.getTime() / 60_000) * 60_000;
  for (let t = start; t > start - 8 * 24 * 60 * 60_000; t -= 60_000) {
    const p = Object.fromEntries(parts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    if (minutes.includes(Number(p.minute)) && hours.includes(Number(p.hour)) && days.includes(WEEKDAYS.indexOf(p.weekday))) {
      return new Date(t);
    }
  }
  return null;
}
