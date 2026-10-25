import { describe, expect, it } from "vitest";
import type { CourtInfo, HourStatus } from "@/lib/queries/court-status";
import { withHourStatus } from "./park-summary";

const court = (id: string): CourtInfo => ({
  id,
  name: id,
  kind: "tennis",
  parkId: "park",
  parkName: "Park",
  lighted: true,
  geometry: null,
  parkLat: 30.2,
  parkLng: -95.5,
  reservable: true,
});
const status = (id: string): HourStatus => ({ id, label: { kind: "no_reservation", publicCanJoin: true }, bookingClosed: false, dark: false });

describe("withHourStatus", () => {
  it("joins each hour's label onto its court, in the hour's order", () => {
    const catalog = new Map([court("a"), court("b")].map((c) => [c.id, c]));
    const joined = withHourStatus(catalog, [status("b"), status("a")]);
    expect(joined.map((c) => c.id)).toEqual(["b", "a"]);
    expect(joined[0]).toEqual({ ...court("b"), ...status("b") });
  });

  it("leaves out courts missing from either side", () => {
    expect(withHourStatus(new Map([["a", court("a")]]), [status("a"), status("new")]).map((c) => c.id)).toEqual(["a"]);
  });
});
