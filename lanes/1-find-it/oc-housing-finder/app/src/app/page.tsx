"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Feature, Meta, Weights } from "@/lib/types";
import { COMPONENT_LABELS, score } from "@/lib/types";
import ParcelPanel from "@/components/ParcelPanel";
import SourcesModal from "@/components/SourcesModal";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false, loading: () => <div className="p-4">Loading map…</div> });

const LAW_SHORT: Record<string, string> = {
  SB9: "SB 9 duplex / lot split",
  SHRA_SB684: "SB 684 small-lot (multifamily zone)",
  SHRA_SB1123: "SB 1123 small-lot (vacant single-family)",
  AB2011: "AB 2011 commercial land",
  SB4: "SB 4 faith land (lead)",
};

export default function Home() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [showSources, setShowSources] = useState(false);

  const [laws, setLaws] = useState<string[]>(["SHRA_SB684", "SHRA_SB1123", "AB2011", "SB4"]);
  const [labels, setLabels] = useState<string[]>(["Potentially suitable", "Needs review"]);
  const [minAcres, setMinAcres] = useState(0.15);
  const [maxAcres, setMaxAcres] = useState(5);
  const [vacantOrUnder, setVacantOrUnder] = useState(false);
  const [transitOnly, setTransitOnly] = useState(false);
  const [q, setQ] = useState("");
  const [weights, setWeights] = useState<Weights | null>(null);

  useEffect(() => {
    Promise.all([fetch("data/parcels.geojson").then((r) => r.json()), fetch("data/meta.json").then((r) => r.json())])
      .then(([fc, m]) => {
        setFeatures(fc.features);
        setMeta(m);
        setWeights(m.assumptions.weights.value);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const filtered = useMemo(() => {
    if (!weights) return [];
    const qq = q.trim().toLowerCase();
    return features
      .filter((f) => {
        const p = f.properties;
        if (qq) return (p.address ?? "").toLowerCase().includes(qq) || p.apn.includes(qq);
        if (!labels.includes(p.label)) return false;
        if (!laws.some((l) => p.laws[l] === "possible" || (p.label === "Not enough data" && p.laws[l] === "unclear"))) return false;
        if (p.acres < minAcres || p.acres > maxAcres) return false;
        if (vacantOrUnder && !(p.flags.vacant || p.flags.underused || p.flags.surplus)) return false;
        if (transitOnly && !p.flags.transit) return false;
        return true;
      })
      .map((f) => ({ f, s: score(f.properties.components, weights) }))
      .sort((a, b) => b.s - a.s);
  }, [features, laws, labels, minAcres, maxAcres, vacantOrUnder, transitOnly, q, weights]);

  const mapFeatures = useMemo(() => filtered.slice(0, 4000).map((x) => x.f), [filtered]);
  const top = filtered.slice(0, 10);

  function exportCsv() {
    if (!meta) return;
    const rows = [["rank", "score_ASSUMPTION_weights", "apn", "address", "zone", "acres_computed", "label", "possible_pathways", "unknowns_to_confirm"]];
    filtered.slice(0, 200).forEach(({ f, s }, i) => {
      const p = f.properties;
      rows.push([String(i + 1), String(s), p.apn, p.address ?? "", p.zone ?? "", String(p.acres), p.label,
        Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]).join("; "), String(p.unknowns)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `oc-housing-finder-santa-ana-calllist.csv`;
    a.click();
  }

  const toggle = (arr: string[], set: (x: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="flex h-screen flex-col bg-stone-50 text-ink">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2">
        <div>
          <span className="text-lg font-semibold">OC Housing Finder</span>
          <span className="ml-2 text-sm text-stone-500">Where can the next affordable home go? · Santa Ana pilot</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => setShowSources(true)} className="rounded border px-3 py-1 hover:bg-stone-100">Sources & assumptions</button>
        </div>
      </header>
      <div className="bg-amber-50 px-4 py-1 text-xs text-amber-900">
        Prototype. Not legal, zoning or financial advice. ✅ pass · ❌ fail · ❓ could not check · 🔎 lead, not fact. Confirm every result with the city.
      </div>
      {err && <div className="bg-red-50 p-3 text-sm text-red-800">Could not load data: {err}. Run the pipeline first (see README).</div>}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="w-full shrink-0 overflow-y-auto border-r bg-white p-3 text-sm md:w-80">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or APN…" className="mb-3 w-full rounded border px-2 py-1.5" />

          <div className="mb-3">
            <div className="mb-1 font-semibold">Pathways</div>
            {Object.entries(LAW_SHORT).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2">
                <input type="checkbox" checked={laws.includes(k)} onChange={() => toggle(laws, setLaws, k)} />
                <span>{v}</span>
                <span className="ml-auto text-xs text-stone-400">{meta?.law_counts[k] ?? 0}</span>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <div className="mb-1 font-semibold">Result label</div>
            {["Potentially suitable", "Needs review", "Not enough data"].map((l) => (
              <label key={l} className="flex items-center gap-2">
                <input type="checkbox" checked={labels.includes(l)} onChange={() => toggle(labels, setLabels, l)} /> {l}
              </label>
            ))}
          </div>

          <div className="mb-3">
            <div className="mb-1 font-semibold">Project fit (4–12 homes)</div>
            <label className="block">Min lot acres: {minAcres}
              <input type="range" min={0} max={2} step={0.05} value={minAcres} onChange={(e) => setMinAcres(+e.target.value)} className="w-full" />
            </label>
            <label className="block">Max lot acres: {maxAcres}
              <input type="range" min={0.25} max={10} step={0.25} value={maxAcres} onChange={(e) => setMaxAcres(+e.target.value)} className="w-full" />
            </label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={vacantOrUnder} onChange={(e) => setVacantOrUnder(e.target.checked)} /> Vacant, underused or surplus only</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={transitOnly} onChange={(e) => setTransitOnly(e.target.checked)} /> Near high-quality transit</label>
          </div>

          {weights && (
            <details className="mb-3">
              <summary className="cursor-pointer font-semibold">Score weights <span className="text-xs font-normal text-amber-700">ASSUMPTION</span></summary>
              {(Object.keys(COMPONENT_LABELS) as (keyof Weights)[]).map((k) => (
                <label key={k} className="block text-xs">{COMPONENT_LABELS[k]}: {weights[k]}
                  <input type="range" min={0} max={50} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: +e.target.value })} className="w-full" />
                </label>
              ))}
            </details>
          )}

          <div className="mb-1 flex items-center justify-between">
            <div className="font-semibold">Call list: top 10 of {filtered.length.toLocaleString()}</div>
            <button onClick={exportCsv} className="text-xs text-blue-700 underline">CSV (top 200)</button>
          </div>
          <ol className="space-y-1">
            {top.map(({ f, s }, i) => (
              <li key={f.properties.apn}>
                <button onClick={() => setSelected(f)} className={`w-full rounded border px-2 py-1 text-left hover:bg-orange-50 ${selected?.properties.apn === f.properties.apn ? "border-clay" : ""}`}>
                  <div className="flex justify-between"><span className="font-medium">{i + 1}. {f.properties.address ?? f.properties.apn}</span><span>{s}</span></div>
                  <div className="text-xs text-stone-500">
                    {Object.entries(f.properties.laws).filter(([, v]) => v === "possible").map(([k]) => k.replace("SHRA_", "")).join(" · ")} · {f.properties.acres} ac · {f.properties.label}
                  </div>
                </button>
              </li>
            ))}
          </ol>
          {filtered.length > 4000 && <p className="mt-2 text-xs text-stone-500">Map shows the top 4,000 by score. Narrow the filters to see the rest.</p>}
        </aside>

        <main className="relative min-h-[50vh] flex-1">
          {features.length > 0 && <MapView features={mapFeatures} selected={selected} onSelect={setSelected} />}
          <div className="absolute bottom-3 left-3 z-[1000] rounded bg-white/90 px-2 py-1 text-xs shadow">
            <span className="mr-2"><span className="inline-block h-2 w-2 rounded-full bg-[#2f8f5b]" /> Potentially suitable</span>
            <span className="mr-2"><span className="inline-block h-2 w-2 rounded-full bg-[#d69a2d]" /> Needs review</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-[#8a8580]" /> Not enough data</span>
          </div>
        </main>

        {selected && meta && weights && (
          <aside className="h-[60vh] w-full shrink-0 border-l md:h-auto md:w-[420px]">
            <ParcelPanel f={selected} meta={meta} weights={weights} onClose={() => setSelected(null)} />
          </aside>
        )}
      </div>
      {showSources && meta && <SourcesModal meta={meta} onClose={() => setShowSources(false)} />}
    </div>
  );
}
