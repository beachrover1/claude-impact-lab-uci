"use client";
import type { Meta } from "@/lib/types";

const LAYER_NAMES: Record<string, string> = {
  parcels_sa: "Santa Ana Assessor Parcels (APN, site address, assessed values; owner fields NOT downloaded)",
  zoning_city: "Santa Ana Zoning Classifications",
  zoning_scag: "SCAG Zoning_poly_OR (2024 regional zoning, second source)",
  he_sites: "SCAG Housing Element Sites",
  footprints: "OC Building Footprints",
  flood_fema: "FEMA National Flood Hazard Layer",
  fire_lra_oc: "OC Fire Hazard Severity Zones (LRA)",
  fire_sra_state: "CAL FIRE Fire Hazard Severity Zones (SRA, 2007)",
  liquefaction: "OC Liquefaction zones (CGS, county copy)",
  landslide: "CGS Landslide Zones",
  hqta: "Caltrans High-Quality Transit Areas",
};

export default function SourcesModal({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 text-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-between">
          <h2 className="text-lg font-semibold text-ink">Sources, assumptions & data gaps</h2>
          <button onClick={onClose} className="px-2 text-stone-500">✕</button>
        </div>

        <h3 className="mt-3 font-semibold">Laws (HCD Housing Law Fact Sheets, April 2026)</h3>
        <ul className="list-disc pl-5">
          {Object.values(meta.laws.sources).map((s) => (
            <li key={s.title}>
              <a className="text-blue-700 underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> · {s.statute} · checked {meta.laws.checked}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-stone-500">Fact sheets summarize the law. Confirm against the Government Code before relying on any result.</p>

        <h3 className="mt-4 font-semibold">Map data</h3>
        <ul className="list-disc pl-5">
          {Object.entries(meta.layers).map(([k, v]) => (
            <li key={k}>
              {LAYER_NAMES[k] ?? k}:{" "}
              {v ? (<><a className="break-all text-blue-700 underline" href={v.url} target="_blank" rel="noreferrer">{v.url}</a> · downloaded {v.fetched}</>) : <span className="text-red-700">not loaded (related checks show “could not check”)</span>}
            </li>
          ))}
          <li>HCD Surplus Land Act notices: {meta.layers_extra.surplus_land ? <a className="text-blue-700 underline" href={meta.layers_extra.surplus_land.dataset} target="_blank" rel="noreferrer">data.ca.gov</a> : "not loaded"} ({meta.surplus_santa_ana.length} rows mention Santa Ana)</li>
          <li>Places of worship: {meta.layers_extra.worship_osm ? "OpenStreetMap via Overpass (ODbL), downloaded " + meta.layers_extra.worship_osm.fetched : "not loaded"}</li>
          <li>Urban area check: {meta.city_rules.urbanized.source}</li>
        </ul>

        <h3 className="mt-4 font-semibold text-amber-800">ASSUMPTIONS</h3>
        <ul className="list-disc pl-5">
          {Object.entries(meta.assumptions).map(([k, a]) => (
            <li key={k}><code>{k}</code> = {JSON.stringify(a.value)}: {a.why}</li>
          ))}
          <li>Zone categories (single-family, multifamily, commercial…) are our reading of Santa Ana's zone descriptions, not a city determination. Specific plans and specific developments are marked “needs review”.</li>
        </ul>

        <h3 className="mt-4 font-semibold text-red-800">Known data gaps</h3>
        <ul className="list-disc pl-5">
          {meta.data_gaps.map((g) => <li key={g}>{g}</li>)}
        </ul>

        <p className="mt-4 rounded bg-amber-50 p-2 text-xs">Prototype built at the Claude Impact Lab hackathon. It is not legal, zoning, environmental or financial advice. Every parcel-level result must be checked with the city and a professional.</p>
      </div>
    </div>
  );
}
