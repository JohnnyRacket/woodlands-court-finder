import { count } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describeSchedule, previousRun } from "@/lib/cron-text";
import { getDb, type Db } from "@/lib/db/client";
import { courts, parks, scheduleEvents } from "@/lib/db/tables";
import { sources } from "@/lib/sources";
import { slotChanges, slots } from "@/lib/sources/activenet-slots/table";
import { weatherAlerts } from "@/lib/sources/nws-alerts/table";
import { rainHours } from "@/lib/sources/rainfall/table";
import { townshipAlerts } from "@/lib/sources/township-alerts/table";
import { parkEvents } from "@/lib/sources/township-events/table";
import type { SyncProfile } from "@/lib/sources/types";
import { weatherHours } from "@/lib/sources/weather/table";
import { weatherDetails } from "@/lib/sources/weather-details/table";
import { syncProfile } from "@/lib/sync-profile";
import { getFreshness } from "./freshness";

/** How long after a scheduled run we wait before calling a source delayed (runs can take minutes). */
const GRACE_MS = 30 * 60 * 1000;

export type SourceState = "up_to_date" | "delayed" | "failed" | "paused" | "never";

export interface Finding {
  headline: string;
  /** A list of names (courts, ids) when the finding enumerates them. */
  items: string[];
  /** Free-text detail when it doesn't. */
  detail: string | null;
}

export interface SourceStatus {
  name: string;
  title: string;
  origin: string;
  /** Plain English, e.g. "Every 15 minutes, 7 AM–11 PM". */
  schedule: string;
  state: SourceState;
  lastSuccessAt: string | null;
  error: string | null;
  findings: Finding[];
}

export interface AppStatus {
  overall: SourceState;
  profile: SyncProfile;
  schedulerEnabled: boolean;
  sources: SourceStatus[];
  rowCounts: { table: string; rows: number }[];
}

/** "19 ActiveNet court(s) have no GIS outline: A, B, C" → headline + list. */
export function parseFinding(note: string): Finding {
  const split = note.indexOf(": ");
  if (split === -1) return { headline: note, items: [], detail: null };
  const headline = note.slice(0, split);
  const rest = note.slice(split + 2);
  const items = rest.split(", ");
  return items.length >= 3 && !rest.includes('"') ? { headline, items, detail: null } : { headline, items: [], detail: rest };
}

const SEVERITY: SourceState[] = ["up_to_date", "paused", "delayed", "never", "failed"];

export function sourceState(
  lastRun: { ok: boolean } | null,
  lastSuccessAt: string | null,
  cron: string | string[],
  schedulerEnabled: boolean,
  now: Date,
): SourceState {
  if (!lastRun) return "never";
  if (!lastRun.ok) return "failed";
  if (!schedulerEnabled) return "paused";
  const due = Math.max(...[cron].flat().map((c) => previousRun(c, now)?.getTime() ?? 0));
  if (due && lastSuccessAt && new Date(lastSuccessAt).getTime() < due - GRACE_MS) return "delayed";
  return "up_to_date";
}

/** Everything /status shows: per-source health in plain language, findings, and table sizes. */
export function getStatus(now: Date = new Date(), db: Db = getDb()): AppStatus {
  const profile = syncProfile();
  const schedulerEnabled = process.env.SYNC_ENABLED === "true";
  const freshness = new Map(getFreshness(db).map((f) => [f.source, f]));
  const tableCount = (table: SQLiteTable) => db.select({ n: count() }).from(table).get()?.n ?? 0;

  const statuses = sources.map((source): SourceStatus => {
    const f = freshness.get(source.name);
    const cron = source.schedule[profile];
    return {
      name: source.name,
      title: source.title,
      origin: source.origin,
      schedule: [cron].flat().map(describeSchedule).join("; "),
      state: sourceState(f?.lastRun ?? null, f?.lastSuccessAt ?? null, cron, schedulerEnabled, now),
      lastSuccessAt: f?.lastSuccessAt ?? null,
      error: f?.lastRun && !f.lastRun.ok ? f.lastRun.error : null,
      findings: (f?.lastRun?.notes ?? []).map(parseFinding),
    };
  });

  return {
    overall: statuses.reduce<SourceState>((worst, s) => (SEVERITY.indexOf(s.state) > SEVERITY.indexOf(worst) ? s.state : worst), "up_to_date"),
    profile,
    schedulerEnabled,
    sources: statuses,
    rowCounts: [
      { table: "parks", rows: tableCount(parks) },
      { table: "courts", rows: tableCount(courts) },
      { table: "slots", rows: tableCount(slots) },
      { table: "slot_changes", rows: tableCount(slotChanges) },
      { table: "schedule_events", rows: tableCount(scheduleEvents) },
      { table: "park_events", rows: tableCount(parkEvents) },
      { table: "weather_hours", rows: tableCount(weatherHours) },
      { table: "weather_details", rows: tableCount(weatherDetails) },
      { table: "rain_hours", rows: tableCount(rainHours) },
      { table: "weather_alerts", rows: tableCount(weatherAlerts) },
      { table: "township_alerts", rows: tableCount(townshipAlerts) },
    ],
  };
}
