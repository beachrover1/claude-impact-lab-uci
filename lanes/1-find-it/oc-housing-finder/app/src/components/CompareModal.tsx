"use client";
import { useEffect, useState } from "react";
import type { Detail, Feature, Meta, Weights } from "@/lib/types";
import { COMPONENT_LABELS, expandTests, score } from "@/lib/types";
import { LAW_LONG, loadDetail } from "@/lib/detail";
import ScoreRing from "./ScoreRing";

const STATUS: Record<string, [string, string]> = {
  possible: ["Possible", "text-emerald-700 bg-emerald-50"],
  unclear: ["Zone needs review", "text-amber-700 bg-amber-50"],
  no: ["Not eligible", "text-[#6B6458] bg-[#efe9df]"],
  no_lead: ["No ownership lead", "text-[#6B6458] bg-[#efe9df]"],
};

const yn = (v: any, yes: string, no: string, unk = "Unknown") => (v === true ? yes : v === false || v == null ? (v == null ? unk : no) : String(v));

export default function CompareModal({ items, meta, weights, onClose, onRemove }: { items: Feature[]; meta: Meta; weights: Weights; onClose: () => void; onRemove: (apn: string) => void }) {
  const [details, setDetails] = useState<Record<string, Detail | null>>({});
  useEffect(() => {
    items.forEach((f) => loadDetail(f.properties.apn).then((d) => setDetails((x) => ({ ...x, [f.properties.apn]: d }))));
  }, [items]);

  const row = (label: string, cell: (f: Feature, d: Detail | null) => React.ReactNode) => (
    <tr className="border-t border-[#efe9df]">
      <th className="w-48 py-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-[#6B6458]">{label}</th>
      {items.map((f) => (
        <td key={f.properties.apn} className="px-3 py-2 align-top text-sm text-[#1B2433]">{cell(f, details[f.properties.apn] ?? null)}</td>
      ))}
    </tr>
  );

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-[#FFFDF9] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-[#FFFDF9] px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1B2433]">Compare parcels</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-[#6B6458] hover:bg-[#efe9df]">✕</button>
        </div>
        <table className="w-full px-6">
          <thead>
            <tr>
              <th />
              {items.map((f) => {
                const s = score(f.properties.components, weights);
                return (
                  <th key={f.properties.apn} className="px-3 py-4 text-left align-top">
                    <div className="flex items-center gap-3">
                      <ScoreRing score={s} size={52} />
                      <div>
                        <div className="text-sm font-semibold text-[#1B2433]">{f.properties.address ?? "APN " + f.properties.apn}</div>
                        <div className="text-xs font-normal text-[#6B6458]">APN {f.properties.apn}</div>
                        <button onClick={() => onRemove(f.properties.apn)} className="text-xs font-normal text-[#9c958a] hover:text-red-600">Remove</button>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&_th]:pl-6">
            {row("Result", (f) => f.properties.label)}
            {row("Lot size", (f) => `${f.properties.acres} ac (computed)`)}
            {row("Zone", (f, d) => `${f.properties.zone ?? "?"}${d?.facts.zone_desc ? " · " + d.facts.zone_desc : ""}`)}
            {meta.laws.laws.map((l) =>
              row(LAW_LONG[l.id] ?? l.name, (f, d) => {
                const st = f.properties.laws[l.id];
                const [txt, cls] = STATUS[st] ?? [st, ""];
                const t = d ? expandTests(d.results[l.id].tests, l) : [];
                const unk = t.filter((x) => x.status === "unknown").length;
                return (
                  <span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{txt}</span>
                    {st === "possible" && d && <span className="ml-1 text-xs text-[#9c958a]">{unk} to confirm</span>}
                  </span>
                );
              })
            )}
            {row("Vacant", (f, d) => yn(d?.facts.vacant ?? (d ? false : undefined), "Yes (footprints < 2%)", `No (${Math.round((d?.facts.building_coverage ?? 0) * 100)}% covered)`))}
            {row("Flood (FEMA)", (f, d) => (d ? (d.facts.sfha ? `Special flood hazard area (${d.facts.flood_zone})` : `Zone ${d.facts.flood_zone ?? "none mapped"}`) : "…"))}
            {row("Fire", (f, d) => (d ? (d.facts.vhfhsz ? "Very high" : "None mapped") : "…"))}
            {row("Liquefaction zone", (f, d) => (d ? (d.facts.liquefaction_zone ? "Yes" : "No") : "…"))}
            {row("High-quality transit", (f) => (f.properties.flags.transit ? "Yes" : "No"))}
            {row("Public land notice", (f, d) => (d?.facts.surplus_notice ? `${d.facts.surplus_notice["Local Agency"]} · ${d.facts.surplus_notice["NOA Status"]}` : "None"))}
            {(Object.keys(COMPONENT_LABELS) as (keyof Weights)[]).map((k) => row(COMPONENT_LABELS[k], (f) => `${Math.round(f.properties.components[k] * 100)}%`))}
          </tbody>
        </table>
        <p className="px-6 py-4 text-xs text-amber-700">Scores use ASSUMPTION weights. Prototype, not legal advice. Confirm every result with the city.</p>
      </div>
    </div>
  );
}
