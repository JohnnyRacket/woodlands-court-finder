import { describe, expect, it } from "vitest";
import { seedSampleDb } from "@/lib/db/test-seed";
import { getCourtStatuses } from "./court-status";

const byId = (rows: ReturnType<typeof getCourtStatuses>) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("getCourtStatuses", () => {
  const db = seedSampleDb();
  const now = new Date("2026-10-26T06:00:00-05:00"); // before the seeded day's courts open

  it("stitches slots, events and courts into one label per court", () => {
    const at8 = byId(getCourtStatuses("2026-10-26", 8, now, db));
    expect(at8["pb-1"].label.kind).toBe("open_play");
    expect(at8["pb-walkup"].label.kind).toBe("open_play");
    expect(at8["tn-1"].label.kind).toBe("private"); // the pickleball drop-in doesn't touch tennis courts
    expect(at8["tn-2"].label.kind).toBe("no_reservation");
  });

  it("separates one private booking from a whole park booked for no known reason", () => {
    expect(byId(getCourtStatuses("2026-10-26", 12, now, db))["pb-1"].label.kind).toBe("private");
    expect(byId(getCourtStatuses("2026-10-26", 19, now, db))["pb-1"].label.kind).toBe("likely_event");
  });

  it("marks hours with no synced data instead of calling them free", () => {
    const at15 = byId(getCourtStatuses("2026-10-26", 15, now, db));
    expect(at15["pb-1"].label.kind).toBe("no_data");
    expect(at15["pb-walkup"].label.kind).toBe("first_come");
  });

  it("marks pickleball not open yet two days out, while tennis has data", () => {
    const twoDaysOut = new Date("2026-10-24T12:00:00-05:00"); // the seeded date is the day after tomorrow
    const at8 = byId(getCourtStatuses("2026-10-26", 8, twoDaysOut, db));
    expect([at8["tn-1"].label.kind, at8["tn-2"].label.kind]).toEqual(["private", "no_reservation"]);
    expect(at8["pb-1"].label.kind).toBe("open_play"); // scheduled drop-in still shows
    const at12 = byId(getCourtStatuses("2026-10-26", 12, twoDaysOut, db));
    expect(at12["pb-1"].label.kind).toBe("not_open");
    expect(at12["pb-1"].bookingClosed).toBe(false);
    expect(at12["pb-walkup"].label.kind).toBe("first_come");
  });

  it("keeps the last known status once it's too late to book, and says booking has closed", () => {
    const at1130 = new Date("2026-10-26T11:30:00-05:00");
    const at12 = byId(getCourtStatuses("2026-10-26", 12, at1130, db));
    expect([at12["pb-1"].label.kind, at12["pb-2"].label.kind]).toEqual(["private", "no_reservation"]);
    expect([at12["pb-1"].bookingClosed, at12["pb-2"].bookingClosed, at12["pb-walkup"].bookingClosed]).toEqual([true, true, false]);
    expect(byId(getCourtStatuses("2026-10-26", 13, at1130, db))["pb-1"].bookingClosed).toBe(false);
  });

  it("flags courts that aren't known to be lit after sunset (6:39 p.m. on Oct 26)", () => {
    const at18 = byId(getCourtStatuses("2026-10-26", 18, now, db));
    expect(at18["tn-2"].dark).toBe(false); // 6:00–7:00, mostly before sunset
    const at19 = byId(getCourtStatuses("2026-10-26", 19, now, db));
    expect([at19["tn-1"].dark, at19["tn-2"].dark, at19["pb-1"].dark]).toEqual([false, true, true]);
  });
});
