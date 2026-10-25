import { describe, expect, it } from "vitest";
import { sunTimes } from "./sun";
import { chicagoDateHour } from "./time";

const localTime = (at: Date) => at.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

describe("sunTimes", () => {
  it("matches published times for The Woodlands", () => {
    // api.sunrise-sunset.org for 30.1658,-95.4613 on Oct 25, 2026: sunrise 7:30:55 AM, sunset 6:40:51 PM CDT (±2 min).
    const { sunrise, sunset } = sunTimes("2026-10-25");
    expect(chicagoDateHour(sunset)).toEqual({ date: "2026-10-25", hour: 18 });
    expect(localTime(sunrise)).toMatch(/^7:(29|3[0-2]) AM$/);
    expect(localTime(sunset)).toMatch(/^6:(39|4[0-2]) PM$/);
  });

  it("returns the right day across the DST change", () => {
    expect(chicagoDateHour(sunTimes("2026-11-02").sunset).date).toBe("2026-11-02");
    expect(chicagoDateHour(sunTimes("2026-06-21").sunset).date).toBe("2026-06-21");
  });
});
