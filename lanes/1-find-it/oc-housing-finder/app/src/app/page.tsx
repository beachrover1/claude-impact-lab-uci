"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Feature, Meta, Weights } from "@/lib/types";
import { COMPONENT_LABELS, score } from "@/lib/types";
import { LAW_LONG, LAW_SHORT, LABEL_COLOR } from "@/lib/detail";
import type { Layers } from "@/components/MapView";
import ParcelPanel from "@/components/ParcelPanel";
import SourcesModal from "@/components/SourcesModal";
import CompareModal from "@/components/CompareModal";
import Assistant from "@/components/Assistant";
import ScoreRing from "@/components/ScoreRing";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading map…</div>,
});

// ASSUMPTION: lot-size ranges for each project size. Not a density calculation.
const PROJECT_SIZES: Record<string, { label: string; min: number; max: number }> = {
  small: { label: "4–12 homes", min: 0.15, max: 5 },
  mid: { label: "13–50 homes", min: 0.5, max: 10 },
  any: { label: "Any size", min: 0, max: 100 },
};

const CITIES = ["Santa Ana", "Anaheim (soon)", "Irvine (soon)", "Fullerton (soon)"];

export default function Home() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [compare, setCompare] = useState<Feature[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [layers, setLayers] = useState<Layers>({ zoning: false, transit: false, flood: false, publicLand: true });

  const [laws, setLaws] = useState<string[]>(["SHRA_SB684", "SHRA_SB1123", "AB2011", "SB4"]);
  const [labels, setLabels] = useState<string[]>(["Potentially suitable", "Needs review"]);
  const [size, setSize] = useState("small");
  const [minAcres, setMinAcres] = useState(PROJECT_SIZES.small.min);
  const [maxAcres, setMaxAcres] = useState(PROJECT_SIZES.small.max);
  const [vacantOrUnder, setVacantOrUnder] = useState(false);
  const [transitOnly, setTransitOnly] = useState(false);
  const [advanced, setAdvanced] = useState(false);
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

  useEffect(() => {
    const s = PROJECT_SIZES[size];
    setMinAcres(s.min);
    setMaxAcres(s.max);
  }, [size]);

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

  const publicLand = useMemo(() => features.filter((f) => f.properties.flags.surplus), [features]);
  const mapFeatures = useMemo(() => filtered.slice(0, 4000).map((x) => x.f), [filtered]);
  const top = filtered.slice(0, 25);

  const toggle = (arr: string[], set: (x: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const inCompare = (f: Feature) => compare.some((c) => c.properties.apn === f.properties.apn);
  const toggleCompare = (f: Feature) =>
    setCompare((c) => (inCompare(f) ? c.filter((x) => x.properties.apn !== f.properties.apn) : c.length >= 3 ? c : [...c, f]));

  function exportCsv() {
    const rows = [["rank", "score_ASSUMPTION_weights", "apn", "address", "zone", "acres_computed", "label", "possible_pathways", "unknowns_to_confirm"]];
    filtered.slice(0, 200).forEach(({ f, s }, i) => {
      const p = f.properties;
      rows.push([String(i + 1), String(s), p.apn, p.address ?? "", p.zone ?? "", String(p.acres), p.label,
        Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]).join("; "), String(p.unknowns)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "oc-housing-finder-santa-ana-calllist.csv";
    a.click();
  }

  const suitable = meta?.counts["Potentially suitable"] ?? 0;

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      {/* Top navigation */}
      <header className="z-20 flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1b33] text-sm font-bold text-emerald-400">⌂</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">OC Housing Finder</div>
            <div className="text-[11px] text-slate-500">Where can the next affordable home go?</div>
          </div>
        </div>
        <div className="mx-2 hidden h-6 w-px bg-slate-200 md:block" />
        <label className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
          City
          <select className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800" value="Santa Ana" onChange={() => {}}>
            {CITIES.map((c) => (
              <option key={c} disabled={c !== "Santa Ana"}>{c}</option>
            ))}
          </select>
        </label>
        <label className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
          Project size
          <select className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800" value={size} onChange={(e) => setSize(e.target.value)}>
            {Object.entries(PROJECT_SIZES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <div className="hidden items-center gap-4 text-xs text-slate-500 lg:flex">
          <span><b className="text-slate-900">{(meta?.counts.parcels_screened ?? 0).toLocaleString()}</b> parcels screened</span>
          <span><b className="text-emerald-600">{suitable.toLocaleString()}</b> potentially suitable</span>
          <span><b className="text-red-600">{publicLand.length}</b> on public land notices</span>
        </div>
        <button onClick={() => setShowSources(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">Sources & assumptions</button>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3" title="No accounts in this prototype">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-xs font-semibold text-white">G</div>
          <span className="text-xs text-slate-600">Guest</span>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-50 px-4 py-1 text-[11px] text-amber-900">
        Prototype · not legal, zoning or financial advice · ✅ pass ❌ fail ❓ could not check 🔎 lead, not fact · confirm every result with the city
      </div>
      {err && <div className="bg-red-50 p-3 text-sm text-red-800">Could not load data: {err}. Run the pipeline first (see README).</div>}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Navy sidebar */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden bg-[#0b1b33] text-slate-100 md:w-[340px]">
          <div className="space-y-3 border-b border-white/10 p-4">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address or APN…" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-400" />
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pathways</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(LAW_SHORT).map(([k, v]) => (
                  <button key={k} onClick={() => toggle(laws, setLaws, k)} title={LAW_LONG[k]}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${laws.includes(k) ? "border-emerald-400 bg-emerald-400/15 text-emerald-300" : "border-white/15 text-slate-400 hover:text-white"}`}>
                    {v} <span className="opacity-60">{meta?.law_counts[k] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(LABEL_COLOR).map((l) => (
                <button key={l} onClick={() => toggle(labels, setLabels, l)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${labels.includes(l) ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-slate-500"}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: LABEL_COLOR[l] }} /> {l}
                </button>
              ))}
            </div>
            <button onClick={() => setAdvanced(!advanced)} className="text-xs text-slate-400 hover:text-white">{advanced ? "▾" : "▸"} Advanced filters & score weights</button>
            {advanced && weights && (
              <div className="space-y-2 rounded-lg bg-white/5 p-3 text-xs text-slate-300">
                <label className="block">Min lot acres: {minAcres}<input type="range" min={0} max={2} step={0.05} value={minAcres} onChange={(e) => setMinAcres(+e.target.value)} className="w-full accent-emerald-400" /></label>
                <label className="block">Max lot acres: {maxAcres}<input type="range" min={0.25} max={10} step={0.25} value={Math.min(maxAcres, 10)} onChange={(e) => setMaxAcres(+e.target.value)} className="w-full accent-emerald-400" /></label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={vacantOrUnder} onChange={(e) => setVacantOrUnder(e.target.checked)} /> Vacant, underused or surplus only</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={transitOnly} onChange={(e) => setTransitOnly(e.target.checked)} /> Near high-quality transit</label>
                <div className="pt-1 font-semibold text-slate-200">Score weights <span className="font-normal text-amber-300">ASSUMPTION</span></div>
                {(Object.keys(COMPONENT_LABELS) as (keyof Weights)[]).map((k) => (
                  <label key={k} className="block">{COMPONENT_LABELS[k]}: {weights[k]}
                    <input type="range" min={0} max={50} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: +e.target.value })} className="w-full accent-emerald-400" />
                  </label>
                ))}
                <p className="text-[10px] text-slate-500">Project-size presets map to lot acres (ASSUMPTION).</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Call list · {filtered.length.toLocaleString()} sites
            </div>
            <button onClick={exportCsv} className="text-xs text-emerald-300 hover:text-emerald-200">Export CSV</button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {top.map(({ f, s }, i) => {
              const p = f.properties;
              const sel = selected?.properties.apn === p.apn;
              return (
                <div key={p.apn} onClick={() => setSelected(f)}
                  className={`cursor-pointer rounded-xl border p-3 transition ${sel ? "border-emerald-400 bg-white/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"}`}>
                  <div className="flex items-start gap-3">
                    <ScoreRing score={s} size={42} dark />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{i + 1}. {p.address ?? "APN " + p.apn}</div>
                      <div className="text-[11px] text-slate-400">{p.acres} ac · zone {p.zone ?? "?"}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => (
                          <span key={k} className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">{LAW_SHORT[k]}</span>
                        ))}
                        {p.flags.vacant && <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] text-sky-300">Vacant</span>}
                        {p.flags.transit && <span className="rounded bg-violet-400/15 px-1.5 py-0.5 text-[10px] text-violet-300">Transit</span>}
                        {p.flags.surplus && <span className="rounded bg-red-400/15 px-1.5 py-0.5 text-[10px] text-red-300">Public land</span>}
                        {p.flags.worship_lead && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-300">Faith lead</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: LABEL_COLOR[p.label] }} /> {p.label}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); toggleCompare(f); }}
                      disabled={!inCompare(f) && compare.length >= 3}
                      className={`rounded-md px-2 py-0.5 text-[11px] ${inCompare(f) ? "bg-emerald-400 text-[#0b1b33]" : "border border-white/15 text-slate-300 hover:border-white/40 disabled:opacity-30"}`}>
                      {inCompare(f) ? "✓ Comparing" : "+ Compare"}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length > 25 && <p className="px-1 text-[11px] text-slate-500">Showing the top 25. The map shows up to 4,000; narrow the filters or export the CSV for more.</p>}
          </div>
        </aside>

        {/* Map canvas */}
        <main className="relative min-h-[55vh] flex-1">
          {features.length > 0 && weights && (
            <MapView features={mapFeatures} publicLand={publicLand} selected={selected} onSelect={setSelected} weights={weights} layers={layers} setLayers={setLayers} />
          )}
          {meta && weights && <Assistant selected={selected} meta={meta} weights={weights} />}
          {compare.length > 0 && (
            <div className="absolute left-1/2 top-4 z-[1000] flex -translate-x-1/2 items-center gap-3 rounded-full bg-[#0b1b33] py-1.5 pl-4 pr-1.5 text-sm text-white shadow-xl">
              <span>{compare.length} of 3 selected</span>
              <button onClick={() => setCompare([])} className="text-xs text-slate-400 hover:text-white">Clear</button>
              <button onClick={() => setShowCompare(true)} disabled={compare.length < 2} className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-[#0b1b33] disabled:opacity-40">Compare</button>
            </div>
          )}
        </main>

        {selected && meta && weights && (
          <aside className="h-[70vh] w-full shrink-0 border-l border-slate-200 md:h-auto md:w-[430px]">
            <ParcelPanel f={selected} meta={meta} weights={weights} onClose={() => setSelected(null)} inCompare={inCompare(selected)} onToggleCompare={() => toggleCompare(selected)} compareFull={compare.length >= 3} />
          </aside>
        )}
      </div>
      {showSources && meta && <SourcesModal meta={meta} onClose={() => setShowSources(false)} />}
      {showCompare && meta && weights && (
        <CompareModal items={compare} meta={meta} weights={weights} onClose={() => setShowCompare(false)} onRemove={(apn) => setCompare((c) => c.filter((x) => x.properties.apn !== apn))} />
      )}
    </div>
  );
}
