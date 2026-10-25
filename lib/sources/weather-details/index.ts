import { overwriteAll } from "@/lib/db/upsert";
import { politeFetch } from "@/lib/http";
import type { SourceModule } from "../types";
import { toWeatherDetailRows } from "./normalize";
import { weatherDetails } from "./table";

// The raw gridpoint behind the hourly forecast (same gridpoint as lib/sources/weather):
// gusts, thunder, heat index, WBGT and rain amounts, which the hourly forecast leaves out.
const GRIDPOINT_URL = "https://api.weather.gov/gridpoints/HGX/59,112";

export const weatherDetailsSource: SourceModule = {
  name: "weather-details",
  title: "Storms, gusts & heat",
  origin: "National Weather Service",
  schedule: { live: "7 * * * *", gentle: "7 */6 * * *" }, // hourly / every 6 h

  async run({ db, now, dryRun }) {
    const response = await politeFetch(GRIDPOINT_URL, { headers: { Accept: "application/geo+json" } });
    const rows = toWeatherDetailRows(await response.json(), now.toISOString());

    if (!dryRun) {
      db.transaction((tx) => {
        for (let i = 0; i < rows.length; i += 500) {
          tx.insert(weatherDetails)
            .values(rows.slice(i, i + 500))
            .onConflictDoUpdate({ target: [weatherDetails.date, weatherDetails.hour], set: overwriteAll(weatherDetails) })
            .run();
        }
      });
    }
    return { rows: rows.length };
  },
};
