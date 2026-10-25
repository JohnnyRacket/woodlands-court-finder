import { CloudRain, ExternalLink, Lightbulb, LightbulbOff, MoonStar } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatClock, formatDay, formatHour, formatMinutes } from "@/lib/format";
import { LABEL_META } from "@/lib/label-meta";
import { getCourtDay } from "@/lib/queries/court-day";
import { addDays, chicagoDateHour } from "@/lib/time";
import { cn } from "@/lib/utils";

const KIND_TEXT = { tennis: "Tennis", pickleball: "Pickleball", tennis_pickleball: "Tennis · pickleball lines" } as const;

export default function CourtPage({ params, searchParams }: PageProps<"/courts/[id]">) {
  return (
    <PageShell>
      <Suspense fallback={<CourtDaySkeleton />}>
        <CourtDayView params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function CourtDayView({ params, searchParams }: Pick<PageProps<"/courts/[id]">, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  const { date: requested } = await searchParams;
  const now = chicagoDateHour(new Date());
  const dates = [now.date, addDays(now.date, 1)];
  const date = typeof requested === "string" && dates.includes(requested) ? requested : now.date;

  const day = getCourtDay(id, date);
  if (!day) notFound();
  const { court } = day;
  const playable = day.hours.filter((h) => h.label.publicCanJoin && !h.dark && !(date === now.date && h.hour < now.hour));

  return (
    <article className="flex flex-col gap-4">
      <section className="glass-panel p-6">
        <p className="text-sm text-muted-foreground">{court.parkName}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{court.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Chip>{KIND_TEXT[court.kind]}</Chip>
          {court.lighted === true && (
            <Chip>
              <Lightbulb className="size-3.5" /> Lit
            </Chip>
          )}
          {court.lighted === false && (
            <Chip>
              <LightbulbOff className="size-3.5" /> No lights
            </Chip>
          )}
          <Chip>{court.reservable ? "Reservable online" : "First come, first served"}</Chip>
          <Chip>
            <MoonStar className="size-3.5" /> Sunset {formatClock(day.sunset)}
          </Chip>
        </div>
        <div className="mt-5 flex items-center gap-2">
          {dates.map((d, i) => (
            <Link
              key={d}
              href={`/courts/${court.id}?date=${d}`}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium transition",
                d === date ? "bg-primary text-primary-foreground shadow-sm" : "bg-white/70 text-foreground/80 hover:bg-accent",
              )}
            >
              {i === 0 ? "Today" : "Tomorrow"} <span className="font-normal opacity-70">{formatDay(d)}</span>
            </Link>
          ))}
          {court.reservable && (
            <a
              href={`https://anc.apm.activecommunities.com/wcscparksandrec/reservation/landing/quick?locale=en-US&groupId=${court.kind === "pickleball" ? 25 : 20}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-primary/20 px-3 py-2 text-sm font-medium text-primary transition hover:bg-accent"
            >
              Reserve <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <p className="mt-4 text-sm">
          {playable.length === 0
            ? "No playable hours left on this day."
            : `${playable.length} playable hour${playable.length === 1 ? "" : "s"} left on this day.`}
        </p>
      </section>

      <section className="glass-panel p-3">
        <ol className="flex flex-col gap-1">
          {day.hours.map(({ hour, label, dark, weather }) => {
            const meta = LABEL_META[label.kind];
            const past = date === now.date && hour < now.hour;
            const current = date === now.date && hour === now.hour;
            return (
              <li
                key={hour}
                className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", current && "bg-primary/8 ring-1 ring-primary/25", past && "opacity-45")}
              >
                <span className="w-14 shrink-0 text-sm font-medium tabular-nums">{current ? "Now" : formatHour(hour)}</span>
                <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color, opacity: dark ? 0.45 : 1 }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{meta.text}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {"event" in label ? `${label.event.title} · ${formatMinutes(label.event.startMin)}–${formatMinutes(label.event.endMin)}` : meta.hint}
                  </span>
                </span>
                {dark && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground" title="After sunset and not known to be lit">
                    <MoonStar className="size-3.5" />
                  </span>
                )}
                {weather && (
                  <span className="flex w-24 shrink-0 items-center justify-end gap-2 text-xs text-muted-foreground tabular-nums" title={weather.shortForecast}>
                    <span className="font-medium text-foreground">{weather.tempF}°</span>
                    <span className={cn("flex items-center gap-0.5", weather.precipPct >= 40 && "text-status-tournament")}>
                      <CloudRain className="size-3.5" />
                      {weather.precipPct}%
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {day.events.length > 0 && (
        <section className="glass-panel p-6">
          <h2 className="text-sm font-semibold">Scheduled at {court.parkName} this day</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {day.events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span>{event.url ? <a href={event.url} target="_blank" rel="noreferrer" className="hover:underline">{event.title}</a> : event.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatMinutes(event.startMin)}–{formatMinutes(event.endMin)} · {event.courtKind ?? "any court"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 font-medium text-foreground/80">{children}</span>;
}

function CourtDaySkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-48 rounded-3xl bg-white/60" />
      <Skeleton className="h-[40rem] rounded-3xl bg-white/60" />
    </div>
  );
}
