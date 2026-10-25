"use client";

import { LoaderCircle, LocateFixed, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { catchError } from "next/error";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingDates } from "@/lib/booking-window";
import { fetchJson } from "@/lib/fetch-json";
import { assistantEnabled } from "@/lib/flags";
import { distanceMiles, type LatLng } from "@/lib/geo";
import type { CourtInfo } from "@/lib/queries/court-status";
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
import { filterCourts, SPORTS, summarizeParks, withHourStatus, type Filters } from "./park-summary";
import { StatusBar } from "./status-bar";
import { TimeScrubber } from "./time-scrubber";
import { isPastTime } from "./url-state";
import { useExplorerView } from "./use-explorer-view";
import { WeatherPill } from "./weather-pill";

// The ArcGIS SDK needs the browser, so the map never renders on the server.
const CourtMap = dynamic(() => import("./court-map").then((m) => m.CourtMap), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#e9efe9]" />,
});

// No WebGL2, a lost connection while loading the map code, or an ArcGIS failure: keep the panels usable.
const MapBoundary = catchError(function MapUnavailable() {
  return (
    <div className="absolute inset-0 flex justify-center bg-[#e9efe9] px-6 pt-28 md:items-center md:pt-0 md:pl-[25rem]">
      <p className="glass-panel h-fit max-w-xs rounded-2xl px-4 py-3 text-center text-sm text-muted-foreground">
        The map couldn&apos;t load on this device. The park list still works.
      </p>
    </div>
  );
});

/** How often an open, visible page re-reads court data (reservations sync every 15 minutes). */
const REFRESH_MS = 5 * 60_000;

// Side panels ease in from the right (from below on phones) and back out the same way.
const PANEL_IN = "animate-in fade-in duration-200 ease-out max-md:slide-in-from-bottom-4 md:slide-in-from-right-4";
const PANEL_OUT = "pointer-events-none animate-out fade-out duration-200 ease-in fill-mode-forwards max-md:slide-out-to-bottom-4 md:slide-out-to-right-4";

