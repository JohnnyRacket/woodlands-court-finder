import { describe, expect, it } from "vitest";
import { openDb } from "@/lib/db/client";
import { courts, parks, scheduleEvents } from "@/lib/db/tables";
import { slots } from "@/lib/sources/activenet-slots/table";
import { getCourtStatuses } from "./court-status";

function seed() {
  const db = openDb(":memory:");
  db.insert(parks).values({ id: "falconwing", name: "Falconwing Park", lat: 30.2, lng: -95.5 }).run();
  const court = (id: string, kind: "tennis" | "pickleball", activenetId: number | null, lighted: boolean | null) => ({
    id,
    parkId: "falconwing",
    name: id,
    kind,
    lighted,
    geometry: null,
    gisId: null,
    activenetId,
  });
  db.insert(courts)
    .values([
      court("pb-1", "pickleball", 1, null),
      court("pb-2", "pickleball", 2, null),
      court("tn-1", "tennis", 3, true),
      court("tn-2", "tennis", 4, false),
      court("pb-walkup", "pickleball", null, true),
    ])
    .run();
  const slot = (courtId: string, hour: number, status: "free" | "booked") => ({ courtId, date: "2026-10-26", hour, status, fetchedAt: "x" });
  db.insert(slots)
    .values([
      slot("pb-1", 8, "booked"),
      slot("pb-2", 8, "booked"),
      slot("tn-1", 8, "booked"),
      slot("tn-2", 8, "free"),
      slot("pb-1", 12, "booked"),
      slot("pb-2", 12, "free"),
      slot("pb-1", 19, "booked"),
      slot("pb-2", 19, "booked"),
    ])
    .run();
  db.insert(scheduleEvents)
    .values({
      id: "drop-in",
      source: "township-page",
      kind: "drop_in",
      title: "Pickleball drop-in play",
      parkId: "falconwing",
      courtKind: "pickleball",
      date: "2026-10-26",
      startMin: 480,
      endMin: 600,
      publicCanJoin: true,
    })
    .run();
  return db;
}

const byId = (rows: ReturnType<typeof getCourtStatuses>) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("getCourtStatuses", () => {
  const db = seed();

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
