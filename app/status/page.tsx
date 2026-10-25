import { CheckCircle2, CircleAlert, CircleDashed, Clock, PauseCircle, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExpandableChips } from "@/components/expandable-chips";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAgo } from "@/lib/format";
import { getStatus, type Finding, type SourceState, type SourceStatus } from "@/lib/queries/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data status · Woodlands Court Finder" };

const STATE: Record<SourceState, { label: string; icon: typeof CheckCircle2; pill: string }> = {
  up_to_date: { label: "Up to date", icon: CheckCircle2, pill: "bg-status-open/12 text-status-open" },
  delayed: { label: "Delayed", icon: Clock, pill: "bg-status-program/15 text-[#a8700d]" },
  failed: { label: "Update failed", icon: CircleAlert, pill: "bg-destructive/10 text-destructive" },
  paused: { label: "Updates paused", icon: PauseCircle, pill: "bg-muted text-muted-foreground" },
  never: { label: "Not loaded yet", icon: CircleDashed, pill: "bg-muted text-muted-foreground" },
};

const SUMMARY: Record<SourceState, { title: string; body: string; tone: string }> = {
  up_to_date: { title: "All data is up to date", body: "Every source refreshed on schedule.", tone: "bg-status-open/10 text-status-open" },
  delayed: { title: "Some data is running late", body: "The map still works; a source hasn't refreshed on schedule yet.", tone: "bg-status-program/12 text-[#a8700d]" },
  failed: { title: "An update didn't work", body: "The map is showing the last good data for that source.", tone: "bg-destructive/10 text-destructive" },
  paused: { title: "Automatic updates are paused", body: "This server isn't refreshing data on its own right now.", tone: "bg-muted text-muted-foreground" },
  never: { title: "Some data hasn't loaded yet", body: "It will appear after the first refresh.", tone: "bg-muted text-muted-foreground" },
};

const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });

export default function StatusPage() {
  return (
    <PageShell>
      <div className="mb-5 px-1">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Data status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Woodlands Court Finder combines public data from The Woodlands Township, the National Weather Service and Open-Meteo. Here&apos;s how current it is.
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
  const now = new Date();
  const status = getStatus(now);
  const summary = SUMMARY[status.overall];
  const SummaryIcon = STATE[status.overall].icon;
  const withFindings = status.sources.filter((source) => source.findings.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <section className={cn("flex items-center gap-3 rounded-3xl px-5 py-4", summary.tone)}>
        <SummaryIcon className="size-6 shrink-0" />
        <div>
          <p className="font-semibold">{summary.title}</p>
          <p className="text-sm opacity-80">{summary.body}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {status.sources.map((source) => (
          <SourceCard key={source.name} source={source} now={now} />
        ))}
      </section>

      {withFindings.length > 0 && (
        <section className="glass-panel p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4.5 text-status-program" /> Data discrepancies
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Places where Township systems disagree with each other. Woodlands Court Finder works around them, but fixing them at the source would help every app that
            uses this data.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {withFindings.flatMap((source) =>
              source.findings.map((finding, i) => <FindingCard key={`${source.name}-${i}`} source={source.title} finding={finding} />),
            )}
          </div>
        </section>
      )}

      <details className="glass-panel group px-6 py-4 text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground select-none group-open:mb-3">Technical details</summary>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
          <dt className="text-muted-foreground">Sync profile</dt>
          <dd className="sm:col-span-2">{status.profile === "gentle" ? "gentle (slow schedules for development)" : "live (production schedules)"}</dd>
          <dt className="text-muted-foreground">Scheduler</dt>
          <dd className="sm:col-span-2">{status.schedulerEnabled ? "running" : "off"}</dd>
          {status.rowCounts.map(({ table, rows }) => (
            <div key={table} className="contents">
              <dt className="font-mono text-xs text-muted-foreground">{table}</dt>
              <dd className="tabular-nums sm:col-span-2">{rows.toLocaleString()} rows</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}

function SourceCard({ source, now }: { source: SourceStatus; now: Date }) {
  const state = STATE[source.state];
  const Icon = state.icon;
  return (
    <article className="glass-panel flex flex-col gap-3 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{source.title}</h3>
          <p className="text-xs text-muted-foreground">from {source.origin}</p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", state.pill)}>
          <Icon className="size-3.5" /> {state.label}
        </span>
      </header>
      <p title={source.lastSuccessAt ? timeFormat.format(new Date(source.lastSuccessAt)) : undefined}>
        <span className="block text-xs text-muted-foreground">Last updated</span>
        <span className="text-xl font-semibold tracking-tight">{source.lastSuccessAt ? formatAgo(source.lastSuccessAt, now) : "Not yet"}</span>
      </p>
      {source.error && (
        <p className="rounded-2xl bg-destructive/8 px-3 py-2 text-xs text-destructive">
          The latest refresh didn&apos;t work, so this shows the last good data.
        </p>
      )}
      <p className="mt-auto text-xs text-muted-foreground">{source.schedule}</p>
    </article>
  );
}

function FindingCard({ source, finding }: { source: string; finding: Finding }) {
  return (
    <article className="rounded-2xl bg-white/75 px-4 py-3.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{source}</p>
      <h3 className="mt-0.5 text-sm font-semibold">{finding.headline}</h3>
      {finding.detail && <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>}
      {finding.items.length > 0 && (
        <div className="mt-2">
          <ExpandableChips items={finding.items} />
        </div>
      )}
    </article>
  );
}
