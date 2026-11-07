"use client";
import { useEffect, useState } from "react";
import type { Detail, Feature, Meta, Weights } from "@/lib/types";
import { expandTests } from "@/lib/types";
import { LAW_SHORT, loadDetail } from "@/lib/detail";
import { FACTORS, LABEL_STYLE } from "@/lib/theme";

const LAW_ORDER = ["SB9", "SHRA_SB684", "SHRA_SB1123", "AB2011", "SB4"];

export function contributions(c: Feature["properties"]["components"], w: Weights) {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return FACTORS.map((f) => ({ ...f, value: c[f.key], pts: (c[f.key] * w[f.key] * 100) / total }));
}

export function StackBar({ f, w, h = 6 }: { f: Feature; w: Weights; h?: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-[#ebe5da]" style={{ height: h }}>
      {contributions(f.properties.components, w).map((x) => (
        <div key={x.key} style={{ width: `${x.pts}%`, background: x.color }} title={`${x.label}: +${x.pts.toFixed(1)}`} />
      ))}
    </div>
  );
}

export default function CallCard({
  f, s, rank, meta, weights, selected, comparing, compareFull, onSelect, onFull, onCompare,
}: {
  f: Feature; s: number; rank: number; meta: Meta; weights: Weights; selected: boolean; comparing: boolean; compareFull: boolean;
  onSelect: () => void; onFull: () => void; onCompare: () => void;
}) {
  const p = f.properties;
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Detail | null>(null);
  useEffect(() => {
    if (open && !d) loadDetail(p.apn).then(setD);
  }, [open, d, p.apn]);
  const ls = LABEL_STYLE[p.label];
  const tags = [
    `${p.acres} ac`,
    `zone ${p.zone ?? "?"}`,
    ...Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]),
    ...(p.flags.vacant ? ["Vacant"] : []),
    ...(p.flags.transit ? ["Transit"] : []),
    ...(p.flags.surplus ? ["Public land"] : []),
    ...(p.flags.worship_lead ? ["Faith lead"] : []),
  ];

  function check(lawId: string): { icon: string; cls: string; text: string } {
    const st = p.laws[lawId];
    const rule = meta.laws.laws.find((l) => l.id === lawId)!;
    const tests = d ? expandTests(d.results[lawId].tests, rule) : [];
    if (st === "possible") {
      const unk = tests.filter((t) => t.status === "unknown").length;
      return { icon: "✓", cls: "bg-[#e6f1ea] text-[#2f6448]", text: d ? `No test fails · ${unk} to confirm` : "No test fails" };
    }
    if (st === "unclear") return { icon: "?", cls: "bg-[#fbf3dc] text-[#9a7414]", text: `Zone ${p.zone} needs review` };
    if (st === "no_lead") return { icon: "–", cls: "bg-[#efebe4] text-[#6b6458]", text: "No ownership lead" };
    const fail = tests.find((t) => t.status === "fail");
    const label = fail ? rule.tests.find((t) => t.id === fail.id)?.label : null;
    return { icon: "✕", cls: "bg-[#fbeae2] text-[#a2441f]", text: label ? `Fails: ${label.toLowerCase()}` : "A test fails" };
  }

  return (
    <div onClick={onSelect} className={`card cursor-pointer p-4 transition hover:-translate-y-px ${selected ? "ring-2 ring-[#e2b33c]" : ""} ${comparing ? "border-[#1f3a5f]" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="w-14 shrink-0 text-center">
          <div className="font-display num text-[34px] font-semibold leading-none text-[#1f3a5f]">{s}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-[#9c958a]">score</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#9c958a]">#{rank}</span>
            <span className="truncate text-[15px] font-semibold text-[#1B2433]">{p.address ?? "APN " + p.apn}</span>
            <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: ls.bg, color: ls.text }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: ls.dot }} /> {p.label}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-[#6B6458]">{tags.join(" · ")}</div>
          <div className="mt-2.5 max-w-[520px]"><StackBar f={f} w={weights} /></div>
        </div>
        <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setOpen(!open)} className="rounded-xl border border-[#E9E2D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1B2433] hover:bg-[#f6f1e8]">
            {open ? "Hide details" : "Breakdown"}
          </button>
          <button onClick={onFull} className="rounded-xl border border-[#E9E2D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1B2433] hover:bg-[#f6f1e8]">Full</button>
          <button onClick={onCompare} disabled={!comparing && compareFull}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${comparing ? "bg-[#1f3a5f] text-white" : "border border-[#1f3a5f]/30 text-[#1f3a5f] hover:bg-[#1f3a5f]/5 disabled:opacity-30"}`}>
            {comparing ? "✓ Comparing" : "+ Compare"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-6 border-t border-[#E9E2D6] pt-4 md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B6458]">Score breakdown · factor × weight</div>
            {contributions(p.components, weights).map((x) => (
              <div key={x.key} className="mb-1.5 grid grid-cols-[96px_1fr_88px] items-center gap-2 text-[12.5px]">
                <span className="text-[#1B2433]">{x.label}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#ebe5da]"><div className="h-full rounded-full" style={{ width: `${x.value * 100}%`, background: x.color }} /></div>
                <span className="num text-right text-[#6B6458]">{Math.round(x.value * 100)} → <b className="text-[#1B2433]">+{x.pts.toFixed(1)}</b></span>
              </div>
            ))}
            <p className="mt-1 text-[10.5px] text-[#c2562e]">Weights are ASSUMPTIONS. Change them in the Scoring studio.</p>
          </div>
          <div>
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B6458]">Pathway checks</div>
            {LAW_ORDER.map((id) => {
              const c = check(id);
              return (
                <div key={id} className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${c.cls}`}>{c.icon}</span>
                  <span className="w-16 font-semibold text-[#1B2433]">{LAW_SHORT[id]}</span>
                  <span className="truncate text-[#6B6458]">{c.text}</span>
                </div>
              );
            })}
            {!d && <p className="text-[11px] text-[#9c958a]">Loading test details…</p>}
          </div>
        </div>
      )}
    </div>
  );
}
