import type { SourceModule } from "./types";

// The registry. Adding a source = add its folder + one line here.
export const sources: SourceModule[] = [];

export function findSource(name: string): SourceModule | undefined {
  return sources.find((source) => source.name === name);
}
