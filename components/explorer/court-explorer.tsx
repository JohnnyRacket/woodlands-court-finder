"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExplorerData } from "@/lib/queries/explorer";
import { cn } from "@/lib/utils";
import { ControlsPanel } from "./controls-panel";
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
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);

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
  const parks = useMemo(() => summarizeParks(courts), [courts]);
  const selectedPark = parks.find((park) => park.id === selectedParkId) ?? null;
  const loading = !data || (time !== null && (data.date !== time.date || data.hour !== time.hour));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <CourtMap parks={parks} courts={courts} selectedParkId={selectedParkId} onSelectPark={setSelectedParkId} />

      {/* Left column: controls + park list (a bottom sheet on phones) */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex max-h-[58dvh] flex-col gap-3 md:inset-y-4 md:right-auto md:bottom-4 md:left-4 md:max-h-none md:w-[23rem]">
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
            className={cn("pointer-events-auto min-h-40 flex-1 transition-opacity", loading && "opacity-60", selectedPark && "max-md:hidden")}
            parks={parks}
            selectedParkId={selectedParkId}
            onSelectPark={setSelectedParkId}
          />
        ) : (
          <div className="glass-panel pointer-events-auto flex flex-1 flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl bg-muted" />
            ))}
          </div>
        )}
      </div>

      {data && (
        <WeatherPill
          className="absolute top-4 right-4 max-md:top-3 max-md:right-3"
          weather={data.weather}
          sunset={data.sunset}
        />
      )}

      {selectedPark && data && (
        <ParkDetail
          className="absolute inset-x-3 bottom-3 max-h-[58dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-28 md:max-h-none md:w-[23rem]"
          park={selectedPark}
          hour={data.hour}
          events={data.events.filter((event) => event.parkId === selectedPark.id)}
          onClose={() => setSelectedParkId(null)}
        />
      )}

      <StatusBar
        className="absolute right-20 bottom-4 left-[25.5rem] max-md:hidden"
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
