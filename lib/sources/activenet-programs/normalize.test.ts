import { describe, expect, it } from "vitest";
import { dateRange } from "@/lib/time";
import listFixture from "./__fixtures__/list-pickleball-page1.json";
import meetingFixtures from "./__fixtures__/meeting-dates.json";
import {
  expandMeetings,
  listPageSchema,
  meetingDatesSchema,
  parseExceptionDates,
  parseWeeksOfMonth,
  programLocation,
  titleWeekdayMismatch,
  toProgramEvents,
  type MeetingDates,
} from "./normalize";

const parks = ["Bear Branch", "Creekwood", "Falconwing", "Sawmill", "Shadowbend", "Windvale"].map((name) => ({
  id: name.toLowerCase().replace(" ", "-"),
  name: `${name} Park`,
}));
const window = dateRange("2026-10-25", 14); // Sun Oct 25 – Sat Nov 7
const meetingFor = (id: number): MeetingDates =>
  meetingDatesSchema.parse((meetingFixtures as Record<string, { body: unknown }>)[id].body).meeting_and_registration_dates;
const programs = listPageSchema.parse(listFixture.body).activity_items;

describe("programLocation", () => {
  it.each([
    ["Bear Branch Multi-Use Court", "tennis", ["bear-branch"], "pickleball"],
    ["Windvale Pickleball Courts", "tennis", ["windvale"], "pickleball"],
    ["Bear Branch Tennis Courts #9, 10 & 11", "pickleball", ["bear-branch"], "tennis"],
    ["Sawmill & Shadowbend Tennis Courts", "tennis", ["sawmill", "shadowbend"], "tennis"],
    ["Shadowbend 3 -5", "tennis", ["shadowbend"], "tennis"],
  ] as const)("%s", (label, keyword, parkIds, courtKind) => {
    const location = programLocation(label, keyword, parks);
    expect(location?.parks.map((p) => p.id)).toEqual(parkIds);
    expect(location?.courtKind).toBe(courtKind);
  });

  it.each(["TBD with the Instructor", "Various Tennis Courts in The Woodlands", "Bear Branch Covered Basketball Court", "Bear Branch Indoor Gym"])(
    "skips %j",
    (label) => expect(programLocation(label, "tennis", parks)).toBeNull(),
  );
});

describe("expandMeetings with real schedules", () => {
  it("expands a weekly pattern and honors its end date", () => {
    // Fall 2026 Beginner Pickleball: Tuesdays 7–8:30 p.m., Sep 1 – Dec 15
    const program = programs.find((p) => p.name.includes("Beginner Pickleball - Tue"))!;
    expect(expandMeetings(meetingFor(program.id), window)).toEqual([
      { date: "2026-10-27", startMin: 1140, endMin: 1230 },
      { date: "2026-11-03", startMin: 1140, endMin: 1230 },
    ]);
  });

  it("uses explicit additional dates", () => {
    // Jo's Club: Fridays 9 a.m.–noon, listed date by date
    const program = programs.find((p) => p.name.includes("Jo's Club"))!;
    expect(expandMeetings(meetingFor(program.id), window)).toEqual([
      { date: "2026-10-30", startMin: 540, endMin: 720 },
      { date: "2026-11-06", startMin: 540, endMin: 720 },
    ]);
  });

  it("parses every schedule in the fixtures", () => {
    for (const id of Object.keys(meetingFixtures)) expect(() => expandMeetings(meetingFor(Number(id)), window)).not.toThrow();
  });
});

