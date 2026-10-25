import { describe, expect, it } from "vitest";
import { playingConditions, type ConditionInput } from "./conditions";

const dry = { inches: 0, forecast: false };
const fell = (inches: number) => ({ inches, forecast: false });
const calm: ConditionInput = { thunderPct: 0, gustMph: 8, heatIndexF: null, wbgtF: 70, rainLast2h: dry, rainLast6h: dry };
const kinds = (input: Partial<ConditionInput>) => playingConditions({ ...calm, ...input }).map((c) => [c.kind, c.level]);

describe("playingConditions", () => {
  it("says nothing on a calm, dry day", () => {
    expect(playingConditions(calm)).toEqual([]);
  });

  it("flags wet courts after a recent shower or a soaking earlier", () => {
    expect(playingConditions({ ...calm, rainLast2h: fell(0.05), rainLast6h: fell(0.05) })).toEqual([
      { kind: "wet", level: "caution", text: "Courts may be wet: about 0.05 in of rain in the last 2 h" },
    ]);
    expect(kinds({ rainLast6h: fell(0.4) })).toEqual([["wet", "warning"]]);
    expect(kinds({ rainLast2h: fell(0.01), rainLast6h: fell(0.1) })).toEqual([]);
    expect(playingConditions({ ...calm, rainLast2h: { inches: 0.3, forecast: true }, rainLast6h: { inches: 0.3, forecast: true } })[0].text).toBe(
      "Courts may be wet: 0.30 in of rain forecast in the 2 h before",
    );
  });

  it("separates possible from likely storms", () => {
    expect(kinds({ thunderPct: 29 })).toEqual([]);
    expect(kinds({ thunderPct: 30 })).toEqual([["storms", "caution"]]);
    expect(kinds({ thunderPct: 70 })).toEqual([["storms", "warning"]]);
  });

  it("uses WBGT for heat, falling back to the heat index", () => {
    expect(kinds({ wbgtF: 84, heatIndexF: 110 })).toEqual([["heat", "caution"]]);
    expect(kinds({ wbgtF: 91 })).toEqual([["heat", "warning"]]);
    expect(kinds({ wbgtF: null, heatIndexF: 105 })).toEqual([["heat", "caution"]]);
    expect(kinds({ wbgtF: 75, heatIndexF: 105 })).toEqual([]);
  });

  it("flags strong gusts", () => {
    expect(kinds({ gustMph: 24 })).toEqual([]);
    expect(kinds({ gustMph: 30 })).toEqual([["wind", "caution"]]);
  });
});
