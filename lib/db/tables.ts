import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// Shared tables. Source-owned tables live in lib/sources/<name>/table.ts.

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
  lighted: integer("lighted", { mode: "boolean" }).notNull(),
  geometry: text("geometry").notNull(),
  gisId: text("gis_id"),
  activenetId: integer("activenet_id"),
});

export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  rows: integer("rows").notNull().default(0),
  error: text("error"),
});
