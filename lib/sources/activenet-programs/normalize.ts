import { z } from "zod";
import type { ScheduleEvent } from "@/lib/db/tables";
import { parksMentionedIn } from "@/lib/park-key";
import { weekdayOf } from "@/lib/time";
import { parseWeekdays } from "@/lib/weekdays";

export const SOURCE = "activenet-programs";
export const KEYWORDS = ["pickleball", "tennis"] as const;
type Keyword = (typeof KEYWORDS)[number];

export const listPageSchema = z.object({
  activity_items: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      detail_url: z.string(),
      location: z.object({ label: z.string() }),
    }),
  ),
});
export type Program = z.infer<typeof listPageSchema>["activity_items"][number];

const clock = z.string().regex(/^\d{2}:\d{2}:\d{2}$/);
export const meetingDatesSchema = z.object({
  meeting_and_registration_dates: z.object({
    no_meeting_dates: z.boolean(),
    activity_patterns: z
      .array(
        z.object({
          beginning_date: z.iso.date(),
          ending_date: z.iso.date(),
          weeks_of_month: z.string(),
          exception_dates: z.array(z.string()),
          pattern_dates: z.array(z.object({ weekdays: z.string(), starting_time: clock, ending_time: clock })),
        }),
      )
      .nullable(),
    additional_dates: z
      .array(z.object({ meeting_date: z.iso.date(), starting_time: clock, ending_time: clock }))
      .nullable(),
  }),
});
export type MeetingDates = z.infer<typeof meetingDatesSchema>["meeting_and_registration_dates"];

interface Park {
  id: string;
  name: string;
}

const NOT_A_COURT = /basketball|gym|indoor/i;

/**
 * Where a program meets, from ActiveNet's free-text location.
 * Maps to parks only; court numbers in the text ("#9, 10 & 11") are ignored for now.
 */
export function programLocation(label: string, keyword: Keyword, parks: Park[]) {
  if (NOT_A_COURT.test(label)) return null;
  const found = parksMentionedIn(label, parks);
  if (found.length === 0) return null;
  const courtKind: "tennis" | "pickleball" = /pickleball|multi-use/i.test(label) ? "pickleball" : /tennis/i.test(label) ? "tennis" : keyword;
  return { parks: found, courtKind };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "1,8 Sep 2026" → ["2026-09-01", "2026-09-08"] */
export function parseExceptionDates(text: string): string[] {
  const match = text.trim().match(/^([\d,\s]+)\s+([A-Za-z]{3})\s+(\d{4})$/);
  const month = match ? MONTHS.indexOf(match[2].toLowerCase()) : -1;
  if (!match || month === -1) throw new Error(`Can't read exception dates "${text}"`);
  return match[1]
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean)
    .map((day) => `${match[3]}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}`);
}

/** "1st, 3rd week of every month" → [1, 3]; "" → every week */
export function parseWeeksOfMonth(text: string): number[] | null {
  if (text.trim() === "") return null;
  const weeks = [...text.matchAll(/(\d)(?:st|nd|rd|th)/g)].map((m) => Number(m[1]));
  if (weeks.length === 0 || !/week of every month$/i.test(text.trim())) throw new Error(`Can't read weeks "${text}"`);
  return weeks;
}

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Concrete meetings inside `window`. Throws on any format it doesn't recognize. */
export function expandMeetings(meeting: MeetingDates, window: string[]) {
  const meetings: { date: string; startMin: number; endMin: number }[] = [];
  if (meeting.no_meeting_dates) return meetings;

  for (const pattern of meeting.activity_patterns ?? []) {
    const exceptions = new Set(pattern.exception_dates.flatMap(parseExceptionDates));
    const weeks = parseWeeksOfMonth(pattern.weeks_of_month);
    for (const slot of pattern.pattern_dates) {
      const weekdays = parseWeekdays(slot.weekdays);
      for (const date of window) {
        if (date < pattern.beginning_date || date > pattern.ending_date || exceptions.has(date)) continue;
        if (!weekdays.includes(weekdayOf(date))) continue;
        // ActiveNet's "2nd week" = the 2nd such weekday of the month
        if (weeks && !weeks.includes(Math.ceil(Number(date.slice(8, 10)) / 7))) continue;
        meetings.push({ date, startMin: minutes(slot.starting_time), endMin: minutes(slot.ending_time) });
      }
    }
  }
  for (const extra of meeting.additional_dates ?? []) {
    if (window.includes(extra.meeting_date)) {
      meetings.push({ date: extra.meeting_date, startMin: minutes(extra.starting_time), endMin: minutes(extra.ending_time) });
    }
  }

  // A program can list the same meeting as both a pattern and an additional date.
  const unique = new Map(meetings.map((m) => [`${m.date}|${m.startMin}|${m.endMin}`, m]));
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}

export function toProgramEvents(
  program: Program,
  location: NonNullable<ReturnType<typeof programLocation>>,
  meeting: MeetingDates,
  window: string[],
): ScheduleEvent[] {
  return expandMeetings(meeting, window).flatMap(({ date, startMin, endMin }) =>
    location.parks.map((park) => ({
      id: `${SOURCE}:${program.id}:${park.id}:${date}:${startMin}`,
      source: SOURCE,
      kind: "program" as const,
      title: program.name.trim(),
      parkId: park.id,
      courtKind: location.courtKind,
      date,
      startMin,
      endMin,
      publicCanJoin: false,
      url: program.detail_url,
    })),
  );
}
