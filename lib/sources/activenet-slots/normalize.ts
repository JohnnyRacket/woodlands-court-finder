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
