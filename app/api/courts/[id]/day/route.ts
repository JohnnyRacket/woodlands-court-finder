import type { NextRequest } from "next/server";
import { z } from "zod";
import { getCourtDay } from "@/lib/queries/court-day";
import { addDays, chicagoDate } from "@/lib/time";

// GET /api/courts/:id/day?date=YYYY-MM-DD (today or tomorrow; defaults to today)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/courts/[id]/day">) {
  const { id } = await params;
  const today = chicagoDate(new Date());
  const date = z
    .enum([today, addDays(today, 1)])
    .catch(today)
    .parse(request.nextUrl.searchParams.get("date"));

  const day = getCourtDay(id, date);
  if (!day) return Response.json({ error: `Unknown court "${id}"` }, { status: 404 });
  return Response.json(day);
}
