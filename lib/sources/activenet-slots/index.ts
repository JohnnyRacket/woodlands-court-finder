import { inArray, isNotNull } from "drizzle-orm";
import { ActiveNetClient, FACILITY_GROUPS, fetchAvailability } from "@/lib/activenet/client";
import { courts } from "@/lib/db/tables";
import { addDays, chicagoDate } from "@/lib/time";
import type { SourceModule } from "../types";
import { toSlotRows, type SlotRow } from "./normalize";
import { slots } from "./table";

// Hourly reservation status for today and tomorrow (residents can book 1 day ahead).
export const activenetSlotsSource: SourceModule = {
  name: "activenet-slots",
  schedule: { live: "*/15 7-22 * * *", gentle: "0 8-20/3 * * *" }, // every 15 min / every 3 h

  async run({ db, now, dryRun, log }) {
    const known = db
      .select({ id: courts.id, activenetId: courts.activenetId })
      .from(courts)
      .where(isNotNull(courts.activenetId))
      .all();
    if (known.length === 0) throw new Error("No ActiveNet courts in the courts table yet; run the courts source first");
    const courtIdByActiveNetId = new Map(known.map((c) => [c.activenetId!, c.id]));

    const today = chicagoDate(now);
    const dates = [today, addDays(today, 1)];
    const fetchedAt = now.toISOString();
    const client = new ActiveNetClient();
    const rows: SlotRow[] = [];
    const notes: string[] = [];

    for (const date of dates) {
      for (const groupId of Object.values(FACILITY_GROUPS)) {
        const result = toSlotRows(await fetchAvailability(client, groupId, date), date, courtIdByActiveNetId, fetchedAt);
        rows.push(...result.rows);
        if (result.unknownCourts.length) {
          notes.push(`${date}: ActiveNet returned courts not in the courts table: ${result.unknownCourts.join(", ")}`);
        }
      }
    }
    for (const note of notes) log(note);

    if (!dryRun) {
      db.transaction((tx) => {
        tx.delete(slots).where(inArray(slots.date, dates)).run();
        for (let i = 0; i < rows.length; i += 500) tx.insert(slots).values(rows.slice(i, i + 500)).run();
      });
    }
    return { rows: rows.length, notes };
  },
};
