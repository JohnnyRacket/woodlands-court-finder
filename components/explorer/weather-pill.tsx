"use client";

import { ChevronRight, Cloud, CloudLightning, CloudRain, CloudSun, Droplets, Sun, Sunset, Wind } from "lucide-react";
import Link from "next/link";
import { formatClock } from "@/lib/format";
import type { ExplorerData } from "@/lib/queries/explorer";
import { cn } from "@/lib/utils";

function WeatherIcon({ forecast, className }: { forecast: string; className?: string }) {
  if (/thunder/i.test(forecast)) return <CloudLightning className={className} />;
  if (/rain|shower|drizzle/i.test(forecast)) return <CloudRain className={className} />;
  if (/partly|mostly sunny/i.test(forecast)) return <CloudSun className={className} />;
  if (/cloud|overcast/i.test(forecast)) return <Cloud className={className} />;
  return <Sun className={className} />;
}

export function WeatherPill({ weather, sunset, href, className }: Pick<ExplorerData, "weather" | "sunset"> & { href?: string; className?: string }) {
  const Root = href ? Link : "div";
  return (
    <Root href={href!} className={cn("glass-panel flex items-center gap-4 rounded-full px-4 py-2 text-sm", href && "pr-3 transition active:scale-95", className)}>
      {weather ? (
        <>
          <span className="flex items-center gap-2 font-medium" title={weather.shortForecast}>
            <WeatherIcon forecast={weather.shortForecast} className="size-4 text-primary" />
            {weather.tempF}°
          </span>
          <span className={cn("flex items-center gap-1", weather.precipPct >= 40 ? "text-status-tournament" : "text-muted-foreground")}>
            <Droplets className="size-3.5" />
            {weather.precipPct}%
          </span>
          <span className="flex items-center gap-1 text-muted-foreground max-sm:hidden short:max-[48rem]:hidden">
            <Wind className="size-3.5" />
            {weather.gustMph !== null && weather.gustMph >= weather.windMph + 5 ? `${weather.windMph} mph, gusts ${weather.gustMph}` : `${weather.windMph} mph`}
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">No forecast</span>
      )}
      <span className="flex items-center gap-1 text-muted-foreground">
        <Sunset className="size-3.5" />
        {formatClock(sunset)}
      </span>
      {href && (
        <>
          <ChevronRight className="-ml-2 size-4 text-muted-foreground" />
          <span className="sr-only">Data status</span>
        </>
      )}
    </Root>
  );
}
