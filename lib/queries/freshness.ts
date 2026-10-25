import { desc } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/tables";

export interface SourceFreshness {
  source: string;
  /** When the last successful run finished; null if it never succeeded. */
  lastSuccessAt: string | null;
  lastRun: { ok: boolean; finishedAt: string; rows: number; error: string | null; notes: string[] } | null;
}

/** The latest run and latest success per source. */
export function getFreshness(db: Db = getDb()): SourceFreshness[] {
  const runs = db.select().from(syncRuns).orderBy(desc(syncRuns.id)).all();
  const bySource = Map.groupBy(runs, (run) => run.source);
  return [...bySource].map(([source, list]) => {
    const [last] = list;
    return {
      source,
      lastSuccessAt: list.find((run) => run.ok)?.finishedAt ?? null,
      lastRun: { ok: last.ok, finishedAt: last.finishedAt, rows: last.rows, error: last.error, notes: last.notes ?? [] },
    };
  });
}
