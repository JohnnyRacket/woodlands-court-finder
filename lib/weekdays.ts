// Strict weekday-list parser: 0 = Sunday … 6 = Saturday.
// Handles "Monday & Wednesday", "Mon, Tue, Wed", "Monday through Friday", "Weekdays", "Everyday".

const NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const GROUPS: Record<string, number[]> = {
  weekdays: [1, 2, 3, 4, 5],
  weekends: [0, 6],
  everyday: [0, 1, 2, 3, 4, 5, 6],
  daily: [0, 1, 2, 3, 4, 5, 6],
};

function day(token: string): number {
  const index = NAMES.indexOf(token.slice(0, 3));
  const full = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][index];
  if (index === -1 || !(token === NAMES[index] || full.startsWith(token))) throw new Error(`Unknown weekday "${token}"`);
  return index;
}

export function parseWeekdays(text: string): number[] {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (GROUPS[normalized.replace(/[^a-z]/g, "")]) return GROUPS[normalized.replace(/[^a-z]/g, "")];

  const days = new Set<number>();
  for (const part of normalized.split(/\s*(?:,|&|\band\b)\s*/).filter(Boolean)) {
    const range = part.split(/\s*(?:\bthrough\b|\bthru\b|-|–)\s*/);
    if (range.length === 2) {
      const [from, to] = range.map(day);
      for (let d = from; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === to) break;
      }
    } else if (range.length === 1) {
      days.add(day(part));
    } else {
      throw new Error(`Can't read weekdays "${text}"`);
    }
  }
  if (days.size === 0) throw new Error(`Can't read weekdays "${text}"`);
  return [...days].sort((a, b) => a - b);
}
