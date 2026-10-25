// Tennis-ball and pickleball icons, used as map markers (data URIs) and in the panels.
// Grey versions mean "courts here, but none you can play on right now".

import type { Sport } from "./park-summary";

const PALETTE = {
  tennis: { light: "#e8f37e", fill: "#cfe047", shade: "#a5b628", detail: "#ffffff", text: "#24361f" },
  pickleball: { light: "#ffd86b", fill: "#f5b82e", shade: "#d38e18", detail: "#b4740e", text: "#3b2a07" },
  muted: { light: "#eef1ef", fill: "#d5dbd7", shade: "#b3bcb6", detail: "#a9b3ad", text: "#56625a" },
};

export function ballColors(sport: Sport, muted: boolean) {
  return muted ? PALETTE.muted : PALETTE[sport];
}

// Pickleball holes, placed evenly on a sphere and projected onto the icon: holes facing
// the viewer are round, holes near the rim flatten into ovals and run off the edge.
// [cx, cy, rx, ry, rotation°], generated once (Fibonacci sphere, 20 holes, rotated).
const HOLES = [
  [44.1, 23.5, 4.58, 1.34, 88],
  [34.3, 12.9, 4.58, 3.17, 43],
  [36.8, 36, 4.58, 2.52, 133],
  [23.4, 21.5, 4.58, 4.55, -14],
  [28.1, 3.7, 4.58, 0.71, 11],
  [22, 38.6, 4.58, 3.27, 188],
  [14.2, 11.5, 4.58, 2.99, -38],
  [9.1, 30.1, 4.58, 2.94, 248],
  [3.2, 21.8, 4.58, 0.4, -84],
];

function ballSvg(sport: Sport, muted: boolean): string {
  const c = ballColors(sport, muted);
  const detail =
    sport === "tennis"
      ? `<path d="M5 10c7 4 7 24 0 28M43 10c-7 4-7 24 0 28" fill="none" stroke="${muted ? "#f4f6f5" : c.detail}" stroke-width="2.6" stroke-linecap="round"/>`
      : HOLES.map(([x, y, rx, ry, a]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${x} ${y})" fill="${c.detail}"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">` +
    `<defs><radialGradient id="shade" cx="38%" cy="32%" r="72%"><stop offset="0" stop-color="${c.light}"/><stop offset=".6" stop-color="${c.fill}"/><stop offset="1" stop-color="${c.shade}"/></radialGradient>` +
    `<clipPath id="ball"><circle cx="24" cy="24" r="21"/></clipPath></defs>` +
    `<circle cx="24" cy="24" r="22.5" fill="#ffffff"/><circle cx="24" cy="24" r="21" fill="url(#shade)"/>` +
    `<g clip-path="url(#ball)">${detail}</g>` +
    `<ellipse cx="16.5" cy="12.5" rx="6" ry="3" transform="rotate(-35 16.5 12.5)" fill="#ffffff" opacity="${muted ? 0.5 : 0.4}"/>` +
    `</svg>`
  );
}

const cache = new Map<string, string>();

/** Data URI for a PictureMarkerSymbol. */
export function ballDataUri(sport: Sport, muted: boolean): string {
  const key = `${sport}|${muted}`;
  if (!cache.has(key)) cache.set(key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ballSvg(sport, muted))}`);
  return cache.get(key)!;
}

/** A thin outline in the ball's color, so numbers stay readable over the holes. */
const halo = (color: string) => [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((y) => `${x}px ${y}px 0 ${color}`)).join(", ");

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
      <span className="relative text-[13px] leading-none font-bold" style={{ color: ballColors(sport, muted).text, textShadow: halo(ballColors(sport, muted).fill) }}>
        {count}
      </span>
    </span>
  );
}
