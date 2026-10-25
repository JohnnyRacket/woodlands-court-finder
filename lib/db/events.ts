import { and, eq, gte } from "drizzle-orm";
import type { Db } from "./client";
import { scheduleEvents, type ScheduleEvent } from "./tables";

/**
 * Replace one source's events from `fromDate` onward. Earlier rows are left alone,
 * so past events stay as history.
 */
export function replaceEvents(db: Db, source: string, fromDate: string, rows: ScheduleEvent[]) {
  if (rows.some((row) => row.source !== source || row.date < fromDate)) {
    throw new Error(`replaceEvents(${source}): rows must belong to ${source} and start on or after ${fromDate}`);
  }
  db.transaction((tx) => {
    tx.delete(scheduleEvents)
      .where(and(eq(scheduleEvents.source, source), gte(scheduleEvents.date, fromDate)))
      .run();
    for (let i = 0; i < rows.length; i += 200) tx.insert(scheduleEvents).values(rows.slice(i, i + 200)).run();
  });
}
