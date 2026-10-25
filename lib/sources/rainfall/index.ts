import { overwriteAll } from "@/lib/db/upsert";
import { politeFetch } from "@/lib/http";
import type { SourceModule } from "../types";
import { toRainRows } from "./normalize";
import { rainHours } from "./table";

// Recent rain, to tell whether courts are likely still wet. Nearby airport stations don't
// report hourly rain, so this uses Open-Meteo's estimate for the township center (free for
// non-commercial use, no key). Times are requested in UTC and converted once, here.
const RAIN_URL =
  "https://api.open-meteo.com/v1/forecast?" +
  new URLSearchParams({
    latitude: "30.1658",
    longitude: "-95.4613",
    hourly: "precipitation",
    past_days: "2",
    forecast_days: "1",
    timezone: "GMT",
    precipitation_unit: "inch",
  });

export const rainfallSource: SourceModule = {
  name: "rainfall",
  title: "Recent rainfall",
  origin: "Open-Meteo (estimate)",
  schedule: { live: "12 * * * *", gentle: "12 */6 * * *" }, // hourly / every 6 h

  async run({ db, now, dryRun }) {
    const response = await politeFetch(RAIN_URL, { headers: { Accept: "application/json" } });
    // Recent hours are revised as observations come in, so every run overwrites them.
    const rows = toRainRows(await response.json(), now, now.toISOString());

    if (!dryRun) {
      db.transaction((tx) => {
        tx.insert(rainHours)
          .values(rows)
          .onConflictDoUpdate({ target: [rainHours.date, rainHours.hour], set: overwriteAll(rainHours) })
          .run();
      });
    }
    return { rows: rows.length };
  },
};
