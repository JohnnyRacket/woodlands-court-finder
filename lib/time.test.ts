import { describe, expect, it } from "vitest";
import { addDays, chicagoDate } from "./time";

describe("chicagoDate", () => {
  it("uses the Chicago calendar day, not UTC", () => {
    expect(chicagoDate(new Date("2026-10-25T03:30:00Z"))).toBe("2026-10-24"); // 10:30 p.m. CDT
    expect(chicagoDate(new Date("2026-10-25T05:30:00Z"))).toBe("2026-10-25");
  });

  it("handles the DST change", () => {
    expect(chicagoDate(new Date("2026-11-01T05:30:00Z"))).toBe("2026-11-01"); // 12:30 a.m. CDT
    expect(chicagoDate(new Date("2026-11-02T05:30:00Z"))).toBe("2026-11-01"); // 11:30 p.m. CST
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
