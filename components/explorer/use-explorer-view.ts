"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseView, viewSearch, type ExplorerView } from "./url-state";

/**
 * The explorer's view, read from and written to the URL (see url-state.ts).
 * "push" adds a history entry, so Back undoes it (opening a park or court);
 * "replace" doesn't (scrubbing the time, flipping a filter).
 */
export function useExplorerView() {
  const searchParams = useSearchParams();
  // A time that has passed reads as null, so an old link opens on now.
  const view = useMemo(() => parseView(new URLSearchParams(searchParams.toString()), new Date()), [searchParams]);

  const update = useCallback((change: Partial<ExplorerView>, history: "push" | "replace" = "replace") => {
    // From the address bar, not the last render, so two updates in one event both land.
    const current = parseView(new URLSearchParams(window.location.search), new Date());
    const url = `${window.location.pathname}${viewSearch({ ...current, ...change })}`;
    if (url === `${window.location.pathname}${window.location.search}`) return;
    if (history === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }, []);

  return [view, update] as const;
}
