import { getDb, type Db } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/tables";
import type { SourceModule } from "@/lib/sources/types";

export type SyncResult =
  | { source: string; status: "ok"; rows: number; ms: number }
  | { source: string; status: "failed"; error: string; ms: number }
  | { source: string; status: "skipped"; reason: "already running" };

interface RunOptions {
  db?: Db;
  dryRun?: boolean;
  now?: () => Date;
  log?: (message: string) => void;
}

const running = new Set<string>();

export async function runSource(source: SourceModule, options: RunOptions = {}): Promise<SyncResult> {
  if (running.has(source.name)) {
    return { source: source.name, status: "skipped", reason: "already running" };
  }
  running.add(source.name);

  const db = options.db ?? getDb();
  const now = options.now ?? (() => new Date());
  const dryRun = options.dryRun ?? false;
  const log = options.log ?? ((message: string) => console.log(`[sync:${source.name}] ${message}`));
  const startedAt = now();

  try {
    const { rows } = await source.run({ db, now: startedAt, dryRun, log });
    const finishedAt = now();
    if (!dryRun) {
      db.insert(syncRuns)
        .values({ source: source.name, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), ok: true, rows })
        .run();
    }
    return { source: source.name, status: "ok", rows, ms: finishedAt.getTime() - startedAt.getTime() };
  } catch (err) {
    const finishedAt = now();
    const error = err instanceof Error ? err.message : String(err);
    log(`failed: ${error}`);
    if (!dryRun) {
      db.insert(syncRuns)
        .values({ source: source.name, startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), ok: false, error })
        .run();
    }
    return { source: source.name, status: "failed", error, ms: finishedAt.getTime() - startedAt.getTime() };
  } finally {
    running.delete(source.name);
  }
}

/** Runs sources one after another, so requests to the same upstream never overlap. */
export async function runSources(list: SourceModule[], options: RunOptions = {}): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const source of list) results.push(await runSource(source, options));
  return results;
}
