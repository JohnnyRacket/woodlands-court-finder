import { connection, type NextRequest } from "next/server";
import { jsonResponse } from "@/lib/json-response";
import { getCourts } from "@/lib/queries/court-status";

// GET /api/courts/catalog: every court's fixed details (park, kind, lights, outline). The map
// loads this once and then fetches only labels per hour from /api/courts.
export async function GET(request: NextRequest) {
  // SQLite reads are synchronous, so without this the build would prerender a snapshot.
  await connection();
  return jsonResponse(request, { courts: getCourts() });
}
