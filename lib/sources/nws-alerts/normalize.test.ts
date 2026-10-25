import { describe, expect, it } from "vitest";
import active from "./__fixtures__/alerts-active.json";
import none from "./__fixtures__/alerts-none.json";
import { toWeatherAlerts } from "./normalize";

describe("toWeatherAlerts with real NWS responses", () => {
  it("reads nothing when The Woodlands has no alerts", () => {
    expect(toWeatherAlerts(none)).toEqual([]);
  });

  it("keeps the hazard window, falling back to expiry when there's no end", () => {
    // Two real alerts from elsewhere in the country, same payload shape.
    const [advisory, warning] = toWeatherAlerts(active);
    expect(advisory).toMatchObject({ event: "Small Craft Advisory", severity: "Minor", startsAt: "2026-10-27T04:00:00.000Z", endsAt: "2026-10-27T14:00:00.000Z" });
    expect(warning.event).toBe("Flood Warning");
    expect(warning.endsAt).toBe(new Date(active.features[1].properties.expires).toISOString());
  });

  it("drops test messages", () => {
    const test = structuredClone(active);
    test.features[0].properties.status = "Test";
    expect(toWeatherAlerts(test).map((a) => a.event)).toEqual(["Flood Warning"]);
  });

  it("fails loudly on an unexpected payload", () => {
    expect(() => toWeatherAlerts({ features: [{ properties: { id: "x" } }] })).toThrow();
  });
});
