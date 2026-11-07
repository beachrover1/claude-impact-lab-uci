"use client";
import { useEffect, useState } from "react";
import type { Detail, Feature, Meta, Status, Weights } from "@/lib/types";
import { COMPONENT_LABELS, expandTests, score } from "@/lib/types";
import { draftEmail, explain } from "@/lib/explain";
import { LABEL_COLOR, LAW_SHORT, loadDetail } from "@/lib/detail";
import ScoreRing from "./ScoreRing";
import Feasibility from "./Feasibility";

const ICON: Record<Status, string> = { pass: "✅", fail: "❌", unknown: "❓", lead: "🔎" };
const STATUS_TEXT: Record<Status, string> = { pass: "Pass", fail: "Fail", unknown: "Could not check", lead: "Lead, not fact" };

export default function ParcelPanel({ f, meta, weights, onClose, inCompare, onToggleCompare, compareFull }: {
  f: Feature; meta: Meta; weights: Weights; onClose: () => void; inCompare: boolean; onToggleCompare: () => void; compareFull: boolean;
}) {
  const p = f.properties;
  const [d, setD] = useState<Detail | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  useEffect(() => {
    setD(null);
    setShowEmail(false);
    loadDetail(p.apn).then(setD);
  }, [p.apn]);

  const ex = d ? explain(p, d, meta) : null;
  const srcs = meta.laws.sources;
  const s = score(p.components, weights);
  const possible = Object.entries(p.laws).filter(([, v]) => v === "possible").map(([k]) => LAW_SHORT[k]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#FFFDF9] text-sm">
      <div className="sticky top-0 z-10 border-b border-[#E9E2D6] bg-[#FFFDF9] px-5 py-4">
        <div className="flex items-start gap-3">
          <ScoreRing score={s} size={56} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-[#1B2433]">{p.address ?? "No site address"}</div>
            <div className="text-xs text-[#6B6458]">APN {p.apn} · Santa Ana {p.zip ?? ""}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 rounded-full bg-[#efe9df] px-2 py-0.5 text-xs font-medium text-[#1B2433]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: LABEL_COLOR[p.label] }} />{p.label}
              </span>
              {possible.map((l) => <span key={l} className="rounded-full bg-[#2a7f8f]/10 px-2 py-0.5 text-xs font-medium text-[#1d5d69]">{l}</span>)}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-[#9c958a] hover:bg-[#efe9df]" aria-label="Close">✕</button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Kpi label="Lot" value={`${p.acres} ac`} />
          <Kpi label="Zone" value={p.zone ?? "?"} />
          <Kpi label="Built" value={d?.facts.building_coverage != null ? `${Math.round(d.facts.building_coverage * 100)}%` : d ? "0%" : "…"} />
          <Kpi label="Transit" value={p.flags.transit ? "Yes" : "No"} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-amber-700">Score uses ASSUMPTION weights</span>
          <button onClick={onToggleCompare} disabled={!inCompare && compareFull}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${inCompare ? "bg-[#1f3a5f] text-white" : "border border-[#E9E2D6] text-[#1B2433] hover:bg-[#f6f1e8] disabled:opacity-40"}`}>
            {inCompare ? "✓ In compare" : "+ Compare"}
          </button>
        </div>
      </div>

      {!d && <div className="p-4 text-[#6B6458]">Loading details…</div>}
      {d && ex && (
        <div className="space-y-5 p-5">
          <Feasibility f={f} d={d} meta={meta} weights={weights} />
          <section>
            <h3 className="mb-1 font-semibold text-[#1B2433]">Why this site</h3>
            <p className="mb-2 text-xs text-[#6B6458]">Written from the test results below. Each line is marked as verified data, an estimate, or something to confirm.</p>
            <List title="Verified in public data" items={ex.verified} cls="text-emerald-800" />
            <List title="Estimates" items={ex.estimates} cls="text-[#1B2433]" />
            <List title="Needs confirmation" items={ex.confirm} cls="text-amber-800" />
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-[#1B2433]">Law-by-law site tests</h3>
            {meta.laws.laws.map((law) => {
              const r = d.results[law.id];
              if (!r) return null;
              const src = srcs[law.source];
              const tests = expandTests(r.tests, law);
              const head =
                r.status === "possible" ? "Possible: no test failed"
                : r.status === "unclear" ? "Unclear: zone needs review"
                : r.status === "no_lead" ? "No ownership lead"
                : "Not eligible: a test failed";
              return (
                <details key={law.id} open={r.status === "possible" || r.status === "unclear"} className="mb-2 rounded border">
                  <summary className="cursor-pointer px-3 py-2">
                    <span className="font-medium">{law.name}</span>{" "}
                    <span className={r.status === "possible" ? "text-emerald-700" : r.status === "unclear" ? "text-amber-700" : "text-[#6B6458]"}>· {head}</span>
                  </summary>
                  <div className="border-t px-3 py-2">
                    <p className="mb-2 text-xs text-[#6B6458]">{law.what}</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {tests.map((t) => {
                          const rule = law.tests.find((x) => x.id === t.id);
                          return (
                            <tr key={t.id} className="border-t align-top">
                              <td className="w-6 py-1">{ICON[t.status]}</td>
                              <td className="py-1">
                                <div className="font-medium">{rule?.label}</div>
                                <div className="text-[#6B6458]">{STATUS_TEXT[t.status]}: {t.why}</div>
                                {rule?.note && <div className="text-amber-700">Note: {rule.note}</div>}
                                {rule?.quote && <div className="italic text-[#9c958a]">“{rule.quote}”</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 text-xs">
                      Source: <a className="text-blue-700 underline" href={src.url} target="_blank" rel="noreferrer">{src.title}</a> · {src.statute} · checked {meta.laws.checked}
                    </p>
                  </div>
                </details>
              );
            })}
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-[#1B2433]">Score breakdown</h3>
            <table className="w-full text-xs">
              <tbody>
                {(Object.keys(COMPONENT_LABELS) as (keyof Weights)[]).map((k) => (
                  <tr key={k} className="border-t">
                    <td className="py-1">{COMPONENT_LABELS[k]}</td>
                    <td className="py-1 text-right">{Math.round(p.components[k] * 100)}%</td>
                    <td className="py-1 pl-2 text-right text-[#6B6458]">weight {weights[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-amber-700">ASSUMPTION: the weights and component formulas are illustrative, not a validated policy. See Sources & assumptions.</p>
          </section>

          {d.facts.surplus_notice && (
            <section>
              <h3 className="mb-1 font-semibold text-[#1B2433]">Surplus Land Act notice</h3>
              <pre className="whitespace-pre-wrap rounded bg-[#f6f1e8] p-2 text-xs">{JSON.stringify(d.facts.surplus_notice, null, 1)}</pre>
            </section>
          )}

          <section>
            <button onClick={() => setShowEmail((s) => !s)} className="rounded border border-[#1f3a5f] px-3 py-1.5 text-[#1f3a5f] hover:bg-[#1f3a5f]/5">
              {showEmail ? "Hide" : "Draft"} a question to city planning
            </button>
            {showEmail && (
              <div className="mt-2">
                <textarea readOnly className="h-64 w-full rounded border p-2 font-mono text-xs" value={draftEmail(p, d, meta)} />
                <p className="text-xs text-[#6B6458]">Draft only. Copy it into your own email. This tool never sends anything.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f6f1e8] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[#9c958a]">{label}</div>
      <div className="truncate text-sm font-semibold text-[#1B2433]">{value}</div>
    </div>
  );
}

function List({ title, items, cls }: { title: string; items: string[]; cls: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#6B6458]">{title}</div>
      <ul className={`list-disc pl-5 ${cls}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
