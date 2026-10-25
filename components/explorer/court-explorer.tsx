"use client";

import { ChevronUp, LoaderCircle, LocateFixed, Sparkles, Trees } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingDates } from "@/lib/booking-window";
import { assistantEnabled } from "@/lib/flags";
import { formatDay, formatHour } from "@/lib/format";
import { distanceMiles, type LatLng } from "@/lib/geo";
import type { ExplorerData } from "@/lib/queries/explorer";
import { usePresence } from "@/lib/use-presence";
import { cn } from "@/lib/utils";
import { AlertsBanner } from "./alerts-banner";
import { AssistantPanel } from "./assistant-panel";
import { ConditionChips } from "./conditions";
import { ControlsPanel } from "./controls-panel";
import type { Selection } from "./court-map";
import { ParkDetail } from "./park-detail";
import { ParkList } from "./park-list";
import { filterCourts, SPORTS, summarizeParks, type Filters } from "./park-summary";
import { StatusBar } from "./status-bar";
import { WeatherPill } from "./weather-pill";

// The ArcGIS SDK needs the browser, so the map never renders on the server.
const CourtMap = dynamic(() => import("./court-map").then((m) => m.CourtMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#e9efe9]" />,
});

// Side panels ease in from the right (from below on phones) and back out the same way.
const PANEL_IN = "animate-in fade-in duration-200 ease-out max-md:slide-in-from-bottom-4 md:slide-in-from-right-4";
const PANEL_OUT = "pointer-events-none animate-out fade-out duration-200 ease-in fill-mode-forwards max-md:slide-out-to-bottom-4 md:slide-out-to-right-4";

