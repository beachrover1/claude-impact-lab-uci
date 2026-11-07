"use client";
import { useEffect, useState } from "react";
import type { Detail, Feature, Meta, Weights } from "@/lib/types";
import { score } from "@/lib/types";
import { FACTORS, PRESETS } from "@/lib/theme";
import { loadDetail } from "@/lib/detail";
import { answer } from "./Assistant";
import { contributions } from "./CallCard";

type Ranked = { f: Feature; s: number }[];
const name = (f: Feature) => f.properties.address ?? "APN " + f.properties.apn;

export function Funnel({ meta, onList, publicLand, sizeLabel }: { meta: Meta; onList: number; publicLand: number; sizeLabel: string }) {
  const total = meta.counts.parcels_screened || 1;
  const rows: [string, number, string][] = [
    ["Parcels screened", total, "#1B2433"],
    ["Potentially suitable", meta.counts["Potentially suitable"] ?? 0, "#3f7d5c"],
    ["On the call list", onList, "#1f3a5f"],
    ["On public land", publicLand, "#c2562e"],
  ];
  return (
    <div className="card p-5">
      <div className="font-display text-lg font-semibold">Screening funnel</div>
      <div className="mb-3 text-xs text-[#6B6458]">Santa Ana · {sizeLabel}</div>
      {rows.map(([label, n, c]) => (
        <div key={label} className="mb-3">
          <div className="mb-1 flex justify-between text-[12.5px]"><span>{label}</span><b className="num">{n.toLocaleString()}</b></div>
          <div className="h-3 overflow-hidden rounded-full bg-[#efe9df]">
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (n / total) * 100)}%`, background: c }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WeightsChart({ top, weights }: { top: Ranked; weights: Weights }) {
  const items = top.slice(0, 5);
  return (
    <div className="card p-5">
      <div className="font-display text-lg font-semibold">Weights vs. balanced</div>
      <div className="mb-4 text-xs text-[#6B6458]">How your weights move each top score</div>
      <div className="flex h-36 items-end justify-between gap-3">
        {items.map(({ f, s }) => {
          const b = score(f.properties.components, PRESETS.balanced.w);
          return (
            <div key={f.properties.apn} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-1">
                <div className="w-1/2 rounded-t-md bg-[#1B2433]" style={{ height: `${b}%` }} title={`Balanced ${b}`} />
                <div className="w-1/2 rounded-t-md bg-[#2a7f8f]" style={{ height: `${s}%` }} title={`Yours ${s}`} />
              </div>
              <div className="w-full truncate text-center text-[10px] text-[#6B6458]">{(f.properties.address ?? f.properties.apn).split(" ").slice(0, 2).join(" ")}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[11px] text-[#6B6458]">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1B2433]" /> Balanced</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#2a7f8f]" /> Your weights</span>
      </div>
    </div>
  );
}

function globalAnswer(q: string, ranked: Ranked, compare: Feature[], weights: Weights): string | null {
  const ql = q.toLowerCase();
  const wTop = [...FACTORS].sort((a, b) => weights[b.key] - weights[a.key])[0];
  if (/ranked first|why is .*#?1|top site/.test(ql) && ranked[0]) {
    const [a, b] = ranked;
    const ca = contributions(a.f.properties.components, weights);
    const lines = ca.map((x) => `${x.label} +${x.pts.toFixed(1)}`).join(", ");
    let diff = "";
    if (b) {
      const cb = contributions(b.f.properties.components, weights);
      const gaps = ca.map((x, i) => ({ l: x.label, d: x.pts - cb[i].pts })).sort((m, n) => n.d - m.d);
      diff = gaps[0].d > 0.05 ? ` Its biggest edge over #2 (${name(b.f)}) is ${gaps[0].l.toLowerCase()} (+${gaps[0].d.toFixed(1)}).` : ` It ties #2 (${name(b.f)}) at ${b.s}; ties keep their data order.`;
    }
    return `${name(a.f)} scores ${a.s}: ${lines}.${diff} Your weights favor ${wTop.label.toLowerCase()}.`;
  }
  if (/risk|careful|call first|avoid/.test(ql)) {
    const flagged = ranked.slice(0, 10).map(({ f }, i) => {
      const p = f.properties, why: string[] = [];
      if (p.label === "Needs review") why.push("labelled needs review");
      if (p.flags.sfha) why.push("in a FEMA flood hazard area");
      if (p.flags.vhfhsz) why.push("very high fire zone");
      if (p.flags.zone_conflict) why.push("zoning sources disagree");
      if (p.flags.he_stale) why.push("housing-element listing may be stale");
      if (!p.flags.vacant && !p.flags.surplus) why.push("not vacant: someone may live or work there");
      return why.length ? `#${i + 1} ${name(f)}: ${why.join("; ")}` : null;
    }).filter(Boolean);
    return flagged.length ? "In your top 10:\n" + flagged.join("\n") + "\nEvery site still needs ownership, utilities and city standards confirmed." : "None of your top 10 has a hazard, zoning-conflict or occupancy flag. Ownership, utilities and city standards still need confirming for each.";
  }
  if (/compar|head|summar/.test(ql)) {
    if (compare.length < 2) return "Pick 2 or 3 sites with “+ Compare” first.";
    const rows = FACTORS.map((x) => {
      const best = [...compare].sort((a, b) => b.properties.components[x.key] - a.properties.components[x.key]);
      const tie = best.every((f) => f.properties.components[x.key] === best[0].properties.components[x.key]);
      return `${x.label}: ${tie ? "tie" : name(best[0])}`;
    });
    const scores = compare.map((f) => `${name(f)} ${score(f.properties.components, weights)}`).join(", ");
    return `Scores: ${scores}.\n` + rows.join("\n");
  }
  if (/weight|favor|prefer/.test(ql)) return `Your weights favor ${wTop.label.toLowerCase()} (${weights[wTop.key]}). Presets and sliders are ASSUMPTIONS; there is no official weighting.`;
  return null;
}

