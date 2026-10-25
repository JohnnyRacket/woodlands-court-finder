import type { SlotLabel } from "@/lib/labels";

// How each label reads and looks. Client-safe: no server imports.

export const LABEL_META: Record<SlotLabel["kind"], { text: string; hint: string; color: string; className: string }> = {
  no_reservation: {
    text: "No reservation",
    hint: "Open to reserve; walk-ups may still be playing",
    color: "#2e9e5b",
    className: "bg-status-open",
  },
  first_come: {
    text: "First come",
    hint: "Not reservable online; first come, first served",
    color: "#7f9d81",
    className: "bg-status-first-come",
  },
  open_play: {
    text: "Open play",
    hint: "Drop-in play: bring a paddle and join the rotation",
    color: "#1d54a6",
    className: "bg-status-open-play",
  },
  program: {
    text: "Program",
    hint: "Lesson, league or clinic; registration required",
    color: "#d9971c",
    className: "bg-status-program",
  },
  tournament: {
    text: "Tournament",
    hint: "Township tournament",
    color: "#ce3f13",
    className: "bg-status-tournament",
  },
  likely_event: {
    text: "Likely event",
    hint: "Every court here is booked; probably a Township event (unconfirmed)",
    color: "#7c6f9b",
    className: "bg-status-event",
  },
  private: {
    text: "Reserved",
    hint: "Private reservation",
    color: "#64748b",
    className: "bg-status-private",
  },
  no_data: {
    text: "No data",
    hint: "Reservation data isn't available for this hour",
    color: "#b9c2bc",
    className: "bg-status-no-data",
  },
};

export const LEGEND_ORDER: SlotLabel["kind"][] = [
  "no_reservation",
  "open_play",
  "first_come",
  "program",
  "tournament",
  "likely_event",
  "private",
];
