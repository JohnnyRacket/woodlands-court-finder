import { and, desc, eq, inArray, max } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/tables";

export interface SourceFreshness {
  source: string;
  /** When the last successful run finished; null if it never succeeded. */
  lastSuccessAt: string | null;
  lastRun: { ok: boolean; finishedAt: string; rows: number; error: string | null; notes: string[] } | null;
}

/** The latest run and latest success per source, most recently run first. */
export function getFreshness(db: Db = getDb()): SourceFreshness[] {
  // sync_runs keeps every run, so pick the rows in SQL (index sync_runs_source_ok) rather than reading them all.
  const latestIds = (okOnly: boolean) =>
    db
      .select({ id: max(syncRuns.id) })
      .from(syncRuns)
      .where(okOnly ? eq(syncRuns.ok, true) : undefined)
      .groupBy(syncRuns.source);
  const successAt = new Map(
    db
      .select({ source: syncRuns.source, finishedAt: syncRuns.finishedAt })
      .from(syncRuns)
      .where(inArray(syncRuns.id, latestIds(true)))
      .all()
      .map((run) => [run.source, run.finishedAt]),
  );
  return db
    .select()
    .from(syncRuns)
    .where(inArray(syncRuns.id, latestIds(false)))
    .orderBy(desc(syncRuns.id))
    .all()
    .map((last) => ({
      source: last.source,
      lastSuccessAt: successAt.get(last.source) ?? null,
      lastRun: { ok: last.ok, finishedAt: last.finishedAt, rows: last.rows, error: last.error, notes: last.notes ?? [] },
    }));
}

/** When one source last succeeded; null if it never has. */
export function lastSuccessAt(source: string, db: Db = getDb()): string | null {
  return (
    db
      .select({ finishedAt: syncRuns.finishedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.source, source), eq(syncRuns.ok, true)))
      .orderBy(desc(syncRuns.id))
      .limit(1)
      .get()?.finishedAt ?? null
  );
}
