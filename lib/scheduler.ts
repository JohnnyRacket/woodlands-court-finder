import cron from "node-cron";
import { sources } from "@/lib/sources";
import { runSource, runSources } from "@/lib/sync";

const globalForScheduler = globalThis as unknown as { schedulerStarted?: boolean };

export function startScheduler() {
  if (globalForScheduler.schedulerStarted) return;
  globalForScheduler.schedulerStarted = true;

  for (const source of sources) {
    cron.schedule(source.schedule, () => void runSource(source), {
      name: source.name,
      timezone: "America/Chicago",
      noOverlap: true,
    });
  }
  console.log(`[scheduler] scheduled ${sources.length} source(s): ${sources.map((s) => s.name).join(", ") || "none"}`);

  // Fill the database on boot instead of waiting for the first cron tick.
  void runSources(sources);
}
