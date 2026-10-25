import { ActiveNetClient } from "@/lib/activenet/client";
import { replaceEvents } from "@/lib/db/events";
import { parks, type ScheduleEvent } from "@/lib/db/tables";
import { chicagoDate, dateRange, EVENT_WINDOW_DAYS } from "@/lib/time";
import type { SourceModule } from "../types";
import {
  KEYWORDS,
  listPageSchema,
  meetingDatesSchema,
  programLocation,
  SOURCE,
  toProgramEvents,
  type Program,
} from "./normalize";

const searchBody = (keyword: string) => ({
  activity_search_pattern: {
    activity_keyword: keyword,
    activity_select_param: 2,
    center_ids: [],
    activity_category_ids: [],
    activity_type_ids: [],
    activity_other_category_ids: [],
    skills: [],
    days_of_week: null,
    activity_department_ids: [],
    site_ids: [],
    for_map: false,
    geographic_area_ids: [],
    season_ids: [],
    activity_ids: [],
    date_after: "",
    time_after_str: "",
    custom_price_from: "",
    custom_price_to: "",
    open_spots: null,
  },
  activity_transfer_pattern: {},
});

// Lessons, leagues, drills and clinics that hold courts. About 170 programs, so one run
// takes a few minutes at the polite request pace; it runs once a day.
export const activenetProgramsSource: SourceModule = {
  name: SOURCE,
  schedule: "30 5 * * *",

  async run({ db, now, dryRun, log }) {
    const knownParks = db.select({ id: parks.id, name: parks.name }).from(parks).all();
    if (knownParks.length === 0) throw new Error("No parks yet; run the courts source first");

    const client = new ActiveNetClient();
    const found = new Map<number, { program: Program; keyword: (typeof KEYWORDS)[number] }>();
    for (const keyword of KEYWORDS) {
      const pages = await client.requestAllPages("/activities/list", listPageSchema, searchBody(keyword));
      for (const program of pages.flatMap((page) => page.activity_items)) {
        if (!found.has(program.id)) found.set(program.id, { program, keyword });
      }
    }
    if (found.size === 0) throw new Error("ActiveNet returned no tennis or pickleball programs");

    const today = chicagoDate(now);
    const window = dateRange(today, EVENT_WINDOW_DAYS);
    const events: ScheduleEvent[] = [];
    const unreadable: string[] = [];
    let noCourt = 0;

    log(`${found.size} programs listed; fetching schedules`);
    let fetched = 0;
    for (const { program, keyword } of found.values()) {
      const location = programLocation(program.location.label, keyword, knownParks);
      if (!location) {
        noCourt++;
        continue;
      }
      if (++fetched % 25 === 0) log(`${fetched} schedules fetched`);
      try {
        const { meeting_and_registration_dates: meeting } = await client.request(
          "GET",
          `/activity/detail/meetingandregistrationdates/${program.id}`,
          meetingDatesSchema,
        );
        events.push(...toProgramEvents(program, location, meeting, window));
      } catch (err) {
        unreadable.push(`${program.name} (${program.id}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const notes = [
      `${found.size} programs found; ${noCourt} skipped with no park court as location (TBD, various, gym, …)`,
      ...unreadable.map((line) => `Skipped unreadable schedule: ${line}`),
    ];
    for (const note of notes) log(note);
    if (unreadable.length > 0 && unreadable.length >= found.size - noCourt) {
      throw new Error(`Every program schedule failed to parse; first error: ${unreadable[0]}`);
    }

    if (!dryRun) replaceEvents(db, SOURCE, today, events);
    return { rows: events.length, notes };
  },
};
