import type { CourtInfo, CourtStatus, HourStatus } from "@/lib/queries/court-status";

export type Sport = "tennis" | "pickleball";
export const SPORTS: Sport[] = ["tennis", "pickleball"];

export interface Filters {
  sports: Sport[];
  joinableOnly: boolean;
  litOnly: boolean;
}

export interface SportSummary {
  /** Courts you can play this sport on. Tennis courts with pickleball lines count for both. */
  courts: CourtStatus[];
  /** Of those, how many you can walk onto now (no reservation, first come, open play; not dark). */
  joinable: number;
}

export interface ParkSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Every court at the park that passed the filters, each listed once. */
  courts: CourtStatus[];
  sports: Partial<Record<Sport, SportSummary>>;
  joinable: number;
  openPlay: boolean;
}

export const playsSport = (court: CourtStatus, sport: Sport) => court.kind === sport || court.kind === "tennis_pickleball";

const canPlay = (court: CourtStatus) => court.label.publicCanJoin && !court.dark;

/** The courts (loaded once) with their labels for the shown hour, in the hour's order; a court missing from either is left out. */
export function withHourStatus(catalog: Map<string, CourtInfo>, hour: HourStatus[]): CourtStatus[] {
  return hour.flatMap((status) => {
    const court = catalog.get(status.id);
    return court ? [{ ...court, ...status }] : [];
  });
}

export function filterCourts(courts: CourtStatus[], filters: Filters): CourtStatus[] {
  return courts.filter(
    (court) =>
      filters.sports.some((sport) => playsSport(court, sport)) &&
      (!filters.joinableOnly || court.label.publicCanJoin) &&
      (!filters.litOnly || court.lighted === true),
  );
}

export function summarizeParks(courts: CourtStatus[], sports: Sport[]): ParkSummary[] {
  // Not Map.groupBy: it needs Safari 17.4, and Next supports 16.4.
  const byPark = new Map<string, CourtStatus[]>();
  for (const court of courts) {
    const list = byPark.get(court.parkId);
    if (list) list.push(court);
    else byPark.set(court.parkId, [court]);
  }
  return [...byPark.values()]
    .map((list) => {
      const bySport: Partial<Record<Sport, SportSummary>> = {};
      for (const sport of sports) {
        const sportCourts = list.filter((court) => playsSport(court, sport));
        if (sportCourts.length) bySport[sport] = { courts: sportCourts, joinable: sportCourts.filter(canPlay).length };
      }
      return {
        id: list[0].parkId,
        name: list[0].parkName,
        lat: list[0].parkLat,
        lng: list[0].parkLng,
        courts: list,
        sports: bySport,
        joinable: list.filter(canPlay).length,
        openPlay: list.some((court) => court.label.kind === "open_play"),
      };
    })
    .sort((a, b) => Number(b.joinable > 0) - Number(a.joinable > 0) || a.name.localeCompare(b.name));
}
