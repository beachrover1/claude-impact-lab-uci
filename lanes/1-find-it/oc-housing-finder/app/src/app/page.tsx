"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Feature, Meta, Weights } from "@/lib/types";
import { score } from "@/lib/types";
import { LAW_LONG, LAW_SHORT } from "@/lib/detail";
import { PRICE_LIMITS, PRICE_NOTE, money, perAcre } from "@/lib/price";
import { FACTORS, LABEL_STYLE, PRESETS } from "@/lib/theme";
import { parseQuery, removeChip, type Parsed } from "@/lib/nlq";
import type { Layers } from "@/components/MapView";
import ParcelPanel from "@/components/ParcelPanel";
import SourcesModal from "@/components/SourcesModal";
import CompareModal from "@/components/CompareModal";
import CallCard from "@/components/CallCard";
import { AssistantCard, Funnel, HeadToHead, WeightsChart } from "@/components/Workbench";
import HeroSunset from "@/components/HeroSunset";
import { LogoMark, Wordmark } from "@/components/Logo";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[#9c958a]">Loading map…</div>,
});

// ASSUMPTION: lot-size ranges for each project size. Not a density calculation.
const SIZES: Record<string, { label: string; min: number; max: number }> = {
  small: { label: "4–12 homes", min: 0.15, max: 5 },
  mid: { label: "13–50 homes", min: 0.5, max: 10 },
  any: { label: "Any size", min: 0, max: 100 },
};
const TRY = ["Vacant single-family lots near transit, at least half an acre", "Public land near the train", "Church land, low flood risk", "Commercial corridor sites near transit"];

