import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eventPark, parseEventTimes, parseListing } from "./normalize";

const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8");
const parks = [
  { id: "terramont", name: "Terramont Park" },
  { id: "falconwing", name: "Falconwing Park" },
];

describe("parseListing with the real first page", () => {
  const { events, page, pageCount, next } = parseListing(fixture("events-page1.html"));

  it("reads every event with its date, venue and tags", () => {
    expect([page, pageCount, events.length]).toEqual([1, 4, 10]);
    expect(events[2]).toEqual({
      title: "Flashlight Candy Hunt",
      url: "https://www.thewoodlandsparks.com/Events-Directory/2026/October/102826-Flashlight-Candy-Hunt",
      date: "2026-10-28",
      venue: "Terramont Park",
      tags: ["Kids & family"],
    });
    expect(events.map((e) => e.date)).toEqual([...events.map((e) => e.date)].sort());
  });

  it("builds the postback for the next page", () => {
    expect(next?.action).toBe("https://www.thewoodlandsparks.com/Events-Directory");
    const names = next!.fields.map(([name]) => name);
    expect(names).toContain("__VIEWSTATE");
    expect(next!.fields.at(-1)).toEqual(["ctl09$ctl00$ctl09", "Next"]);
  });
});

describe("parseListing", () => {
  it("accepts an empty listing", () => {
    expect(parseListing("<form id='mainForm'></form>")).toEqual({ events: [], page: 1, pageCount: 1, next: null });
  });

  it("fails loudly on an event it can't read", () => {
    const html = `<div class="seamless-pagination-info">Page 1 of 1</div><div class="list-item-container"><article><a href="/x"><h2 class="list-item-title">Mystery</h2></a></article></div>`;
    expect(() => parseListing(html)).toThrow(/Can't read event "Mystery"/);
  });
});

describe("parseEventTimes with a real event page", () => {
  const html = fixture("event-detail.html");

  it("reads the start time for the listed date", () => {
    expect(parseEventTimes(html, "2026-10-28")).toEqual({ startMin: 19 * 60 + 30, endMin: null });
  });

  it("returns null for a date the page doesn't list", () => {
    expect(parseEventTimes(html, "2026-10-29")).toBeNull();
  });

  it("reads an end time when there is one", () => {
    const li = `<li class="multi-date-item" data-start-year="2026" data-start-month="11" data-start-day="7" data-start-hour="9" data-start-mins="0" data-end-hour="13" data-end-mins="30"></li>`;
    expect(parseEventTimes(li, "2026-11-07")).toEqual({ startMin: 540, endMin: 810 });
  });
});

describe("eventPark", () => {
  const event = (venue: string) => ({ title: "x", url: "x", date: "2026-10-28", venue, tags: [] });

  it("matches the venue name only, not the street address", () => {
    expect(eventPark(event("Terramont Park"), parks)?.id).toBe("terramont");
    expect(eventPark(event("Riva Row Boat House"), parks)).toBeNull();
  });

  it("refuses a venue naming two parks", () => {
    expect(() => eventPark(event("Terramont Park & Falconwing Park"), parks)).toThrow(/matches 2 parks/);
  });
});
