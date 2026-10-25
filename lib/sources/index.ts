import { activenetProgramsSource } from "./activenet-programs";
import { activenetSlotsSource } from "./activenet-slots";
import { courtsSource } from "./courts";
import { townshipPageSource } from "./township-page";
import type { SourceModule } from "./types";
import { weatherSource } from "./weather";

// The registry. Adding a source = add its folder + one line here.
// Order matters on boot: courts first, since the others reference it; the slow
// programs crawl goes last so live data fills in first.
export const sources: SourceModule[] = [
  courtsSource,
  activenetSlotsSource,
  weatherSource,
  townshipPageSource,
  activenetProgramsSource,
];

export function findSource(name: string): SourceModule | undefined {
  return sources.find((source) => source.name === name);
}
