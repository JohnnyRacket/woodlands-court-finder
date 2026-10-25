import { inArray, isNotNull } from "drizzle-orm";
import { ActiveNetClient, FACILITY_GROUPS, fetchAvailability } from "@/lib/activenet/client";
import { courts } from "@/lib/db/tables";
import { allBookingDates, bookingDates, readWhileBookable, type Pool } from "@/lib/booking-window";
import { chicagoDate } from "@/lib/time";
import type { SourceModule } from "../types";
import { diffSlots, keepLastOpenStatus, toSlotRows, type SlotRow } from "./normalize";
import { slotChanges, slots } from "./table";

// Hourly reservation status for every date residents can book (see lib/booking-window.ts).
export const activenetSlotsSource: SourceModule = {
  name: "activenet-slots",
  title: "Court reservations",
  origin: "Township ActiveNet",
  // every 15 min / every 3 h, plus 12:01 a.m. to pick up the day that opens at midnight.
  // Live runs at :10, :25, :40, :55 from 5 a.m.: booking for an hour closes at the top of the hour
  // before, so the :55 run is the last reading of the hour after next (1:55 for 3 p.m., 5:55 for 7 a.m.).
  schedule: { live: ["10-55/15 5-22 * * *", "1 0 * * *"], gentle: ["0 8-20/3 * * *", "1 0 * * *"] },

  async run({ db, now, dryRun, log }) {
    const known = db
      .select({ id: courts.id, activenetId: courts.activenetId })
      .from(courts)
      .where(isNotNull(courts.activenetId))
      .all();
    if (known.length === 0) throw new Error("No ActiveNet courts in the courts table yet; run the courts source first");
    const courtIdByActiveNetId = new Map(known.map((c) => [c.activenetId!, c.id]));

    const today = chicagoDate(now);
    const dates = allBookingDates(today);
    const client = new ActiveNetClient();
    const rows: SlotRow[] = [];
    const notes: string[] = [];

    // Only within each group's window: ActiveNet marks hours past it unavailable, which would read as booked.
    for (const [pool, groupId] of Object.entries(FACILITY_GROUPS) as [Pool, number][]) {
      for (const date of bookingDates(pool, today)) {
        const availability = await fetchAvailability(client, groupId, date);
        // Stamped when ActiveNet answered, not when the run started: readWhileBookable judges each reading by it.
        const result = toSlotRows(availability, date, courtIdByActiveNetId, new Date().toISOString());
        rows.push(...result.rows);
        if (result.unknownCourts.length) {
          notes.push(`${date}: ActiveNet returned courts not in the courts table: ${result.unknownCourts.join(", ")}`);
        }
      }
    }
    for (const note of notes) log(note);

    let stored = rows;
    if (!dryRun) {
      db.transaction((tx) => {
        const previous = tx.select().from(slots).where(inArray(slots.date, dates)).all();
        stored = keepLastOpenStatus(rows, previous, (row) => readWhileBookable(row.date, row.hour, row.fetchedAt));

        // Log what changed since the last run before replacing it: this is the booking history.
        const changes = diffSlots(previous, stored);
        for (let i = 0; i < changes.length; i += 500) tx.insert(slotChanges).values(changes.slice(i, i + 500)).run();

        tx.delete(slots).where(inArray(slots.date, dates)).run();
        for (let i = 0; i < stored.length; i += 500) tx.insert(slots).values(stored.slice(i, i + 500)).run();
      });
    }
    return { rows: stored.length, notes };
  },
};
