"use client";

import { useState } from "react";

/** A wrapping row of chips that shows the first few and expands in place. */
export function ExpandableChips({ items, visible = 8 }: { items: string[]; visible?: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, visible);
  const hidden = items.length - visible;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((item) => (
        <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-xs whitespace-nowrap">
          {item}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded-full px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-accent"
        >
          {expanded ? "Show less" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}
