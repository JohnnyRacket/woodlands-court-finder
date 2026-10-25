import { describe, expect, it } from "vitest";
import { sources } from "@/lib/sources";
import { describeSchedule, previousRun } from "./cron-text";

describe("describeSchedule", () => {
  it.each([
    ["*/15 7-22 * * *", "Every 15 minutes, 7 AM–11 PM"],
    ["0 8-20/3 * * *", "Every 3 hours, 8 AM–8 PM"],
    ["5 * * * *", "Every hour"],
    ["5 */6 * * *", "Every 6 hours"],
    ["0 4 * * *", "Daily at 4 AM"],
    ["15 6 * * *", "Daily at 6:15 AM"],
    ["30 5 * * 1", "Weekly on Mondays at 5:30 AM"],
  ])("%s → %s", (cron, text) => expect(describeSchedule(cron)).toBe(text));

  it("describes every registered schedule without falling back to raw cron", () => {
    for (const source of sources) {
      for (const cron of Object.values(source.schedule)) expect(describeSchedule(cron)).not.toBe(cron);
    }
  });

  it("returns unsupported expressions unchanged", () => {
    expect(describeSchedule("0 0 1 * *")).toBe("0 0 1 * *");
  });
});

describe("previousRun", () => {
  it("finds the last 15-minute tick inside the window", () => {
    // 2026-10-25 2:07 p.m. CDT
    expect(previousRun("*/15 7-22 * * *", new Date("2026-10-25T19:07:30Z"))).toEqual(new Date("2026-10-25T19:00:00Z"));
  });

  it("looks back overnight to the last run of the window", () => {
    // 3:10 a.m. CDT → last run was 10:45 p.m. the night before
    expect(previousRun("*/15 7-22 * * *", new Date("2026-10-25T08:10:00Z"))).toEqual(new Date("2026-10-25T03:45:00Z"));
  });

  it("handles weekly schedules", () => {
    // Sunday 2026-10-25 → the previous Monday 5:30 a.m. CDT
    expect(previousRun("30 5 * * 1", new Date("2026-10-25T19:00:00Z"))).toEqual(new Date("2026-10-19T10:30:00Z"));
  });
});
