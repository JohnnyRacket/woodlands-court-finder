import { Suspense } from "react";
import { CourtExplorer } from "@/components/explorer/court-explorer";

export default function Home() {
  return (
    // The explorer reads its view from the URL, so it renders in the browser; the fallback is the map's backdrop.
    <Suspense fallback={<main className="h-dvh w-full bg-[#e9efe9]" />}>
      <CourtExplorer />
    </Suspense>
  );
}
