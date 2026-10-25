import { z } from "zod";

export const alertsResponseSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        id: z.string(),
        status: z.string(),
        event: z.string(),
        headline: z.string().nullable(),
        severity: z.string(),
        description: z.string().nullable(),
        instruction: z.string().nullable(),
        effective: z.iso.datetime({ offset: true }),
        onset: z.iso.datetime({ offset: true }).nullable(),
        expires: z.iso.datetime({ offset: true }),
        ends: z.iso.datetime({ offset: true }).nullable(),
      }),
    }),
  ),
});

export interface WeatherAlert {
  id: string;
  /** "Heat Advisory", "Severe Thunderstorm Warning", … */
  event: string;
  headline: string | null;
  /** NWS severity: Extreme, Severe, Moderate, Minor, Unknown */
  severity: string;
  description: string | null;
  instruction: string | null;
  /** When the hazard starts and ends; ends falls back to when the message expires. ISO instants. */
  startsAt: string;
  endsAt: string;
}

/** Active alerts for the point. Tests and drills are dropped; only real ones reach players. */
export function toWeatherAlerts(json: unknown): WeatherAlert[] {
  return alertsResponseSchema
    .parse(json)
    .features.map((f) => f.properties)
    .filter((p) => p.status === "Actual")
    .map((p) => ({
      id: p.id,
      event: p.event,
      headline: p.headline,
      severity: p.severity,
      description: p.description,
      instruction: p.instruction,
      startsAt: new Date(p.onset ?? p.effective).toISOString(),
      endsAt: new Date(p.ends ?? p.expires).toISOString(),
    }));
}
