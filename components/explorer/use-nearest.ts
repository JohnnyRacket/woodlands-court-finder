"use client";

import { useState } from "react";
import type { LatLng } from "@/lib/geo";

export interface Nearest {
  /** Sorting parks by distance (and showing "you are here"). */
  on: boolean;
  location: LatLng | null;
  locating: boolean;
  error: string | null;
}

/** Sort by distance only after the user asks: location is requested on that click, never on load. */
export function useNearest() {
  const [nearest, setNearest] = useState<Nearest>({ on: false, location: null, locating: false, error: null });

  const toggle = () => {
    if (nearest.on) return setNearest({ ...nearest, on: false });
    if (nearest.location) return setNearest({ ...nearest, on: true, error: null });
    if (!("geolocation" in navigator)) return setNearest({ ...nearest, error: "Location isn't available in this browser." });
    setNearest({ ...nearest, locating: true, error: null });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setNearest({ on: true, location: { lat: coords.latitude, lng: coords.longitude }, locating: false, error: null }),
      (err) =>
        setNearest((prev) => ({
          ...prev,
          locating: false,
          error: err.code === err.PERMISSION_DENIED ? "Location access was declined." : "Couldn't get your location.",
        })),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  };

  return [nearest, toggle] as const;
}
