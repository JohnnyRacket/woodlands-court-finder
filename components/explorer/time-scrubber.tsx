"use client";

import { ChevronUp } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatDay, formatHour } from "@/lib/format";
import { cn } from "@/lib/utils";

const SLOT_WIDTH = 40;
// Long enough to outlast the gaps between momentum scroll events, so a fling commits once.
const SETTLE_MS = 160;

interface TimeScrubberProps {
  dates: string[];
  hours: number[];
  date: string;
  hour: number;
  now: { date: string; hour: number; open: boolean };
  onChange: (date: string, hour: number) => void;
  /** Shown under the time, describing the committed hour (e.g. how many parks have a court). */
  summary: string;
  loading?: boolean;
  onExpand: () => void;
  className?: string;
}

/** The collapsed phone bar: a ruler of every bookable hour that you swipe like a dial. */
export function TimeScrubber({ dates, hours, date, hour, now, onChange, summary, loading, onExpand, className }: TimeScrubberProps) {
  const slots = useMemo(
    () =>
      dates.flatMap((d, day) =>
        hours.filter((h) => d !== now.date || h >= now.hour).map((h, i) => ({ date: d, hour: h, day, firstOfDay: i === 0 })),
      ),
    [dates, hours, now],
  );
  const foundIndex = slots.findIndex((slot) => slot.date === date && slot.hour === hour);
  const selectedIndex = Math.max(0, foundIndex);

  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [centered, setCentered] = useState(selectedIndex);

  // Follows time changes made elsewhere, unless the user is mid-swipe. Before paint, so it opens on the right hour.
  useLayoutEffect(() => {
    if (!scroller.current || settle.current) return;
    scroller.current.scrollTo({ left: selectedIndex * SLOT_WIDTH, behavior: "instant" });
    setCentered(selectedIndex);
  }, [selectedIndex]);

  // The chosen hour can slip into the past while the page sits open; move to the earliest one left.
  const firstSlot = slots[0];
  useEffect(() => {
    if (foundIndex === -1 && firstSlot) onChange(firstSlot.date, firstSlot.hour);
  }, [foundIndex, firstSlot, onChange]);

  useEffect(() => () => void (settle.current && clearTimeout(settle.current)), []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const index = Math.min(slots.length - 1, Math.max(0, Math.round(el.scrollLeft / SLOT_WIDTH)));
    if (index !== centered) {
      setCentered(index);
      // Chrome blocks (and warns about) vibration until the user has tapped the page; scrolling doesn't count.
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(4);
    }
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      settle.current = null;
      const slot = slots[index];
      if (slot && (slot.date !== date || slot.hour !== hour)) onChange(slot.date, slot.hour);
    }, SETTLE_MS);
  };

  const scrollToSlot = (index: number) =>
    scroller.current?.scrollTo({ left: Math.min(slots.length - 1, Math.max(0, index)) * SLOT_WIDTH, behavior: "smooth" });

  const dayName = (day: number, d: string) => (day === 0 ? "Today" : day === 1 ? "Tomorrow" : formatDay(d).split(", ")[0]);
  const isNow = (slot: { date: string; hour: number }) => slot.date === now.date && now.open && slot.hour === now.hour;
  const current = slots[centered];
  const settled = current?.date === date && current?.hour === hour;

  return (
    <div className={cn("glass-panel flex flex-col gap-1.5 px-4 pt-3.5 pb-3 select-none", className)}>
      <button type="button" onClick={onExpand} aria-expanded={false} aria-label="Show options and park list" className="flex items-center gap-3 pl-1 text-left">
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-semibold tracking-tight text-primary tabular-nums">
            {current ? `${dayName(current.day, current.date)} · ${isNow(current) ? "Now" : formatHour(current.hour)}` : "Loading…"}
          </span>
          <span className={cn("block truncate text-xs text-muted-foreground transition-opacity", (loading || !settled) && "opacity-50")}>{summary}</span>
        </span>
        <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-primary/10 pr-2.5 pl-3 text-xs font-semibold text-primary">
          Options
          <ChevronUp className="size-3.5" />
        </span>
      </button>

      <div className="relative">
        <div
          ref={scroller}
          onScroll={onScroll}
          role="slider"
          tabIndex={0}
          aria-label="Time"
          aria-valuemin={0}
          aria-valuemax={slots.length - 1}
          aria-valuenow={centered}
          aria-valuetext={current ? `${dayName(current.day, current.date)} ${formatHour(current.hour)}` : undefined}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            scrollToSlot(centered + (event.key === "ArrowRight" ? 1 : -1));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
        >
          <div className="shrink-0" style={{ width: `calc(50% - ${SLOT_WIDTH / 2}px)` }} />
          {slots.map((slot, i) => {
            const active = i === centered;
            return (
              <button
                key={`${slot.date}-${slot.hour}`}
                type="button"
                tabIndex={-1}
                onClick={() => scrollToSlot(i)}
                aria-label={`${dayName(slot.day, slot.date)} ${formatHour(slot.hour)}`}
                style={{ width: SLOT_WIDTH }}
                className="relative h-11 shrink-0 snap-center"
              >
                {/* Half-hour tick on the slot's left edge, hour tick in the middle. */}
                {!slot.firstOfDay && <span className="absolute top-1 left-0 h-1.5 w-px bg-foreground/15" />}
                <span
                  className={cn(
                    "absolute top-1 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full",
                    slot.firstOfDay ? "h-5 bg-primary" : "h-3.5 bg-foreground/30",
                  )}
                />
                <span
                  className={cn(
                    "absolute inset-x-0 bottom-1 text-center text-[10.5px] leading-none whitespace-nowrap transition-colors",
                    slot.firstOfDay ? "font-semibold text-primary" : active ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                  )}
                >
                  {slot.firstOfDay && slot.day > 0
                    ? formatDay(slot.date).split(", ")[0]
                    : isNow(slot)
                      ? "Now"
                      : `${slot.hour % 12 || 12}${slot.hour < 12 ? "a" : "p"}`}
                </span>
              </button>
            );
          })}
          <div className="shrink-0" style={{ width: `calc(50% - ${SLOT_WIDTH / 2}px)` }} />
        </div>
        <div className="pointer-events-none absolute top-0 left-1/2 h-6 w-0.5 -translate-x-1/2 rounded-full bg-primary">
          <span className="absolute -top-px left-1/2 size-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent border-t-primary" />
        </div>
      </div>
    </div>
  );
}
