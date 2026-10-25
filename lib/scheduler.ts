import cron, { type ScheduledTask } from "node-cron";
import { previousRun } from "@/lib/cron-text";
import { getDb } from "@/lib/db/client";
import { getFreshness } from "@/lib/queries/freshness";
import { sources } from "@/lib/sources";
import type { SourceModule, SyncProfile } from "@/lib/sources/types";
import { syncProfile } from "@/lib/sync-profile";
import { runSource } from "@/lib/sync";

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

/** After a failed run, try again after each of these, unless a scheduled run comes first. */
const RETRY_DELAYS_MS = [5 * 60_000, 20 * 60_000];

/**
 * How long to wait before retrying a failed run, or null to leave it to the schedule:
 * retries are used up, or the next scheduled run is due before the retry would be.
 */
export function retryDelay(retriesDone: number, nextRunAt: Date | null, now: Date): number | null {
  const delay = RETRY_DELAYS_MS[retriesDone];
  if (delay === undefined) return null;
  if (nextRunAt && nextRunAt.getTime() - now.getTime() <= delay) return null;
  return delay;
}

export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return;
  globalForScheduler.schedulerStarted = true;

  const profile = syncProfile();
  const tasks = new Map<string, ScheduledTask[]>();
  const nextRunAt = (source: SourceModule) =>
    (tasks.get(source.name) ?? [])
      .map((task) => task.getNextRun())
      .filter((at) => at !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  // A transient upstream failure shouldn't leave a daily source stale until tomorrow.
  const run = async (source: SourceModule, retriesDone = 0) => {
    const result = await runSource(source);
    if (result.status !== "failed") return;
    const delay = retryDelay(retriesDone, nextRunAt(source), new Date());
    if (delay === null) return;
    console.log(`[scheduler] retrying ${source.name} in ${delay / 60_000} min`);
    setTimeout(() => void run(source, retriesDone + 1), delay).unref();
  };

  for (const source of sources) {
    tasks.set(
      source.name,
      [source.schedule[profile]].flat().map((expression) =>
        cron.schedule(expression, () => run(source), {
          name: source.name,
          timezone: "America/Chicago",
          noOverlap: true,
        }),
      ),
    );
  }

  const onBoot = bootSources(sources, profile, new Date(), getFreshness(getDb()));
  console.log(
    `[scheduler] ${profile} profile: ${sources.length} source(s) scheduled; on boot: ${onBoot.map((s) => s.name).join(", ") || "none (data is fresh enough)"}`,
  );
  // One after another, so requests to the same upstream never overlap.
  void (async () => {
    for (const source of onBoot) await run(source);
  })();
}
