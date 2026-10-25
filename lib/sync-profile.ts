import type { SyncProfile } from "@/lib/sources/types";

/** gentle unless running in production or told otherwise with SYNC_PROFILE. */
export function syncProfile(): SyncProfile {
  const explicit = process.env.SYNC_PROFILE;
  if (explicit === "live" || explicit === "gentle") return explicit;
  return process.env.NODE_ENV === "production" ? "live" : "gentle";
}
