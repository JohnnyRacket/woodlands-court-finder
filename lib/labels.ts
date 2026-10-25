import type { ScheduleEvent } from "@/lib/db/tables";

// What a court-hour means for someone who wants to play. Every rule lives here,
// so the map, the court page and the AI assistant can never disagree.

export type CourtKind = "tennis" | "pickleball" | "tennis_pickleball";

export type SlotLabel =
  | { kind: "no_reservation"; publicCanJoin: true }
  | { kind: "first_come"; publicCanJoin: true }
  | { kind: "open_play"; publicCanJoin: true; event: ScheduleEvent }
  | { kind: "tournament"; publicCanJoin: false; event: ScheduleEvent }
  | { kind: "program"; publicCanJoin: false; event: ScheduleEvent }
  | { kind: "likely_event"; publicCanJoin: false }
  | { kind: "private"; publicCanJoin: false }
  | { kind: "no_data"; publicCanJoin: false };

export interface LabelInput {
  /**
   * ActiveNet status for this court-hour. null = the court isn't reservable online;
   * "unknown" = it is, but there's no data for this hour (not synced yet, or too far ahead).
   */
  status: "free" | "booked" | "unknown" | null;
  hour: number;
  courtKind: CourtKind;
  /** Events at this court's park on this date. */
  events: ScheduleEvent[];
  /** Every reservable court of the same kind at the park is booked this hour. */
  parkFullyBooked: boolean;
}

/** An hourly slot counts as covered when an event fills at least half of it. */
const MIN_OVERLAP = 30;

export function covers(event: ScheduleEvent, hour: number): boolean {
  const start = Math.max(event.startMin, hour * 60);
  const end = Math.min(event.endMin, hour * 60 + 60);
  return end - start >= MIN_OVERLAP;
}

function usesCourt(event: ScheduleEvent, courtKind: CourtKind): boolean {
  return event.courtKind == null || courtKind === event.courtKind || courtKind === "tennis_pickleball";
}

export function labelSlot({ status, hour, courtKind, events, parkFullyBooked }: LabelInput): SlotLabel {
  if (status === "free") return { kind: "no_reservation", publicCanJoin: true };

  const active = events.filter((event) => usesCourt(event, courtKind) && covers(event, hour));
  const find = (kind: ScheduleEvent["kind"]) => active.find((event) => event.kind === kind);

  const dropIn = find("drop_in");
  if (dropIn) return { kind: "open_play", publicCanJoin: true, event: dropIn };
  const tournament = find("tournament");
  if (tournament) return { kind: "tournament", publicCanJoin: false, event: tournament };
  const program = find("program");
  if (program) return { kind: "program", publicCanJoin: false, event: program };

  if (status === null) return { kind: "first_come", publicCanJoin: true };
  if (status === "unknown") return { kind: "no_data", publicCanJoin: false };
  if (parkFullyBooked) return { kind: "likely_event", publicCanJoin: false };
  return { kind: "private", publicCanJoin: false };
}
