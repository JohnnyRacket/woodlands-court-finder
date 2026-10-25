import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Shared tables. parks and courts are reference data written only by the `courts`
// source; any source or query may read them. Source-owned tables live in
// lib/sources/<name>/table.ts.

export const parks = sqliteTable("parks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
});

export const courts = sqliteTable("courts", {
  id: text("id").primaryKey(),
  parkId: text("park_id")
    .notNull()
    .references(() => parks.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["tennis", "pickleball", "tennis_pickleball"] }).notNull(),
  /** null = unknown (no GIS record) */
  lighted: integer("lighted", { mode: "boolean" }),
  /** GeoJSON Polygon; null when GIS has no outline for the court */
  geometry: text("geometry"),
  gisId: text("gis_id"),
  activenetId: integer("activenet_id").unique(),
  /** false once a court disappears from both upstreams; kept so its history survives */
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// Scheduled uses of courts (drop-in, programs, tournaments). Shared by several sources;
// each source replaces only rows where source = its own name (see lib/db/events.ts).
// Times are Chicago-local minutes from midnight, matching slots' date + hour keys.
export const scheduleEvents = sqliteTable(
  "schedule_events",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    kind: text("kind", { enum: ["drop_in", "program", "tournament"] }).notNull(),
    title: text("title").notNull(),
    parkId: text("park_id")
      .notNull()
      .references(() => parks.id),
    /** Which courts at the park it uses; null = any */
    courtKind: text("court_kind", { enum: ["tennis", "pickleball"] }),
    date: text("date").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    publicCanJoin: integer("public_can_join", { mode: "boolean" }).notNull(),
    url: text("url"),
  },
  (table) => [index("schedule_events_park_date").on(table.parkId, table.date)],
);

export type ScheduleEvent = typeof scheduleEvents.$inferInsert;

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  rows: integer("rows").notNull().default(0),
  error: text("error"),
  /** JSON array of data-quality notes reported by the source */
  notes: text("notes", { mode: "json" }).$type<string[]>(),
});
