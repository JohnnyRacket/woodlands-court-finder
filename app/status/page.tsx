import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAgo } from "@/lib/format";
import { getStatus, type SourceStatus } from "@/lib/queries/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data status · Court Finder" };

const DESCRIPTIONS: Record<string, string> = {
  courts: "Township GIS court outlines joined with ActiveNet's reservable courts",
  "activenet-slots": "Hourly reservation status for today and tomorrow",
  weather: "National Weather Service hourly forecast",
  "township-page": "Pickleball drop-in times and tournaments from the Township website",
  "activenet-programs": "Lessons, leagues and clinics from ActiveNet",
};

export default function StatusPage() {
  return (
    <PageShell>
      <div className="mb-4 px-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Data status</h1>
        <p className="text-sm text-muted-foreground">
          Where every number on the map comes from, how fresh it is, and what didn&apos;t line up between Township systems.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[36rem] rounded-3xl bg-white/60" />}>
        <StatusView />
      </Suspense>
    </PageShell>
  );
}

async function StatusView() {
  await connection();
  const status = getStatus();
  const now = new Date();
  const findings = status.sources.flatMap((source) => (source.lastRun?.notes ?? []).map((note) => ({ source: source.name, note })));

  return (
    <div className="flex flex-col gap-4">
      <section className="glass-panel flex flex-wrap gap-x-6 gap-y-2 px-6 py-4 text-sm">
        <span>
          Sync profile: <strong className="font-semibold">{status.profile}</strong>
          <span className="text-muted-foreground">{status.profile === "gentle" ? " (slow schedules for development)" : " (production schedules)"}</span>
        </span>
        <span>
          Scheduler: <strong className="font-semibold">{status.schedulerEnabled ? "running" : "off"}</strong>
        </span>
      </section>

      <section className="glass-panel divide-y divide-border/60">
        {status.sources.map((source) => (
          <SourceRow key={source.name} source={source} now={now} />
        ))}
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-sm font-semibold">Data-quality findings</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reported by the latest run of each source. These are mismatches between Township systems, not errors in this app.
        </p>
        {findings.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">None reported.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {findings.map(({ source, note }) => (
              <li key={`${source}|${note}`} className="rounded-2xl bg-white/70 px-4 py-2.5">
                <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{source}</span>
                {note}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-panel p-6">
        <h2 className="text-sm font-semibold">Stored data</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {status.rowCounts.map(({ table, rows }) => (
            <div key={table} className="rounded-2xl bg-white/70 px-4 py-3">
              <dt className="text-xs text-muted-foreground">{table}</dt>
              <dd className="text-lg font-semibold tabular-nums">{rows.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function SourceRow({ source, now }: { source: SourceStatus; now: Date }) {
  const run = source.lastRun;
  const state = !run ? "never" : run.ok ? "ok" : "failed";
  const Icon = { ok: CheckCircle2, failed: CircleAlert, never: CircleDashed }[state];

  return (
    <div className="flex items-start gap-4 px-6 py-4">
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", { ok: "text-status-open", failed: "text-destructive", never: "text-muted-foreground" }[state])}
        aria-label={state}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h3 className="font-medium">{source.name}</h3>
          <code className="text-xs text-muted-foreground">{source.schedule}</code>
        </div>
        <p className="text-sm text-muted-foreground">{DESCRIPTIONS[source.name]}</p>
        <p className="mt-1 text-xs">
          {source.lastSuccessAt ? `Last success ${formatAgo(source.lastSuccessAt, now)}` : "Never succeeded"}
          {run?.ok && ` · ${run.rows.toLocaleString()} rows`}
        </p>
        {run && !run.ok && <p className="mt-1 rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{run.error}</p>}
      </div>
    </div>
  );
}
