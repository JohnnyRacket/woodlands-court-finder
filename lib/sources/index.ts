import { activenetProgramsSource } from "./activenet-programs";
import { activenetSlotsSource } from "./activenet-slots";
import { courtsSource } from "./courts";
import { nwsAlertsSource } from "./nws-alerts";
import { rainfallSource } from "./rainfall";
import { townshipAlertsSource } from "./township-alerts";
import { townshipEventsSource } from "./township-events";
import { townshipPageSource } from "./township-page";
import type { SourceModule } from "./types";
import { weatherSource } from "./weather";
import { weatherDetailsSource } from "./weather-details";

// The registry. Adding a source = add its folder + one line here.
// Order matters on boot: courts first, since the others reference it; the slow
// programs crawl goes last so live data fills in first.
export const sources: SourceModule[] = [
  courtsSource,
  activenetSlotsSource,
  weatherSource,
  weatherDetailsSource,
  rainfallSource,
  nwsAlertsSource,
  townshipAlertsSource,
  townshipPageSource,
  townshipEventsSource,
  activenetProgramsSource,
];

export function findSource(name: string): SourceModule | undefined {
  return sources.find((source) => source.name === name);
}
