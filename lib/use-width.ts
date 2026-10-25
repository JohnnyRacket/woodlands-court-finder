"use client";

import { useCallback, useState } from "react";

/** The rendered width of the element `ref` is attached to, kept current as it resizes; 0 when none is. */
export function useWidth<T extends HTMLElement>(): [ref: (element: T | null) => (() => void) | undefined, width: number] {
  const [width, setWidth] = useState(0);
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.borderBoxSize[0].inlineSize));
    observer.observe(element);
    return () => {
      observer.disconnect();
      setWidth(0);
    };
  }, []);
  return [ref, width];
}
