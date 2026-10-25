"use client";

import { ArrowLeft, CloudRain, Lightbulb, LightbulbOff, MoonStar } from "lucide-react";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock, formatHour, formatMinutes } from "@/lib/format";
import { LABEL_META } from "@/lib/label-meta";
import type { CourtDay } from "@/lib/queries/court-day";
import { cn } from "@/lib/utils";
import { ConditionIcon } from "./conditions";

interface CourtDayPanelProps {
  courtId: string;
  date: string;
  /** The hour the map is showing. */
  hour: number;
  now: { date: string; hour: number; open: boolean };
  onPickHour: (hour: number) => void;
  onClose: () => void;
  className?: string;
}

/** One court's 7 a.m.–11 p.m. day, shown beside the park's court list. */
export function CourtDayPanel({ courtId, date, hour, now, onPickHour, onClose, className }: CourtDayPanelProps) {
  const [day, setDay] = useState<CourtDay | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const key = `${courtId}/${date}`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/courts/${courtId}/day?date=${date}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((next: CourtDay) => setDay(next))
      .catch((err: Error) => err.name !== "AbortError" && setFailure({ key: `${courtId}/${date}`, message: err.message }));
    return () => controller.abort();
  }, [courtId, date]);

  const current = day?.court.id === courtId && day.date === date ? day : null;
  // Only the court and date on screen; an earlier court's failure shouldn't show here.
  const error = !current && failure?.key === key ? failure.message : null;
  const playable = current?.hours.filter((h) => h.label.publicCanJoin && !h.dark && !(date === now.date && h.hour < now.hour)).length;

  return (
    <section className={cn("flex min-h-0 flex-col", className)} aria-label="Court day">
      <header className="flex items-start gap-2 px-4 pt-5 pb-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to courts"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-accent hover:text-primary"
        >
          <ArrowLeft className="size-4" />
        </button>
        {current ? (
          <div className="min-w-0 animate-in fade-in duration-200">
            <h3 className="truncate font-semibold text-primary">{current.court.name}</h3>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
              {current.court.lighted === true && (
                <span className="inline-flex items-center gap-1">
                  <Lightbulb className="size-3" /> Lit
                </span>
              )}
              {current.court.lighted === false && (
                <span className="inline-flex items-center gap-1">
                  <LightbulbOff className="size-3" /> No lights
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <MoonStar className="size-3" /> Sunset {formatClock(current.sunset)}
              </span>
              <span>
                {playable} playable hour{playable === 1 ? "" : "s"} left
              </span>
            </p>
          </div>
        ) : (
          <Skeleton className="h-10 flex-1 rounded-xl bg-muted" />
        )}
      </header>

      {error && <p className="mx-4 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">Couldn&apos;t load this court ({error}).</p>}

      <ol key={current ? "day" : "loading"} className={cn("panel-scroll flex min-h-0 flex-col gap-0.5 px-2", current && "animate-in fade-in duration-200")}>
        {current
          ? current.hours.map(({ hour: h, label, dark, weather, conditions }) => {
              const meta = LABEL_META[label.kind];
              const past = date === now.date && h < now.hour;
              return (
                <li key={h}>
                  <button
                    type="button"
                    disabled={past}
                    onClick={() => onPickHour(h)}
                    title={`Show ${formatHour(h)} on the map`}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition",
                      h === hour ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-white/70",
                      "disabled:pointer-events-none disabled:opacity-40",
                    )}
                  >
                    <span className="w-11 shrink-0 text-xs font-medium tabular-nums">
                      {date === now.date && now.open && h === now.hour ? "Now" : formatHour(h)}
                    </span>
                    <span className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: meta.color, opacity: dark ? 0.45 : 1 }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">{meta.text}</span>
                      {"event" in label && (
                        <span className="block truncate text-[11px] text-muted-foreground" title={`${label.event.title}, ${formatMinutes(label.event.startMin)}–${formatMinutes(label.event.endMin)}`}>
                          {label.event.title}
                        </span>
                      )}
                    </span>
                    {dark && <MoonStar className="size-3 shrink-0 text-muted-foreground" aria-label="After sunset and not known to be lit" />}
                    {conditions.length > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5" title={conditions.map((c) => c.text).join("\n")}>
                        {conditions.map((condition) => (
                          <ConditionIcon key={condition.kind} condition={condition} className="size-3" />
                        ))}
                      </span>
                    )}
                    {weather && (
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums" title={weather.shortForecast}>
                        <span className="font-medium text-foreground">{weather.tempF}°</span>
                        <span className={cn("flex items-center gap-0.5", weather.precipPct >= 40 && "text-status-tournament")}>
                          <CloudRain className="size-3" />
                          {weather.precipPct}%
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })
          : Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="mx-2 my-1 h-9 rounded-xl bg-muted" />)}
      </ol>
    </section>
  );
}
