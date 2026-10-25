import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// NWS hourly forecast for The Woodlands, keyed by Chicago date + hour like slots.
// Past hours are kept, so this doubles as a record of the forecast at the time.
export const weatherHours = sqliteTable(
  "weather_hours",
  {
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    tempF: integer("temp_f").notNull(),
    precipPct: integer("precip_pct").notNull(),
    windMph: integer("wind_mph").notNull(),
    shortForecast: text("short_forecast").notNull(),
    isDaytime: integer("is_daytime", { mode: "boolean" }).notNull(),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.hour] })],
);
