import { and, eq, notInArray } from "drizzle-orm";
import { parks } from "@/lib/db/tables";
import { politeFetch } from "@/lib/http";
import type { SourceModule } from "../types";
import { PAGE_URL, parseAlerts, SOURCE } from "./normalize";
import { townshipAlerts } from "./table";

// Closures and notices from the banner the Township shows across thewoodlandsparks.com.
export const townshipAlertsSource: SourceModule = {
  name: SOURCE,
  title: "Township closure alerts",
  origin: "thewoodlandsparks.com",
  schedule: { live: "*/30 6-22 * * *", gentle: "20 */6 * * *" }, // every 30 min while courts are open / every 6 h

  async run({ db, now, dryRun }) {
    const knownParks = db.select({ id: parks.id, name: parks.name }).from(parks).all();
    if (knownParks.length === 0) throw new Error("No parks yet; run the courts source first");

    const response = await politeFetch(PAGE_URL, { headers: { Accept: "text/html" } });
    const alerts = parseAlerts(await response.text(), knownParks);
    const seenAt = now.toISOString();

    if (!dryRun) {
      db.transaction((tx) => {
        for (const alert of alerts) {
          tx.insert(townshipAlerts)
            .values({ ...alert, firstSeenAt: seenAt, lastSeenAt: seenAt, active: true })
            .onConflictDoUpdate({
              target: townshipAlerts.id,
              set: { title: alert.title, body: alert.body, severity: alert.severity, parkIds: alert.parkIds, aboutCourts: alert.aboutCourts, lastSeenAt: seenAt, active: true },
            })
            .run();
        }
        // Anything no longer on the page has come down.
        const gone = alerts.length ? notInArray(townshipAlerts.id, alerts.map((a) => a.id)) : undefined;
        tx.update(townshipAlerts).set({ active: false }).where(and(eq(townshipAlerts.active, true), gone)).run();
      });
    }
    return { rows: alerts.length };
  },
};
