import { getTimes } from "suncalc";

// Center of The Woodlands; sunset varies by well under a minute across the township.
const WOODLANDS = { lat: 30.1658, lng: -95.4613 };

/** Sunrise and sunset for a Chicago calendar date (YYYY-MM-DD). */
export function sunTimes(date: string): { sunrise: Date; sunset: Date } {
  // Midday UTC on that date falls inside the local day in any season, which is all SunCalc needs.
  const { sunrise, sunset } = getTimes(new Date(`${date}T18:00:00Z`), WOODLANDS.lat, WOODLANDS.lng);
  // SunCalc returns null only near the poles.
  if (!sunrise || !sunset) throw new Error(`No sunrise/sunset for ${date}`);
  return { sunrise, sunset };
}
