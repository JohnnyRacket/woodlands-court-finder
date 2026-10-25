"use client";

import "./globals.css";

// Replaces the root layout when it fails, so it brings its own <html> and <body>.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="grid h-full place-items-center bg-background p-6 font-sans">
        <main className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-semibold text-primary">Woodlands Court Finder couldn&apos;t load</h1>
          <p className="text-sm text-muted-foreground">Something went wrong on our end. It&apos;s usually temporary.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-1 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