export function CourtExplorer() {
  // Time, selection and filters live in the URL (url-state.ts).
  const [view, updateView] = useExplorerView();
  const { time, filters } = view;
  const setTime = (next: { date: string; hour: number }) => updateView({ time: next });
  const setFilters = (change: Partial<Filters>) => updateView({ filters: { ...filters, ...change } });
  const [data, setData] = useState<ExplorerData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshes, setRefreshes] = useState(0);
  const selection = useMemo<Selection>(() => ({ parkId: view.parkId, courtId: view.courtId }), [view.parkId, view.courtId]);
  const selectedParkId = selection.parkId;
  // Selecting a court (on the map or in the panel) also opens its day; closing the day keeps the court selected.
  const [closedDayCourtId, setClosedDayCourtId] = useState<string | null>(null);
  const dayCourtId = selection.courtId !== closedDayCourtId ? selection.courtId : null;
  const select = (next: Selection) => {
    setClosedDayCourtId(null);
    updateView(next, "push");
  };
  const selectPark = (parkId: string | null) => select({ parkId, courtId: null });
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Phones open on the map with the time dial; this only affects phone layouts.
  const [sheetCollapsed, setSheetCollapsed] = useState(true);
  // Once the bar and sheet have morphed into each other, the bar stops playing its own entrance.
  const [sheetMorphed, setSheetMorphed] = useState(false);
  // The bar grows into the sheet and shrinks back (the `phone-sheet` view transition), where the browser can.
  const toggleSheet = (collapsed: boolean) => {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setSheetCollapsed(collapsed);
    const root = document.documentElement;
    root.dataset.sheetMorph = "";
    const transition = document.startViewTransition(() =>
      flushSync(() => {
        setSheetMorphed(true);
        setSheetCollapsed(collapsed);
      }),
    );
    transition.finished.finally(() => delete root.dataset.sheetMorph);
  };

  // What the courts are (names, outlines, lights) is loaded once; each hour only brings labels.
  const [catalog, setCatalog] = useState<Map<string, CourtInfo> | null>(null);
  const catalogRef = useRef(catalog);
  const [catalogLoads, setCatalogLoads] = useState(0);
  const [catalogFailed, setCatalogFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<{ courts: CourtInfo[] }>("/api/courts/catalog", controller.signal)
      .then(({ courts }) => {
        catalogRef.current = new Map(courts.map((court) => [court.id, court]));
        setCatalog(catalogRef.current);
        setCatalogFailed(false);
      })
      .catch(() => !controller.signal.aborted && setCatalogFailed(true));
    return () => controller.abort();
  }, [catalogLoads]);

  const refresh = useCallback(() => {
    // An hour that has passed while the page sat open goes back to following now.
    if (time && isPastTime(time, new Date())) updateView({ time: null });
    if (!catalogRef.current) setCatalogLoads((n) => n + 1);
    setRefreshes((n) => n + 1);
  }, [time, updateView]);


  useEffect(() => {
    const refreshIfVisible = () => document.visibilityState === "visible" && refresh();
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refresh]);

  // By value: a filter change rewrites the URL, which shouldn't refetch the same hour.
  const query = time ? `?date=${time.date}&hour=${time.hour}` : "";
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<ExplorerData>(`/api/courts${query}`, controller.signal)
      .then((next) => {
        setData(next);
        setFailed(false);
        // A court added since the catalog loaded (the courts source runs daily): load it again.
        if (catalogRef.current && next.courts.some((court) => !catalogRef.current!.has(court.id))) setCatalogLoads((n) => n + 1);
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, [query, refreshes]);

  // Sports residents can book on the shown date (pickleball opens a day later than tennis).
  // The user's choice is kept, so pickleball comes back on dates it's bookable.
  const bookableSports = useMemo(() => (data ? SPORTS.filter((sport) => bookingDates(sport, data.now.date).includes(data.date)) : SPORTS), [data]);
  const shownFilters = useMemo(() => {
    const sports = filters.sports.filter((sport) => bookableSports.includes(sport));
    return { ...filters, sports: sports.length ? sports : bookableSports };
  }, [filters, bookableSports]);

  const courts = useMemo(() => (data && catalog ? filterCourts(withHourStatus(catalog, data.courts), shownFilters) : []), [data, catalog, shownFilters]);
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
      <MapBoundary>
        <CourtMap
          parks={parks}
          courts={courts}
          selection={selection}
          onSelect={select}
          rightPanelWidth={selectedPark && !assistantOpen ? (dayCourtId ? 736 : 400) : assistantOpen ? 400 : 0}
          userLocation={nearest.on ? nearest.location : null}
        />
      </MapBoundary>

      {/* Left column: controls + park list (a bottom sheet on phones) */}
      <div
        className={cn(
          "absolute inset-x-3 bottom-7 flex max-h-[58dvh] flex-col gap-3 overflow-y-auto rounded-3xl transition-[opacity,visibility] duration-200 [scrollbar-width:none] md:pointer-events-none md:inset-y-4 md:right-auto md:bottom-8 md:left-4 md:max-h-none md:w-[23rem] md:overflow-visible md:rounded-none",
          // The morph animates collapsing and expanding, so the sheet's own fade sits that out.
          "[:root[data-sheet-morph]_&]:transition-none",
          // On phones the park or assistant sheet takes this spot, so the controls get out of the way.
          // The morph's name goes on only while it runs: a named element stops the glass inside it from blurring the map.
          (detailOpen || assistantOpen || sheetCollapsed) ? "max-md:invisible max-md:opacity-0" : "max-md:[:root[data-sheet-morph]_&]:[view-transition-name:phone-sheet]",
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
          onFiltersChange={setFilters}
          onCollapse={() => toggleSheet(true)}
        />
        {data && catalog ? (
          <ParkList
            className={cn("pointer-events-auto shrink-0 animate-in fade-in duration-300 transition-opacity md:min-h-40 md:flex-1 md:shrink", loading && "opacity-60", selectedPark && "max-md:hidden")}
            parks={parks}
            selectedParkId={selectedParkId}
            onSelectPark={selectPark}
            nearest={{ ...nearest, distances: nearest.on ? distances : null }}
            onToggleNearest={toggleNearest}
            emptyText={data.courts.length ? "No courts match these filters." : "Court data hasn't loaded yet. Check back in a few minutes."}
          />
        ) : (
          <div className="glass-panel pointer-events-auto flex flex-1 flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-2xl bg-muted" />
            ))}
          </div>
        )}
      </div>

      {sheetCollapsed && !detailOpen && !assistantOpen && !data && (
        <div className="glass-panel absolute inset-x-3 bottom-7 flex flex-col gap-3 px-5 pt-4 pb-3 md:hidden">
          <Skeleton className="h-4 w-32 rounded-full bg-muted" />
          <Skeleton className="h-3 w-44 rounded-full bg-muted" />
          <Skeleton className="h-9 rounded-xl bg-muted" />
        </div>
      )}
      {sheetCollapsed && !detailOpen && !assistantOpen && data && (
        <TimeScrubber
          className={cn(
            "absolute inset-x-3 bottom-7 md:hidden [:root[data-sheet-morph]_&]:[view-transition-name:phone-sheet]",
            !sheetMorphed && "animate-in duration-200 fade-in slide-in-from-bottom-4",
          )}
          dates={data.dates}
          hours={data.hours}
          date={time?.date ?? data.date}
          hour={time?.hour ?? data.hour}
          now={data.now}
          onChange={(date, hour) => setTime({ date, hour })}
          summary={`${parks.filter((park) => park.joinable > 0).length} of ${parks.length} parks with a court`}
          loading={loading}
          onExpand={() => toggleSheet(false)}
        />
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
          "glass-panel absolute top-3 left-3 grid size-9.5 place-items-center rounded-full transition active:scale-95 disabled:opacity-60 md:hidden",
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
          onCloseDay={() => setClosedDayCourtId(selection.courtId)}
          now={data.now}
          onPickHour={(hour) => setTime({ date: data.date, hour })}
          onClose={() => selectPark(null)}
        />
      )}

      <div className="@container pointer-events-none absolute right-[4.5rem] bottom-8 left-[25rem] flex justify-center max-md:hidden">
        <StatusBar className="pointer-events-auto w-fit" updatedAt={data?.reservationsUpdatedAt ?? null} />
      </div>

      {(failed || catalogFailed) && (
        <div
          role="alert"
          className="glass-panel absolute top-4 left-1/2 z-20 flex w-max max-w-[calc(100%-1.5rem)] -translate-x-1/2 animate-in items-center gap-3 rounded-full py-2 pr-2 pl-4 text-sm text-destructive duration-300 fade-in slide-in-from-top-2 max-md:top-15"
        >
          {data && catalog ? "Couldn't refresh courts; showing the last loaded." : "Couldn't load courts."}
          <button type="button" onClick={refresh} className="shrink-0 rounded-full bg-destructive/10 px-3 py-1 font-medium transition hover:bg-destructive/15">
            Try again
          </button>
        </div>
      )}
    </main>
  );
}
