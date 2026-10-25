import { replaceEvents } from "@/lib/db/events";
import { parks } from "@/lib/db/tables";
import { politeFetch } from "@/lib/http";
import { chicagoDate } from "@/lib/time";
import type { SourceModule } from "../types";
import { PAGE_URL, parsePickleballPage, SOURCE } from "./normalize";

// Pickleball drop-in times and tournaments, published only as a web page.
export const townshipPageSource: SourceModule = {
  name: SOURCE,
  title: "Drop-in play & tournaments",
  origin: "thewoodlandsparks.com",
  schedule: { live: "15 6 * * *", gentle: "15 6 * * 1" }, // daily / weekly

  async run({ db, now, dryRun, log }) {
    const knownParks = db.select({ id: parks.id, name: parks.name }).from(parks).all();
    if (knownParks.length === 0) throw new Error("No parks yet; run the courts source first");

    const response = await politeFetch(PAGE_URL, { headers: { Accept: "text/html" } });
    const today = chicagoDate(now);
    const { events, notes } = parsePickleballPage(await response.text(), knownParks, today);
    for (const note of notes) log(note);

    if (!dryRun) replaceEvents(db, SOURCE, today, events);
    return { rows: events.length, notes };
  },
};
