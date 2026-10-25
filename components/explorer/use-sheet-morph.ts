"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

/**
 * The phone layout's bottom sheet: collapsed to the time dial at first, expanded to the full
 * controls on demand. The bar grows into the sheet and shrinks back (the `phone-sheet` view
 * transition, named in CSS while `data-sheet-morph` is set on <html>), where the browser can.
 */
export function useSheetMorph() {
  const [collapsed, setCollapsed] = useState(true);
  // Once the bar and sheet have morphed into each other, the bar stops playing its own entrance.
  const [morphed, setMorphed] = useState(false);

  const toggle = (next: boolean) => {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setCollapsed(next);
    const root = document.documentElement;
    root.dataset.sheetMorph = "";
    const transition = document.startViewTransition(() =>
      flushSync(() => {
        setMorphed(true);
        setCollapsed(next);
      }),
    );
    transition.finished.finally(() => delete root.dataset.sheetMorph);
  };

  return { collapsed, morphed, toggle };
}
