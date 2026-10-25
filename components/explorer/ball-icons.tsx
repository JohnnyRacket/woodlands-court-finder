// Tennis-ball and pickleball icons, used as map markers (data URIs) and in the panels.
// Grey versions mean "courts here, but none you can play on right now".

import type { Sport } from "./park-summary";

const PALETTE = {
  tennis: { fill: "#cfe047", stroke: "#a9b92c", detail: "#ffffff", text: "#24361f" },
  pickleball: { fill: "#f5b82e", stroke: "#d1951a", detail: "#b97c10", text: "#3b2a07" },
  muted: { fill: "#d5dbd7", stroke: "#b5beb8", detail: "#eef1ef", text: "#56625a" },
};

export function ballColors(sport: Sport, muted: boolean) {
  return muted ? PALETTE.muted : PALETTE[sport];
}

function ballSvg(sport: Sport, muted: boolean): string {
  const c = ballColors(sport, muted);
  const detail =
    sport === "tennis"
      ? // two curved seams
        `<path d="M6 10.5c6 3 6 23 0 27M42 10.5c-6 3-6 23 0 27" fill="none" stroke="${c.detail}" stroke-width="2.6" stroke-linecap="round"/>`
      : // pickleball holes
        [
          [24, 9],
          [12, 15],
          [36, 15],
          [9, 28],
          [39, 28],
          [16, 39],
          [32, 39],
          [24, 42],
        ]
          .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${c.detail}"/>`)
          .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21.5" fill="${c.fill}" stroke="#ffffff" stroke-width="3"/><circle cx="24" cy="24" r="19.5" fill="none" stroke="${c.stroke}" stroke-width="1"/>${detail}</svg>`;
}

const cache = new Map<string, string>();

/** Data URI for a PictureMarkerSymbol. */
export function ballDataUri(sport: Sport, muted: boolean): string {
  const key = `${sport}|${muted}`;
  if (!cache.has(key)) cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ballSvg(sport, muted))}`);
  return cache.get(key)!;
}

/** A ball with a number on it, for the panels. */
export function BallBadge({ sport, count, muted, size = 32 }: { sport: Sport; count: number; muted: boolean; size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center drop-shadow-sm"
      style={{ width: size, height: size }}
      title={`${count} ${sport} court${count === 1 ? "" : "s"} to play`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG data URI */}
      <img src={ballDataUri(sport, muted)} alt="" className="absolute inset-0 size-full" />
      <span className="relative text-[13px] leading-none font-bold" style={{ color: ballColors(sport, muted).text }}>
        {count}
      </span>
    </span>
  );
}
