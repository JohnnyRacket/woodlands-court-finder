"use client";

import { Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExplorerData } from "@/lib/queries/explorer";
import { cn } from "@/lib/utils";
import { AssistantPanel } from "./assistant-panel";
import { ControlsPanel } from "./controls-panel";
import type { Selection } from "./court-map";
import { ParkDetail } from "./park-detail";
import { ParkList } from "./park-list";
import { filterCourts, summarizeParks, type Filters } from "./park-summary";
import { StatusBar } from "./status-bar";
import { WeatherPill } from "./weather-pill";

// The ArcGIS SDK needs the browser, so the map never renders on the server.
const CourtMap = dynamic(() => import("./court-map").then((m) => m.CourtMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#e9efe9]" />,
});

export function CourtExplorer() {
  const [time, setTime] = useState<{ date: string; hour: number } | null>(null);
  const [data, setData] = useState<ExplorerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ sports: ["tennis", "pickleball"], joinableOnly: false, litOnly: false });
  const [selection, setSelection] = useState<Selection>({ parkId: null, courtId: null });
  const selectedParkId = selection.parkId;
  const [dayCourtId, setDayCourtId] = useState<string | null>(null);
  const selectPark = (parkId: string | null) => {
    setSelection({ parkId, courtId: null });
    setDayCourtId(null);
  };
  // Selecting a court (on the map or in the panel) also opens its day.
  const select = (next: Selection) => {
    setSelection(next);
    setDayCourtId(next.courtId);
  };
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = time ? `?date=${time.date}&hour=${time.hour}` : "";
    fetch(`/api/courts${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((next: ExplorerData) => {
        setData(next);
        setError(null);
      })
      .catch((err: Error) => err.name !== "AbortError" && setError(err.message));
    return () => controller.abort();
  }, [time]);

  const courts = useMemo(() => (data ? filterCourts(data.courts, filters) : []), [data, filters]);
  const parks = useMemo(() => summarizeParks(courts, filters.sports), [courts, filters.sports]);
  const selectedPark = parks.find((park) => park.id === selectedParkId) ?? null;
  const loading = !data || (time !== null && (data.date !== time.date || data.hour !== time.hour));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <CourtMap
        parks={parks}
        courts={courts}
        selection={selection}
        onSelect={select}
        rightPanelWidth={selectedPark && !assistantOpen ? (dayCourtId ? 736 : 400) : assistantOpen ? 400 : 0}
      />

      {/* Left column: controls + park list (a bottom sheet on phones) */}
      <div className="absolute inset-x-3 bottom-7 flex max-h-[58dvh] flex-col gap-3 overflow-y-auto rounded-3xl [scrollbar-width:none] md:pointer-events-none md:inset-y-4 md:right-auto md:bottom-8 md:left-4 md:max-h-none md:w-[23rem] md:overflow-visible md:rounded-none">
        <ControlsPanel
          className="pointer-events-auto shrink-0"
          dates={data?.dates ?? []}
          hours={data?.hours ?? []}
          date={data?.date ?? null}
          hour={data?.hour ?? null}
          now={data?.now ?? null}
          filters={filters}
          onTimeChange={(date, hour) => setTime({ date, hour })}
          onFiltersChange={setFilters}
        />
        {data ? (
          <ParkList
            className={cn("pointer-events-auto shrink-0 transition-opacity md:min-h-40 md:flex-1 md:shrink", loading && "opacity-60", selectedPark && "max-md:hidden")}
            parks={parks}
            selectedParkId={selectedParkId}
            onSelectPark={selectPark}
          />
        ) : (
          <div className="glass-panel pointer-events-auto flex flex-1 flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl bg-muted" />
            ))}
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-2 max-md:top-3 max-md:right-3">
        {!assistantOpen && (
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgb(41_92_45_/_0.6)] transition hover:bg-primary/90"
          >
            <Sparkles className="size-4 text-brand-mint" /> Ask
          </button>
        )}
        {data && <WeatherPill weather={data.weather} sunset={data.sunset} />}
      </div>

      {assistantOpen && (
        <AssistantPanel
          className="absolute inset-x-3 bottom-7 z-10 h-[62dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-28 md:h-auto md:w-[23rem]"
          onClose={() => setAssistantOpen(false)}
        />
      )}

      {selectedPark && data && !assistantOpen && (
        <ParkDetail
          className="absolute inset-x-3 bottom-7 max-h-[58dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-28 md:max-h-none"
          park={selectedPark}
          date={data.date}
          hour={data.hour}
          events={data.events.filter((event) => event.parkId === selectedPark.id)}
          selectedCourtId={selection.courtId}
          onSelectCourt={(courtId) => select({ parkId: selectedPark.id, courtId })}
          dayCourtId={dayCourtId}
          onCloseDay={() => setDayCourtId(null)}
          now={data.now}
          onPickHour={(hour) => setTime({ date: data.date, hour })}
          onClose={() => selectPark(null)}
        />
      )}

      <StatusBar
        className="absolute bottom-8 left-[25.5rem] w-fit max-w-[calc(100%-31rem)] max-md:hidden"
        updatedAt={data?.reservationsUpdatedAt ?? null}
      />

      {error && (
        <p className="glass-panel absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-destructive">
          Couldn&apos;t load courts ({error}). Retrying when you change the time.
        </p>
      )}
    </main>
  );
}
