import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// NWS watches, warnings and advisories for The Woodlands. Rows are kept after an alert
// ends (active = false), so this doubles as a record of past weather hazards.
export const weatherAlerts = sqliteTable("weather_alerts", {
  id: text("id").primaryKey(),
  event: text("event").notNull(),
  headline: text("headline"),
  severity: text("severity").notNull(),
  description: text("description"),
  instruction: text("instruction"),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
});
