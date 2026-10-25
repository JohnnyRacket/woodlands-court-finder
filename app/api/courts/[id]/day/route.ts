import type { NextRequest } from "next/server";
import { z } from "zod";
import { allBookingDates } from "@/lib/booking-window";
import { jsonResponse } from "@/lib/json-response";
import { getCourtDay } from "@/lib/queries/court-day";
import { chicagoDate } from "@/lib/time";

// GET /api/courts/:id/day?date=YYYY-MM-DD (any bookable date; defaults to today)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/courts/[id]/day">) {
  const { id } = await params;
  const now = new Date();
  const today = chicagoDate(now);
  // A date outside the window is an error, not today: the caller checks the date it gets back.
  const parsed = z
    .enum(allBookingDates(today))
    .default(today)
    .safeParse(request.nextUrl.searchParams.get("date") ?? undefined);
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const date = parsed.data;

  const day = getCourtDay(id, date, now);
  if (!day) return Response.json({ error: `Unknown court "${id}"` }, { status: 404 });
  return jsonResponse(request, day);
}
