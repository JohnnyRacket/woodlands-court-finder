"use client";

import "@arcgis/core/assets/esri/themes/light/view.css";
import esriConfig from "@arcgis/core/config";
import ArcGISMap from "@arcgis/core/Map";
import Basemap from "@arcgis/core/Basemap";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import OpenStreetMapLayer from "@arcgis/core/layers/OpenStreetMapLayer";
import PictureMarkerSymbol from "@arcgis/core/symbols/PictureMarkerSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import MapView from "@arcgis/core/views/MapView";
import { Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { LABEL_META } from "@/lib/label-meta";
import type { CourtStatus } from "@/lib/queries/court-status";
import { ballColors, ballDataUri } from "./ball-icons";
import type { ParkSummary, Sport } from "./park-summary";

const WOODLANDS_CENTER: [number, number] = [-95.49, 30.19];
const HOME_ZOOM = 12;
const PARK_ZOOM = 17;
const COURT_ZOOM = 18.5;
/** Below this scale (zoomed in), park markers float above the park as pins. */
const PIN_SCALE = 9_000;

// With an ArcGIS Location Platform key, use Esri's light-gray vector basemap;
// without one, muted OpenStreetMap tiles (no key needed).
const ARCGIS_API_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
if (ARCGIS_API_KEY) esriConfig.apiKey = ARCGIS_API_KEY;

// React's development mode mounts the map twice; the first, cancelled basemap load
// logs an AbortError that isn't a real problem.
esriConfig.log.interceptors.push((_level, _module, ...args) => args.some((arg) => arg?.name === "AbortError"));

function createBasemap() {
  if (ARCGIS_API_KEY) return "arcgis/light-gray";
  return new Basemap({
    baseLayers: [new OpenStreetMapLayer({ effect: "saturate(45%) brightness(105%) contrast(92%)" })],
  });
}

export interface Selection {
  parkId: string | null;
  courtId: string | null;
}

interface CourtMapProps {
  parks: ParkSummary[];
  courts: CourtStatus[];
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** Width in px of the floating panel on the right (0 when closed), to keep the map centered in view. */
  rightPanelWidth: number;
}

/** Ball markers for one park: one per sport, side by side. */
function parkMarkers(park: ParkSummary, selected: boolean, yoffset: number, size: number, halo: boolean): Graphic[] {
  const geometry = new Point({ longitude: park.lng, latitude: park.lat });
  const attributes = { parkId: park.id };
  const sports = (["tennis", "pickleball"] as Sport[]).filter((sport) => park.sports[sport]);
  const graphics: Graphic[] = [];
  const spacing = size * 0.62;

  if (selected && halo) {
    graphics.push(
      new Graphic({
        geometry,
        attributes,
        symbol: new SimpleMarkerSymbol({
          size: size + 10 + (sports.length - 1) * spacing * 2,
          yoffset,
          color: [41, 92, 45, 0.18],
          outline: { color: "#295c2d", width: 2 },
        }),
      }),
    );
  }
  sports.forEach((sport, i) => {
    const summary = park.sports[sport]!;
    const muted = summary.joinable === 0;
    const xoffset = sports.length === 1 ? 0 : (i === 0 ? -1 : 1) * spacing;
    graphics.push(
      new Graphic({
        geometry,
        attributes,
        symbol: new PictureMarkerSymbol({ url: ballDataUri(sport, muted), width: size, height: size, xoffset, yoffset }),
      }),
      new Graphic({
        geometry,
        attributes,
        symbol: new TextSymbol({
          text: String(summary.joinable),
          color: ballColors(sport, muted).text,
          // A halo in the ball's color keeps the number readable over the pickleball holes.
          haloColor: ballColors(sport, muted).fill,
          haloSize: 1.5,
          xoffset,
          yoffset,
          verticalAlignment: "middle",
          horizontalAlignment: "center",
          font: { size: size * 0.4, weight: "bold" },
        }),
      }),
    );
  });
  return graphics;
}

export function CourtMap({ parks, courts, selection, onSelect, rightPanelWidth }: CourtMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const layersRef = useRef<{ parks: GraphicsLayer; pins: GraphicsLayer; courts: GraphicsLayer } | null>(null);
  const rightPanelRef = useRef(0);
  const fitPaddingRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const courtLayer = new GraphicsLayer({ minScale: 20_000 });
    const parkLayer = new GraphicsLayer({ maxScale: PIN_SCALE });
    const pinLayer = new GraphicsLayer({ minScale: PIN_SCALE });
    const map = new ArcGISMap({ basemap: createBasemap(), layers: [courtLayer, parkLayer, pinLayer] });
    const view = new MapView({
      container: containerRef.current!,
      map,
      center: WOODLANDS_CENTER,
      zoom: HOME_ZOOM,
      constraints: { minZoom: 10, maxZoom: 20, rotationEnabled: false },
      ui: { components: [] },
      popupEnabled: false,
    });

    // Keep the map's center clear of the floating panels.
    const fitPadding = () => {
      view.padding = window.matchMedia("(min-width: 768px)").matches
        ? { top: 0, right: rightPanelRef.current, left: 400, bottom: 60 }
        : { top: 0, right: 0, left: 0, bottom: window.innerHeight * 0.45 };
    };
    fitPadding();
    window.addEventListener("resize", fitPadding);

    const include = [parkLayer, pinLayer, courtLayer];
    const hitAttributes = async (event: Parameters<MapView["hitTest"]>[0]) => {
      const { results } = await view.hitTest(event, { include });
      const hit = results.find((result) => result.type === "graphic");
      return hit?.type === "graphic" ? (hit.graphic.attributes as { parkId?: string; courtId?: string } | null) : null;
    };

    const click = view.on("click", async (event) => {
      const hit = await hitAttributes(event);
      onSelectRef.current({ parkId: hit?.parkId ?? null, courtId: hit?.courtId ?? null });
    });

    // Pointer cursor over anything clickable; one hit test in flight at a time.
    let probing = false;
    const hover = view.on("pointer-move", async (event) => {
      if (probing) return;
      probing = true;
      try {
        const hit = await hitAttributes(event);
        if (containerRef.current) containerRef.current.style.cursor = hit?.parkId ? "pointer" : "";
      } finally {
        probing = false;
      }
    });

    viewRef.current = view;
    layersRef.current = { parks: parkLayer, pins: pinLayer, courts: courtLayer };
    fitPaddingRef.current = fitPadding;
    return () => {
      click.remove();
      hover.remove();
      window.removeEventListener("resize", fitPadding);
      view.destroy();
      viewRef.current = null;
      layersRef.current = null;
      fitPaddingRef.current = null;
    };
  }, []);

  // Redraw graphics whenever the data or selection changes.
  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;

    layers.courts.removeAll();
    layers.courts.addMany(
      courts
        .filter((court) => court.geometry)
        .map((court) => {
          const selected = court.id === selection.courtId;
          return new Graphic({
            geometry: new Polygon({ rings: JSON.parse(court.geometry!).coordinates, spatialReference: { wkid: 4326 } }),
            symbol: new SimpleFillSymbol({
              color: withAlpha(LABEL_META[court.label.kind].color, court.dark ? 0.35 : selected ? 0.95 : 0.8),
              outline: { color: selected ? "#1f1f1f" : "#ffffff", width: selected ? 3 : 1.5 },
            }),
            attributes: { parkId: court.parkId, courtId: court.id },
          });
        }),
    );

    layers.parks.removeAll();
    layers.pins.removeAll();
    for (const park of parks) {
      const selected = park.id === selection.parkId;
      layers.parks.addMany(parkMarkers(park, selected, 0, selected ? 34 : 30, true));
      layers.pins.add(
        new Graphic({
          geometry: new Point({ longitude: park.lng, latitude: park.lat }),
          attributes: { parkId: park.id },
          symbol: new SimpleMarkerSymbol({ size: 7, color: "#295c2d", outline: { color: "#ffffff", width: 2 } }),
        }),
      );
      // Zoomed in, the pin floats well above the park so it never covers the court outlines.
      layers.pins.addMany(parkMarkers(park, selected, 46, selected ? 30 : 26, false));
    }
  }, [parks, courts, selection]);

  useEffect(() => {
    rightPanelRef.current = rightPanelWidth;
    fitPaddingRef.current?.();
  }, [rightPanelWidth]);

  // Fly to the selected court (when it has an outline) or park.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const court = courts.find((c) => c.id === selection.courtId && c.geometry);
    const park = parks.find((p) => p.id === selection.parkId);
    const target = court
      ? { target: new Polygon({ rings: JSON.parse(court.geometry!).coordinates, spatialReference: { wkid: 4326 } }).extent!.center, zoom: COURT_ZOOM }
      : park
        ? { center: [park.lng, park.lat], zoom: Math.max(view.zoom, PARK_ZOOM) }
        : null;
    if (target) view.when(() => view.goTo(target, { duration: 700 })).catch(() => {});
    // Only when the selection changes, not on every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.parkId, selection.courtId]);

  const zoomBy = (delta: number) => {
    const view = viewRef.current;
    view?.goTo({ zoom: view.zoom + delta }, { duration: 250 }).catch(() => {});
  };
  const home = () => {
    onSelect({ parkId: null, courtId: null });
    viewRef.current?.goTo({ center: WOODLANDS_CENTER, zoom: HOME_ZOOM }, { duration: 600 }).catch(() => {});
  };

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="size-full" />
      <div className="glass-panel absolute right-4 bottom-12 flex flex-col overflow-hidden rounded-2xl p-1 max-md:hidden">
        <MapButton label="Zoom in" onClick={() => zoomBy(1)}>
          <Plus className="size-4" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-1)}>
          <Minus className="size-4" />
        </MapButton>
        <MapButton label="Show all parks" onClick={home}>
          <Maximize className="size-4" />
        </MapButton>
      </div>
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-9 cursor-pointer place-items-center rounded-xl text-foreground/80 transition hover:bg-accent hover:text-primary"
    >
      {children}
    </button>
  );
}

function withAlpha(hex: string, alpha: number): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}
