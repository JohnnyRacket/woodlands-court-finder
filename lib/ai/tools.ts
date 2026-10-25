import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/lib/db/client";
import { parks } from "@/lib/db/tables";
import { formatHour, formatMinutes } from "@/lib/format";
import { LABEL_META } from "@/lib/label-meta";
import { getCourtStatuses, type CourtStatus } from "@/lib/queries/court-status";
import { getFreshness } from "@/lib/queries/freshness";
import { weatherHours } from "@/lib/sources/weather/table";
import { sunTimes } from "@/lib/sun";
import { addDays, chicagoDateHour, FIRST_HOUR, LAST_HOUR } from "@/lib/time";

// Tools for the assistant: thin wrappers over the same queries the map uses, returning
// compact JSON. The model never sees SQL or raw upstream payloads.

type Sport = "tennis" | "pickleball";
const playsSport = (court: CourtStatus, sport: Sport) => court.kind === sport || court.kind === "tennis_pickleball";
const canPlay = (court: CourtStatus) => court.label.publicCanJoin && !court.dark;

const describe = (court: CourtStatus) => ({
  court: court.name,
  status: LABEL_META[court.label.kind].text,
  ...("event" in court.label && {
    event: `${court.label.event.title} (${formatMinutes(court.label.event.startMin)}–${formatMinutes(court.label.event.endMin)})`,
  }),
  ...(court.dark && { warning: "after sunset and not known to be lit" }),
  ...(court.kind === "tennis_pickleball" && { note: "tennis court with pickleball lines" }),
});

