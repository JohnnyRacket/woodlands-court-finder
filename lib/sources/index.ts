import { courtsSource } from "./courts";
import type { SourceModule } from "./types";

// The registry. Adding a source = add its folder + one line here.
// Order matters on boot: courts first, since other sources reference it.
export const sources: SourceModule[] = [courtsSource];

export function findSource(name: string): SourceModule | undefined {
  return sources.find((source) => source.name === name);
}
