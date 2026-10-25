import { describe, expect, it } from "vitest";
import { availabilitySchema, type Availability } from "@/lib/activenet/client";
import fixture from "./__fixtures__/availability-pickleball.json";
import { diffSlots, keepLastOpenStatus, toSlotRows } from "./normalize";

const availability = availabilitySchema.parse(fixture.body).availability;
const fetchedAt = "2026-10-25T03:24:00.000Z";

// Falconwing Pickleball 1–8 are ActiveNet resources 1029–1036.
const falconwing = new Map(Array.from({ length: 8 }, (_, i) => [1029 + i, `falconwing-pickleball-${i + 1}`]));

describe("toSlotRows with a real availability response", () => {
  const { rows, unknownCourts } = toSlotRows(availability, "2026-10-25", falconwing, fetchedAt);

  it("emits one row per court per hour, 7:00–22:00", () => {
    expect(rows).toHaveLength(8 * 16);
    expect(new Set(rows.map((r) => r.hour))).toEqual(new Set(Array.from({ length: 16 }, (_, i) => 7 + i)));
  });

  it("maps status 0 to free and anything else to booked", () => {
    const court1 = rows.filter((r) => r.courtId === "falconwing-pickleball-1");
    expect(court1.filter((r) => r.status === "booked").map((r) => r.hour)).toEqual([10, 17, 18]);
    expect(court1.find((r) => r.hour === 7)).toEqual({
      courtId: "falconwing-pickleball-1",
      date: "2026-10-25",
      hour: 7,
      status: "free",
      fetchedAt,
    });
  });

  it("reports courts it doesn't know instead of dropping them silently", () => {
    expect(unknownCourts).toHaveLength(11); // Creekwood (5) + Windvale (6)
    expect(unknownCourts[0]).toBe("Creekwood Pickleball 1 (1089)");
  });
});

describe("toSlotRows fails loudly on shape changes", () => {
  const one = (overrides: Partial<Availability>): Availability => ({
    time_slots: ["07:00:00", "08:00:00"],
    resources: [{ resource_id: 1, resource_name: "Test 1", time_slot_details: [{ status: 0 }, { status: 1 }] }],
    ...overrides,
  });
  const courtsMap = new Map([[1, "test-tennis-1"]]);

  it("rejects non-hourly slots", () => {
    expect(() => toSlotRows(one({ time_slots: ["07:00:00", "07:30:00"] }), "2026-10-25", courtsMap, fetchedAt)).toThrow(
      /Unexpected ActiveNet time slot "07:30:00"/,
    );
  });

  it("rejects a slot count that doesn't match the hours", () => {
    expect(() => toSlotRows(one({ time_slots: ["07:00:00"] }), "2026-10-25", courtsMap, fetchedAt)).toThrow(/2 slots for 1 hours/);
  });
});

describe("keepLastOpenStatus", () => {
  const row = (hour: number, status: "free" | "booked", fetchedAt: string) => ({ courtId: "c1", date: "2026-10-25", hour, status, fetchedAt });

  it("keeps what was seen before booking closed instead of ActiveNet's 'taken'", () => {
    const previous = [row(13, "booked", "t1"), row(14, "free", "t1"), row(16, "free", "t1")];
    const fetched = [row(13, "booked", "t2"), row(14, "booked", "t2"), row(15, "booked", "t2"), row(16, "booked", "t2")];
    const readWhileOpen = (r: { hour: number; fetchedAt: string }) => r.fetchedAt === "t1" || r.hour >= 16;
    // 13 and 14 keep the earlier reading, 15 was never seen open so it's dropped, 16 is still bookable.
    expect(keepLastOpenStatus(fetched, previous, readWhileOpen)).toEqual([row(13, "booked", "t1"), row(14, "free", "t1"), row(16, "booked", "t2")]);
    expect(diffSlots(previous, keepLastOpenStatus(fetched, previous, readWhileOpen)).map((c) => c.hour)).toEqual([16]);
  });

  it("drops stored rows that were themselves read after booking closed", () => {
    // 15 was stored "booked" by a sync at the cutoff; it's discarded rather than carried forward.
    const previous = [row(14, "free", "t1"), row(15, "booked", "late")];
    const fetched = [row(14, "booked", "t2"), row(15, "booked", "t2")];
    const readWhileOpen = (r: { fetchedAt: string }) => r.fetchedAt === "t1";
    expect(keepLastOpenStatus(fetched, previous, readWhileOpen)).toEqual([row(14, "free", "t1")]);
    expect(diffSlots(previous, keepLastOpenStatus(fetched, previous, readWhileOpen))).toEqual([]);
  });
});

describe("diffSlots", () => {
  const row = (hour: number, status: "free" | "booked", fetchedAt = "t2") => ({ courtId: "c1", date: "2026-10-25", hour, status, fetchedAt });

  it("logs bookings, cancellations and first sightings, and nothing unchanged", () => {
    const previous = [row(8, "free"), row(9, "booked"), row(10, "free")];
    expect(diffSlots(previous, [row(8, "booked"), row(9, "free"), row(10, "free"), row(11, "free")])).toEqual([
      { courtId: "c1", date: "2026-10-25", hour: 8, status: "booked", previousStatus: "free", observedAt: "t2" },
      { courtId: "c1", date: "2026-10-25", hour: 9, status: "free", previousStatus: "booked", observedAt: "t2" },
      { courtId: "c1", date: "2026-10-25", hour: 11, status: "free", previousStatus: null, observedAt: "t2" },
    ]);
  });
});