function dayLabel(dates: string[], date: string) {
  const i = dates.indexOf(date);
  return i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(date).split(", ")[0];
}

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
  const [sheetCollapsed, setSheetCollapsed] = useState(false);

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

  // Sports residents can book on the shown date (pickleball opens a day later than tennis).
  // The user's choice is kept, so pickleball comes back on dates it's bookable.
  const bookableSports = useMemo(() => (data ? SPORTS.filter((sport) => bookingDates(sport, data.now.date).includes(data.date)) : SPORTS), [data]);
  const shownFilters = useMemo(() => {
    const sports = filters.sports.filter((sport) => bookableSports.includes(sport));
    return { ...filters, sports: sports.length ? sports : bookableSports };
  }, [filters, bookableSports]);

  const courts = useMemo(() => (data ? filterCourts(data.courts, shownFilters) : []), [data, shownFilters]);
  // Sort by distance only after the user asks: location is requested on that click, never on load.
  const [nearest, setNearest] = useState<{ on: boolean; location: LatLng | null; locating: boolean; error: string | null }>({
    on: false,
    location: null,
    locating: false,
    error: null,
  });
  const toggleNearest = () => {
    if (nearest.on) return setNearest({ ...nearest, on: false });
    if (nearest.location) return setNearest({ ...nearest, on: true, error: null });
    if (!("geolocation" in navigator)) return setNearest({ ...nearest, error: "Location isn't available in this browser." });
    setNearest({ ...nearest, locating: true, error: null });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setNearest({ on: true, location: { lat: coords.latitude, lng: coords.longitude }, locating: false, error: null }),
      (err) =>
        setNearest((prev) => ({
          ...prev,
          locating: false,
          error: err.code === err.PERMISSION_DENIED ? "Location access was declined." : "Couldn't get your location.",
        })),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  const summarized = useMemo(() => summarizeParks(courts, shownFilters.sports), [courts, shownFilters.sports]);
  const distances = useMemo(
    () => (nearest.location ? new Map(summarized.map((park) => [park.id, distanceMiles(nearest.location!, park)])) : null),
    [summarized, nearest.location],
  );
  const parks = useMemo(
    () => (nearest.on && distances ? [...summarized].sort((a, b) => distances.get(a.id)! - distances.get(b.id)!) : summarized),
    [summarized, nearest.on, distances],
  );
  const selectedPark = parks.find((park) => park.id === selectedParkId) ?? null;
  const loading = !data || (time !== null && (data.date !== time.date || data.hour !== time.hour));

  // Panels stay mounted briefly after closing, showing what they last showed, so they can animate out.
  const assistant = usePresence(assistantOpen || null);
  const detailOpen = selectedPark !== null && data !== null && !assistantOpen;
  const detail = usePresence(
    useMemo(
      () => (detailOpen ? { park: selectedPark, courtId: selection.courtId, dayCourtId } : null),
      [detailOpen, selectedPark, selection.courtId, dayCourtId],
    ),
  );

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <CourtMap
        parks={parks}
        courts={courts}
        selection={selection}
        onSelect={select}
        rightPanelWidth={selectedPark && !assistantOpen ? (dayCourtId ? 736 : 400) : assistantOpen ? 400 : 0}
        userLocation={nearest.on ? nearest.location : null}
      />

      {/* Left column: controls + park list (a bottom sheet on phones) */}
      <div
        className={cn(
          "absolute inset-x-3 bottom-7 flex max-h-[58dvh] flex-col gap-3 overflow-y-auto rounded-3xl transition-[opacity,visibility] duration-200 [scrollbar-width:none] md:pointer-events-none md:inset-y-4 md:right-auto md:bottom-8 md:left-4 md:max-h-none md:w-[23rem] md:overflow-visible md:rounded-none",
          // On phones the park or assistant sheet takes this spot, so the controls get out of the way.
          (detailOpen || assistantOpen || sheetCollapsed) && "max-md:invisible max-md:opacity-0",
        )}
      >
        <ControlsPanel
          className="pointer-events-auto shrink-0"
          dates={data?.dates ?? []}
          hours={data?.hours ?? []}
          date={data?.date ?? null}
          hour={data?.hour ?? null}
          now={data?.now ?? null}
          filters={shownFilters}
          bookableSports={bookableSports}
          onTimeChange={(date, hour) => setTime({ date, hour })}
          onFiltersChange={(change) => setFilters((current) => ({ ...current, ...change }))}
          onCollapse={() => setSheetCollapsed(true)}
        />
        {data ? (
          <ParkList
            className={cn("pointer-events-auto shrink-0 animate-in fade-in duration-300 transition-opacity md:min-h-40 md:flex-1 md:shrink", loading && "opacity-60", selectedPark && "max-md:hidden")}
            parks={parks}
            selectedParkId={selectedParkId}
            onSelectPark={selectPark}
            nearest={{ ...nearest, distances: nearest.on ? distances : null }}
            onToggleNearest={toggleNearest}
          />
        ) : (
          <div className="glass-panel pointer-events-auto flex flex-1 flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl bg-muted" />
            ))}
          </div>
        )}
      </div>

      {sheetCollapsed && !detailOpen && !assistantOpen && (
        <button
          type="button"
          onClick={() => setSheetCollapsed(false)}
          aria-expanded={false}
          className="glass-panel absolute inset-x-3 bottom-7 flex animate-in items-center gap-3 p-3 text-left duration-200 fade-in slide-in-from-bottom-4 md:hidden"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-brand-mint shadow-sm">
            <Trees className="size-4" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-primary">Woodlands Court Finder</span>
            <span className="block truncate text-xs text-muted-foreground">
              {data
                ? `${dayLabel(data.dates, data.date)} at ${formatHour(data.hour)} · ${parks.filter((park) => park.joinable > 0).length} of ${parks.length} parks with a court`
                : "Loading courts…"}
            </span>
          </span>
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {data && data.alerts.length > 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-16 flex justify-center md:top-4 md:right-[24rem] md:left-[25.5rem]">
          <AlertsBanner className="pointer-events-auto w-fit max-w-full animate-in fade-in duration-300" alerts={data.alerts} />
        </div>
      )}

      <button
        type="button"
        onClick={toggleNearest}
        aria-pressed={nearest.on}
        disabled={nearest.locating}
        aria-label={nearest.on ? "Stop showing my location" : "Show my location and sort parks by distance"}
        className={cn(
          "glass-panel absolute top-3 left-3 grid size-10 place-items-center rounded-full transition active:scale-95 disabled:opacity-60 md:hidden",
          nearest.on ? "bg-primary text-brand-mint" : "text-primary",
        )}
      >
        {nearest.locating ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
      </button>
      {nearest.error && (
        <p className="glass-panel absolute top-15 left-3 max-w-48 animate-in rounded-2xl px-3 py-2 text-xs text-muted-foreground fade-in md:hidden">{nearest.error}</p>
      )}

      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 max-md:top-3 max-md:right-3">
        <div className="flex items-center gap-2">
          {assistantEnabled && !assistantOpen && (
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgb(41_92_45_/_0.6)] transition animate-in fade-in zoom-in-95 duration-200 hover:bg-primary/90"
            >
              <Sparkles className="size-4 text-brand-mint" /> Ask
            </button>
          )}
          {data && (
            <>
              {/* Phones have no status bar, so the pill is their way to the data status page. */}
              <WeatherPill className="animate-in fade-in duration-300 md:hidden" weather={data.weather} sunset={data.sunset} href="/status" />
              <WeatherPill className="animate-in fade-in duration-300 max-md:hidden" weather={data.weather} sunset={data.sunset} />
            </>
          )}
        </div>
        {data && !detail.value && !assistantOpen && <ConditionChips className="animate-in fade-in duration-300 max-md:hidden" conditions={data.conditions} />}
      </div>

      {assistant.value && (
        <AssistantPanel
          className={cn(
            "absolute inset-x-3 bottom-7 z-10 h-[62dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-28 md:h-auto md:w-[23rem]",
            assistant.state === "open" ? PANEL_IN : PANEL_OUT,
          )}
          onClose={() => setAssistantOpen(false)}
        />
      )}

      {detail.value && data && (
        <ParkDetail
          className={cn(
            "absolute inset-x-3 bottom-7 max-h-[58dvh] md:inset-x-auto md:top-20 md:right-4 md:bottom-28 md:max-h-none",
            detail.state === "open" ? PANEL_IN : PANEL_OUT,
          )}
          park={detail.value.park}
          date={data.date}
          hour={data.hour}
          events={data.events.filter((event) => event.parkId === detail.value!.park.id)}
          parkEvents={data.parkEvents.filter((event) => event.parkId === detail.value!.park.id)}
          alerts={data.alerts.filter((alert) => alert.parkIds.includes(detail.value!.park.id))}
          conditions={data.conditions}
          selectedCourtId={detail.value.courtId}
          onSelectCourt={(courtId) => select({ parkId: detail.value!.park.id, courtId })}
          dayCourtId={detail.value.dayCourtId}
          onCloseDay={() => setDayCourtId(null)}
          now={data.now}
          onPickHour={(hour) => setTime({ date: data.date, hour })}
          onClose={() => selectPark(null)}
        />
      )}

      <div className="pointer-events-none absolute right-20 bottom-8 left-[25.5rem] flex justify-center max-md:hidden">
        <StatusBar className="pointer-events-auto w-fit" updatedAt={data?.reservationsUpdatedAt ?? null} />
      </div>

      {error && (
        <p className="glass-panel absolute top-4 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-top-2 duration-300 rounded-full px-4 py-2 text-sm text-destructive">
          Couldn&apos;t load courts ({error}). Retrying when you change the time.
        </p>
      )}
    </main>
  );
}
