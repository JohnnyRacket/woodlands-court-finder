import type { CourtKind } from "@/lib/labels";
import { dateRange } from "@/lib/time";

// How far ahead residents can reserve, per ActiveNet facility group. Client-safe.
// ActiveNet: "Residents can make reservations … not more than N day(s) in advance";
// each new day opens at midnight.

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
