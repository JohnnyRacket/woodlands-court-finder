"use client";

import { ChevronDown, CloudAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { Alert } from "@/lib/queries/conditions";
import { cn } from "@/lib/utils";

const LEVEL_TONE: Record<Alert["level"], string> = {
  info: "text-muted-foreground",
  warning: "text-[#a8700d]",
  danger: "text-destructive",
};

const until = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });

/** One alert line; click to read the full notice. */
export function AlertItem({ alert, className }: { alert: Alert; className?: string }) {
  const [open, setOpen] = useState(false);
  const Icon = alert.source === "nws" ? CloudAlert : TriangleAlert;
  return (
    <div className={cn("text-sm", className)}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} disabled={!alert.body} className="flex w-full items-center gap-2 text-left">
        <Icon className={cn("size-4 shrink-0", LEVEL_TONE[alert.level])} />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{alert.title}</span>
          <span className="text-xs text-muted-foreground">
            {" · "}
            {alert.source === "nws" ? `National Weather Service${alert.endsAt ? `, until ${until(alert.endsAt)}` : ""}` : "Township notice"}
          </span>
        </span>
        {alert.body && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />}
      </button>
      {open && alert.body && <p className="mt-1.5 pl-6 text-xs whitespace-pre-line text-muted-foreground">{alert.body}</p>}
    </div>
  );
}

/** Court closures and weather alerts in effect now, across the top of the map. */
export function AlertsBanner({ alerts, className }: { alerts: Alert[]; className?: string }) {
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Alerts" className={cn("glass-panel flex max-h-[40dvh] flex-col gap-2 overflow-y-auto rounded-2xl px-4 py-2.5", className)}>
      {alerts.map((alert) => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </section>
  );
}
