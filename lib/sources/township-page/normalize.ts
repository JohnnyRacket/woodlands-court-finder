import * as cheerio from "cheerio";
import type { ScheduleEvent } from "@/lib/db/tables";
import { parksMentionedIn } from "@/lib/park-key";
import { dateRange, EVENT_WINDOW_DAYS, weekdayOf } from "@/lib/time";
import { parseWeekdays } from "@/lib/weekdays";

export const SOURCE = "township-page";
export const PAGE_URL = "https://www.thewoodlandsparks.com/Recreation/Pickleball";
const TOURNAMENT_MINUTES = 4 * 60;
const COURTS_CLOSE_MIN = 23 * 60;

interface Park {
  id: string;
  name: string;
}

/** "5:30" + "p.m." → 1050 */
export function toMinutes(clock: string, meridiem: string): number {
  const [h, m = "0"] = clock.split(":");
  const hour = Number(h) % 12 + (meridiem.toLowerCase().startsWith("p") ? 12 : 0);
  return hour * 60 + Number(m);
}

const TIME = String.raw`(\d{1,2}(?::\d{2})?)\s*([ap]\.m\.)`;
const DROP_IN_LINE = new RegExp(String.raw`^(?:(?:morning|afternoon|evening):\s*)?(.+?)\s+(\d{1,2}(?::\d{2})?)\s*([ap]\.m\.)?\s+to\s+${TIME}$`, "i");
const TOURNAMENT_LINE = new RegExp(String.raw`^(\w+),\s+(\w+)\s+(\d{1,2})\s+at\s+${TIME}\s+at\s+(.+?)\s+\((.+)\)$`, "i");
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "Monday & Wednesday 8 to 10 a.m." → weekdays + minutes. Throws on anything else. */
export function parseDropInLine(line: string) {
  const match = line.match(DROP_IN_LINE);
  if (!match) throw new Error(`Can't read drop-in line "${line}"`);
  const [, days, startClock, startMeridiem, endClock, endMeridiem] = match;
  const endMin = toMinutes(endClock, endMeridiem);
  let startMin = toMinutes(startClock, startMeridiem ?? endMeridiem);
  // "11 to 1 p.m." means 11 a.m.
  if (!startMeridiem && startMin >= endMin) startMin -= 12 * 60;
  if (startMin < 0 || startMin >= endMin) throw new Error(`Drop-in line "${line}" has an impossible time range`);
  return { weekdays: parseWeekdays(days), startMin, endMin };
}

function onePark(text: string, parks: Park[], context: string): Park {
  const found = parksMentionedIn(text, parks);
  if (found.length !== 1) throw new Error(`${context}: "${text}" matches ${found.length} parks`);
  return found[0];
}

export function parsePickleballPage(html: string, parks: Park[], today: string) {
  const $ = cheerio.load(html);
  const notes: string[] = [];
  const events: ScheduleEvent[] = [];
  const window = dateRange(today, EVENT_WINDOW_DAYS);
  const currentYear = Number(today.slice(0, 4));

  // Drop-in play: required. Without it, open play would look like "all courts reserved".
  const heading = $("h2").filter((_, el) => /drop-in play times/i.test($(el).text())).first();
  if (!heading.length) throw new Error('No "Drop-In Play Times" heading on the pickleball page');
  const year = Number(heading.text().match(/\b(20\d{2})\b/)?.[1]);
  if (year !== currentYear) notes.push(`Drop-in schedule is titled "${heading.text().trim()}"; it may be out of date`);

  const panel = heading.nextAll().first();
  panel.find("br").replaceWith("\n");
  const lines = panel.text().split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("The drop-in panel is empty");

  let park: Park | undefined;
  let windows = 0;
  for (const line of lines) {
    // Park headings are bold, all-caps names: "FALCONWING"
    if (/^[A-Z][A-Z' .&-]*$/.test(line)) {
      park = onePark(line, parks, "Drop-in park heading");
      continue;
    }
    if (!park) throw new Error(`Drop-in line "${line}" comes before any park name`);
    const { weekdays, startMin, endMin } = parseDropInLine(line);
    windows++;
    for (const date of window) {
      if (!weekdays.includes(weekdayOf(date))) continue;
      events.push({
        id: `${SOURCE}:drop-in:${park.id}:${date}:${startMin}`,
        source: SOURCE,
        kind: "drop_in",
        title: "Pickleball drop-in play",
        parkId: park.id,
        courtKind: "pickleball",
        date,
        startMin,
        endMin,
        publicCanJoin: true,
        url: PAGE_URL,
      });
    }
  }
  if (windows === 0) throw new Error("Found drop-in parks but no drop-in times");

  // Tournaments: optional (the list comes and goes with the season).
  const tournamentHeading = $("h2, h3, h4, p, strong")
    .filter((_, el) => /tournaments schedule/i.test($(el).text()))
    .last();
  if (!tournamentHeading.length) {
    notes.push("No tournament schedule on the pickleball page");
  } else {
    const tournamentYear = Number(tournamentHeading.text().match(/\b(20\d{2})\b/)?.[1]);
    if (!tournamentYear) throw new Error(`Tournament heading "${tournamentHeading.text().trim()}" has no year`);
    const items = tournamentHeading.closest("h2, h3, h4, p").nextAll("ul").first().find("li");
    items.each((_, li) => {
      const text = $(li).text().replace(/\s+/g, " ").trim();
      const match = text.match(TOURNAMENT_LINE);
      if (!match) throw new Error(`Can't read tournament "${text}"`);
      const [, weekdayName, monthName, dayOfMonth, clock, meridiem, place, name] = match;
      const month = MONTHS.indexOf(monthName.toLowerCase());
      if (month === -1) throw new Error(`Tournament "${text}" has an unknown month`);
      const date = `${tournamentYear}-${String(month + 1).padStart(2, "0")}-${dayOfMonth.padStart(2, "0")}`;
      if (parseWeekdays(weekdayName)[0] !== weekdayOf(date)) throw new Error(`Tournament "${text}": ${date} isn't a ${weekdayName}`);
      if (!window.includes(date)) return;

      const tournamentPark = onePark(place, parks, "Tournament location");
      const startMin = toMinutes(clock, meridiem);
      const href = $(li).find("a").attr("href");
      events.push({
        id: `${SOURCE}:tournament:${tournamentPark.id}:${date}:${startMin}`,
        source: SOURCE,
        kind: "tournament",
        title: `Pickleball tournament: ${name}`,
        parkId: tournamentPark.id,
        courtKind: "pickleball",
        date,
        startMin,
        endMin: Math.min(startMin + TOURNAMENT_MINUTES, COURTS_CLOSE_MIN),
        publicCanJoin: false,
        url: href ? new URL(href, PAGE_URL).toString() : PAGE_URL,
      });
    });
    if (items.length === 0) notes.push("Tournament heading found but no tournaments listed");
  }

  return { events, notes };
}
