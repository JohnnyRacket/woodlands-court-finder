// Playing conditions for one hour: wet courts, storms, heat, wind. Like labels.ts, every
// threshold lives here so the map, the day view and the assistant agree. Client-safe.
// Conditions are warnings beside a court's label; they never change it.

export type ConditionKind = "wet" | "storms" | "heat" | "wind";

export interface Condition {
  kind: ConditionKind;
  /** caution: worth knowing; warning: may stop play */
  level: "caution" | "warning";
  text: string;
}

export interface ConditionInput {
  thunderPct: number | null;
  gustMph: number | null;
  heatIndexF: number | null;
  /** Wet-bulb globe temperature, °F */
  wbgtF: number | null;
  /** Rain in the 2 and 6 hours before the hour starts; forecast = some of it hasn't fallen yet */
  rainLast2h: RainTotal;
  rainLast6h: RainTotal;
}

export interface RainTotal {
  inches: number;
  forecast: boolean;
}

// Hard courts dry within an hour or so after a shower; a soaking takes longer.
const WET_AFTER_2H_IN = 0.02;
const WET_AFTER_6H_IN = 0.25;
const STORMS_POSSIBLE_PCT = 30;
const STORMS_LIKELY_PCT = 60;
// WBGT bands used by sports heat policies (ACSM): 82 °F high risk, 90 °F stop play.
const WBGT_HIGH_F = 82;
const WBGT_EXTREME_F = 90;
/** Used only when there's no WBGT. */
const HEAT_INDEX_F = 103;
const GUSTY_MPH = 25;

const inches = (amount: number) => (amount < 1 ? amount.toFixed(2) : amount.toFixed(1));

export function playingConditions(input: ConditionInput): Condition[] {
  const conditions: Condition[] = [];
  const { rainLast2h, rainLast6h } = input;

  if (rainLast2h.inches >= WET_AFTER_2H_IN || rainLast6h.inches >= WET_AFTER_6H_IN) {
    const [rain, hours] = rainLast2h.inches >= WET_AFTER_2H_IN ? [rainLast2h, 2] : [rainLast6h, 6];
    conditions.push({
      kind: "wet",
      level: rain.inches >= WET_AFTER_6H_IN ? "warning" : "caution",
      text: rain.forecast
        ? `Courts may be wet: ${inches(rain.inches)} in of rain forecast in the ${hours} h before`
        : `Courts may be wet: about ${inches(rain.inches)} in of rain in the last ${hours} h`,
    });
  }

  if (input.thunderPct !== null && input.thunderPct >= STORMS_POSSIBLE_PCT) {
    const likely = input.thunderPct >= STORMS_LIKELY_PCT;
    conditions.push({ kind: "storms", level: likely ? "warning" : "caution", text: `Thunderstorms ${likely ? "likely" : "possible"} (${input.thunderPct}%)` });
  }

  if (input.wbgtF !== null && input.wbgtF >= WBGT_HIGH_F) {
    const extreme = input.wbgtF >= WBGT_EXTREME_F;
    conditions.push({ kind: "heat", level: extreme ? "warning" : "caution", text: `${extreme ? "Extreme" : "High"} heat stress (WBGT ${input.wbgtF}°F)` });
  } else if (input.wbgtF === null && input.heatIndexF !== null && input.heatIndexF >= HEAT_INDEX_F) {
    conditions.push({ kind: "heat", level: "caution", text: `Heat index ${input.heatIndexF}°F` });
  }

  if (input.gustMph !== null && input.gustMph >= GUSTY_MPH) {
    conditions.push({ kind: "wind", level: "caution", text: `Gusts to ${input.gustMph} mph` });
  }

  return conditions;
}