export function AssistantCard({ ranked, compare, selected, weights, meta }: { ranked: Ranked; compare: Feature[]; selected: Feature | null; weights: Weights; meta: Meta }) {
  const [msgs, setMsgs] = useState<{ q: string; a: string }[]>([]);
  const [q, setQ] = useState("");
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    setD(null);
    if (selected) loadDetail(selected.properties.apn).then(setD);
  }, [selected]);
  const top = ranked[0] ? name(ranked[0].f) : "#1";
  const suggestions = [`Why is ${top} ranked first?`, "Which sites are risky to call first?", "Summarize the comparison", ...(selected ? [`What could block ${name(selected)}?`] : [])];

  function ask(text: string) {
    if (!text.trim()) return;
    let a = globalAnswer(text, ranked, compare, weights);
    if (!a && selected && d) a = answer(text, selected, d, meta, weights);
    if (!a) a = selected ? "Still loading that parcel. Try again in a second." : "Select a site (click a card or a pin) to ask about it, or try a suggestion below.";
    setMsgs((m) => [...m, { q: text, a }].slice(-4));
    setQ("");
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <div className="font-display flex items-center gap-2 text-lg font-semibold"><span className="text-[#e2b33c]">✦</span> Assistant</div>
        <span className="text-[11px] text-[#6B6458]">sees your weights</span>
      </div>
      <p className="mb-3 text-[10.5px] text-[#9c958a]">Answers come only from the screening data. No LLM in this build.</p>
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {msgs.length === 0 && (
          <div className="rounded-2xl bg-[#f3eee5] p-3 text-[13px] leading-relaxed text-[#1B2433]">
            Your weights favor <b>{[...FACTORS].sort((a, b) => weights[b.key] - weights[a.key])[0].label.toLowerCase()}</b>. {ranked.length.toLocaleString()} sites match your filters.
            {selected ? <> Asking about <b>{name(selected)}</b>.</> : " Click a card or pin to ask about one site."}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className="ml-6 rounded-2xl rounded-br-sm bg-[#1f3a5f] px-3 py-2 text-[12.5px] text-white">{m.q}</div>
            <div className="mr-2 whitespace-pre-line rounded-2xl rounded-bl-sm bg-[#f3eee5] px-3 py-2 text-[12.5px] leading-relaxed text-[#1B2433]">{m.a}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {suggestions.map((s) => (
          <button key={s} onClick={() => ask(s)} className="block w-full truncate rounded-xl border border-[#E9E2D6] bg-white px-3 py-2 text-left text-[12.5px] text-[#1f3a5f] hover:border-[#1f3a5f]/40">{s}</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="mt-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your list…" className="flex-1 rounded-xl border border-[#E9E2D6] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#1f3a5f]" />
        <button className="rounded-xl bg-[#1f3a5f] px-3 text-[13px] font-semibold text-white">Ask</button>
      </form>
    </div>
  );
}

export function HeadToHead({ items, weights, onFull, onRemove }: { items: Feature[]; weights: Weights; onFull: () => void; onRemove: (apn: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="card border-[#1f3a5f]/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-lg font-semibold">Head-to-head · {items.length} site{items.length > 1 ? "s" : ""}</div>
        <div className="flex items-center gap-3 text-xs text-[#6B6458]">
          <span>Brightest bar wins each row</span>
          <button onClick={onFull} disabled={items.length < 2} className="rounded-lg border border-[#E9E2D6] bg-white px-2.5 py-1 font-medium text-[#1B2433] disabled:opacity-40">Full table</button>
        </div>
      </div>
      <div className="grid gap-x-6" style={{ gridTemplateColumns: `110px repeat(${items.length}, minmax(0,1fr))` }}>
        <div />
        {items.map((f) => (
          <div key={f.properties.apn} className="mb-2">
            <div className="truncate text-[13px] font-semibold">{name(f)}</div>
            <div className="text-[11.5px] text-[#6B6458]">Score {score(f.properties.components, weights)} · <button onClick={() => onRemove(f.properties.apn)} className="hover:text-[#c2562e]">remove</button></div>
          </div>
        ))}
        {FACTORS.map((x) => {
          const vals = items.map((f) => f.properties.components[x.key]);
          const max = Math.max(...vals);
          return [
            <div key={x.key} className="py-1 text-[12.5px] text-[#6B6458]">{x.label}</div>,
            ...items.map((f, i) => (
              <div key={x.key + f.properties.apn} className="flex items-center gap-2 py-1">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#efe9df]">
                  <div className="h-full rounded-full" style={{ width: `${vals[i] * 100}%`, background: x.color, opacity: vals[i] === max ? 1 : 0.35 }} />
                </div>
                <span className={`num w-7 text-right text-[12px] ${vals[i] === max ? "font-bold text-[#1B2433]" : "text-[#9c958a]"}`}>{Math.round(vals[i] * 100)}</span>
              </div>
            )),
          ];
        })}
      </div>
    </div>
  );
}
