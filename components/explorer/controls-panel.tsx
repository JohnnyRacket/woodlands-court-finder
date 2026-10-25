"use client";

import { Trees } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDay, formatHour } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Filters, Sport } from "./park-summary";

const DAY_PARTS = [
  { name: "Morning", from: 7, to: 11 },
  { name: "Afternoon", from: 12, to: 16 },
  { name: "Evening", from: 17, to: 22 },
];

interface ControlsPanelProps {
  dates: string[];
  hours: number[];
  date: string | null;
  hour: number | null;
  /** The current Chicago time; earlier hours today are in the past. */
  now: { date: string; hour: number; open: boolean } | null;
  filters: Filters;
  onTimeChange: (date: string, hour: number) => void;
  onFiltersChange: (filters: Filters) => void;
  className?: string;
}

export function ControlsPanel({ dates, hours, date, hour, now, filters, onTimeChange, onFiltersChange, className }: ControlsPanelProps) {
  return (
    <section className={cn("glass-panel flex flex-col gap-4 p-4", className)}>
      <header className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-brand-mint shadow-sm">
          <Trees className="size-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-semibold tracking-tight text-primary">Court Finder</h1>
          <p className="text-xs text-muted-foreground">Tennis &amp; pickleball · The Woodlands</p>
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <ToggleGroup
          value={date ? [date] : []}
          onValueChange={(value) => {
            const next = value[0];
            if (!next || !hour) return;
            const firstOpen = next === now?.date ? Math.max(now.hour, hours[0]) : hours[0];
            onTimeChange(next, Math.max(hour, firstOpen));
          }}
          spacing={1}
          className="w-full rounded-2xl bg-muted p-1"
        >
          {dates.map((d, i) => (
            <ToggleGroupItem
              key={d}
              value={d}
              className="h-9 flex-1 rounded-xl text-sm data-[pressed]:bg-white data-[pressed]:text-primary data-[pressed]:shadow-sm"
            >
              {i === 0 ? "Today" : "Tomorrow"}
              <span className="ml-1 text-xs font-normal text-muted-foreground">{formatDay(d).split(", ")[1]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Hour">
          {DAY_PARTS.map((part) => {
            const partHours = hours.filter((h) => h >= part.from && h <= part.to);
            const past = (h: number) => date === now?.date && h < now.hour;
            if (partHours.length === 0 || partHours.every(past)) return null;
            return (
              <div key={part.name} className="flex items-start gap-3">
                <span className="w-[4.5rem] shrink-0 pt-2 text-xs font-medium text-muted-foreground">{part.name}</span>
                <div className="grid flex-1 grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {partHours.map((h) => {
                    const selected = h === hour;
                    return (
                      <button
                        key={h}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={past(h)}
                        onClick={() => date && onTimeChange(date, h)}
                        className={cn(
                          "h-8 rounded-xl text-xs font-medium whitespace-nowrap transition",
                          selected ? "bg-primary text-primary-foreground shadow-sm" : "bg-white/70 text-foreground/80 hover:bg-accent hover:text-primary",
                          "disabled:pointer-events-none disabled:opacity-35",
                        )}
                      >
                        {date === now?.date && now.open && h === now.hour ? "Now" : formatHour(h)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <ToggleGroup
          multiple
          value={filters.sports}
          onValueChange={(value) => value.length && onFiltersChange({ ...filters, sports: value as Sport[] })}
          spacing={1}
          className="w-full rounded-2xl bg-muted p-1"
        >
          {(["tennis", "pickleball"] as const).map((sport) => (
            <ToggleGroupItem
              key={sport}
              value={sport}
              className="h-9 flex-1 rounded-xl text-sm capitalize data-[pressed]:bg-white data-[pressed]:text-primary data-[pressed]:shadow-sm"
            >
              {sport}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Only courts I can play on</span>
          <Switch checked={filters.joinableOnly} onCheckedChange={(joinableOnly) => onFiltersChange({ ...filters, joinableOnly })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Lit courts only</span>
          <Switch checked={filters.litOnly} onCheckedChange={(litOnly) => onFiltersChange({ ...filters, litOnly })} />
        </label>
      </div>
    </section>
  );
}
