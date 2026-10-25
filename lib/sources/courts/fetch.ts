import { z } from "zod";
import { ActiveNetClient, FACILITY_GROUPS, fetchAvailability } from "@/lib/activenet/client";
import { politeFetch } from "@/lib/http";
import type { ActiveNetCourt, GisCourt } from "./normalize";

const GIS_URL =
  "https://tharcgis2.thewoodlands-tx.gov/arcgis/rest/services/SPORTS_COURTS/FeatureServer/0/query?" +
  new URLSearchParams({
    where: "COURT_TYPE IN ('Tennis','Pickleball','Pickleball & Tennis') AND STATUS = 'ACTIVE'",
    outFields: "ID,COURT_TYPE,COURTID,PARKNAME,LIGHTED",
    outSR: "4326",
    f: "geojson",
  });

export const gisResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(z.array(z.number()))) }),
      properties: z.object({
        ID: z.string(),
        COURT_TYPE: z.string(),
        COURTID: z.number(),
        PARKNAME: z.string(),
        LIGHTED: z.string().nullable(),
      }),
    }),
  ),
});

export function parseGis(json: unknown): GisCourt[] {
  return gisResponseSchema.parse(json).features.map(({ geometry, properties: p }) => ({
    id: p.ID,
    type: p.COURT_TYPE,
    courtNumber: p.COURTID,
    parkName: p.PARKNAME,
    lighted: p.LIGHTED === "Y",
    polygon: geometry.coordinates,
  }));
}

export async function fetchGisCourts(): Promise<GisCourt[]> {
  const response = await politeFetch(GIS_URL, { headers: { Accept: "application/geo+json" } });
  return parseGis(await response.json());
}

export async function fetchActiveNetCourts(client: ActiveNetClient, date: string): Promise<ActiveNetCourt[]> {
  const courts: ActiveNetCourt[] = [];
  for (const [group, groupId] of Object.entries(FACILITY_GROUPS) as [ActiveNetCourt["group"], number][]) {
    const { resources } = await fetchAvailability(client, groupId, date);
    courts.push(...resources.map((r) => ({ id: r.resource_id, name: r.resource_name, group })));
  }
  return courts;
}
