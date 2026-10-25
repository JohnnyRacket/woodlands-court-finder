import type { NextRequest } from "next/server";
import { z } from "zod";
import { allBookingDates } from "@/lib/booking-window";
import { getCourtDay } from "@/lib/queries/court-day";
import { chicagoDate } from "@/lib/time";

// GET /api/courts/:id/day?date=YYYY-MM-DD (any bookable date; defaults to today)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/courts/[id]/day">) {
  const { id } = await params;
  const now = new Date();
  const today = chicagoDate(now);
  const date = z
    .enum(allBookingDates(today))
    .catch(today)
    .parse(request.nextUrl.searchParams.get("date"));

  const day = getCourtDay(id, date, now);
  if (!day) return Response.json({ error: `Unknown court "${id}"` }, { status: 404 });
  return Response.json(day);
}
