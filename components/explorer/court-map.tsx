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
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import MapView from "@arcgis/core/views/MapView";
import { Minus, Plus, Maximize } from "lucide-react";
import { useEffect, useRef } from "react";
import { LABEL_META } from "@/lib/label-meta";
import type { CourtStatus } from "@/lib/queries/court-status";
import type { ParkSummary } from "./park-summary";

const WOODLANDS_CENTER: [number, number] = [-95.49, 30.19];

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
const HOME_ZOOM = 12;
const PARK_ZOOM = 17;

interface CourtMapProps {
  parks: ParkSummary[];
  courts: CourtStatus[];
  selectedParkId: string | null;
  onSelectPark: (parkId: string | null) => void;
}

export function CourtMap({ parks, courts, selectedParkId, onSelectPark }: CourtMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const layersRef = useRef<{ parks: GraphicsLayer; pins: GraphicsLayer; courts: GraphicsLayer } | null>(null);
  const detailOpenRef = useRef(false);
  const fitPaddingRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelectPark);
  useEffect(() => {
    onSelectRef.current = onSelectPark;
  }, [onSelectPark]);

  useEffect(() => {
    const courtLayer = new GraphicsLayer({ minScale: 20_000 });
    // Zoomed out: a count marker centered on each park. Zoomed in: a smaller pin that
    // floats above the park so the court outlines underneath stay visible.
    const parkLayer = new GraphicsLayer({ maxScale: 9_000 });
    const pinLayer = new GraphicsLayer({ minScale: 9_000 });
    const map = new ArcGISMap({
      basemap: createBasemap(),
      layers: [courtLayer, parkLayer, pinLayer],
    });
    const view = new MapView({
      container: containerRef.current!,
      map,
      center: WOODLANDS_CENTER,
      zoom: HOME_ZOOM,
      constraints: { minZoom: 10, maxZoom: 19, rotationEnabled: false },
      ui: { components: [] },
      popupEnabled: false,
    });
    // Keep the map's center clear of the floating panels.
    const fitPadding = () => {
      view.padding = window.matchMedia("(min-width: 768px)").matches
        ? { top: 0, right: detailOpenRef.current ? 400 : 0, left: 400, bottom: 60 }
        : { top: 0, right: 0, left: 0, bottom: window.innerHeight * 0.45 };
    };
    fitPadding();
    window.addEventListener("resize", fitPadding);
    const click = view.on("click", async (event) => {
      const { results } = await view.hitTest(event, { include: [parkLayer, pinLayer, courtLayer] });
      const hit = results.find((result) => result.type === "graphic");
      onSelectRef.current(hit?.type === "graphic" ? (hit.graphic.attributes?.parkId ?? null) : null);
    });
    viewRef.current = view;
    layersRef.current = { parks: parkLayer, pins: pinLayer, courts: courtLayer };
    fitPaddingRef.current = fitPadding;
    return () => {
      click.remove();
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
        .map(
          (court) =>
            new Graphic({
              geometry: new Polygon({ rings: JSON.parse(court.geometry!).coordinates, spatialReference: { wkid: 4326 } }),
              symbol: new SimpleFillSymbol({
                color: withAlpha(LABEL_META[court.label.kind].color, court.dark ? 0.35 : 0.8),
                outline: { color: court.parkId === selectedParkId ? "#1f1f1f" : "#ffffff", width: court.parkId === selectedParkId ? 2 : 1.5 },
              }),
              attributes: { parkId: court.parkId, courtId: court.id },
            }),
        ),
    );

    layers.parks.removeAll();
    layers.pins.removeAll();
    for (const park of parks) {
      const selected = park.id === selectedParkId;
      const geometry = new Point({ longitude: park.lng, latitude: park.lat });
      const outline = { color: selected ? "#1f1f1f" : "#ffffff", width: selected ? 3 : 2.5 };
      const count = (size: number, yoffset: number) =>
        new TextSymbol({ text: String(park.joinable), color: "#ffffff", yoffset, font: { size, weight: "bold" } });
      layers.parks.addMany([
        new Graphic({ geometry, symbol: new SimpleMarkerSymbol({ size: selected ? 34 : 28, color: park.color, outline }), attributes: { parkId: park.id } }),
        new Graphic({ geometry, symbol: count(selected ? 12 : 10.5, -4), attributes: { parkId: park.id } }),
      ]);
      layers.pins.addMany([
        new Graphic({ geometry, symbol: new SimpleMarkerSymbol({ size: 8, color: park.color, outline: { color: "#ffffff", width: 2 } }), attributes: { parkId: park.id } }),
        new Graphic({ geometry, symbol: new SimpleMarkerSymbol({ size: 26, yoffset: 30, color: park.color, outline }), attributes: { parkId: park.id } }),
        new Graphic({ geometry, symbol: count(10, 26), attributes: { parkId: park.id } }),
      ]);
    }
  }, [parks, courts, selectedParkId]);

  // Fly to the selected park.
  useEffect(() => {
    detailOpenRef.current = selectedParkId !== null;
    fitPaddingRef.current?.();
    const view = viewRef.current;
    const park = parks.find((p) => p.id === selectedParkId);
    if (!view || !park) return;
    view.when(() => view.goTo({ center: [park.lng, park.lat], zoom: PARK_ZOOM }, { duration: 800 })).catch(() => {});
    // Only when the selection changes, not on every data refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParkId]);

  const zoomBy = (delta: number) => {
    const view = viewRef.current;
    view?.goTo({ zoom: view.zoom + delta }, { duration: 250 }).catch(() => {});
  };
  const home = () => {
    onSelectPark(null);
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
      className="grid size-9 place-items-center rounded-xl text-foreground/80 transition hover:bg-accent hover:text-primary"
    >
      {children}
    </button>
  );
}

function withAlpha(hex: string, alpha: number): number[] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}
