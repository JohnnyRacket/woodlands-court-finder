import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Playing-condition details from the NWS gridpoint forecast, keyed like weather_hours.
// Past hours are kept, so this doubles as a record of the forecast at the time.
export const weatherDetails = sqliteTable(
  "weather_details",
  {
    date: text("date").notNull(),
    hour: integer("hour").notNull(),
    gustMph: integer("gust_mph"),
    thunderPct: integer("thunder_pct"),
    heatIndexF: integer("heat_index_f"),
    wbgtF: integer("wbgt_f"),
    /** Forecast rain for the hour, inches */
    rainIn: real("rain_in"),
    fetchedAt: text("fetched_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.hour] })],
);
