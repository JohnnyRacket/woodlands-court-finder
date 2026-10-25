"use client";

import { Check, Trees } from "lucide-react";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDay, formatHour } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SPORTS, type Filters, type Sport } from "./park-summary";

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
  /** Sports residents can book on this date; the others are shown disabled. */
  bookableSports: Sport[];
  onTimeChange: (date: string, hour: number) => void;
  onFiltersChange: (change: Partial<Filters>) => void;
  className?: string;
}

export function ControlsPanel({ dates, hours, date, hour, now, filters, bookableSports, onTimeChange, onFiltersChange, className }: ControlsPanelProps) {
  const past = (h: number) => date === now?.date && h < now.hour;
  const closedSports = SPORTS.filter((sport) => !bookableSports.includes(sport));
  // Parts of the day with hours left; the selected hour's part is shown unless the user picks another.
  const parts = DAY_PARTS.filter((p) => hours.some((h) => h >= p.from && h <= p.to && !past(h)));
  const partOf = (h: number | null) => DAY_PARTS.find((p) => h !== null && h >= p.from && h <= p.to)?.name;
  const [part, setPart] = useState<string | undefined>();
  const [partForHour, setPartForHour] = useState(hour);
  if (hour !== partForHour) {
    setPartForHour(hour);
    setPart(undefined);
  }
  const shownPart = parts.find((p) => p.name === part)?.name ?? partOf(hour) ?? parts[0]?.name ?? "";
  const shownRange = DAY_PARTS.find((p) => p.name === shownPart);
  const partHours = shownRange ? hours.filter((h) => h >= shownRange.from && h <= shownRange.to) : [];

  return (
    <section className={cn("glass-panel flex flex-col gap-4 p-4", className)}>
      <header className="flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-brand-mint shadow-sm">
          <Trees className="size-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-semibold tracking-tight text-primary">Woodlands Court Finder</h1>
          <p className="text-xs text-muted-foreground">Tennis &amp; pickleball courts</p>
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
              className="h-11 min-w-0 flex-1 flex-col gap-0 rounded-xl text-sm leading-tight data-[pressed]:bg-white data-[pressed]:text-primary data-[pressed]:shadow-sm"
            >
              {i === 0 ? "Today" : i === 1 ? "Tomorrow" : formatDay(d).split(", ")[0]}
              <span className="text-[11px] font-normal text-muted-foreground">{formatDay(d).split(", ")[1]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {parts.length > 0 && (
          <ToggleGroup
            value={[shownPart]}
            onValueChange={(value) => value[0] && setPart(value[0])}
            spacing={1}
            className="w-full rounded-2xl bg-muted p-1"
          >
            {parts.map((p) => (
              <ToggleGroupItem
                key={p.name}
                value={p.name}
                className="h-8 flex-1 rounded-xl text-xs data-[pressed]:bg-white data-[pressed]:text-primary data-[pressed]:shadow-sm"
              >
                {p.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Hour">
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

      <div className="flex flex-col gap-3">
        <ToggleGroup
          multiple
          value={filters.sports}
          onValueChange={(value) => value.length && onFiltersChange({ sports: value as Sport[] })}
          spacing={1}
          className="w-full rounded-2xl bg-muted p-1"
        >
          {SPORTS.map((sport) => (
            <ToggleGroupItem
              key={sport}
              value={sport}
              disabled={!bookableSports.includes(sport)}
              className="group/sport h-9 flex-1 gap-1.5 rounded-xl text-sm text-muted-foreground capitalize data-[pressed]:bg-brand-mint/45 data-[pressed]:font-medium data-[pressed]:text-primary data-[pressed]:ring-1 data-[pressed]:ring-primary/20"
            >
              <Check className="hidden size-3.5 group-data-[pressed]/sport:block" />
              {sport}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {date && closedSports.length > 0 && (
          <p className="-mt-1.5 text-xs text-muted-foreground first-letter:uppercase">
            {closedSports.join(" and ")} booking for {formatDay(date).split(", ")[0]} opens at midnight.
          </p>
        )}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span title="Hides reserved courts, programs and events; keeps open courts and open play">Only show unreserved courts</span>
          <Switch checked={filters.joinableOnly} onCheckedChange={(joinableOnly) => onFiltersChange({ joinableOnly })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Only show courts with lights</span>
          <Switch checked={filters.litOnly} onCheckedChange={(litOnly) => onFiltersChange({ litOnly })} />
        </label>
      </div>
    </section>
  );
}
