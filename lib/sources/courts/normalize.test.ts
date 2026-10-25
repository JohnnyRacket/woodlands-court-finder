import { describe, expect, it } from "vitest";
import { availabilitySchema } from "@/lib/activenet/client";
import { parseGis } from "./fetch";
import gisFixture from "./__fixtures__/gis-sports-courts.json";
import tennisFixture from "./__fixtures__/activenet-tennis.json";
import pickleballFixture from "./__fixtures__/activenet-pickleball.json";
import { parkKey } from "@/lib/park-key";
import { buildReference, parseActiveNetName, type ActiveNetCourt } from "./normalize";

const activenetCourts = (json: unknown, group: ActiveNetCourt["group"]): ActiveNetCourt[] =>
  availabilitySchema
    .parse((json as { body: unknown }).body)
    .availability.resources.map((r) => ({ id: r.resource_id, name: r.resource_name, group }));

const gis = parseGis(gisFixture);
const activenet = [...activenetCourts(tennisFixture, "tennis"), ...activenetCourts(pickleballFixture, "pickleball")];

describe("name parsing", () => {
  it.each([
    ["Alden Bridge Tennis 1", "aldenbridge", 1],
    ["Coppersage Tennis 2", "coppersage", 2],
    ["WendtwoodsTennis 3", "wendtwoods", 3],
    ["Timarron Tennis Court #1", "timarron", 1],
    ["Grogan's Point Tennis 2", "groganspoint", 2],
    ["Falconwing Pickleball 8", "falconwing", 8],
  ])("%s", (name, parkKey, number) => {
    expect(parseActiveNetName(name)).toEqual({ parkKey, number });
  });

  it("matches GIS park names to the same keys", () => {
    expect(parkKey("COPPER SAGE PARK")).toBe("coppersage");
    expect(parkKey("GROGAN'S POINT PARK")).toBe("groganspoint");
  });
});

describe("buildReference with real data", () => {
  const { parks, courts, notes } = buildReference(gis, activenet);

  it("keeps every ActiveNet court and every GIS court", () => {
    expect(activenet).toHaveLength(99);
    expect(courts.filter((c) => c.activenetId !== null)).toHaveLength(99);
    expect(courts).toHaveLength(99 + 5); // + Bear Branch's 5 non-reservable pickleball courts
    expect(new Set(courts.map((c) => c.id)).size).toBe(courts.length);
  });

  it("pairs all 80 reservable tennis courts with a GIS outline", () => {
    const tennis = courts.filter((c) => c.activenetId !== null && c.kind !== "pickleball");
    expect(tennis).toHaveLength(80);
    expect(tennis.every((c) => c.geometry !== null && c.gisId !== null)).toBe(true);
  });

  it("keeps dedicated pickleball courts without inventing geometry or lighting", () => {
    const falconwing = courts.find((c) => c.id === "falconwing-pickleball-8");
    expect(falconwing).toMatchObject({ kind: "pickleball", geometry: null, lighted: null, gisId: null, activenetId: 1036 });
  });

  it("builds readable ids and names", () => {
    expect(courts.find((c) => c.activenetId === 785)).toMatchObject({ id: "timarron-tennis-1", name: "Timarron Tennis 1" });
    expect(courts.find((c) => c.gisId === "TNS01-GPT")).toMatchObject({ parkId: "grogans-point", name: "Grogan's Point Tennis 1" });
    expect(parks.find((p) => p.id === "copper-sage")).toMatchObject({ name: "Copper Sage Park" });
  });

  it("gives every park a location in The Woodlands", () => {
    for (const park of parks) {
      expect(park.lat).toBeGreaterThan(30.1);
      expect(park.lat).toBeLessThan(30.3);
      expect(park.lng).toBeGreaterThan(-95.6);
      expect(park.lng).toBeLessThan(-95.4);
    }
  });

  it("reports the known data-quality findings", () => {
    expect(notes).toEqual([
      "2 courts share the GIS ID PKTN01-HRL: Harper's Landing Park #2 and Harper's Landing Park #1",
      expect.stringMatching(/^19 bookable courts are missing from the Township GIS map: Creekwood Pickleball 1, /),
      "5 courts on the GIS map can't be booked online: PKL01-BBR, PKL02-BBR, PKL03-BBR, PKL04-BBR, PKL05-BBR",
    ]);
  });
});

describe("buildReference edge cases", () => {
  const square = [[[-95.5, 30.2], [-95.5, 30.21], [-95.49, 30.21], [-95.5, 30.2]]];
  const gisCourt = { id: "TNS01-X", type: "Tennis", courtNumber: 1, parkName: "EXAMPLE PARK", lighted: true, polygon: square };

  it("skips and reports an ActiveNet court whose park isn't in GIS", () => {
    const result = buildReference([gisCourt], [{ id: 1, name: "Nowhere Tennis 1", group: "tennis" }]);
    expect(result.courts.map((c) => c.id)).toEqual(["example-tennis-1"]);
    expect(result.notes[0]).toBe(`A bookable court doesn't match any park on the GIS map: "Nowhere Tennis 1" (ActiveNet 1)`);
  });

  it("skips and reports a GIS court with an unknown type", () => {
    const result = buildReference([{ ...gisCourt, type: "Squash" }], []);
    expect(result.courts).toEqual([]);
    expect(result.notes[0]).toMatch(/type we don't recognize: "Squash"/);
  });
});
