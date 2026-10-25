import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { courts, parks, scheduleEvents, type ScheduleEvent } from "@/lib/db/tables";
import { labelSlot, type CourtKind, type SlotLabel } from "@/lib/labels";
import { slots } from "@/lib/sources/activenet-slots/table";
import { sunTimes } from "@/lib/sun";
import { chicagoMinuteOfDay } from "@/lib/time";

export interface CourtStatus {
  id: string;
  name: string;
  kind: CourtKind;
  parkId: string;
  parkName: string;
  /** null = unknown */
  lighted: boolean | null;
  /** GeoJSON Polygon, or null when GIS has no outline */
  geometry: string | null;
  parkLat: number;
  parkLng: number;
  reservable: boolean;
  label: SlotLabel;
  /** The hour starts after sunset and the court isn't known to be lit. */
  dark: boolean;
}

const pool = (kind: CourtKind) => (kind === "pickleball" ? "pickleball" : "tennis");

/** Every active court with its label for one Chicago-local date and hour. */
export function getCourtStatuses(date: string, hour: number, db: Db = getDb()): CourtStatus[] {
  const courtRows = db
    .select({
      id: courts.id,
      name: courts.name,
      kind: courts.kind,
      parkId: courts.parkId,
      parkName: parks.name,
      lighted: courts.lighted,
      geometry: courts.geometry,
      parkLat: parks.lat,
      parkLng: parks.lng,
      activenetId: courts.activenetId,
    })
    .from(courts)
    .innerJoin(parks, eq(parks.id, courts.parkId))
    .where(eq(courts.active, true))
    .orderBy(parks.name, courts.name)
    .all();

  const statusByCourt = new Map(
    db
      .select({ courtId: slots.courtId, status: slots.status })
      .from(slots)
      .where(and(eq(slots.date, date), eq(slots.hour, hour)))
      .all()
      .map((row) => [row.courtId, row.status]),
  );

  const eventsByPark = Map.groupBy(
    db.select().from(scheduleEvents).where(eq(scheduleEvents.date, date)).all() as ScheduleEvent[],
    (event) => event.parkId,
  );

  // A park is "fully booked" for a pool (tennis or pickleball) when every reservable court in it is booked.
  const fullyBooked = new Map<string, boolean>();
  for (const court of courtRows) {
    const status = statusByCourt.get(court.id);
    if (status === undefined) continue;
    const key = `${court.parkId}|${pool(court.kind)}`;
    fullyBooked.set(key, (fullyBooked.get(key) ?? true) && status === "booked");
  }

  // Dark when most of the hour falls after sunset.
  const afterSunset = hour * 60 + 30 > chicagoMinuteOfDay(sunTimes(date).sunset);

  return courtRows.map(({ activenetId, ...court }) => ({
    ...court,
    reservable: activenetId !== null,
    dark: afterSunset && court.lighted !== true,
    label: labelSlot({
      status: activenetId === null ? null : (statusByCourt.get(court.id) ?? "unknown"),
      hour,
      courtKind: court.kind,
      events: eventsByPark.get(court.parkId) ?? [],
      parkFullyBooked: fullyBooked.get(`${court.parkId}|${pool(court.kind)}`) ?? false,
    }),
  }));
}
