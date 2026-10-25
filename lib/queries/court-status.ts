import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { courts, parks, scheduleEvents, type ScheduleEvent } from "@/lib/db/tables";
import { bookingClosed, bookingDates, poolOf } from "@/lib/booking-window";
import { labelSlot, type CourtKind, type SlotLabel } from "@/lib/labels";
import { slots } from "@/lib/sources/activenet-slots/table";
import { sunTimes } from "@/lib/sun";
import { chicagoDate, chicagoMinuteOfDay } from "@/lib/time";

/** What a court is: fixed from hour to hour, so the map loads it once (/api/courts/catalog). */
export interface CourtInfo {
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
}

/** A court with its label for one hour. */
export interface CourtStatus extends CourtInfo {
  label: SlotLabel;
  /** Reservable, but too late to book this hour online; the label is the last status seen before booking closed. */
  bookingClosed: boolean;
  /** The hour starts after sunset and the court isn't known to be lit. */
  dark: boolean;
}

/** What changes from hour to hour: the part of a CourtStatus the map fetches for each hour. */
export type HourStatus = Pick<CourtStatus, "id" | "label" | "bookingClosed" | "dark">;

/** Every active court, in park then natural court order ("Tennis 2" before "Tennis 10"). */
export function getCourts(db: Db = getDb()): CourtInfo[] {
  return db
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
    .all()
    .map(({ activenetId, ...court }) => ({ ...court, reservable: activenetId !== null }))
    .sort((a, b) => a.parkName.localeCompare(b.parkName) || a.name.localeCompare(b.name, "en", { numeric: true }));
}

/** Every active court with its label for one Chicago-local date and hour; `now` decides what can be booked. */
export function getCourtStatuses(date: string, hour: number, now: Date, db: Db = getDb()): CourtStatus[] {
  return courtStatusesForDay(date, now, db)(hour);
}

/** Reads a date's courts, slots and events once; the returned function labels any hour of it. */
export function courtStatusesForDay(date: string, now: Date, db: Db = getDb()): (hour: number) => CourtStatus[] {
  const today = chicagoDate(now);
  const courtRows = getCourts(db);

  // hour → court id → status
  const statusByHour = new Map<number, Map<string, "free" | "booked">>();
  for (const row of db.select({ courtId: slots.courtId, hour: slots.hour, status: slots.status }).from(slots).where(eq(slots.date, date)).all()) {
    if (!statusByHour.has(row.hour)) statusByHour.set(row.hour, new Map());
    statusByHour.get(row.hour)!.set(row.courtId, row.status);
  }

  const eventsByPark = Map.groupBy(
    db.select().from(scheduleEvents).where(eq(scheduleEvents.date, date)).all() as ScheduleEvent[],
    (event) => event.parkId,
  );
  const sunsetMinute = chicagoMinuteOfDay(sunTimes(date).sunset);

  return (hour) => {
    const closed = bookingClosed(date, hour, now);
    const statusByCourt = statusByHour.get(hour) ?? new Map<string, "free" | "booked">();

    // A park is "fully booked" for a pool (tennis or pickleball) when every reservable court in it is booked.
    const fullyBooked = new Map<string, boolean>();
    for (const court of courtRows) {
      const status = statusByCourt.get(court.id);
      if (status === undefined) continue;
      const key = `${court.parkId}|${poolOf(court.kind)}`;
      fullyBooked.set(key, (fullyBooked.get(key) ?? true) && status === "booked");
    }

    // Dark when most of the hour falls after sunset.
    const afterSunset = hour * 60 + 30 > sunsetMinute;

    return courtRows.map((court) => {
      const bookable = court.reservable && bookingDates(poolOf(court.kind), today).includes(date);
      return {
        ...court,
        bookingClosed: bookable && closed,
        dark: afterSunset && court.lighted !== true,
        label: labelSlot({
          status: !court.reservable ? null : !bookable ? "not_open" : (statusByCourt.get(court.id) ?? "unknown"),
          hour,
          courtKind: court.kind,
          events: eventsByPark.get(court.parkId) ?? [],
          parkFullyBooked: fullyBooked.get(`${court.parkId}|${poolOf(court.kind)}`) ?? false,
        }),
      };
    });
  };
}
