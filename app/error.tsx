"use client";

import { CircleAlert } from "lucide-react";
import { PageShell } from "@/components/page-shell";

export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <PageShell>
      <section className="glass-panel flex flex-col items-start gap-3 p-6">
        <CircleAlert className="size-6 text-destructive" />
        <div>
          <h1 className="text-lg font-semibold text-primary">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">This page couldn&apos;t load. It&apos;s usually temporary.</p>
        </div>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-1 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Try again
        </button>
      </section>
    </PageShell>
  );
}
