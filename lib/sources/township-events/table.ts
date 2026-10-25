import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { parks } from "../../db/tables";

// Township events (festivals, concerts, kids' events) at parks with courts. They don't
// reserve courts, so labels ignore them; they warn of crowds and full parking.
// Rows before today are kept as history.
export const parkEvents = sqliteTable(
  "park_events",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    parkId: text("park_id")
      .notNull()
      .references(() => parks.id),
    date: text("date").notNull(),
    /** Chicago-local minutes from midnight; null when the Township lists no time */
    startMin: integer("start_min"),
    endMin: integer("end_min"),
    venue: text("venue").notNull(),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    url: text("url").notNull(),
  },
  (table) => [index("park_events_date").on(table.date)],
);

export type ParkEvent = typeof parkEvents.$inferSelect;
