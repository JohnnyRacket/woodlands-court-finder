import { describe, expect, it } from "vitest";
import { distanceMiles, formatMiles } from "./geo";

describe("distanceMiles", () => {
  it("is zero for the same point", () => {
    expect(distanceMiles({ lat: 30.17, lng: -95.46 }, { lat: 30.17, lng: -95.46 })).toBe(0);
  });

  it("matches a known distance (The Woodlands to downtown Houston ≈ 28.6 mi)", () => {
    expect(distanceMiles({ lat: 30.1658, lng: -95.4613 }, { lat: 29.7604, lng: -95.3698 })).toBeCloseTo(28.6, 0);
  });
});

describe("formatMiles", () => {
  it.each([
    [0.34, "0.3 mi"],
    [2.06, "2.1 mi"],
    [12.6, "13 mi"],
  ])("%d → %s", (miles, text) => expect(formatMiles(miles)).toBe(text));
});
