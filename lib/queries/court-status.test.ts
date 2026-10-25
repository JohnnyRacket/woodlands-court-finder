import { describe, expect, it } from "vitest";
import { seedSampleDb } from "@/lib/db/test-seed";
import { getCourtStatuses } from "./court-status";

const byId = (rows: ReturnType<typeof getCourtStatuses>) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("getCourtStatuses", () => {
  const db = seedSampleDb();

  it("stitches slots, events and courts into one label per court", () => {
    const at8 = byId(getCourtStatuses("2026-10-26", 8, db));
    expect(at8["pb-1"].label.kind).toBe("open_play");
    expect(at8["pb-walkup"].label.kind).toBe("open_play");
    expect(at8["tn-1"].label.kind).toBe("private"); // the pickleball drop-in doesn't touch tennis courts
    expect(at8["tn-2"].label.kind).toBe("no_reservation");
  });

  it("separates one private booking from a whole park booked for no known reason", () => {
    expect(byId(getCourtStatuses("2026-10-26", 12, db))["pb-1"].label.kind).toBe("private");
    expect(byId(getCourtStatuses("2026-10-26", 19, db))["pb-1"].label.kind).toBe("likely_event");
  });

  it("marks hours with no synced data instead of calling them free", () => {
    const at15 = byId(getCourtStatuses("2026-10-26", 15, db));
    expect(at15["pb-1"].label.kind).toBe("no_data");
    expect(at15["pb-walkup"].label.kind).toBe("first_come");
  });

  it("flags courts that aren't known to be lit after sunset (6:39 p.m. on Oct 26)", () => {
    const at18 = byId(getCourtStatuses("2026-10-26", 18, db));
    expect(at18["tn-2"].dark).toBe(false); // 6:00–7:00, mostly before sunset
    const at19 = byId(getCourtStatuses("2026-10-26", 19, db));
    expect([at19["tn-1"].dark, at19["tn-2"].dark, at19["pb-1"].dark]).toEqual([false, true, true]);
  });
});
