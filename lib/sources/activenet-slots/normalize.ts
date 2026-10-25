import type { Availability } from "@/lib/activenet/client";

export interface SlotRow {
  courtId: string;
  date: string;
  hour: number;
  status: "free" | "booked";
  fetchedAt: string;
}

/**
 * ActiveNet marks each hourly slot 0 (open to reserve) or non-zero (taken or unavailable).
 * courtIdByActiveNetId comes from the shared courts table.
 */
export function toSlotRows(
  availability: Availability,
  date: string,
  courtIdByActiveNetId: Map<number, string>,
  fetchedAt: string,
): { rows: SlotRow[]; unknownCourts: string[] } {
  const hours = availability.time_slots.map((time) => {
    if (!/^\d{2}:00:00$/.test(time)) throw new Error(`Unexpected ActiveNet time slot "${time}" (expected hourly slots)`);
    return Number(time.slice(0, 2));
  });

  const rows: SlotRow[] = [];
  const unknownCourts: string[] = [];
  for (const resource of availability.resources) {
    const courtId = courtIdByActiveNetId.get(resource.resource_id);
    if (!courtId) {
      unknownCourts.push(`${resource.resource_name} (${resource.resource_id})`);
      continue;
    }
    if (resource.time_slot_details.length !== hours.length) {
      throw new Error(`${resource.resource_name}: ${resource.time_slot_details.length} slots for ${hours.length} hours`);
    }
    resource.time_slot_details.forEach((slot, i) => {
      rows.push({ courtId, date, hour: hours[i], status: slot.status === 0 ? "free" : "booked", fetchedAt });
    });
  }
  return { rows, unknownCourts };
}

export interface SlotChange {
  courtId: string;
  date: string;
  hour: number;
  status: "free" | "booked";
  /** null the first time the hour is seen */
  previousStatus: "free" | "booked" | null;
  observedAt: string;
}

const slotKey = (row: { courtId: string; date: string; hour: number }) => `${row.courtId}|${row.date}|${row.hour}`;

/**
 * Once booking closes for an hour, ActiveNet reports it taken whether or not anyone reserved it.
 * For hours not read while still bookable, keep the last stored row that was, or drop the row
 * if there is none (stored rows read too late are discarded, not carried forward).
 */
export function keepLastOpenStatus(rows: SlotRow[], previous: SlotRow[], readWhileOpen: (row: SlotRow) => boolean): SlotRow[] {
  const before = new Map(previous.filter(readWhileOpen).map((row) => [slotKey(row), row]));
  return rows.flatMap((row) => {
    if (readWhileOpen(row)) return [row];
    const last = before.get(slotKey(row));
    return last ? [last] : [];
  });
}

/** Court-hours whose status differs from what was stored, i.e. bookings and cancellations seen this run. */
export function diffSlots(previous: { courtId: string; date: string; hour: number; status: "free" | "booked" }[], rows: SlotRow[]): SlotChange[] {
  const before = new Map(previous.map((row) => [slotKey(row), row.status]));
  return rows.flatMap((row) => {
    const previousStatus = before.get(slotKey(row)) ?? null;
    if (previousStatus === row.status) return [];
    return [{ courtId: row.courtId, date: row.date, hour: row.hour, status: row.status, previousStatus, observedAt: row.fetchedAt }];
  });
}
