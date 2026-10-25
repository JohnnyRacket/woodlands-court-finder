import { slugify } from "@/lib/slug";

// Joins Township GIS court outlines with ActiveNet's reservable courts.
// Matching is deterministic: same park + same court number + compatible kind.
// Anything that doesn't line up is kept (with what we know) and reported as a note.

export type CourtKind = "tennis" | "pickleball" | "tennis_pickleball";

export interface GisCourt {
  id: string;
  type: string;
  courtNumber: number;
  parkName: string;
  lighted: boolean;
  polygon: number[][][];
}

export interface ActiveNetCourt {
  id: number;
  name: string;
  group: "tennis" | "pickleball";
}

export interface ParkRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface CourtRow {
  id: string;
  parkId: string;
  name: string;
  kind: CourtKind;
  lighted: boolean | null;
  geometry: string | null;
  gisId: string | null;
  activenetId: number | null;
}

const GIS_KINDS: Record<string, CourtKind> = {
  Tennis: "tennis",
  "Pickleball & Tennis": "tennis_pickleball",
  Pickleball: "pickleball",
};

const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "GROGAN'S POINT PARK" → "groganspoint" */
export const gisParkKey = (parkName: string) => compact(parkName.replace(/\s+park$/i, ""));

/** "Timarron Tennis Court #1" → { parkKey: "timarron", number: 1 } */
export function parseActiveNetName(name: string): { parkKey: string; number: number } | null {
  const match = name.match(/^(.*?)\s*#?(\d+)$/);
  if (!match) return null;
  return { parkKey: compact(match[1].replace(/tennis|pickleball|court/gi, "")), number: Number(match[2]) };
}

const titleCase = (text: string) => text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function centroid(polygons: number[][][][]): { lat: number; lng: number } {
  const points = polygons.flatMap((polygon) => polygon[0]);
  const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

const poolOf = (kind: CourtKind) => (kind === "pickleball" ? "pickleball" : "tennis");

export function buildReference(gis: GisCourt[], activenet: ActiveNetCourt[]) {
  const notes: string[] = [];

  // Parks come from GIS, since that's where locations live.
  const gisByPark = new Map<string, GisCourt[]>();
  for (const court of gis) {
    const key = gisParkKey(court.parkName);
    gisByPark.set(key, [...(gisByPark.get(key) ?? []), court]);
  }
  const parks = new Map<string, ParkRow>();
  for (const [key, list] of gisByPark) {
    const name = titleCase(list[0].parkName);
    parks.set(key, { id: slugify(name.replace(/\s+park$/i, "")), name, ...centroid(list.map((c) => c.polygon)) });
  }

  const duplicateIds = [...Map.groupBy(gis, (c) => c.id)].filter(([, list]) => list.length > 1);
  for (const [id, list] of duplicateIds) {
    notes.push(`GIS ID ${id} is used by ${list.length} courts (${list.map((c) => `${titleCase(c.parkName)} #${c.courtNumber}`).join(", ")})`);
  }

  const unmatchedGis = new Map<string, GisCourt>();
  for (const court of gis) {
    const kind = GIS_KINDS[court.type];
    if (!kind) {
      notes.push(`GIS court ${court.id} has unknown type "${court.type}"; skipped`);
      continue;
    }
    const key = `${poolOf(kind)}|${gisParkKey(court.parkName)}|${court.courtNumber}`;
    if (unmatchedGis.has(key)) notes.push(`Two GIS courts claim ${titleCase(court.parkName)} ${poolOf(kind)} #${court.courtNumber}; using the first`);
    else unmatchedGis.set(key, court);
  }

  const courts: CourtRow[] = [];
  const noOutline: string[] = [];

  const toRow = (park: ParkRow, kind: CourtKind, number: number, gisCourt?: GisCourt, activenetId?: number): CourtRow => {
    const label = kind === "pickleball" ? "pickleball" : "tennis";
    return {
      id: `${park.id}-${label}-${number}`,
      parkId: park.id,
      name: `${park.name.replace(/\s+Park$/, "")} ${titleCase(label)} ${number}`,
      kind,
      lighted: gisCourt?.lighted ?? null,
      geometry: gisCourt ? JSON.stringify({ type: "Polygon", coordinates: gisCourt.polygon }) : null,
      gisId: gisCourt?.id ?? null,
      activenetId: activenetId ?? null,
    };
  };

  for (const court of activenet) {
    const parsed = parseActiveNetName(court.name);
    const park = parsed && parks.get(parsed.parkKey);
    if (!parsed || !park) {
      notes.push(`ActiveNet court "${court.name}" (${court.id}) doesn't match any GIS park; skipped`);
      continue;
    }
    const key = `${court.group}|${parsed.parkKey}|${parsed.number}`;
    const gisCourt = unmatchedGis.get(key);
    unmatchedGis.delete(key);
    if (!gisCourt) noOutline.push(court.name);
    const kind = gisCourt ? GIS_KINDS[gisCourt.type] : court.group;
    courts.push(toRow(park, kind, parsed.number, gisCourt, court.id));
  }

  if (noOutline.length) {
    notes.push(`${noOutline.length} ActiveNet court(s) have no GIS outline: ${noOutline.join(", ")}`);
  }

  const notReservable = [...unmatchedGis.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const gisCourt of notReservable) {
    const park = parks.get(gisParkKey(gisCourt.parkName))!;
    courts.push(toRow(park, GIS_KINDS[gisCourt.type], gisCourt.courtNumber, gisCourt));
  }
  if (notReservable.length) {
    notes.push(`${notReservable.length} GIS court(s) aren't reservable in ActiveNet: ${notReservable.map((c) => c.id).join(", ")}`);
  }

  return { parks: [...parks.values()], courts, notes };
}
