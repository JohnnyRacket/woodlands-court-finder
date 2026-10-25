import * as cheerio from "cheerio";
import { parksMentionedIn } from "@/lib/park-key";

export const SOURCE = "township-alerts";
// Every page on the parks site carries the same announcement banner; the home page is the lightest.
export const PAGE_URL = "https://www.thewoodlandsparks.com/Home";

interface Park {
  id: string;
  name: string;
}

export interface TownshipAlert {
  /** The banner's own id (data-cvid), stable while the announcement is up. */
  id: string;
  title: string;
  body: string;
  /** OpenCities severity class, e.g. 30 for "oc-emergency-severity-30"; higher is more urgent. */
  severity: number;
  /** Court parks the alert names; empty when it names none. */
  parkIds: string[];
  /** Mentions courts, tennis, pickleball, or parks closing as a whole. A sprayground closure doesn't. */
  aboutCourts: boolean;
}

const ABOUT_COURTS = /\b(tennis|pickleball|courts?)\b|\ball (township )?parks\b|\bparks (are|will be) closed\b/i;

/** The site-announcement banner. No announcements is normal; a missing banner container means the page changed. */
export function parseAlerts(html: string, parks: Park[]): TownshipAlert[] {
  const $ = cheerio.load(html);
  const list = $("#PublicEmergencyAnnouncementList");
  if (!list.length) throw new Error("No site-announcement container (#PublicEmergencyAnnouncementList) on the parks home page");

  return list
    .find(".emergency-message-box")
    .toArray()
    .map((box) => {
      const el = $(box);
      const title = el.find(".side-box-title").text().replace(/\s+/g, " ").trim();
      const body = el.find(".side-box-content").text().replace(/\s+/g, " ").trim();
      const id = el.find("[data-cvid]").attr("data-cvid");
      const severity = Number(el.attr("class")?.match(/oc-emergency-severity-(\d+)/)?.[1]);
      if (!title || !id || !Number.isFinite(severity)) throw new Error(`Can't read site announcement "${title || el.text().trim().slice(0, 80)}"`);
      const text = `${title} ${body}`;
      return { id, title, body, severity, parkIds: parksMentionedIn(text, parks).map((p) => p.id), aboutCourts: ABOUT_COURTS.test(text) };
    });
}
