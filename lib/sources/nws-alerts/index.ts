import { and, eq, notInArray } from "drizzle-orm";
import { politeFetch } from "@/lib/http";
import type { SourceModule } from "../types";
import { toWeatherAlerts } from "./normalize";
import { weatherAlerts } from "./table";

// The same point the forecast uses (see lib/sources/weather).
const ALERTS_URL = "https://api.weather.gov/alerts/active?point=30.1658,-95.4613";

export const nwsAlertsSource: SourceModule = {
  name: "nws-alerts",
  title: "Weather alerts",
  origin: "National Weather Service",
  schedule: { live: "*/15 6-22 * * *", gentle: "40 */3 * * *" }, // every 15 min while courts are open / every 3 h

  async run({ db, now, dryRun }) {
    const response = await politeFetch(ALERTS_URL, { headers: { Accept: "application/geo+json" } });
    const alerts = toWeatherAlerts(await response.json());
    const seenAt = now.toISOString();

    if (!dryRun) {
      db.transaction((tx) => {
        for (const alert of alerts) {
          tx.insert(weatherAlerts)
            .values({ ...alert, firstSeenAt: seenAt, lastSeenAt: seenAt, active: true })
            .onConflictDoUpdate({ target: weatherAlerts.id, set: { ...alert, lastSeenAt: seenAt, active: true } })
            .run();
        }
        // Anything NWS no longer lists has ended or been replaced.
        const gone = alerts.length ? notInArray(weatherAlerts.id, alerts.map((a) => a.id)) : undefined;
        tx.update(weatherAlerts).set({ active: false }).where(and(eq(weatherAlerts.active, true), gone)).run();
      });
    }
    return { rows: alerts.length };
  },
};