describe("expandMeetings rules", () => {
  const meeting = (pattern: Partial<NonNullable<MeetingDates["activity_patterns"]>[number]>): MeetingDates => ({
    no_meeting_dates: false,
    additional_dates: [],
    activity_patterns: [
      {
        beginning_date: "2026-10-01",
        ending_date: "2026-12-31",
        weeks_of_month: "",
        exception_dates: [],
        pattern_dates: [{ weekdays: "Wed", starting_time: "19:00:00", ending_time: "20:30:00" }],
        ...pattern,
      },
    ],
  });

  it("keeps only the listed weeks of the month", () => {
    // Wednesdays in the window: Oct 28 (4th), Nov 4 (1st)
    expect(expandMeetings(meeting({ weeks_of_month: "2nd, 4th week of every month" }), window).map((m) => m.date)).toEqual(["2026-10-28"]);
  });

  it("drops exception dates", () => {
    expect(expandMeetings(meeting({ exception_dates: ["28 Oct 2026"] }), window).map((m) => m.date)).toEqual(["2026-11-04"]);
  });

  it("returns nothing for programs without meeting dates", () => {
    expect(expandMeetings({ no_meeting_dates: true, activity_patterns: null, additional_dates: null }, window)).toEqual([]);
  });

  it("throws on formats it doesn't know", () => {
    expect(() => expandMeetings(meeting({ weeks_of_month: "last week of every month" }), window)).toThrow(/Can't read weeks/);
    expect(() => expandMeetings(meeting({ exception_dates: ["October 28"] }), window)).toThrow(/Can't read exception dates/);
  });
});

describe("parsers", () => {
  it("reads exception dates", () => {
    expect(parseExceptionDates("1,8 Sep 2026")).toEqual(["2026-09-01", "2026-09-08"]);
  });

  it("reads weeks of month", () => {
    expect(parseWeeksOfMonth("")).toBeNull();
    expect(parseWeeksOfMonth("1st, 2nd, 3rd week of every month")).toEqual([1, 2, 3]);
  });
});

describe("titleWeekdayMismatch", () => {
  it("catches the real 'Drop In - Saturdays' program that meets Mon–Thu", () => {
    const program = programs.find((p) => p.name.includes("Drop In - Saturdays"))!;
    expect(titleWeekdayMismatch(program.name, meetingFor(program.id))).toBe("title names Sat but it's scheduled Mon, Tue, Wed, Thu");
  });

  it("stays quiet when the title agrees or names no day", () => {
    const beginner = programs.find((p) => p.name.includes("Beginner Pickleball - Tue"))!;
    expect(titleWeekdayMismatch(beginner.name, meetingFor(beginner.id))).toBeNull();
    expect(titleWeekdayMismatch("Tuesday Clinic", meetingForWednesday())).toBe("title names Tue but it's scheduled Wed");
    expect(titleWeekdayMismatch("Evening Clinic", meetingForWednesday())).toBeNull();
  });

  it("finds exactly one mismatch across the fixtures", () => {
    const flagged = programs.filter((p) => titleWeekdayMismatch(p.name, meetingFor(p.id)));
    expect(flagged.map((p) => p.id)).toEqual([74372]);
  });
});

describe("toProgramEvents", () => {
  it("creates one event per park per meeting, linked to the program page", () => {
    const program = { id: 1, name: " Clinic ", detail_url: "https://example.test/1", location: { label: "Sawmill & Shadowbend Tennis Courts" } };
    const location = programLocation(program.location.label, "tennis", parks)!;
    const events = toProgramEvents(program, location, meetingForWednesday(), window);
    expect(events.map((e) => [e.parkId, e.date])).toEqual([
      ["sawmill", "2026-10-28"],
      ["shadowbend", "2026-10-28"],
      ["sawmill", "2026-11-04"],
      ["shadowbend", "2026-11-04"],
    ]);
    expect(events[0]).toMatchObject({ kind: "program", title: "Clinic", courtKind: "tennis", publicCanJoin: false, url: "https://example.test/1" });
  });
});

function meetingForWednesday(): MeetingDates {
  return {
    no_meeting_dates: false,
    additional_dates: null,
    activity_patterns: [
      {
        beginning_date: "2026-10-01",
        ending_date: "2026-12-31",
        weeks_of_month: "",
        exception_dates: [],
        pattern_dates: [{ weekdays: "Wed", starting_time: "19:00:00", ending_time: "20:00:00" }],
      },
    ],
  };
}
