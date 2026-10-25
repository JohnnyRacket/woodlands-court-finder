import { describe, expect, it } from "vitest";
import { isPastTime, parseView, viewSearch, type ExplorerView } from "./url-state";

// Sunday Oct 25, 2026, 2:30 p.m. in Chicago (CDT, UTC−5).
const now = new Date("2026-10-25T19:30:00Z");
const parse = (search: string) => parseView(new URLSearchParams(search), now);
const defaults: ExplorerView = {
  time: null,
  parkId: null,
  courtId: null,
  filters: { sports: ["tennis", "pickleball"], joinableOnly: false, litOnly: false },
};

describe("parseView", () => {
  it("reads every parameter", () => {
    expect(parse("?date=2026-10-26&hour=19&park=falconwing&court=fw-1&sport=tennis&open=1&lit=1")).toEqual({
      time: { date: "2026-10-26", hour: 19 },
      parkId: "falconwing",
      courtId: "fw-1",
      filters: { sports: ["tennis"], joinableOnly: true, litOnly: true },
    });
  });

  it("defaults to following now with every sport", () => {
    expect(parse("")).toEqual(defaults);
  });

  it("follows now for past, out-of-window or malformed times", () => {
    expect(parse("?date=2026-10-25&hour=13").time).toBeNull(); // earlier today
    expect(parse("?date=2026-10-24&hour=19").time).toBeNull(); // yesterday
    expect(parse("?date=2026-10-30&hour=19").time).toBeNull(); // beyond the booking window
    expect(parse("?date=2026-10-26&hour=23").time).toBeNull(); // courts closed
    expect(parse("?date=2026-10-26&hour=7.5").time).toBeNull();
    expect(parse("?date=2026-10-26").time).toBeNull();
    expect(parse("?date=2026-10-25&hour=14").time).toEqual({ date: "2026-10-25", hour: 14 }); // the current hour
  });

  it("ignores a court without a park, and unknown sports", () => {
    expect(parse("?court=fw-1").courtId).toBeNull();
    expect(parse("?sport=squash").filters.sports).toEqual(["tennis", "pickleball"]);
  });
});

describe("viewSearch", () => {
  it("writes nothing for the default view", () => {
    expect(viewSearch(defaults)).toBe("");
  });

  it("round-trips through parseView", () => {
    const search = "?date=2026-10-26&hour=19&park=falconwing&court=fw-1&sport=pickleball&open=1&lit=1";
    expect(viewSearch(parse(search))).toBe(search);
  });
});

describe("isPastTime", () => {
  it("compares against the current play hour", () => {
    expect(isPastTime({ date: "2026-10-25", hour: 13 }, now)).toBe(true);
    expect(isPastTime({ date: "2026-10-25", hour: 14 }, now)).toBe(false);
    // After the last court hour, the play hour is tomorrow at 7 a.m.
    expect(isPastTime({ date: "2026-10-25", hour: 22 }, new Date("2026-10-26T04:30:00Z"))).toBe(true);
  });
});
