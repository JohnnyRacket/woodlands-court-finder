import cron from "node-cron";
import { previousRun } from "@/lib/cron-text";
import { getDb } from "@/lib/db/client";
import { getFreshness } from "@/lib/queries/freshness";
import { sources } from "@/lib/sources";
import type { SourceModule, SyncProfile } from "@/lib/sources/types";
import { syncProfile } from "@/lib/sync-profile";
import { runSource, runSources } from "@/lib/sync";

const globalForScheduler = globalThis as unknown as { schedulerStarted?: boolean };

/** In gentle mode, a boot-time run is skipped when the last success is newer than this. */
const GENTLE_BOOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Sources to run on boot, so restarts and redeploys don't re-fetch fresh data.
 * live: missing data, or a scheduled run was missed while the app was down.
 * gentle: missing or day-old data.
 */
export function bootSources(
  list: SourceModule[],
  profile: SyncProfile,
  now: Date,
  freshness: { source: string; lastSuccessAt: string | null }[],
): SourceModule[] {
  const lastSuccess = new Map(freshness.map((f) => [f.source, f.lastSuccessAt]));
  return list.filter((source) => {
    const at = lastSuccess.get(source.name);
    if (!at) return true;
    const successAt = new Date(at).getTime();
    if (profile === "gentle") return now.getTime() - successAt > GENTLE_BOOT_MAX_AGE_MS;
    const due = Math.max(...[source.schedule.live].flat().map((c) => previousRun(c, now)?.getTime() ?? 0));
    return successAt < due;
  });
}

export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return;
  globalForScheduler.schedulerStarted = true;

  const profile = syncProfile();
  for (const source of sources) {
    for (const expression of [source.schedule[profile]].flat()) {
      cron.schedule(expression, () => void runSource(source), {
        name: source.name,
        timezone: "America/Chicago",
        noOverlap: true,
      });
    }
  }

  const onBoot = bootSources(sources, profile, new Date(), getFreshness(getDb()));
  console.log(
    `[scheduler] ${profile} profile: ${sources.length} source(s) scheduled; on boot: ${onBoot.map((s) => s.name).join(", ") || "none (data is fresh enough)"}`,
  );
  void runSources(onBoot);
}
