import { describe, expect, it } from "vitest";
import { allBookingDates, bookingClosed, bookingDates, poolOf } from "./booking-window";

describe("booking window", () => {
  it("gives tennis three days and pickleball two", () => {
    expect(bookingDates("tennis", "2026-10-31")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(bookingDates("pickleball", "2026-10-31")).toEqual(["2026-10-31", "2026-11-01"]);
    expect(allBookingDates("2026-10-31")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("closes booking an hour before each slot starts", () => {
    const at219 = new Date("2026-10-25T14:19:00-05:00");
    expect([13, 14, 15, 16].map((hour) => bookingClosed("2026-10-25", hour, at219))).toEqual([true, true, true, false]);
    expect(bookingClosed("2026-10-25", 15, new Date("2026-10-25T14:00:00-05:00"))).toBe(false);
    expect(bookingClosed("2026-10-24", 22, at219)).toBe(true);
    expect(bookingClosed("2026-10-26", 7, at219)).toBe(false);
  });

  it("books tennis courts with pickleball lines as tennis", () => {
    expect([poolOf("tennis"), poolOf("tennis_pickleball"), poolOf("pickleball")]).toEqual(["tennis", "tennis", "pickleball"]);
  });
});
