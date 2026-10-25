"use client";

import { ChevronRight } from "lucide-react";
import { LABEL_META } from "@/lib/label-meta";
import { cn } from "@/lib/utils";
import type { ParkSummary } from "./park-summary";

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
      <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto px-3 pb-3">
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
              <span
                className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: park.color }}
              >
                {park.joinable}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{park.name.replace(/ Park$/, "")}</span>
                  {park.openPlay && (
                    <span className="rounded-full bg-status-open-play/10 px-2 py-0.5 text-[11px] font-medium text-status-open-play">Open play</span>
                  )}
                </span>
                <span className="mt-1 flex flex-wrap gap-1" aria-hidden>
                  {park.courts.map((court) => (
                    <span
                      key={court.id}
                      className={cn("size-2 rounded-full", court.dark && "opacity-40")}
                      style={{ backgroundColor: LABEL_META[court.label.kind].color }}
                    />
                  ))}
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
