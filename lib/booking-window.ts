import type { CourtKind } from "@/lib/labels";
import { chicagoDate, chicagoMinuteOfDay, dateRange } from "@/lib/time";

// How far ahead residents can reserve, per ActiveNet facility group. Client-safe.
// ActiveNet: "Residents can make reservations at least 1 hour(s) in advance but not more
// than N day(s) in advance"; each new day opens at midnight.

/** Residents must book at least this long before an hour starts, in every pool. */
export const BOOKING_LEAD_MINUTES = 60;

/**
 * Booking has closed for this hour: it has started, or starts within the lead time.
 * ActiveNet then reports it taken on every court, reserved or not.
 */
export function bookingClosed(date: string, hour: number, now: Date): boolean {
  const today = chicagoDate(now);
  if (date !== today) return date < today;
  return hour * 60 < chicagoMinuteOfDay(now) + BOOKING_LEAD_MINUTES;
}

export type Pool = "tennis" | "pickleball";

/** Days beyond today that residents can book. */
export const BOOKING_WINDOW_DAYS: Record<Pool, number> = { tennis: 2, pickleball: 1 };

/** Tennis courts with pickleball lines are booked as tennis courts. */
export const poolOf = (kind: CourtKind): Pool => (kind === "pickleball" ? "pickleball" : "tennis");

/** Dates with reservation data for a pool: today through the last bookable day. */
export function bookingDates(pool: Pool, today: string): string[] {
  return dateRange(today, BOOKING_WINDOW_DAYS[pool] + 1);
}

/** Every date any pool can be booked: the longest window. */
export function allBookingDates(today: string): string[] {
  return dateRange(today, Math.max(...Object.values(BOOKING_WINDOW_DAYS)) + 1);
}
