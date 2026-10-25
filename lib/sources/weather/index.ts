import { politeFetch } from "@/lib/http";
import { overwriteAll } from "@/lib/db/upsert";
import type { SourceModule } from "../types";
import { toWeatherRows } from "./normalize";
import { weatherHours } from "./table";

// NWS gridpoint covering The Woodlands, from api.weather.gov/points/30.1658,-95.4613.
// Gridpoints rarely change; if this one does, NWS returns an error and the run fails loudly.
const FORECAST_URL = "https://api.weather.gov/gridpoints/HGX/59,112/forecast/hourly";

export const weatherSource: SourceModule = {
  name: "weather",
  schedule: { live: "5 * * * *", gentle: "5 */6 * * *" }, // hourly / every 6 h

  async run({ db, now, dryRun }) {
    const response = await politeFetch(FORECAST_URL, { headers: { Accept: "application/geo+json" } });
    const rows = toWeatherRows(await response.json(), now.toISOString());

    if (!dryRun) {
      db.transaction((tx) => {
        for (let i = 0; i < rows.length; i += 500) {
          tx.insert(weatherHours)
            .values(rows.slice(i, i + 500))
            .onConflictDoUpdate({ target: [weatherHours.date, weatherHours.hour], set: overwriteAll(weatherHours) })
            .run();
        }
      });
    }
    return { rows: rows.length };
  },
};
