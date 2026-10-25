"use client";

import { useEffect, useState } from "react";

/** How long panels take to animate out; matches the `duration-200` on their exit classes. */
export const EXIT_MS = 200;

/**
 * Keeps the last non-null `value` rendered for a moment after it goes away, so it can animate out.
 * `state` is "closed" during that moment; pass `value` memoized so it keeps its identity between renders.
 */
export function usePresence<T>(value: T | null, ms = EXIT_MS): { value: T | null; state: "open" | "closed" } {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);

  useEffect(() => {
    if (value !== null) return;
    const timer = setTimeout(() => setLast(null), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return { value: value ?? last, state: value !== null ? "open" : "closed" };
}
