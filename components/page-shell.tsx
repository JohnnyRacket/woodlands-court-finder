import { ArrowLeft, Trees } from "lucide-react";
import Link from "next/link";

/** Layout for the secondary pages: brand bar with a way back to the map. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#e3efe7,transparent_60%)] bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 pt-6 pb-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-2xl bg-primary text-brand-mint shadow-sm">
            <Trees className="size-4.5" />
          </span>
          <span className="text-sm font-semibold text-primary">Court Finder</span>
        </Link>
        <Link
          href="/"
          className="glass-panel inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-primary transition hover:bg-white"
        >
          <ArrowLeft className="size-4" /> Map
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">{children}</main>
    </div>
  );
}
