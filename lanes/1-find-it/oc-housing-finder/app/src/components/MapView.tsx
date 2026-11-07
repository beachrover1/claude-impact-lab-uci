"use client";
import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature } from "@/lib/types";

const COLORS: Record<string, string> = {
  "Potentially suitable": "#2f8f5b",
  "Needs review": "#d69a2d",
  "Not enough data": "#8a8580",
};

function FlyTo({ target }: { target: Feature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    const b = L.geoJSON(target as any).getBounds();
    map.flyToBounds(b, { maxZoom: 18, duration: 0.6 });
  }, [target, map]);
  return null;
}

export default function MapView({
  features,
  selected,
  onSelect,
}: {
  features: Feature[];
  selected: Feature | null;
  onSelect: (f: Feature) => void;
}) {
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const key = useMemo(() => `${features.length}-${features[0]?.properties.apn ?? ""}-${features.at(-1)?.properties.apn ?? ""}`, [features]);
  const selRef = useRef<string | null>(null);
  selRef.current = selected?.properties.apn ?? null;

  return (
    <MapContainer center={[33.745, -117.868]} zoom={13} className="h-full w-full" preferCanvas>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        key={key}
        data={{ type: "FeatureCollection", features } as any}
        style={(f: any) => ({
          renderer,
          color: COLORS[f.properties.label] ?? "#555",
          weight: 1,
          fillOpacity: 0.45,
        }) as any}
        onEachFeature={(f: any, layer) => {
          layer.on("click", () => onSelect(f));
          layer.bindTooltip(`${f.properties.address ?? f.properties.apn}<br/>${f.properties.label}`, { sticky: true });
        }}
      />
      {selected && (
        <GeoJSON
          key={"sel-" + selected.properties.apn}
          data={selected as any}
          style={() => ({ color: "#1d4ed8", weight: 4, fillOpacity: 0.1 })}
        />
      )}
      <FlyTo target={selected} />
    </MapContainer>
  );
}
