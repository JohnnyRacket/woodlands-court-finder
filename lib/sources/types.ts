import type { Db } from "@/lib/db/client";

export interface SyncContext {
  db: Db;
  now: Date;
  /** Fetch and normalize, but write nothing. */
  dryRun: boolean;
  log: (message: string) => void;
}

/** live: production. gentle: development, so working on the app never hammers upstream sites. */
export type SyncProfile = "live" | "gentle";

/**
 * One data collection. Each lives in lib/sources/<name>/ and owns its table(s).
 * run() fetches, normalizes, and replaces its own rows in a transaction.
 * Timing, sync_runs bookkeeping, and error capture are handled by lib/sync.ts.
 */
export interface SourceModule {
  name: string;
  /** Cron expressions per profile, evaluated in America/Chicago. */
  schedule: Record<SyncProfile, string>;
  /** notes: data-quality findings worth showing on /status (not errors). */
  run(ctx: SyncContext): Promise<{ rows: number; notes?: string[] }>;
}
