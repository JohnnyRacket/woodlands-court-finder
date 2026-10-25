import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
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

// Every status change seen between syncs: when each hour was booked or freed, and how far
// ahead. slots holds only the latest state; this is the history behind it.
// Caveat: ActiveNet reports an hour as taken once it can't be booked any more (past hours,
// and the next hour from about half past), so free → booked changes observed within an hour
// of the slot's start are mostly that cutoff, not reservations.
export const slotChanges = sqliteTable(
  "slot_changes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    courtId: text("court_id")
      .notNull()
      .references(() => courts.id),
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    status: text("status", { enum: ["free", "booked"] }).notNull(),
    /** null the first time this court-hour was seen */
    previousStatus: text("previous_status", { enum: ["free", "booked"] }),
    observedAt: text("observed_at").notNull(),
  },
  (table) => [index("slot_changes_date_court").on(table.date, table.courtId)],
);
