"use client";

import { Activity, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAgo } from "@/lib/format";
import { GROUP_META, LEGEND } from "@/lib/label-meta";
import { cn } from "@/lib/utils";
import { StatusDot } from "./status-dot";

export function StatusBar({ updatedAt, className }: { updatedAt: string | null; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    // At most two rows (legend, then sync info) so it stays clear of the park detail pane above it.
    // Sizes are container queries against the slot between the left column and the map controls.
    <div className={cn("glass-panel flex max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-2.5 text-xs @max-[28rem]:px-3.5", className)}>
      <ul className="flex min-w-0 items-center gap-x-3 overflow-x-auto whitespace-nowrap [scrollbar-width:none] @max-[28rem]:gap-x-2.5 @max-[23rem]:pr-6 @max-[23rem]:mask-r-from-80%">
        {LEGEND.map((group) => {
          const meta = GROUP_META[group];
          return (
            <li key={group} className="flex shrink-0 items-center gap-1.5" title={meta.hint}>
              <StatusDot className="size-2.5" color={meta.color} hollow={meta.hollow} />
              {meta.short ? (
                <>
                  <span className="@max-[28rem]:hidden">{meta.text}</span>
                  <span className="@min-[28rem]:hidden">{meta.short}</span>
                </>
              ) : (
                meta.text
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex shrink-0 items-center gap-x-4 whitespace-nowrap">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5 shrink-0" />
          {updatedAt && now ? `Updated ${formatAgo(updatedAt, now)}` : "Not synced yet"}
        </p>
        <Link href="/status" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Activity className="size-3.5" /> Data status
        </Link>
      </div>
    </div>
  );
}
