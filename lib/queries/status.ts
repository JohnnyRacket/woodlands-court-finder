import { count } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { courts, parks, scheduleEvents } from "@/lib/db/tables";
import { sources } from "@/lib/sources";
import { slots } from "@/lib/sources/activenet-slots/table";
import type { SyncProfile } from "@/lib/sources/types";
import { weatherHours } from "@/lib/sources/weather/table";
import { syncProfile } from "@/lib/sync-profile";
import { getFreshness, type SourceFreshness } from "./freshness";

export interface SourceStatus extends Omit<SourceFreshness, "source"> {
  name: string;
  schedule: string;
}

export interface AppStatus {
  profile: SyncProfile;
  schedulerEnabled: boolean;
  sources: SourceStatus[];
  rowCounts: { table: string; rows: number }[];
}

/** Everything /status shows: per-source health, schedules, notes, and table sizes. */
export function getStatus(db: Db = getDb()): AppStatus {
  const profile = syncProfile();
  const freshness = new Map(getFreshness(db).map((f) => [f.source, f]));
  const tableCount = (table: typeof parks | typeof courts | typeof slots | typeof weatherHours | typeof scheduleEvents) =>
    db.select({ n: count() }).from(table).get()?.n ?? 0;

  return {
    profile,
    schedulerEnabled: process.env.SYNC_ENABLED === "true",
    sources: sources.map((source) => {
      const f = freshness.get(source.name);
      return {
        name: source.name,
        schedule: source.schedule[profile],
        lastSuccessAt: f?.lastSuccessAt ?? null,
        lastRun: f?.lastRun ?? null,
      };
    }),
    rowCounts: [
      { table: "parks", rows: tableCount(parks) },
      { table: "courts", rows: tableCount(courts) },
      { table: "slots", rows: tableCount(slots) },
      { table: "schedule_events", rows: tableCount(scheduleEvents) },
      { table: "weather_hours", rows: tableCount(weatherHours) },
    ],
  };
}
