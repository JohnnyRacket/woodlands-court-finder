import type { SlotLabel } from "@/lib/labels";

// How each label reads and looks. Client-safe: no server imports.
//
// At a glance there are only five colors (groups). The specific reason ("Program",
// "Tournament", "First come", …) is text, shown in the detail panel and day view.

export type StatusGroup = "open" | "open_play" | "program" | "reserved" | "no_data";

export const GROUP_META: Record<StatusGroup, { text: string; short?: string; hint: string; color: string; foreground: string; hollow?: boolean }> = {
  open: { text: "Open", hint: "No reservation: you can walk on (or book it)", color: "#2e9e5b", foreground: "#ffffff" },
  open_play: { text: "Open play", hint: "Drop-in play: anyone can join", color: "#1d54a6", foreground: "#ffffff" },
  program: { text: "Program / event", short: "Event", hint: "Lesson, league, clinic, tournament or Township event", color: "#e3b552", foreground: "#4a3305" },
  reserved: { text: "Reserved", hint: "Privately reserved", color: "#c9d0cb", foreground: "#3f4a43" },
  no_data: { text: "No data", hint: "Reservation data isn't available for this hour, or booking isn't open yet", color: "#9aa59e", foreground: "#56625a", hollow: true },
};

export const LEGEND: StatusGroup[] = ["open", "open_play", "program", "reserved", "no_data"];

const KINDS: Record<SlotLabel["kind"], { text: string; hint: string; group: StatusGroup }> = {
  no_reservation: { text: "No reservation", hint: "Open to reserve; walk-ups may still be playing", group: "open" },
  first_come: { text: "First come", hint: "Not reservable online; first come, first served", group: "open" },
  open_play: { text: "Open play", hint: "Drop-in play: bring a paddle and join the rotation", group: "open_play" },
  program: { text: "Program", hint: "Lesson, league or clinic; registration required", group: "program" },
  tournament: { text: "Tournament", hint: "Township tournament", group: "program" },
  likely_event: { text: "Likely event", hint: "Every court here is booked; probably a Township event (unconfirmed)", group: "program" },
  private: { text: "Reserved", hint: "Private reservation", group: "reserved" },
  not_open: { text: "Booking not open yet", hint: "Residents can't reserve this day yet; it opens at midnight", group: "no_data" },
  no_data: { text: "No data", hint: "Reservation data isn't available for this hour", group: "no_data" },
};

/** Per-label text, plus the colors of its group. */
export const LABEL_META = Object.fromEntries(
  Object.entries(KINDS).map(([kind, meta]) => [kind, { ...meta, ...GROUP_META[meta.group], text: meta.text, hint: meta.hint }]),
) as Record<SlotLabel["kind"], (typeof KINDS)[SlotLabel["kind"]] & Omit<(typeof GROUP_META)[StatusGroup], "text" | "hint">>;
