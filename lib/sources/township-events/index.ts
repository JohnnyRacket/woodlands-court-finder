import { gte } from "drizzle-orm";
import { parks } from "@/lib/db/tables";
import { politeFetch } from "@/lib/http";
import { addDays, chicagoDate, EVENT_WINDOW_DAYS } from "@/lib/time";
import type { SourceModule } from "../types";
import { eventPark, LIST_URL, parseEventTimes, parseListing, SOURCE, type ListedEvent, type PostBack } from "./normalize";
import { parkEvents, type ParkEvent } from "./table";

/** The listing runs months ahead; stop paging once it's past the window, and never beyond this. */
const MAX_PAGES = 6;

// Township events at parks with courts, from the parks site's Events Directory.
export const townshipEventsSource: SourceModule = {
  name: SOURCE,
  title: "Township events at parks",
  origin: "thewoodlandsparks.com",
  schedule: { live: "25 6 * * *", gentle: "25 6 * * 1" }, // daily / weekly

  async run({ db, now, dryRun, log }) {
    const knownParks = db.select({ id: parks.id, name: parks.name }).from(parks).all();
    if (knownParks.length === 0) throw new Error("No parks yet; run the courts source first");

    const today = chicagoDate(now);
    const windowEnd = addDays(today, EVENT_WINDOW_DAYS); // exclusive
    const notes: string[] = [];

    // The listing pages by ASP.NET postback: each "Next" is a form post carrying the page's
    // view state, with the session cookie from the first page.
    const listed: ListedEvent[] = [];
    let response = await politeFetch(LIST_URL, { headers: { Accept: "text/html" } });
    const cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    for (let pages = 1; ; pages++) {
      const { events, next } = parseListing(await response.text());
      listed.push(...events);
      if (!next || events.length === 0 || events.at(-1)!.date >= windowEnd) break;
      if (pages >= MAX_PAGES) {
        notes.push(`Stopped after ${MAX_PAGES} pages of the Events Directory before reaching ${windowEnd}`);
        break;
      }
      response = await postBack(next, cookie);
    }

    const rows: ParkEvent[] = [];
    for (const event of listed) {
      if (event.date < today || event.date >= windowEnd) continue;
      const park = eventPark(event, knownParks);
      if (!park) continue;
      const detail = await politeFetch(event.url, { headers: { Accept: "text/html" } });
      const times = parseEventTimes(await detail.text(), event.date);
      if (!times) notes.push(`No start time for "${event.title}" on ${event.date}`);
      rows.push({
        id: `${new URL(event.url).pathname.split("/").at(-1)}:${event.date}`,
        title: event.title,
        parkId: park.id,
        date: event.date,
        startMin: times?.startMin ?? null,
        endMin: times?.endMin ?? null,
        venue: event.venue,
        tags: event.tags,
        url: event.url,
      });
    }
    for (const note of notes) log(note);

    if (!dryRun) {
      db.transaction((tx) => {
        tx.delete(parkEvents).where(gte(parkEvents.date, today)).run();
        if (rows.length) tx.insert(parkEvents).values(rows).onConflictDoNothing().run();
      });
    }
    return { rows: rows.length, notes };
  },
};

function postBack(next: PostBack, cookie: string) {
  return politeFetch(next.action, {
    method: "POST",
    headers: { Accept: "text/html", "Content-Type": "application/x-www-form-urlencoded", ...(cookie && { Cookie: cookie }) },
    body: new URLSearchParams(next.fields),
  });
}
