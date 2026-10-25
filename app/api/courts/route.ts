import type { NextRequest } from "next/server";
import { z } from "zod";
import { getExplorerData } from "@/lib/queries/explorer";
import { currentPlayHour, FIRST_HOUR, LAST_HOUR } from "@/lib/time";

const paramsSchema = z.object({
  date: z.iso.date().optional(),
  hour: z.coerce.number().int().min(FIRST_HOUR).max(LAST_HOUR).optional(),
});

// GET /api/courts?date=YYYY-MM-DD&hour=7..22 (both optional; defaults to the current play hour)
export async function GET(request: NextRequest) {
  const parsed = paramsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const now = new Date();
  const fallback = currentPlayHour(now);
  const date = parsed.data.date ?? fallback.date;
  const hour = parsed.data.hour ?? (parsed.data.date ? FIRST_HOUR : fallback.hour);
  return Response.json(getExplorerData(date, hour, now));
}
