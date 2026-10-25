"use client";

import { ExternalLink, MoonStar, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ScheduleEvent } from "@/lib/db/tables";
import { formatHour, formatMinutes } from "@/lib/format";
import { LABEL_META } from "@/lib/label-meta";
import type { CourtStatus } from "@/lib/queries/court-status";
import { cn } from "@/lib/utils";
import { BallBadge } from "./ball-icons";
import { CourtDayPanel } from "./court-day-panel";
import { StatusDot } from "./status-dot";
import { SPORTS, type ParkSummary, type Sport } from "./park-summary";

const RESERVE_URL = "https://anc.apm.activecommunities.com/wcscparksandrec/reservation/landing/quick?locale=en-US&groupId=";
const SPORT_TEXT: Record<Sport, string> = { tennis: "Tennis", pickleball: "Pickleball" };

interface ParkDetailProps {
  park: ParkSummary;
  date: string;
  hour: number;
  /** Events at this park during the hour. */
  events: ScheduleEvent[];
  selectedCourtId: string | null;
  onSelectCourt: (courtId: string) => void;
  /** The court whose full day is open beside the list, if any. */
  dayCourtId: string | null;
  onCloseDay: () => void;
  now: { date: string; hour: number; open: boolean };
  onPickHour: (hour: number) => void;
  onClose: () => void;
  className?: string;
}

/** How a sport can be booked at this park, mirroring ActiveNet's reservation groups. */
function booking(park: ParkSummary, sport: Sport): { groupId: number } | { note: string } {
  const courts = park.sports[sport]?.courts ?? [];
  if (sport === "tennis") {
    return courts.some((c) => c.reservable) ? { groupId: 20 } : { note: "Tennis here isn't reservable online." };
  }
  if (courts.some((c) => c.kind === "pickleball" && c.reservable)) return { groupId: 25 };
  if (courts.some((c) => c.kind === "tennis_pickleball")) return { note: "Pickleball here is on tennis courts with lines: reserve the tennis court." };
  return { note: "Pickleball here is first come, first served (not reservable online)." };
}

export function ParkDetail({
  park,
  date,
  hour,
  events,
  selectedCourtId,
  onSelectCourt,
  dayCourtId,
  onCloseDay,
  now,
  onPickHour,
  onClose,
  className,
}: ParkDetailProps) {
  const selectedRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedCourtId]);
  const sports = SPORTS.filter((sport) => park.sports[sport]);

  return (
    <section className={cn("glass-panel flex min-h-0", className)}>
      <div className={cn("flex min-h-0 w-full flex-col md:w-[23rem] md:shrink-0", dayCourtId && "max-md:hidden")}>
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

        <div className="panel-scroll flex min-h-0 flex-col">
          {events.length > 0 && (
            <ul className="mx-4 mb-2 flex flex-col gap-2">
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

          {sports.map((sport) => {
            const summary = park.sports[sport]!;
            const how = booking(park, sport);
            return (
              <section key={sport} className="px-3 pb-2">
                <header className="flex items-center gap-2 px-2 pt-2 pb-1.5">
                  <BallBadge sport={sport} count={summary.joinable} muted={summary.joinable === 0} size={24} />
                  <h3 className="flex-1 text-sm font-semibold">{SPORT_TEXT[sport]}</h3>
                  {"groupId" in how && (
                    <a
                      href={`${RESERVE_URL}${how.groupId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                      Reserve <ExternalLink className="size-3" />
                    </a>
                  )}
                </header>
                {"note" in how && <p className="px-2 pb-1.5 text-xs text-muted-foreground">{how.note}</p>}
                <ul className="flex flex-col gap-0.5">
                  {summary.courts.map((court) => (
                    <CourtRow
                      key={court.id}
                      ref={court.id === selectedCourtId ? selectedRef : undefined}
                      court={court}
                      sport={sport}
                      selected={court.id === selectedCourtId}
                      onSelect={() => onSelectCourt(court.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      {dayCourtId && (
        <CourtDayPanel
          className="w-full border-border/60 md:w-[21rem] md:border-l"
          courtId={dayCourtId}
          date={date}
          hour={hour}
          now={now}
          onPickHour={onPickHour}
          onClose={onCloseDay}
        />
      )}
    </section>
  );
}

function CourtRow({
  court,
  sport,
  selected,
  onSelect,
  ref,
}: {
  court: CourtStatus;
  sport: Sport;
  selected: boolean;
  onSelect: () => void;
  ref?: React.Ref<HTMLLIElement>;
}) {
  const meta = LABEL_META[court.label.kind];
  const details = [
    court.kind === "tennis_pickleball" && (sport === "tennis" ? "pickleball lines" : "tennis court with lines"),
    court.lighted === false && "no lights",
    !court.reservable && "not reservable online",
    !court.geometry && "not on the map",
  ].filter(Boolean);

  return (
    <li ref={ref} className={cn("flex items-center rounded-2xl transition", selected ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-white/70")}>
      <button type="button" onClick={onSelect} title="Show this court's day" className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <StatusDot className="size-3" color={meta.color} hollow={meta.hollow} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{court.name}</span>
          {details.length > 0 && <span className="block text-xs text-muted-foreground">{details.join(" · ")}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={meta.hollow ? { boxShadow: `inset 0 0 0 1.5px ${meta.color}`, color: meta.foreground } : { backgroundColor: meta.color, color: meta.foreground }}
            title={meta.hint}
          >
            {meta.text}
          </span>
          {court.dark && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MoonStar className="size-3" /> after sunset
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
