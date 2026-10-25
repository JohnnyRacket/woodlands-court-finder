import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Page not found · Woodlands Court Finder" };

export default function NotFound() {
  return (
    <PageShell>
      <section className="glass-panel flex flex-col items-start gap-3 p-6">
        <div>
          <h1 className="text-lg font-semibold text-primary">Page not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">There&apos;s nothing at this address.</p>
        </div>
        <Link
          href="/"
          className="mt-1 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          Find a court
        </Link>
      </section>
    </PageShell>
  );
}
