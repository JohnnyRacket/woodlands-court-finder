import { slots } from "@/lib/sources/activenet-slots/table";
import { weatherHours } from "@/lib/sources/weather/table";
import { openDb } from "./client";
import { courts, parks, scheduleEvents } from "./tables";

/**
 * A tiny in-memory database for tests: Falconwing with two reservable pickleball courts,
 * two tennis courts (one unlit), and one walk-up court, on 2026-10-26.
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
  return db;
}
