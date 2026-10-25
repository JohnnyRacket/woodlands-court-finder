// One park-name normalization shared by every source, so "COPPER SAGE PARK" (GIS),
// "Coppersage Tennis 1" (ActiveNet) and "FALCONWING" (Township page) all meet on one key.

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "GROGAN'S POINT PARK" → "groganspoint" */
export const parkKey = (parkName: string) => compact(parkName.replace(/\s+park$/i, ""));

/** Every park whose key appears in free text, e.g. "Sawmill & Shadowbend Tennis Courts" → both. */
export function parksMentionedIn<T extends { name: string }>(text: string, parks: T[]): T[] {
  const haystack = compact(text);
  return parks.filter((park) => haystack.includes(parkKey(park.name)));
}
