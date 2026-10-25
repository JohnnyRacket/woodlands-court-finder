import { describe, expect, it } from "vitest";
import { seedSampleDb } from "@/lib/db/test-seed";
import { getActiveAlerts, getDayConditions, getParkEvents } from "./conditions";

describe("getDayConditions", () => {
  const day = getDayConditions("2026-10-26", seedSampleDb());

  it("flags wet courts from rain that has fallen, then clears", () => {
    expect(day.get(7)!.conditions.map((c) => c.text)).toEqual(["Courts may be wet: about 0.15 in of rain in the last 2 h"]);
    expect(day.get(8)!.conditions.map((c) => c.kind)).toEqual(["wet"]); // 6 a.m. is still within 2 h of 8
    expect(day.get(9)!.conditions).toEqual([]); // 0.15 in over 6 h isn't a soaking
  });

  it("carries the gridpoint details and storm warnings", () => {
    expect(day.get(8)).toMatchObject({ gustMph: 12, thunderPct: 0, wbgtF: 70 });
    expect(day.get(17)!.conditions).toEqual([{ kind: "storms", level: "caution", text: "Thunderstorms possible (45%)" }]);
    expect(day.get(20)).toEqual({ gustMph: null, thunderPct: null, heatIndexF: null, wbgtF: null, conditions: [] });
  });
});

describe("getActiveAlerts", () => {
  const db = seedSampleDb();

  it("returns court closures and current weather alerts, not other facilities", () => {
    expect(getActiveAlerts(new Date("2026-10-26T15:00:00Z"), db).map((a) => [a.source, a.title, a.level, a.parkIds])).toEqual([
      ["township", "Falconwing tennis courts closed", "warning", ["falconwing"]],
      ["nws", "Heat Advisory", "warning", []],
    ]);
  });

  it("drops weather alerts that have ended", () => {
    expect(getActiveAlerts(new Date("2026-10-27T02:00:00Z"), db).map((a) => a.source)).toEqual(["township"]);
  });
});

describe("getParkEvents", () => {
  it("lists Township events at court parks on the date", () => {
    const db = seedSampleDb();
    expect(getParkEvents("2026-10-26", db).map((e) => e.title)).toEqual(["Flashlight Candy Hunt"]);
    expect(getParkEvents("2026-10-27", db)).toEqual([]);
  });
});
