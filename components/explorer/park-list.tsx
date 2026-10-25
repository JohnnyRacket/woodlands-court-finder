"use client";

import { ChevronRight } from "lucide-react";
import { LABEL_META } from "@/lib/label-meta";
import { cn } from "@/lib/utils";
import { SPORTS, type ParkSummary, type Sport } from "./park-summary";

const SPORT_LABEL: Record<Sport, string> = { tennis: "Tennis", pickleball: "Pickleball" };

interface ParkListProps {
  parks: ParkSummary[];
  selectedParkId: string | null;
  onSelectPark: (parkId: string) => void;
  className?: string;
}

export function ParkList({ parks, selectedParkId, onSelectPark, className }: ParkListProps) {
  const joinableParks = parks.filter((park) => park.joinable > 0).length;

  return (
    <section className={cn("glass-panel flex min-h-0 flex-col", className)}>
      <header className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold">Parks</h2>
        <p className="text-xs text-muted-foreground">
          {joinableParks} of {parks.length} with a court to play
        </p>
      </header>
      <ul className="flex min-h-0 flex-col gap-1.5 px-3 pb-3 md:overflow-y-auto">
        {parks.map((park) => (
          <li key={park.id}>
            <button
              type="button"
              onClick={() => onSelectPark(park.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                park.id === selectedParkId ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-white/80",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{park.name.replace(/ Park$/, "")}</span>
                  {park.openPlay && (
                    <span className="rounded-full bg-status-open-play/10 px-2 py-0.5 text-[11px] font-medium text-status-open-play">Open play</span>
                  )}
                </span>
                <span className="mt-1.5 flex flex-col gap-1">
                  {SPORTS.map((sport) => {
                    const summary = park.sports[sport];
                    if (!summary) return null;
                    return (
                      <span key={sport} className="flex items-center gap-2">
                        <span className="flex w-[6.25rem] shrink-0 items-baseline gap-1.5 text-xs">
                          <span className="text-muted-foreground">{SPORT_LABEL[sport]}</span>
                          <span className={cn("tabular-nums", summary.joinable ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {summary.joinable}/{summary.courts.length}
                          </span>
                        </span>
                        <span className="flex flex-1 flex-wrap gap-1" aria-label={`${sport}: ${summary.joinable} of ${summary.courts.length} playable`}>
                          {summary.courts.map((court) => (
                            <span
                              key={court.id}
                              title={`${court.name}: ${LABEL_META[court.label.kind].text}`}
                              className={cn("size-2 rounded-full", court.dark && "opacity-40")}
                              style={{ backgroundColor: LABEL_META[court.label.kind].color }}
                            />
                          ))}
                        </span>
                      </span>
                    );
                  })}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
        {parks.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No courts match these filters.</li>}
      </ul>
    </section>
  );
}
