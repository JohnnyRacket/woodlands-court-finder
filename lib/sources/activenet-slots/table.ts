import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { courts } from "../../db/tables";

// One row per court per hour. Past dates are kept, so this doubles as booking history.
export const slots = sqliteTable(
  "slots",
  {
    courtId: text("court_id")
      .notNull()
      .references(() => courts.id),
    date: text("date").notNull(),
    /** Start hour, 7–22, America/Chicago */
    hour: integer("hour").notNull(),
    status: text("status", { enum: ["free", "booked"] }).notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.courtId, table.date, table.hour] })],
);
