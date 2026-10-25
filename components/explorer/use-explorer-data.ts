"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { CourtInfo } from "@/lib/queries/court-status";
import type { ExplorerData } from "@/lib/queries/explorer";

/** How often an open, visible page re-reads court data (reservations sync every 15 minutes). */
const REFRESH_MS = 5 * 60_000;

/**
 * The map's data for a time (null = now): the courts, loaded once, and the hour's labels,
 * weather and alerts, re-read every few minutes while the page is visible. `onRefresh` runs
 * before each re-read, so the caller can move a time that has passed.
 */
export function useExplorerData(time: { date: string; hour: number } | null, onRefresh: () => void) {
  const [data, setData] = useState<ExplorerData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshes, setRefreshes] = useState(0);

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

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);
  const refresh = useCallback(() => {
    onRefreshRef.current();
    if (!catalogRef.current) setCatalogLoads((n) => n + 1);
    setRefreshes((n) => n + 1);
  }, []);

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

  return { data, catalog, failed: failed || catalogFailed, refresh };
}
