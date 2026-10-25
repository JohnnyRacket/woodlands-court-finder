import { parkKey } from "@/lib/park-key";
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

/** "Timarron Tennis Court #1" → { parkKey: "timarron", number: 1 } */
export function parseActiveNetName(name: string): { parkKey: string; number: number } | null {
  const match = name.match(/^(.*?)\s*#?(\d+)$/);
  if (!match) return null;
  return { parkKey: compact(match[1].replace(/tennis|pickleball|court/gi, "")), number: Number(match[2]) };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
    const key = parkKey(court.parkName);
    gisByPark.set(key, [...(gisByPark.get(key) ?? []), court]);
  }
  const parks = new Map<string, ParkRow>();
  for (const [key, list] of gisByPark) {
    const name = titleCase(list[0].parkName);
    parks.set(key, { id: slugify(name.replace(/\s+park$/i, "")), name, ...centroid(list.map((c) => c.polygon)) });
  }

  const duplicateIds = [...Map.groupBy(gis, (c) => c.id)].filter(([, list]) => list.length > 1);
  for (const [id, list] of duplicateIds) {
    notes.push(`${list.length} courts share the GIS ID ${id}: ${list.map((c) => `${titleCase(c.parkName)} #${c.courtNumber}`).join(" and ")}`);
  }

  const unmatchedGis = new Map<string, GisCourt>();
  for (const court of gis) {
    const kind = GIS_KINDS[court.type];
    if (!kind) {
      notes.push(`A court on the GIS map has a type we don't recognize: "${court.type}" (${court.id})`);
      continue;
    }
    const key = `${poolOf(kind)}|${parkKey(court.parkName)}|${court.courtNumber}`;
    if (unmatchedGis.has(key)) notes.push(`Two courts on the GIS map are both ${titleCase(court.parkName)} ${poolOf(kind)} #${court.courtNumber}`);
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
      notes.push(`A bookable court doesn't match any park on the GIS map: "${court.name}" (ActiveNet ${court.id})`);
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
    notes.push(`${plural(noOutline.length, "bookable court is", "bookable courts are")} missing from the Township GIS map: ${noOutline.join(", ")}`);
  }

  const notReservable = [...unmatchedGis.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const gisCourt of notReservable) {
    const park = parks.get(parkKey(gisCourt.parkName))!;
    courts.push(toRow(park, GIS_KINDS[gisCourt.type], gisCourt.courtNumber, gisCourt));
  }
  if (notReservable.length) {
    notes.push(`${plural(notReservable.length, "court on the GIS map can't", "courts on the GIS map can't")} be booked online: ${notReservable.map((c) => c.id).join(", ")}`);
  }

  return { parks: [...parks.values()], courts, notes };
}
