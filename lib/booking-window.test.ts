import { describe, expect, it } from "vitest";
import { allBookingDates, bookingDates, poolOf } from "./booking-window";

describe("booking window", () => {
  it("gives tennis three days and pickleball two", () => {
    expect(bookingDates("tennis", "2026-10-31")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(bookingDates("pickleball", "2026-10-31")).toEqual(["2026-10-31", "2026-11-01"]);
    expect(allBookingDates("2026-10-31")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("books tennis courts with pickleball lines as tennis", () => {
    expect([poolOf("tennis"), poolOf("tennis_pickleball"), poolOf("pickleball")]).toEqual(["tennis", "tennis", "pickleball"]);
  });
});
