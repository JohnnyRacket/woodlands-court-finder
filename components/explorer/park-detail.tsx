"use client";

import { ExternalLink, MoonStar, X } from "lucide-react";
import type { ScheduleEvent } from "@/lib/db/tables";
import { formatHour, formatMinutes } from "@/lib/format";
import { LABEL_META } from "@/lib/label-meta";
import type { CourtStatus } from "@/lib/queries/court-status";
import { cn } from "@/lib/utils";
import type { ParkSummary } from "./park-summary";

const RESERVE_URL = "https://anc.apm.activecommunities.com/wcscparksandrec/reservation/landing/quick?locale=en-US&groupId=";
const KIND_TEXT: Record<CourtStatus["kind"], string> = {
  tennis: "Tennis",
  pickleball: "Pickleball",
  tennis_pickleball: "Tennis · pickleball lines",
};

interface ParkDetailProps {
  park: ParkSummary;
  hour: number;
  /** Events at this park during the hour. */
  events: ScheduleEvent[];
  onClose: () => void;
  className?: string;
}

export function ParkDetail({ park, hour, events, onClose, className }: ParkDetailProps) {
  const reservable = park.courts.filter((court) => court.reservable);

  return (
    <section className={cn("glass-panel flex min-h-0 flex-col", className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-primary">{park.name}</h2>
          <p className="text-sm text-muted-foreground">
            {park.joinable} of {park.courts.length} courts playable at {formatHour(hour)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent hover:text-primary"
        >
          <X className="size-4" />
        </button>
      </header>

      {events.length > 0 && (
        <ul className="mx-4 mb-2 flex max-h-56 shrink-0 flex-col gap-2 overflow-y-auto">
          {events.map((event) => (
            <li key={event.id} className="rounded-2xl bg-white/80 px-4 py-3 text-sm shadow-xs">
              <p className="font-medium">{event.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatMinutes(event.startMin)} – {formatMinutes(event.endMin)}
                {event.publicCanJoin ? " · open to everyone" : " · registration required"}
              </p>
              {event.url && (
                <a href={event.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-chart-5 hover:underline">
                  Details <ExternalLink className="size-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto px-3 pb-3">
        {park.courts.map((court) => {
          const meta = LABEL_META[court.label.kind];
          return (
            <li key={court.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/70">
              <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{court.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {KIND_TEXT[court.kind]}
                  {court.lighted === false && " · no lights"}
                  {!court.reservable && " · not reservable online"}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ backgroundColor: meta.color }} title={meta.hint}>
                  {meta.text}
                </span>
                {court.dark && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MoonStar className="size-3" /> after sunset
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {reservable.length > 0 && (
        <footer className="flex gap-2 border-t border-border/60 px-4 py-3">
          {(["tennis", "pickleball"] as const)
            .filter((sport) => reservable.some((court) => (sport === "pickleball" ? court.kind === "pickleball" : court.kind !== "pickleball")))
            .map((sport) => (
              <a
                key={sport}
                href={`${RESERVE_URL}${sport === "tennis" ? 20 : 25}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground capitalize shadow-sm transition hover:bg-primary/90"
              >
                Reserve {sport} <ExternalLink className="size-3.5" />
              </a>
            ))}
        </footer>
      )}
    </section>
  );
}