export function createTools(now: Date, db: Db = getDb()) {
  const current = chicagoDateHour(now);
  const dates = [current.date, addDays(current.date, 1)];
  const dateSchema = z
    .enum(dates as [string, string])
    .describe(`Date: ${dates[0]} (today) or ${dates[1]} (tomorrow). Reservation data only exists for these two days.`);
  const hourSchema = z.number().int().min(FIRST_HOUR).max(LAST_HOUR).describe("Start hour, 7–22 (24-hour clock, America/Chicago)");
  const freshness = () => ({
    reservationsUpdatedAt: getFreshness(db).find((f) => f.source === "activenet-slots")?.lastSuccessAt ?? null,
  });
  const isPast = (date: string, hour: number) => date === current.date && hour < current.hour;

  return {
    listParks: tool({
      description: "List every Township park with tennis or pickleball courts, with its id and court counts.",
      inputSchema: z.object({}),
      execute: async () => {
        const statuses = getCourtStatuses(current.date, Math.min(Math.max(current.hour, FIRST_HOUR), LAST_HOUR), db);
        const byPark = Map.groupBy(statuses, (court) => court.parkId);
        return [...byPark].map(([parkId, list]) => ({
          parkId,
          name: list[0].parkName,
          tennisCourts: list.filter((c) => playsSport(c, "tennis")).length,
          pickleballCourts: list.filter((c) => playsSport(c, "pickleball")).length,
          litCourts: list.filter((c) => c.lighted === true).length,
        }));
      },
    }),

    findCourts: tool({
      description:
        "Find courts someone can play on (no reservation, first come, or open play) for a sport over a range of hours. " +
        "Returns, per hour, each park with how many courts are playable and what's happening on the rest.",
      inputSchema: z.object({
        sport: z.enum(["tennis", "pickleball"]),
        date: dateSchema,
        startHour: hourSchema,
        endHour: hourSchema.optional().describe("Last start hour to check, inclusive; defaults to startHour"),
        parkId: z.string().optional().describe("Limit to one park (ids from listParks)"),
        litOnly: z.boolean().optional().describe("Only courts known to have lights"),
      }),
      execute: async ({ sport, date, startHour, endHour, parkId, litOnly }) => {
        const last = Math.min(endHour ?? startHour, startHour + 5);
        const hours = [];
        for (let hour = startHour; hour <= last; hour++) {
          if (isPast(date, hour)) continue;
          const courts = getCourtStatuses(date, hour, db).filter(
            (c) => playsSport(c, sport) && (!parkId || c.parkId === parkId) && (!litOnly || c.lighted === true),
          );
          const byPark = Map.groupBy(courts, (c) => c.parkName);
          hours.push({
            hour: formatHour(hour),
            parks: [...byPark]
              .map(([park, list]) => ({
                park,
                playable: list.filter(canPlay).length,
                total: list.length,
                courts: list.map(describe),
              }))
              .sort((a, b) => b.playable - a.playable)
              .slice(0, parkId ? 1 : 8),
          });
        }
        return { date, sport, hours, ...freshness(), note: "Reservations aren't occupancy: walk-ups may already be playing on courts with no reservation." };
      },
    }),

    getParkSchedule: tool({
      description: "Everything happening at one park for a whole day: each court hour by hour, plus drop-in play, programs and tournaments.",
      inputSchema: z.object({ parkId: z.string(), date: dateSchema }),
      execute: async ({ parkId, date }) => {
        const park = db.select().from(parks).where(eq(parks.id, parkId)).get();
        if (!park) return { error: `Unknown park "${parkId}". Use listParks for ids.` };
        const timeline = new Map<string, string[]>();
        const events = new Map<string, string>();
        for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour++) {
          for (const court of getCourtStatuses(date, hour, db).filter((c) => c.parkId === parkId)) {
            const entry = `${formatHour(hour)}: ${LABEL_META[court.label.kind].text}${court.dark ? " (dark)" : ""}`;
            timeline.set(court.name, [...(timeline.get(court.name) ?? []), entry]);
            if ("event" in court.label) {
              const e = court.label.event;
              events.set(e.id, `${e.title}, ${formatMinutes(e.startMin)}–${formatMinutes(e.endMin)}${e.publicCanJoin ? ", open to everyone" : ", registration required"}`);
            }
          }
        }
        return {
          park: park.name,
          date,
          sunset: sunTimes(date).sunset.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }),
          events: [...events.values()],
          courts: Object.fromEntries(timeline),
          ...freshness(),
        };
      },
    }),

    getWeather: tool({
      description: "Hourly forecast (National Weather Service) and sunset for The Woodlands.",
      inputSchema: z.object({ date: dateSchema, startHour: hourSchema, endHour: hourSchema.optional() }),
      execute: async ({ date, startHour, endHour }) => {
        const rows = db
          .select()
          .from(weatherHours)
          .where(eq(weatherHours.date, date))
          .all()
          .filter((row) => row.hour >= startHour && row.hour <= (endHour ?? startHour));
        return {
          date,
          sunset: sunTimes(date).sunset.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }),
          hours: rows.map((row) => ({
            hour: formatHour(row.hour),
            tempF: row.tempF,
            chanceOfRain: `${row.precipPct}%`,
            windMph: row.windMph,
            forecast: row.shortForecast,
          })),
        };
      },
    }),
  };
}

export function systemPrompt(now: Date): string {
  const { date, hour } = chicagoDateHour(now);
  return [
    "You are Court Finder, an assistant for The Woodlands Township's public tennis and pickleball courts.",
    `It is ${now.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })} in The Woodlands (today is ${date}, tomorrow is ${addDays(date, 1)}; current hour ${hour}). Courts are open 7 AM–11 PM.`,
    "Rules:",
    "- Answer only from tool results. If the tools don't cover something, say so plainly; never guess court availability.",
    "- Say \"no reservation\", never \"empty\" or \"free\": reservation data is not occupancy, and walk-ups may be playing.",
    "- Open play (drop-in) means anyone can join. Programs and tournaments need registration. \"Likely event\" is unconfirmed.",
    "- Reservation data only exists for today and tomorrow (residents book 1 day ahead). For later dates, explain that.",
    "- Mention when a court is after sunset and not known to be lit.",
    "- Mention how fresh the reservation data is when you give availability.",
    "- Keep answers short: lead with the best options (park and court counts), then details. Use plain text with short lists.",
  ].join("\n");
}
