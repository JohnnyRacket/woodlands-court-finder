import cron from "node-cron";
import { getDb } from "@/lib/db/client";
import { getFreshness } from "@/lib/queries/freshness";
import { sources } from "@/lib/sources";
import type { SourceModule, SyncProfile } from "@/lib/sources/types";
import { syncProfile } from "@/lib/sync-profile";
import { runSource, runSources } from "@/lib/sync";

const globalForScheduler = globalThis as unknown as { schedulerStarted?: boolean };

/** In gentle mode, a boot-time run is skipped when the last success is newer than this. */
const GENTLE_BOOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Sources to run on boot: all of them when live; only missing or day-old data when gentle. */
export function bootSources(
  list: SourceModule[],
  profile: SyncProfile,
  now: Date,
  freshness: { source: string; lastSuccessAt: string | null }[],
): SourceModule[] {
  if (profile === "live") return list;
  const lastSuccess = new Map(freshness.map((f) => [f.source, f.lastSuccessAt]));
  return list.filter((source) => {
    const at = lastSuccess.get(source.name);
    return !at || now.getTime() - new Date(at).getTime() > GENTLE_BOOT_MAX_AGE_MS;
  });
}

export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return;
  globalForScheduler.schedulerStarted = true;

  const profile = syncProfile();
  for (const source of sources) {
    cron.schedule(source.schedule[profile], () => void runSource(source), {
      name: source.name,
      timezone: "America/Chicago",
      noOverlap: true,
    });
  }

  const onBoot = bootSources(sources, profile, new Date(), getFreshness(getDb()));
  console.log(
    `[scheduler] ${profile} profile: ${sources.length} source(s) scheduled; on boot: ${onBoot.map((s) => s.name).join(", ") || "none (data is fresh enough)"}`,
  );
  void runSources(onBoot);
}
