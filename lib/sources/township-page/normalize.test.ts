import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDropInLine, parsePickleballPage, toMinutes } from "./normalize";

const html = readFileSync(path.join(import.meta.dirname, "__fixtures__/pickleball-page.html"), "utf8");
const parks = [
  { id: "falconwing", name: "Falconwing Park" },
  { id: "creekwood", name: "Creekwood Park" },
  { id: "windvale", name: "Windvale Park" },
  { id: "bear-branch", name: "Bear Branch Park" },
];

describe("parsePickleballPage with the real page", () => {
  // Window: Sun Oct 25 – Sat Nov 7, 2026
  const { events, notes } = parsePickleballPage(html, parks, "2026-10-25");
  const dropIns = events.filter((e) => e.kind === "drop_in");

  it("expands every published drop-in window over the next 14 days", () => {
    // Per week: Falconwing 3 (Mon AM, Wed AM, Mon PM), Creekwood 3, Windvale 2
    expect(dropIns).toHaveLength(16);
    expect(dropIns.filter((e) => e.date === "2026-10-26")).toEqual([
      expect.objectContaining({ parkId: "falconwing", startMin: 8 * 60, endMin: 10 * 60, publicCanJoin: true, courtKind: "pickleball" }),
      expect.objectContaining({ parkId: "falconwing", startMin: 17 * 60 + 30, endMin: 20 * 60 + 30 }),
    ]);
  });

  it("picks up the tournament inside the window, with its event page", () => {
    expect(events.filter((e) => e.kind === "tournament")).toEqual([]); // next one is Nov 14, outside the window
    const later = parsePickleballPage(html, parks, "2026-11-10").events.filter((e) => e.kind === "tournament");
    expect(later).toEqual([
      expect.objectContaining({
        parkId: "falconwing",
        date: "2026-11-14",
        startMin: 9 * 60,
        endMin: 13 * 60,
        title: "Pickleball tournament: Hats Off to Heroes",
        publicCanJoin: false,
        url: expect.stringContaining("/Events-Directory/2026/November/"),
      }),
      expect.objectContaining({ date: "2026-11-17", title: "Pickleball tournament: November to Remember" }),
    ]);
  });

  it("has no notes when the schedule is current", () => {
    expect(notes).toEqual([]);
  });

  it("flags a schedule titled for a different year", () => {
    expect(parsePickleballPage(html, parks, "2027-01-05").notes[0]).toMatch(/may be out of date/);
  });

  it("gives every event a unique id", () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});

describe("parsePickleballPage fails loudly", () => {
  it("when the drop-in section disappears", () => {
    expect(() => parsePickleballPage(html.replace("Drop-In Play Times", "Open Play"), parks, "2026-10-25")).toThrow(/No "Drop-In Play Times"/);
  });

  it("when a line changes shape", () => {
    const changed = html.replace("Morning: Monday &amp; Wednesday 8 to 10 a.m.", "Mornings vary, call ahead");
    expect(() => parsePickleballPage(changed, parks, "2026-10-25")).toThrow(/Can't read drop-in line "Mornings vary, call ahead"/);
  });

  it("when a park name isn't one we know", () => {
    expect(() => parsePickleballPage(html.replace("<strong>WINDVALE</strong>", "<strong>NEWPARK</strong>"), parks, "2026-10-25")).toThrow(
      /"NEWPARK" matches 0 parks/,
    );
  });
});

describe("parseDropInLine", () => {
  it.each([
    ["Morning: Monday & Wednesday 8 to 10 a.m.", [1, 3], 480, 600],
    ["Evening: Tuesday & Thursday 5:30 to 8:30 p.m.", [2, 4], 1050, 1230],
    ["Saturday 11 to 1 p.m.", [6], 660, 780],
    ["Friday 11 a.m. to 1 p.m.", [5], 660, 780],
  ])("%s", (line, weekdays, startMin, endMin) => {
    expect(parseDropInLine(line)).toEqual({ weekdays, startMin, endMin });
  });

  it("converts 12-hour clocks", () => {
    expect(toMinutes("12", "p.m.")).toBe(720);
    expect(toMinutes("12:30", "a.m.")).toBe(30);
  });
});
