import { describe, expect, it } from "vitest";
import type { ScheduleEvent } from "@/lib/db/tables";
import { labelSlot, type LabelInput } from "./labels";

const event = (kind: ScheduleEvent["kind"], startMin: number, endMin: number, courtKind: ScheduleEvent["courtKind"] = "pickleball"): ScheduleEvent => ({
  id: `${kind}-${startMin}`,
  source: "test",
  kind,
  title: kind,
  parkId: "falconwing",
  courtKind,
  date: "2026-10-26",
  startMin,
  endMin,
  publicCanJoin: kind === "drop_in",
});

const dropIn = event("drop_in", 17 * 60 + 30, 20 * 60 + 30); // 5:30–8:30 p.m.
const program = event("program", 19 * 60, 20 * 60 + 30); // 7–8:30 p.m.
const tournament = event("tournament", 9 * 60, 13 * 60);
const tennisClinic = event("program", 18 * 60, 19 * 60, "tennis");

const base: LabelInput = { status: "booked", hour: 18, courtKind: "pickleball", events: [], parkFullyBooked: false };
const label = (input: Partial<LabelInput>) => labelSlot({ ...base, ...input }).kind;

describe("labelSlot", () => {
  it.each<[string, Partial<LabelInput>, string]>([
    ["free slot", { status: "free", events: [dropIn] }, "no_reservation"],
    ["booked during drop-in", { events: [dropIn] }, "open_play"],
    ["drop-in beats a program at the same time", { hour: 19, events: [program, dropIn] }, "open_play"],
    ["tournament beats a program", { hour: 10, events: [program, tournament, event("program", 9 * 60, 12 * 60)] }, "tournament"],
    ["program", { hour: 19, events: [program] }, "program"],
    ["5:00 slot only half covered by a 5:30 start counts", { hour: 17, events: [dropIn] }, "open_play"],
    ["8:00 slot half covered by an 8:30 end counts", { hour: 20, events: [dropIn] }, "open_play"],
    ["9:00 slot after an 8:30 end doesn't", { hour: 21, events: [dropIn] }, "private"],
    ["tennis program doesn't label a pickleball court", { events: [tennisClinic] }, "private"],
    ["tennis program labels a tennis court with pickleball lines", { courtKind: "tennis_pickleball", events: [tennisClinic] }, "program"],
    ["event with no court kind applies to any court", { courtKind: "tennis", events: [{ ...program, courtKind: null }], hour: 19 }, "program"],
    ["whole park booked, no known reason", { parkFullyBooked: true }, "likely_event"],
    ["one court booked, no known reason", {}, "private"],
    ["not reservable online, nothing scheduled", { status: null }, "first_come"],
    ["not reservable online, but a program is on", { status: null, hour: 19, events: [program] }, "program"],
    ["reservable but not synced", { status: "unknown" }, "no_data"],
    ["not synced, but drop-in is scheduled", { status: "unknown", events: [dropIn] }, "open_play"],
    ["reservable, but booking isn't open yet", { status: "not_open" }, "not_open"],
    ["booking not open, but drop-in is scheduled", { status: "not_open", events: [dropIn] }, "open_play"],
  ])("%s → %s", (_, input, expected) => {
    expect(label(input)).toBe(expected);
  });

  it("returns the event so the UI can show its title and link", () => {
    expect(labelSlot({ ...base, hour: 19, events: [program] })).toEqual({ kind: "program", publicCanJoin: false, event: program });
  });
});
