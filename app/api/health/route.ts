import { connection } from "next/server";
import { getFreshness } from "@/lib/queries/freshness";

// For container health checks: 200 when the database opens, with data freshness.
export async function GET() {
  // SQLite reads are synchronous, so without this the build would prerender a snapshot.
  await connection();
  try {
    const freshness = getFreshness();
    return Response.json({
      ok: true,
      sources: Object.fromEntries(freshness.map((f) => [f.source, { lastSuccessAt: f.lastSuccessAt, lastRunOk: f.lastRun?.ok ?? null }])),
    });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
