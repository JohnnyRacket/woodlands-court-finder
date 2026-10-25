import { slots } from "@/lib/sources/activenet-slots/table";
import { weatherAlerts } from "@/lib/sources/nws-alerts/table";
import { rainHours } from "@/lib/sources/rainfall/table";
import { townshipAlerts } from "@/lib/sources/township-alerts/table";
import { parkEvents } from "@/lib/sources/township-events/table";
import { weatherHours } from "@/lib/sources/weather/table";
import { weatherDetails } from "@/lib/sources/weather-details/table";
import { openDb } from "./client";
import { courts, parks, scheduleEvents } from "./tables";

/**
 * A tiny in-memory database for tests: Falconwing with two reservable pickleball courts,
 * two tennis courts (one unlit), and one walk-up court, on 2026-10-26. Rain falls 6–7 a.m.,
 * storms are forecast at 5 p.m., Falconwing's tennis courts are closed, and a heat advisory runs all day.
 */
export function seedSampleDb() {
  const db = openDb(":memory:");
  db.insert(parks).values({ id: "falconwing", name: "Falconwing Park", lat: 30.2, lng: -95.5 }).run();
  const court = (id: string, kind: "tennis" | "pickleball", activenetId: number | null, lighted: boolean | null) => ({
    id,
    parkId: "falconwing",
    name: id,
    kind,
    lighted,
    geometry: null,
    gisId: null,
    activenetId,
  });
  db.insert(courts)
    .values([
      court("pb-1", "pickleball", 1, null),
      court("pb-2", "pickleball", 2, null),
      court("tn-1", "tennis", 3, true),
      court("tn-2", "tennis", 4, false),
      court("pb-walkup", "pickleball", null, true),
    ])
    .run();
  const slot = (courtId: string, hour: number, status: "free" | "booked") => ({ courtId, date: "2026-10-26", hour, status, fetchedAt: "x" });
  db.insert(slots)
    .values([
      slot("pb-1", 8, "booked"),
      slot("pb-2", 8, "booked"),
      slot("tn-1", 8, "booked"),
      slot("tn-2", 8, "free"),
      slot("pb-1", 12, "booked"),
      slot("pb-2", 12, "free"),
      slot("pb-1", 19, "booked"),
      slot("pb-2", 19, "booked"),
    ])
    .run();
  db.insert(scheduleEvents)
    .values({
      id: "drop-in",
      source: "township-page",
      kind: "drop_in",
      title: "Pickleball drop-in play",
      parkId: "falconwing",
      courtKind: "pickleball",
      date: "2026-10-26",
      startMin: 480,
      endMin: 600,
      publicCanJoin: true,
    })
    .run();
  db.insert(weatherHours)
    .values({ date: "2026-10-26", hour: 8, tempF: 60, precipPct: 10, windMph: 5, shortForecast: "Sunny", isDaytime: true, fetchedAt: "x" })
    .run();
  const detail = (hour: number, thunderPct: number) => ({ date: "2026-10-26", hour, gustMph: 12, thunderPct, heatIndexF: null, wbgtF: 70, rainIn: 0, fetchedAt: "x" });
  db.insert(weatherDetails).values([detail(8, 0), detail(17, 45)]).run();
  db.insert(rainHours).values({ date: "2026-10-26", hour: 6, precipIn: 0.15, fetchedAt: "x" }).run();
  const seen = { firstSeenAt: "x", lastSeenAt: "x", active: true };
  db.insert(townshipAlerts)
    .values([
      { id: "closed", title: "Falconwing tennis courts closed", body: "Resurfacing this week.", severity: 30, parkIds: ["falconwing"], aboutCourts: true, ...seen },
      { id: "sprayground", title: "May Valley Sprayground Closed", body: "", severity: 30, parkIds: [], aboutCourts: false, ...seen },
    ])
    .run();
  db.insert(weatherAlerts)
    .values({
      id: "heat",
      event: "Heat Advisory",
      headline: "Heat Advisory until 8 PM",
      severity: "Moderate",
      description: null,
      instruction: null,
      startsAt: "2026-10-26T12:00:00.000Z",
      endsAt: "2026-10-27T01:00:00.000Z",
      ...seen,
    })
    .run();
  db.insert(parkEvents)
    .values({ id: "hunt", title: "Flashlight Candy Hunt", parkId: "falconwing", date: "2026-10-26", startMin: 1170, endMin: null, venue: "Falconwing Park", tags: [], url: "https://example.test/hunt" })
    .run();
  return db;
}
