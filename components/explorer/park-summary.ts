import { LABEL_META } from "@/lib/label-meta";
import type { CourtStatus } from "@/lib/queries/court-status";

export type Sport = "tennis" | "pickleball";

export interface Filters {
  sports: Sport[];
  joinableOnly: boolean;
  litOnly: boolean;
}

export interface ParkSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  courts: CourtStatus[];
  /** Courts someone can walk onto (no reservation, first come, or open play). */
  joinable: number;
  openPlay: boolean;
  /** Marker color: the most useful status at the park. */
  color: string;
}

const playsSport = (court: CourtStatus, sport: Sport) => court.kind === sport || court.kind === "tennis_pickleball";

export function filterCourts(courts: CourtStatus[], filters: Filters): CourtStatus[] {
  return courts.filter(
    (court) =>
      filters.sports.some((sport) => playsSport(court, sport)) &&
      (!filters.joinableOnly || court.label.publicCanJoin) &&
      (!filters.litOnly || court.lighted === true),
  );
}

export function summarizeParks(courts: CourtStatus[]): ParkSummary[] {
  const byPark = Map.groupBy(courts, (court) => court.parkId);
  return [...byPark.values()]
    .map((list) => {
      const joinable = list.filter((court) => court.label.publicCanJoin && !court.dark).length;
      const openPlay = list.some((court) => court.label.kind === "open_play");
      const allNoData = list.every((court) => court.label.kind === "no_data");
      const color = allNoData
        ? LABEL_META.no_data.color
        : openPlay
          ? LABEL_META.open_play.color
          : joinable > 0
            ? LABEL_META.no_reservation.color
            : LABEL_META.private.color;
      return { id: list[0].parkId, name: list[0].parkName, lat: list[0].parkLat, lng: list[0].parkLng, courts: list, joinable, openPlay, color };
    })
    .sort((a, b) => Number(b.joinable > 0) - Number(a.joinable > 0) || a.name.localeCompare(b.name));
}
