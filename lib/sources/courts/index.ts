import { notInArray } from "drizzle-orm";
import { ActiveNetClient } from "@/lib/activenet/client";
import { courts, parks } from "@/lib/db/tables";
import { overwriteAll } from "@/lib/db/upsert";
import { chicagoDate } from "@/lib/time";
import type { SourceModule } from "../types";
import { fetchActiveNetCourts, fetchGisCourts } from "./fetch";
import { buildReference } from "./normalize";

// Reference data: parks and courts, joined from Township GIS + ActiveNet.
export const courtsSource: SourceModule = {
  name: "courts",
  schedule: { live: "0 4 * * *", gentle: "0 4 * * 1" }, // daily / weekly

  async run({ db, now, dryRun, log }) {
    const gis = await fetchGisCourts();
    const activenet = await fetchActiveNetCourts(new ActiveNetClient(), chicagoDate(now));
    if (gis.length === 0 || activenet.length === 0) {
      throw new Error(`Refusing to update courts: got ${gis.length} GIS and ${activenet.length} ActiveNet courts`);
    }

    const reference = buildReference(gis, activenet);
    for (const note of reference.notes) log(note);

    if (!dryRun) {
      db.transaction((tx) => {
        tx.insert(parks).values(reference.parks).onConflictDoUpdate({ target: parks.id, set: overwriteAll(parks) }).run();
        tx.insert(courts)
          .values(reference.courts.map((court) => ({ ...court, active: true })))
          .onConflictDoUpdate({ target: courts.id, set: overwriteAll(courts) })
          .run();
        tx.update(courts)
          .set({ active: false })
          .where(notInArray(courts.id, reference.courts.map((court) => court.id)))
          .run();
      });
    }

    return { rows: reference.courts.length, notes: reference.notes };
  },
};