export default function Home() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [compare, setCompare] = useState<Feature[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [layers, setLayers] = useState<Layers>({ zoning: false, transit: false, flood: false, publicLand: true });
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [shown, setShown] = useState(10);

  const [mode, setMode] = useState<"ask" | "apn">("ask");
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed>({ chips: [] });
  const [q, setQ] = useState("");

  const [laws, setLaws] = useState<string[]>(["SB9", "SHRA_SB684", "SHRA_SB1123", "AB2011", "SB4"]);
  const [labels, setLabels] = useState<string[]>(["Potentially suitable", "Needs review"]);
  const [land, setLand] = useState<string[]>([]);
  const [price, setPrice] = useState("any");
  const [open, setOpen] = useState<Record<string, boolean>>({ pathways: true });
  const [size, setSize] = useState("small");
  const [preset, setPreset] = useState("balanced");
  const [weights, setWeights] = useState<Weights>(PRESETS.balanced.w);

  useEffect(() => {
    Promise.all([fetch("data/parcels.geojson").then((r) => r.json()), fetch("data/meta.json").then((r) => r.json())])
      .then(([fc, m]) => { setFeatures(fc.features); setMeta(m); })
      .catch((e) => setErr(String(e)));
  }, []);

  function submit(t: string) {
    if (mode === "apn") { setQ(t); return; }
    setText(t);
    setParsed(parseQuery(t));
    setQ("");
    setShown(10);
  }

  const ranked = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const sz = SIZES[size];
    const lawSet = parsed.laws ?? laws;
    return features
      .filter((f) => {
        const p = f.properties;
        if (qq) return (p.address ?? "").toLowerCase().includes(qq) || p.apn.includes(qq);
        if (!labels.includes(p.label)) return false;
        if (!lawSet.some((l) => p.laws[l] === "possible" || (p.label === "Not enough data" && p.laws[l] === "unclear"))) return false;
        const minA = Math.max(sz.min, parsed.minAcres ?? 0);
        if (p.acres < minA || p.acres > sz.max) return false;
        if (parsed.zcat && !parsed.zcat.includes((p as any).zcat)) return false;
        if (parsed.vacant && !p.flags.vacant) return false;
        if ((parsed.transit || land.includes("transit")) && !p.flags.transit) return false;
        if ((parsed.publicLand || land.includes("public")) && !p.flags.surplus) return false;
        if (parsed.lowFlood && p.flags.sfha) return false;
        if (land.includes("vacant") && !p.flags.vacant) return false;
        if (land.includes("underused") && !(p.flags.underused || p.flags.vacant)) return false;
        if (price !== "any" && !(p.land_value && p.land_value <= PRICE_LIMITS[price].max)) return false;
        return true;
      })
      .map((f) => ({ f, s: score(f.properties.components, weights) }))
      .sort((a, b) => b.s - a.s);
  }, [features, laws, labels, land, price, size, parsed, q, weights]);

  const publicLand = useMemo(() => features.filter((f) => f.properties.flags.surplus), [features]);
  const mapFeatures = useMemo(() => ranked.slice(0, 4000).map((x) => x.f), [ranked]);
  const pins = useMemo(() => ranked.slice(0, 10).map((x, i) => ({ ...x, rank: i + 1 })), [ranked]);
  const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;

  const toggle = (arr: string[], set: (x: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const inCompare = (f: Feature) => compare.some((c) => c.properties.apn === f.properties.apn);
  const toggleCompare = (f: Feature) => setCompare((c) => (inCompare(f) ? c.filter((x) => x.properties.apn !== f.properties.apn) : c.length >= 3 ? c : [...c, f]));

  function exportCsv() {
    const rows = [["rank", "score_ASSUMPTION_weights", "apn", "address", "zone", "acres_computed", "assessed_land_value_usd_NOT_market_price", "assessed_per_acre_usd", "label", "possible_pathways", "unknowns_to_confirm"]];
    ranked.slice(0, 200).forEach(({ f, s }, i) => {
      const p = f.properties;
      rows.push([String(i + 1), String(s), p.apn, p.address ?? "", p.zone ?? "", String(p.acres), p.land_value ? String(p.land_value) : "", p.land_value ? String(Math.round((p.land_value / p.acres) || 0)) : "", p.label,
        Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]).join("; "), String(p.unknowns)]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "landora-santa-ana-calllist.csv";
    a.click();
  }

  const Section = ({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) => (
    <div className="border-t border-[#E9E2D6] first:border-t-0">
      <button onClick={() => setOpen({ ...open, [id]: !open[id] })} className="flex w-full items-center justify-between px-5 py-3.5 text-left">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-xs text-[#6B6458]">{count} on {open[id] ? "−" : "+"}</span>
      </button>
      {open[id] && <div className="px-5 pb-4">{children}</div>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Hero: sunset OC skyline */}
      <div className="relative overflow-hidden bg-[linear-gradient(180deg,#d7e6f3_0%,#f3e5dc_42%,#ffe6cc_78%,#ffd9b3_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#fff3e6_0%,rgba(255,243,230,.92)_30%,rgba(255,243,230,0)_60%)]" />
        <HeroSunset />
        <header className="relative z-[1500] mx-auto flex h-20 max-w-[1500px] items-center gap-4 px-6">
          <div className="flex items-center gap-3 rounded-2xl bg-white/70 py-2 pl-2 pr-4 shadow-sm backdrop-blur">
            <LogoMark size={44} />
            <Wordmark size={27} />
          </div>
          <nav className="hidden items-center gap-1 rounded-full bg-white/60 p-1 text-sm shadow-sm backdrop-blur md:flex">
            <span className="rounded-full bg-white px-4 py-1.5 font-semibold text-[#1f3a5f] shadow-sm">Workbench</span>
            <button onClick={() => setShowSources(true)} className="rounded-full px-4 py-1.5 text-[#33415c] hover:bg-white/70">Sources & assumptions</button>
          </nav>
          <div className="flex-1" />
          <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-medium text-[#1f3a5f] shadow-sm backdrop-blur" title="Project size (ASSUMPTION lot-size ranges)">
            {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>Santa Ana · {v.label}</option>)}
          </select>
          <button onClick={exportCsv} className="rounded-full border border-white/70 bg-white/75 px-5 py-2 text-sm font-semibold text-[#1f3a5f] shadow-sm backdrop-blur hover:bg-white">Export</button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ffb54d] to-[#f07a2c] text-sm font-bold text-white shadow" title="Guest: no accounts in this prototype">G</div>
        </header>

        <section className="relative mx-auto max-w-[1500px] px-6 pb-28 pt-10 md:pt-14">
          <div className="absolute right-8 top-6 hidden items-center gap-3 rounded-2xl bg-white/80 px-5 py-3.5 shadow-lg backdrop-blur lg:flex">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm"><LogoMark size={40} /></span>
            <div className="leading-tight">
              <div className="text-[17px] font-bold text-[#1f3a5f]">More Homes.</div>
              <div className="text-[17px] font-bold text-[#1f3a5f]">A Stronger OC.</div>
              <div className="mt-1 h-0.5 w-16 rounded bg-[#f07a2c]" />
            </div>
          </div>

          <div className="max-w-[760px]">
            <div className="mb-4 flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[#e0641f]">
              Housing site intelligence · Orange County <span className="h-px w-14 bg-[#e0641f]" />
            </div>
            <h1 className="font-display text-[44px] font-semibold leading-[1.05] tracking-tight text-[#14284b] md:text-[64px]">
              Turn overlooked land into affordable homes.
            </h1>
            <p className="mt-6 max-w-[520px] text-[19px] leading-[1.6] text-[#4a5568]">
              Find promising sites, see which state laws unlock them, and know what's left to check.
            </p>

            <div className="mt-7 flex gap-2">
              {(["ask", "apn"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-[13px] font-semibold shadow-sm backdrop-blur ${mode === m ? "bg-[#1f3a5f] text-white" : "bg-white/70 text-[#33415c] hover:bg-white"}`}>
                  {m === "ask" ? "Ask in plain English" : "Address / APN"}
                </button>
              ))}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submit(text); }} className="mt-3 rounded-[28px] bg-white/95 p-3 pl-6 shadow-[0_25px_60px_-25px_rgba(20,40,75,.55)] backdrop-blur">
              <div className="flex items-center gap-3">
                <span className="text-2xl text-[#f07a2c]">✦</span>
                <input value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={mode === "ask" ? "Vacant single-family lots near transit, at least half an acre…" : "1111 N Bristol or 405-274-10"}
                  className="flex-1 bg-transparent py-3 text-[17px] text-[#14284b] outline-none placeholder:text-[#8a8f9c]" />
                <button aria-label="Find sites" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1f3a5f] text-xl text-white shadow-lg transition hover:scale-105 hover:bg-[#28497a]">→</button>
              </div>
              {((mode === "ask" && (parsed.chips.length > 0 || text)) || (mode === "apn" && q)) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 pb-1 text-[12.5px] text-[#5b6475]">
                {mode === "ask" && parsed.chips.map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 rounded-full bg-[#1f3a5f]/10 px-3 py-1 font-semibold text-[#1f3a5f]">
                    {c.label}<button type="button" onClick={() => setParsed(removeChip(parsed, c.id))} className="opacity-60 hover:text-[#e0641f]">×</button>
                  </span>
                ))}
                {mode === "ask" && text && parsed.chips.length === 0 && <span>No filters recognized yet. Try vacant, transit, half an acre, church, public land.</span>}
                {mode === "apn" && q && <span className="flex items-center gap-1.5 rounded-full bg-[#1f3a5f]/10 px-3 py-1 font-semibold text-[#1f3a5f]">“{q}”<button type="button" onClick={() => { setQ(""); setText(""); }} className="opacity-60">×</button></span>}
              </div>
              )}
            </form>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-[#33415c]">
              <span>Try:</span>
              {TRY.slice(1, 3).map((t) => (
                <button key={t} onClick={() => { setMode("ask"); setText(t); setParsed(parseQuery(t)); setQ(""); }} className="rounded-full bg-white/70 px-3 py-1 font-medium text-[#1f3a5f] shadow-sm backdrop-blur hover:bg-white">{t}</button>
              ))}
              <span className="text-[11px] text-[#5b6475]">· keyword rules, not AI</span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[#14284b]">
              {[["📍", "Explore parcels", "explore"], ["🛡️", "Check eligibility", "eligibility"], ["✦", "Ask the assistant", "assistant"]].map(([ic, label, id], i) => (
                <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`flex items-center gap-2.5 px-4 py-2 hover:text-[#e0641f] ${i ? "border-l border-[#14284b]/15" : ""}`}>
                  <span className="text-lg">{ic}</span>{label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* navy + orange swoosh */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full" viewBox="0 0 1600 80" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,62 C380,30 760,86 1100,52 C1300,32 1460,24 1600,30 V80 H0 Z" fill="#1f3a5f" />
          <path d="M0,58 C380,26 760,82 1100,48 C1300,28 1460,20 1600,26" stroke="#f07a2c" strokeWidth="5" fill="none" />
        </svg>
      </div>

      {/* stats band */}
      <div className="bg-[#1f3a5f]">
        <div className="mx-auto max-w-[1500px] px-6 pb-6">
          <div className="flex flex-wrap items-center gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] px-6 py-4 text-white">
            {[
              ["🏢", (meta?.counts.parcels_screened ?? 0).toLocaleString("en-US"), "Parcels screened"],
              ["⭐", (meta?.counts["Potentially suitable"] ?? 0).toLocaleString("en-US"), "Potentially suitable"],
              ["🏠", String(publicLand.length), "Public land leads"],
              ["⚖️", "5", "State laws checked"],
            ].map(([ic, n, l], i) => (
              <div key={l} className={`flex min-w-[180px] flex-1 items-center gap-4 ${i ? "md:border-l md:border-white/15 md:pl-6" : ""}`}>
                <span className="text-3xl">{ic}</span>
                <div className="leading-tight">
                  <div className="num text-[26px] font-bold">{n}</div>
                  <div className="text-[14px] text-white/75">{l}</div>
                </div>
              </div>
            ))}
            <button onClick={() => document.getElementById("eligibility")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="flex items-center gap-3 rounded-full border border-white/20 px-5 py-2.5 text-[14px] font-medium hover:bg-white/10">
              <span className="text-[#7fd49b]">🌿</span> Building a more affordable Orange County <span className="text-lg">→</span>
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px] px-6 pb-16 pt-4">
        {err && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">Could not load data: {err}</div>}

        <div className="relative mt-6 grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)_330px]">
          {/* Left: scoring studio + filters */}
          <div className="space-y-5">
            <div className="card p-5">
              <div className="font-display text-lg font-semibold">Scoring studio</div>
              <div className="mb-4 text-xs text-[#6B6458]">Drag to re-rank the call list live</div>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {Object.entries(PRESETS).map(([k, v]) => (
                  <button key={k} onClick={() => { setPreset(k); setWeights(v.w); }}
                    className={`rounded-xl px-2 py-2 text-[13px] font-semibold ${preset === k ? "bg-[#1f3a5f] text-white shadow" : "border border-[#E9E2D6] bg-white text-[#1B2433] hover:bg-[#f6f1e8]"}`}>{v.label}</button>
                ))}
              </div>
              <div className="mb-4 flex h-2.5 overflow-hidden rounded-full">
                {FACTORS.map((x) => <div key={x.key} style={{ width: `${(weights[x.key] / totalW) * 100}%`, background: x.color }} />)}
              </div>
              {FACTORS.map((x) => {
                const pct = Math.round((weights[x.key] / totalW) * 100);
                return (
                  <label key={x.key} className="mb-3.5 block" title={x.hint}>
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />{x.label}</span>
                      <span className="num font-semibold">{pct}%</span>
                    </div>
                    <input type="range" min={0} max={50} value={weights[x.key]} className="factor w-full"
                      style={{ ["--c" as any]: x.color, ["--p" as any]: `${(weights[x.key] / 50) * 100}%` }}
                      onChange={(e) => { setPreset(""); setWeights({ ...weights, [x.key]: +e.target.value }); }} />
                  </label>
                );
              })}
              <p className="text-[10.5px] text-[#c2562e]">Presets and weights are ASSUMPTIONS, not policy.</p>
            </div>

            <div className="card overflow-hidden">
              <Section id="pathways" title="Pathways" count={laws.length}>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(LAW_SHORT).map(([k, v]) => (
                    <button key={k} title={LAW_LONG[k]} onClick={() => toggle(laws, setLaws, k)}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${laws.includes(k) ? "border-[#2a7f8f] bg-[#2a7f8f]/10 text-[#1d5d69]" : "border-[#E9E2D6] text-[#6B6458]"}`}>
                      {v} <span className="font-normal opacity-60">{meta?.law_counts[k] ?? 0}</span>
                    </button>
                  ))}
                </div>
                {parsed.laws && <p className="mt-2 text-[11px] text-[#c2562e]">Your question limits this to {parsed.laws.map((l) => LAW_SHORT[l]).join(", ")}.</p>}
              </Section>
              <Section id="status" title="Status" count={labels.length}>
                {Object.entries(LABEL_STYLE).map(([l, st]) => (
                  <label key={l} className="mb-1.5 flex cursor-pointer items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={labels.includes(l)} onChange={() => toggle(labels, setLabels, l)} className="accent-[#1f3a5f]" />
                    <span className="h-2 w-2 rounded-full" style={{ background: st.dot }} /> {l}
                  </label>
                ))}
              </Section>
              <Section id="price" title="Assessed land value" count={price === "any" ? 0 : 1}>
                <select value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-[#E9E2D6] bg-white px-3 py-2 text-[13px]">
                  {Object.entries(PRICE_LIMITS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <p className="mt-2 text-[11px] leading-snug text-[#6B6458]">{PRICE_NOTE} Parcels with no assessed value are hidden when a limit is set.</p>
              </Section>
              <Section id="land" title="Land type" count={land.length}>
                {[["vacant", "Vacant (footprints < 2%)"], ["underused", "Vacant or possibly underused"], ["public", "Public land notice"], ["transit", "Near high-quality transit"]].map(([k, v]) => (
                  <label key={k} className="mb-1.5 flex cursor-pointer items-center gap-2 text-[13px]">
                    <input type="checkbox" checked={land.includes(k)} onChange={() => toggle(land, setLand, k)} className="accent-[#1f3a5f]" /> {v}
                  </label>
                ))}
              </Section>
            </div>
          </div>

          {/* Center: map, call list, head-to-head */}
          <div className="min-w-0 space-y-5">
            <div id="explore" className={`card relative scroll-mt-6 overflow-hidden p-0 transition-all ${expanded ? "h-[640px]" : "h-[400px]"}`}>
              {features.length > 0 && (
                <MapView features={mapFeatures} publicLand={publicLand} selected={selected} weights={weights}
                  onSelect={(f) => { setSelected(f); setDrawer(true); }} layers={layers} setLayers={setLayers} pins={pins} expanded={expanded} />
              )}
              <div className="pointer-events-none absolute left-4 top-4 z-[1000] rounded-xl border border-[#E9E2D6] bg-[#FFFDF9]/95 px-3 py-1.5 text-[12.5px] text-[#1B2433] shadow">
                Pins = your top 10 · they re-rank with your weights
              </div>
              <button onClick={() => setExpanded(!expanded)} className="absolute bottom-4 left-4 z-[1000] rounded-xl border border-[#E9E2D6] bg-[#FFFDF9] px-3 py-1.5 text-[12.5px] font-semibold shadow hover:bg-white">
                {expanded ? "Collapse map" : "Expand map"}
              </button>
            </div>

            <div id="eligibility" className="flex scroll-mt-6 items-end justify-between">
              <div>
                <span className="font-display text-2xl font-semibold">Ranked call list</span>
                <span className="ml-3 text-sm text-[#6B6458]">{ranked.length.toLocaleString()} sites · weights: {PRESETS[preset]?.label ?? "Custom"}</span>
              </div>
              <div className="flex rounded-xl border border-[#E9E2D6] bg-white p-1 text-[13px]">
                {(["cards", "table"] as const).map((v) => (
                  <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 font-medium capitalize ${view === v ? "bg-[#efe9df]" : "text-[#6B6458]"}`}>{v}</button>
                ))}
              </div>
            </div>

            {view === "cards" ? (
              <div className="space-y-3">
                {ranked.slice(0, shown).map(({ f, s }, i) => (
                  <CallCard key={f.properties.apn} f={f} s={s} rank={i + 1} meta={meta!} weights={weights}
                    selected={selected?.properties.apn === f.properties.apn} comparing={inCompare(f)} compareFull={compare.length >= 3}
                    onSelect={() => setSelected(f)} onFull={() => { setSelected(f); setDrawer(true); }} onCompare={() => toggleCompare(f)} />
                ))}
              </div>
            ) : (
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#f3eee5] text-left text-[11px] uppercase tracking-wider text-[#6B6458]">
                    <tr>{["#", "Score", "Address / APN", "Acres", "Assessed land", "Zone", "Pathways", "Status", ""].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {ranked.slice(0, shown).map(({ f, s }, i) => (
                      <tr key={f.properties.apn} onClick={() => { setSelected(f); setDrawer(true); }} className="cursor-pointer border-t border-[#E9E2D6] hover:bg-[#f9f5ee]">
                        <td className="px-3 py-2 text-[#9c958a]">{i + 1}</td>
                        <td className="num px-3 py-2 font-bold text-[#1f3a5f]">{s}</td>
                        <td className="px-3 py-2 font-medium">{f.properties.address ?? f.properties.apn}</td>
                        <td className="num px-3 py-2">{f.properties.acres}</td>
                        <td className="num px-3 py-2">{money(f.properties.land_value)}<span className="text-[11px] text-[#9c958a]"> {f.properties.land_value ? `· ${money(perAcre(f.properties.land_value, f.properties.acres))}/ac` : ""}</span></td>
                        <td className="px-3 py-2">{f.properties.zone}</td>
                        <td className="px-3 py-2">{Object.entries(f.properties.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]).join(", ")}</td>
                        <td className="px-3 py-2">{f.properties.label}</td>
                        <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); toggleCompare(f); }}>
                          <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${inCompare(f) ? "bg-[#1f3a5f] text-white" : "border border-[#E9E2D6]"}`}>{inCompare(f) ? "✓" : "+ Compare"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {ranked.length > shown && (
              <button onClick={() => setShown(shown + 10)} className="w-full rounded-xl border border-dashed border-[#d9cfbf] py-2.5 text-sm font-medium text-[#6B6458] hover:bg-white">
                Show 10 more of {ranked.length.toLocaleString()}
              </button>
            )}
            <HeadToHead items={compare} weights={weights} onFull={() => setShowCompare(true)} onRemove={(apn) => setCompare((c) => c.filter((x) => x.properties.apn !== apn))} />
          </div>

          {/* Right: funnel, weights chart, assistant */}
          <div className="space-y-5">
            {meta && <Funnel meta={meta} onList={ranked.length} publicLand={publicLand.length} sizeLabel={SIZES[size].label} />}
            <WeightsChart top={ranked} weights={weights} />
            <div id="assistant" className="scroll-mt-6" />
            {meta && <AssistantCard ranked={ranked} compare={compare} selected={selected} weights={weights} meta={meta} />}
          </div>
        </div>

        <p className="mt-10 text-center text-[11.5px] text-[#9c958a]">
          Prototype from the Claude Impact Lab hackathon · not legal, zoning or financial advice · ✓ pass ✕ fail ? could not check · every result must be confirmed with the city
        </p>
      </main>

      {/* Full parcel drawer */}
      {drawer && selected && meta && (
        <div className="fixed inset-0 z-[2000] flex justify-end bg-[#1B2433]/30 backdrop-blur-[2px]" onClick={() => setDrawer(false)}>
          <div className="h-full w-full max-w-[460px] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <ParcelPanel f={selected} meta={meta} weights={weights} onClose={() => setDrawer(false)} inCompare={inCompare(selected)} onToggleCompare={() => toggleCompare(selected)} compareFull={compare.length >= 3} />
          </div>
        </div>
      )}
      {showSources && meta && <SourcesModal meta={meta} onClose={() => setShowSources(false)} />}
      {showCompare && meta && (
        <CompareModal items={compare} meta={meta} weights={weights} onClose={() => setShowCompare(false)} onRemove={(apn) => setCompare((c) => c.filter((x) => x.properties.apn !== apn))} />
      )}
    </div>
  );
}
