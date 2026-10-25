import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Announcements from the parks site banner. Rows are never deleted: when an announcement
// comes down it's marked inactive, so first/last seen record how long a closure lasted.
export const townshipAlerts = sqliteTable("township_alerts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  severity: integer("severity").notNull(),
  /** JSON array of park ids named in the alert */
  parkIds: text("park_ids", { mode: "json" }).$type<string[]>().notNull(),
  aboutCourts: integer("about_courts", { mode: "boolean" }).notNull(),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
});
