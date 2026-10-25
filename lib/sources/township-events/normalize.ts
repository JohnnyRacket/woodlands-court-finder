import * as cheerio from "cheerio";
import { parksMentionedIn } from "@/lib/park-key";

export const SOURCE = "township-events";
export const LIST_URL = "https://www.thewoodlandsparks.com/Events-Directory";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

interface Park {
  id: string;
  name: string;
}

export interface ListedEvent {
  title: string;
  url: string;
  date: string;
  /** The place name before the street address: "Terramont Park" */
  venue: string;
  tags: string[];
}

/** The ASP.NET form post that loads the next page of the listing. */
export interface PostBack {
  action: string;
  fields: [string, string][];
}

const clean = (text: string) => text.replace(/ /g, " ").replace(/\s+/g, " ").trim();

/** One page of the Events Directory, plus how to ask for the next one. */
export function parseListing(html: string): { events: ListedEvent[]; page: number; pageCount: number; next: PostBack | null } {
  const $ = cheerio.load(html);
  const pageInfo = clean($(".seamless-pagination-info").text()).match(/Page (\d+) of (\d+)/);
  const items = $(".list-item-container article");
  // A listing with no events has no pagination either; anything else without it means the page changed.
  if (!pageInfo && items.length) throw new Error("Events Directory has events but no page count");

  const events = items.toArray().map((article) => {
    const el = $(article);
    const title = clean(el.find(".list-item-title").text());
    const url = el.find("a").first().attr("href");
    const [day, month, year] = [".part-date", ".part-month", ".part-year"].map((part) => clean(el.find(part).text()));
    const monthIndex = MONTHS.indexOf(month.toLowerCase().slice(0, 3));
    if (!title || !url || !/^\d{1,2}$/.test(day) || monthIndex === -1 || !/^\d{4}$/.test(year)) {
      throw new Error(`Can't read event "${title || clean(el.text()).slice(0, 80)}"`);
    }
    return {
      title,
      url: new URL(url, LIST_URL).toString(),
      date: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day.padStart(2, "0")}`,
      venue: clean(el.find(".list-item-address").text()).split(",")[0].trim(),
      tags: el
        .find(".tagged-as-list .text")
        .text()
        .split(",")
        .map(clean)
        .filter(Boolean),
    };
  });

  const page = pageInfo ? Number(pageInfo[1]) : 1;
  const pageCount = pageInfo ? Number(pageInfo[2]) : 1;
  const nextButton = $(".seamless-pagination .button-next input[type=submit]");
  let next: PostBack | null = null;
  if (page < pageCount) {
    const form = $("form#mainForm");
    const name = nextButton.attr("name");
    if (!form.length || !name || nextButton.attr("disabled")) throw new Error(`Events Directory page ${page} of ${pageCount} has no usable Next button`);
    const fields = form
      .find("input[type=hidden]")
      .toArray()
      .flatMap((input): [string, string][] => {
        const field = $(input).attr("name");
        return field ? [[field, $(input).attr("value") ?? ""]] : [];
      });
    next = { action: new URL(form.attr("action") ?? LIST_URL, LIST_URL).toString(), fields: [...fields, [name, nextButton.attr("value") ?? "Next"]] };
  }
  return { events, page, pageCount, next };
}

/**
 * Start and end of one date of an event, from its detail page's date list.
 * Minutes from Chicago midnight; null end when the Township lists only a start.
 */
export function parseEventTimes(html: string, date: string): { startMin: number; endMin: number | null } | null {
  const $ = cheerio.load(html);
  const [year, month, day] = date.split("-").map(Number);
  const item = $(".multi-date-item")
    .toArray()
    .map((li) => $(li))
    .find((li) => Number(li.attr("data-start-year")) === year && Number(li.attr("data-start-month")) === month && Number(li.attr("data-start-day")) === day);
  if (!item) return null;
  const minutes = (hourAttr: string, minuteAttr: string) => {
    const hour = item.attr(hourAttr);
    return hour ? Number(hour) * 60 + Number(item.attr(minuteAttr) || 0) : null;
  };
  const startMin = minutes("data-start-hour", "data-start-mins");
  if (startMin === null) return null;
  const endMin = minutes("data-end-hour", "data-end-mins");
  return { startMin, endMin: endMin !== null && endMin > startMin ? endMin : null };
}

/** The court park an event is at, by its venue name; null when it isn't at one. Throws on ambiguity. */
export function eventPark(event: ListedEvent, parks: Park[]): Park | null {
  const found = parksMentionedIn(event.venue, parks);
  if (found.length > 1) throw new Error(`Event venue "${event.venue}" matches ${found.length} parks`);
  return found[0] ?? null;
}
