"use client";
// Site assistant. This build has no LLM: every answer is assembled from the selected
// parcel's screening results, so nothing can be invented. A Claude API version would
// get the same data as its only context.
import { useEffect, useRef, useState } from "react";
import type { Detail, Feature, Meta, Weights } from "@/lib/types";
import { COMPONENT_LABELS, expandTests, score } from "@/lib/types";
import { explain } from "@/lib/explain";
import { loadDetail } from "@/lib/detail";

type Msg = { role: "user" | "bot"; text: string };

const SUGGESTED = [
  "Why is it ranked here?",
  "Which law fits best?",
  "What could block it?",
  "Flood or fire risk?",
  "Near transit?",
  "Who should I call?",
];

function answer(q: string, f: Feature, d: Detail, meta: Meta, w: Weights): string {
  const p = f.properties;
  const x = d.facts;
  const ql = q.toLowerCase();
  const ex = explain(p, d, meta);
  const open = meta.laws.laws.filter((l) => d.results[l.id]?.status === "possible");

  if (/rank|score|why/.test(ql)) {
    const s = score(p.components, w);
    const parts = (Object.keys(COMPONENT_LABELS) as (keyof Weights)[])
      .map((k) => `${COMPONENT_LABELS[k]} ${Math.round(p.components[k] * 100)}% × weight ${w[k]}`)
      .join("; ");
    return `Score ${s}/100 (${p.label}). ${parts}. The weights are ASSUMPTIONS you can change in Advanced filters.`;
  }
  if (/law|pathway|fit|eligib|sb|ab/.test(ql)) {
    if (!open.length) {
      const unclear = meta.laws.laws.filter((l) => d.results[l.id]?.status === "unclear").map((l) => l.name);
      return unclear.length
        ? `No pathway can be judged yet: zone ${p.zone} needs a person to read the city's code. Laws waiting on that: ${unclear.join("; ")}.`
        : "No pathway passes every test that public data can check.";
    }
    return open
      .map((l) => {
        const t = expandTests(d.results[l.id].tests, l);
        const pass = t.filter((x) => x.status === "pass" || x.status === "lead").length;
        const unk = t.filter((x) => x.status === "unknown").length;
        return `${l.name}: ${pass} tests pass, ${unk} can't be checked with public data, none fail.`;
      })
      .join("\n");
  }
  if (/block|risk|problem|issue|confirm|unknown|wrong/.test(ql) && !/flood|fire/.test(ql)) {
    return ex.confirm.slice(0, 6).map((c) => "• " + c).join("\n") + (ex.confirm.length > 6 ? `\n…and ${ex.confirm.length - 6} more in the panel.` : "");
  }
  if (/flood|fire|hazard|liquef|landslide|earthquake/.test(ql)) {
    return [
      x.sfha ? `Flood: inside a FEMA special flood hazard area (zone ${x.flood_zone}).` : `Flood: FEMA zone ${x.flood_zone ?? "none mapped"}, not a special flood hazard area.`,
      x.vhfhsz ? "Fire: very high fire hazard severity zone." : "Fire: no fire hazard zone mapped (layer may predate CAL FIRE's 2025 maps).",
      x.liquefaction_zone ? "Liquefaction: inside a state-mapped zone; expect a geotechnical study." : "Liquefaction: not in a mapped zone.",
      x.landslide_zone ? "Landslide: inside a state-mapped zone." : "Landslide: not in a mapped zone.",
      "Earthquake fault zones: not checked (the CGS service needs a token).",
    ].join("\n");
  }
  if (/transit|bus|train|parking/.test(ql)) {
    return x.transit_hqta?.length
      ? `Yes. It's inside a Caltrans High-Quality Transit Area (${Array.from(new Set(x.transit_hqta)).join(", ")}). Per HCD, SB 9 and SB 4 can't require parking within half a mile of major transit.`
      : "Not inside a Caltrans High-Quality Transit Area.";
  }
  if (/call|contact|owner|who|sell|available/.test(ql)) {
    if (x.surplus_notice)
      return `Owner per the HCD surplus notice: ${x.surplus_notice["Local Agency"]} (case ${x.surplus_notice["Parent Case"]}, status ${x.surplus_notice["NOA Status"]}). Start with the agency's real estate office. Open "Draft a question to city planning" in the panel for an email you can copy.`;
    return `Ownership isn't in free parcel data. Start with Santa Ana Planning to confirm zoning (zone ${p.zone}), then find the owner through the County Assessor. The panel has a draft email you can copy; this tool never sends anything.`;
  }
  if (/size|acre|big|homes|units|capacity/.test(ql)) {
    return `About ${p.acres} acres (computed from the parcel outline). We don't estimate a unit count: that depends on the law used and the city's standards. SB 684 and SB 1123 allow up to 10 units; SB 9 allows up to 4.`;
  }
  if (/vacant|empty|building/.test(ql)) {
    return x.vacant
      ? "Looks vacant: building footprints cover under 2% of the lot (ASSUMPTION threshold)."
      : `Buildings cover about ${Math.round((x.building_coverage ?? 0) * 100)}% of the lot (OC Building Footprints).`;
  }
  return `I can only answer from this parcel's screening data. Try: ${SUGGESTED.join(" · ")}`;
}

export default function Assistant({ selected, meta, weights }: { selected: Feature | null; meta: Meta; weights: Weights }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([]);
    setDetail(null);
    if (selected) {
      loadDetail(selected.properties.apn).then(setDetail);
      setOpen(true);
    }
  }, [selected]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" }); // block body: newer Chrome returns a Promise here
  }, [msgs]);

  function ask(text: string) {
    if (!text.trim() || !selected || !detail) return;
    setMsgs((m) => [...m, { role: "user", text }, { role: "bot", text: answer(text, selected, detail, meta, weights) }]);
    setQ("");
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="absolute bottom-14 left-4 z-[1000] flex items-center gap-2 rounded-full bg-[#0b1b33] px-4 py-2.5 text-sm font-medium text-white shadow-xl hover:bg-[#13284a]">
        <span className="text-emerald-400">✦</span> Site assistant
      </button>
    );

  return (
    <div className="absolute bottom-14 left-4 z-[1000] flex max-h-[60%] w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-[#0b1b33] px-4 py-2.5 text-white">
        <div>
          <div className="text-sm font-semibold"><span className="text-emerald-400">✦</span> Site assistant</div>
          <div className="text-[10px] text-slate-300">Answers only from this parcel's screening data. No LLM in this build.</div>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white" aria-label="Minimize">—</button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {!selected && <p className="text-slate-500">Click a parcel on the map, then ask about it.</p>}
        {selected && (
          <p className="text-xs text-slate-500">
            Asking about <b className="text-slate-700">{selected.properties.address ?? "APN " + selected.properties.apn}</b>
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl rounded-br-sm bg-emerald-50 px-3 py-2 text-slate-800" : "mr-4 whitespace-pre-line rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-700"}>
            {m.text}
          </div>
        ))}
        <div ref={end} />
      </div>
      {selected && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 px-3 pt-2">
          {SUGGESTED.map((s) => (
            <button key={s} disabled={!detail} onClick={() => ask(s)} className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} disabled={!selected} placeholder={selected ? "Ask about this parcel…" : "Select a parcel first"} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-400" />
        <button disabled={!selected || !detail} className="rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white disabled:opacity-40">Ask</button>
      </form>
    </div>
  );
}

