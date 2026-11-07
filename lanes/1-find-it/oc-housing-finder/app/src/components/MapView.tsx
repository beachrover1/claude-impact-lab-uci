"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, Weights } from "@/lib/types";
import { score } from "@/lib/types";
import { ZONE_COLOR, ZONE_NAME } from "@/lib/detail";
import { LABEL_STYLE } from "@/lib/theme";
const LABEL_COLOR: Record<string, string> = Object.fromEntries(Object.entries(LABEL_STYLE).map(([k, v]) => [k, v.map]));
const scoreColor = (s: number) => (s >= 75 ? "#1f3a5f" : s >= 55 ? "#c2562e" : "#8b8478");

function Resize({ dep }: { dep: any }) {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 220); }, [dep, map]);
  return null;
}

export type Layers = { zoning: boolean; transit: boolean; flood: boolean; publicLand: boolean };

function FlyTo({ target }: { target: Feature | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyToBounds(L.geoJSON(target as any).getBounds(), { maxZoom: 18, duration: 0.6 });
  }, [target, map]);
  return null;
}

function Controls({ layers, setLayers }: { layers: Layers; setLayers: (l: Layers) => void }) {
  const map = useMap();
  const [open, setOpen] = useState(false);
  const items: [keyof Layers, string, string][] = [
    ["zoning", "Zoning", "Color parcels by zone type"],
    ["transit", "Transit", "Caltrans high-quality transit areas"],
    ["flood", "Flood risk", "FEMA special flood hazard areas"],
    ["publicLand", "Public land", "Surplus Land Act notices (HCD)"],
  ];
  return (
    <>
      <div className="absolute right-4 top-4 z-[1000] w-56 rounded-xl border border-[#E9E2D6] bg-[#FFFDF9]/95 shadow-lg backdrop-blur">
        <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#6B6458]">
          Map layers <span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div className="space-y-1 px-2 pb-2">
            {items.map(([k, label, hint]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#f6f1e8]" title={hint}>
                <span className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition ${layers[k] ? "bg-[#1f3a5f]" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-[#FFFDF9] shadow transition ${layers[k] ? "left-3.5" : "left-0.5"}`} />
                </span>
                <input type="checkbox" className="sr-only" checked={layers[k]} onChange={() => setLayers({ ...layers, [k]: !layers[k] })} />
                <span className="text-sm text-[#1B2433]">{label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="absolute right-4 top-1/2 z-[1000] flex -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#E9E2D6] bg-[#FFFDF9] shadow-lg">
        <button onClick={() => map.zoomIn()} className="h-9 w-9 text-lg text-[#6B6458] hover:bg-[#f6f1e8]" aria-label="Zoom in">+</button>
        <div className="h-px bg-slate-200" />
        <button onClick={() => map.zoomOut()} className="h-9 w-9 text-lg text-[#6B6458] hover:bg-[#f6f1e8]" aria-label="Zoom out">−</button>
        <div className="h-px bg-slate-200" />
        <button onClick={() => map.flyTo([33.745, -117.868], 13)} className="h-9 w-9 text-sm text-[#6B6458] hover:bg-[#f6f1e8]" aria-label="Reset view" title="Reset view">⌂</button>
      </div>
    </>
  );
}

function useLayer(url: string, on: boolean) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (on && !data) fetch(url).then((r) => r.json()).then(setData).catch(() => {});
  }, [on, url, data]);
  return on ? data : null;
}

export type Pin = { f: Feature; s: number; rank: number };

export default function MapView({
  pins = [],
  expanded = false,
  features,
  publicLand,
  selected,
  onSelect,
  weights,
  layers,
  setLayers,
}: {
  features: Feature[];
  publicLand: Feature[];
  selected: Feature | null;
  onSelect: (f: Feature) => void;
  weights: Weights;
  layers: Layers;
  setLayers: (l: Layers) => void;
  pins?: Pin[];
  expanded?: boolean;
}) {
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const transit = useLayer("data/layers/transit_hqta.geojson", layers.transit);
  const flood = useLayer("data/layers/flood_sfha.geojson", layers.flood);
  const key = useMemo(
    () => `${features.length}-${features[0]?.properties.apn ?? ""}-${features.at(-1)?.properties.apn ?? ""}-${layers.zoning}-${Object.values(weights).join(",")}`,
    [features, layers.zoning, weights]
  );

  return (
    <MapContainer center={[33.745, -117.868]} zoom={13} className="h-full w-full bg-[#efe9df]" preferCanvas zoomControl={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {transit && <GeoJSON data={transit} style={() => ({ color: "#7c3aed", weight: 1, dashArray: "3 3", fillColor: "#8b5cf6", fillOpacity: 0.07 })} interactive={false} />}
      {flood && <GeoJSON data={flood} style={() => ({ color: "#0284c7", weight: 1, fillColor: "#38bdf8", fillOpacity: 0.3 })} interactive={false} />}
      <GeoJSON
        key={key}
        data={{ type: "FeatureCollection", features } as any}
        style={(f: any) =>
          ({
            renderer,
            color: layers.zoning ? ZONE_COLOR[f.properties.zcat] ?? "#94a3b8" : LABEL_COLOR[f.properties.label] ?? "#64748b",
            weight: 1,
            fillOpacity: 0.55,
          }) as any
        }
        onEachFeature={(f: any, layer) => {
          const p = f.properties;
          const s = score(p.components, weights);
          layer.on("click", () => onSelect(f));
          layer.bindTooltip(
            `<div style="font-family:inherit;min-width:160px">
               <div style="font-weight:600;color:#0f172a">${p.address ?? "APN " + p.apn}</div>
               <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                 <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${scoreColor(s)}"></span>
                 <span style="color:#334155">Score <b>${s}</b> · ${p.label}</span>
               </div>
               <div style="color:#64748b;font-size:11px;margin-top:2px">${p.acres} ac · zone ${p.zone ?? "?"}${layers.zoning && p.zcat ? " · " + (ZONE_NAME[p.zcat] ?? "") : ""}</div>
             </div>`,
            { sticky: true, direction: "top", offset: [0, -8], className: "ohf-tip" }
          );
        }}
      />
      {layers.publicLand && publicLand.length > 0 && (
        <GeoJSON
          key={"pl-" + publicLand.length}
          data={{ type: "FeatureCollection", features: publicLand } as any}
          style={() => ({ color: "#dc2626", weight: 3, fillColor: "#fca5a5", fillOpacity: 0.35, dashArray: "4 3" })}
          onEachFeature={(f: any, layer) => {
            layer.on("click", () => onSelect(f));
            layer.bindTooltip(`<b>${f.properties.address ?? f.properties.apn}</b><br/>City surplus land notice`, { sticky: true, className: "ohf-tip" });
          }}
        />
      )}
      {selected && (
        <GeoJSON key={"sel-" + selected.properties.apn} data={selected as any} style={() => ({ color: "#1d4ed8", weight: 4, fillOpacity: 0.08 })} interactive={false} />
      )}
      {pins.map(({ f, s, rank }) => {
        const c = L.geoJSON(f as any).getBounds().getCenter();
        const sel = selected?.properties.apn === f.properties.apn;
        return (
          <Marker
            key={"pin-" + f.properties.apn}
            position={c}
            eventHandlers={{ click: () => onSelect(f) }}
            icon={L.divIcon({
              className: "",
              iconSize: [34, 34],
              iconAnchor: [17, 17],
              html: `<div class="ohf-pin${sel ? " ohf-pin-sel" : ""}" style="background:${scoreColor(s)}" title="#${rank}">${s}</div>`,
            })}
          />
        );
      })}
      <Resize dep={expanded} />
      <FlyTo target={selected} />
      <Controls layers={layers} setLayers={setLayers} />
      <div className="pointer-events-none absolute bottom-6 right-4 z-[1000] flex max-w-[60%] flex-wrap justify-end gap-y-1 rounded-xl border border-[#E9E2D6] bg-[#FFFDF9]/95 px-3 py-1.5 text-xs text-[#6B6458] shadow-lg">
        {layers.zoning
          ? Object.entries(ZONE_NAME).slice(0, 6).map(([k, v]) => (
              <span key={k} className="mr-3 inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: ZONE_COLOR[k] }} /> {v}
              </span>
            ))
          : Object.entries(LABEL_COLOR).map(([k, v]) => (
              <span key={k} className="mr-3 inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: v }} /> {k}
              </span>
            ))}
        {layers.publicLand && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-600" /> Public land</span>}
      </div>
    </MapContainer>
  );
}
