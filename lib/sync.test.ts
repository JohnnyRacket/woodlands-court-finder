import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { syncRuns } from "@/lib/db/tables";
import type { SourceModule } from "@/lib/sources/types";
import { runSource, runSources } from "@/lib/sync";

const silent = () => {};

function source(name: string, run: SourceModule["run"]): SourceModule {
  return { name, schedule: "* * * * *", run };
}

describe("runSource", () => {
  it("records a successful run", async () => {
    const db = openDb(":memory:");
    const result = await runSource(source("ok-source", async () => ({ rows: 7 })), { db, log: silent });

    expect(result).toMatchObject({ source: "ok-source", status: "ok", rows: 7 });
    expect(db.select().from(syncRuns).all()).toMatchObject([{ source: "ok-source", ok: true, rows: 7, error: null }]);
  });

  it("records a failed run without throwing", async () => {
    const db = openDb(":memory:");
    const failing = source("bad-source", async () => {
      throw new Error("upstream changed");
    });

    const result = await runSource(failing, { db, log: silent });

    expect(result).toMatchObject({ status: "failed", error: "upstream changed" });
    expect(db.select().from(syncRuns).all()).toMatchObject([{ source: "bad-source", ok: false, error: "upstream changed" }]);
  });

  it("writes nothing on a dry run", async () => {
    const db = openDb(":memory:");
    let sawDryRun = false;
    await runSource(
      source("dry", async (ctx) => {
        sawDryRun = ctx.dryRun;
        return { rows: 1 };
      }),
      { db, dryRun: true, log: silent },
    );

    expect(sawDryRun).toBe(true);
    expect(db.select().from(syncRuns).all()).toEqual([]);
  });

  it("skips a source that is already running", async () => {
    const db = openDb(":memory:");
    let release!: () => void;
    const slow = source("slow", () => new Promise((resolve) => (release = () => resolve({ rows: 0 }))));

    const first = runSource(slow, { db, log: silent });
    const second = await runSource(slow, { db, log: silent });
    release();

    expect(second).toEqual({ source: "slow", status: "skipped", reason: "already running" });
    expect(await first).toMatchObject({ status: "ok" });
  });
});

describe("runSources", () => {
  it("keeps going after a failure", async () => {
    const db = openDb(":memory:");
    const results = await runSources(
      [
        source("a", async () => {
          throw new Error("boom");
        }),
        source("b", async () => ({ rows: 2 })),
      ],
      { db, log: silent },
    );

    expect(results.map((r) => r.status)).toEqual(["failed", "ok"]);
  });
});
