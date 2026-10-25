"use client";

import { Activity, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatAgo } from "@/lib/format";
import { LABEL_META, LEGEND_ORDER } from "@/lib/label-meta";
import { cn } from "@/lib/utils";

export function StatusBar({ updatedAt, className }: { updatedAt: string | null; className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn("glass-panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-2.5 text-xs", className)}>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {LEGEND_ORDER.map((kind) => (
          <li key={kind} className="flex items-center gap-1.5" title={LABEL_META[kind].hint}>
            <span className="size-2.5 rounded-full" style={{ backgroundColor: LABEL_META[kind].color }} />
            {LABEL_META[kind].text}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        {updatedAt && now ? `Updated ${formatAgo(updatedAt, now)}` : "Not synced yet"}
      </p>
      <Link href="/status" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
        <Activity className="size-3.5" /> Data status
      </Link>
    </div>
  );
}
