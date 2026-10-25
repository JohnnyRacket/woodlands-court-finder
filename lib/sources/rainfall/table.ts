import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Rain that has fallen at The Woodlands, hour by hour (a model estimate, not a gauge).
// Kept indefinitely: this is the rainfall history.
export const rainHours = sqliteTable(
  "rain_hours",
  {
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    precipIn: real("precip_in").notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.hour] })],
);
