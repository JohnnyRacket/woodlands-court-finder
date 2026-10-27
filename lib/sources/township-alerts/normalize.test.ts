import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAlerts } from "./normalize";

const html = readFileSync(path.join(import.meta.dirname, "__fixtures__/parks-home.html"), "utf8");
const parks = [
  { id: "may-valley", name: "May Valley Park" },
  { id: "falconwing", name: "Falconwing Park" },
  { id: "bear-branch", name: "Bear Branch Park" },
];

const page = (body: string) =>
  `<html><head><meta name="generator" content="OpenCities - https://granicus.com/product/opencities" /></head><body class="body page-name-home">${body}</body></html>`;
const banner = (...boxes: string[]) => page(`<div id="PublicEmergencyAnnouncementList">${boxes.join("")}</div>`);
const box = (title: string, body: string, severity = 30, id = title) =>
  `<div class="side-box message-box emergency-message-box oc-emergency-severity-${severity}">
     <h3 class="side-box-title">${title}</h3>
     <div class="side-box-content"><p>${body}</p></div>
     <button class="emergency-announcement-item-dismiss" data-cvid="${id}"></button>
   </div>`;

describe("parseAlerts with the real home page", () => {
  it("reads the announcement and links it to the park it names", () => {
    expect(parseAlerts(html, parks)).toEqual([
      {
        id: "f1bd28a2-ea42-4fe4-b916-4753a92b0cc2",
        title: "May Valley Sprayground Closed",
        body: "The May Valley Sprayground is currently down. Thank you for your patience.",
        severity: 30,
        parkIds: ["may-valley"],
        aboutCourts: false, // a sprayground, not the courts
      },
    ]);
  });

  it("returns nothing when no announcement is up, which leaves the banner out of the page", () => {
    const withoutBanner = html.replace(/<div role="region" aria-label="Site announcements"[\s\S]*?<div class="oc-emergency-dismissed results-0"><\/div><\/div><\/div><\/div>/, "");
    expect(withoutBanner).not.toContain("PublicEmergencyAnnouncementList");
    expect(parseAlerts(withoutBanner, parks)).toEqual([]);
  });
});

describe("parseAlerts", () => {
  it("returns nothing when no announcement is up", () => {
    expect(parseAlerts(banner(), parks)).toEqual([]);
  });

  it("flags court closures and park-wide closures", () => {
    const alerts = parseAlerts(
      banner(
        box("Falconwing pickleball courts closed", "Resurfacing through Friday.", 20, "a"),
        box("All parks closed", "Due to severe weather, all Township parks are closed today.", 40, "b"),
      ),
      parks,
    );
    expect(alerts.map((a) => [a.id, a.aboutCourts, a.parkIds, a.severity])).toEqual([
      ["a", true, ["falconwing"], 20],
      ["b", true, [], 40],
    ]);
  });

  it("fails loudly on a page that isn't the parks home page", () => {
    expect(() => parseAlerts("<html><body>redesigned</body></html>", parks)).toThrow(/Not the OpenCities parks home page/);
    expect(() => parseAlerts("<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD><BODY></BODY></HTML>", parks)).toThrow(/Not the OpenCities/);
  });

  it("fails loudly on an announcement it can't read", () => {
    expect(() => parseAlerts(banner(`<div class="emergency-message-box"><h3 class="side-box-title">x</h3></div>`), parks)).toThrow(/Can't read/);
  });
});
