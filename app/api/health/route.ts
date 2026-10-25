import { connection } from "next/server";
import { getSourceStatuses } from "@/lib/queries/status";

// For container health checks: 200 whenever the database opens, so an upstream outage never
// restarts the app. `status` is "degraded" when a source has failed or fallen behind its
// schedule (the same rules as /status), for uptime monitors to alert on.
export async function GET() {
  // SQLite reads are synchronous, so without this the build would prerender a snapshot.
  await connection();
  try {
    const sources = getSourceStatuses();
    const degraded = sources.some((s) => s.state === "failed" || s.state === "delayed");
    return Response.json({
      ok: true,
      status: degraded ? "degraded" : "ok",
      sources: Object.fromEntries(sources.map((s) => [s.name, { state: s.state, lastSuccessAt: s.lastSuccessAt, ...(s.error && { error: s.error }) }])),
    });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 503 });
  }
}
