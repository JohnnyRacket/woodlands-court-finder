import { describe, expect, it } from "vitest";
import { parseFinding, sourceState } from "./status";

describe("parseFinding", () => {
  it("turns an enumerated note into a headline and a list", () => {
    expect(parseFinding("5 GIS court(s) aren't reservable in ActiveNet: PKL01-BBR, PKL02-BBR, PKL03-BBR")).toEqual({
      headline: "5 GIS court(s) aren't reservable in ActiveNet",
      items: ["PKL01-BBR", "PKL02-BBR", "PKL03-BBR"],
      detail: null,
    });
  });

  it("keeps quoted detail as text", () => {
    expect(parseFinding(`Program title doesn't match its schedule: "Drop In - Saturdays" (74372): title names Sat`)).toEqual({
      headline: "Program title doesn't match its schedule",
      items: [],
      detail: `"Drop In - Saturdays" (74372): title names Sat`,
    });
  });

  it("leaves a plain sentence as the headline", () => {
    expect(parseFinding("GIS ID PKTN01-HRL is used by 2 courts (A, B)")).toEqual({ headline: "GIS ID PKTN01-HRL is used by 2 courts (A, B)", items: [], detail: null });
  });
});

describe("sourceState", () => {
  const cron = "*/15 7-22 * * *";
  const now = new Date("2026-10-25T19:07:00Z"); // 2:07 p.m. CDT; last due run 2:00 p.m.

  it("is up to date when the last success is recent enough", () => {
    expect(sourceState({ ok: true }, "2026-10-25T18:50:00Z", cron, true, now)).toBe("up_to_date");
  });

  it("is delayed when the last success is well before the last scheduled run", () => {
    expect(sourceState({ ok: true }, "2026-10-25T15:00:00Z", cron, true, now)).toBe("delayed");
  });

  it("isn't delayed overnight just because the schedule pauses", () => {
    const night = new Date("2026-10-25T08:10:00Z"); // 3:10 a.m.; last due 10:45 p.m.
    expect(sourceState({ ok: true }, "2026-10-25T03:46:00Z", cron, true, night)).toBe("up_to_date");
  });

  it("uses the latest run across several schedules", () => {
    const night = new Date("2026-10-25T08:10:00Z"); // 3:10 a.m.; last due 12:01 a.m.
    const crons = [cron, "1 0 * * *"];
    expect(sourceState({ ok: true }, "2026-10-25T03:46:00Z", crons, true, night)).toBe("delayed");
    expect(sourceState({ ok: true }, "2026-10-25T05:02:00Z", crons, true, night)).toBe("up_to_date");
  });

  it("reports failures, missing data, and a paused scheduler", () => {
    expect(sourceState({ ok: false }, "2026-10-25T18:50:00Z", cron, true, now)).toBe("failed");
    expect(sourceState(null, null, cron, true, now)).toBe("never");
    expect(sourceState({ ok: true }, "2026-10-20T00:00:00Z", cron, false, now)).toBe("paused");
  });
});
