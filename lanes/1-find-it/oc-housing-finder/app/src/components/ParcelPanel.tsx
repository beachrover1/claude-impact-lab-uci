"use client";
import { useEffect, useState } from "react";
import type { Detail, Feature, Meta, Status, Weights } from "@/lib/types";
import { COMPONENT_LABELS, expandTests, score } from "@/lib/types";
import { draftEmail, explain } from "@/lib/explain";

const ICON: Record<Status, string> = { pass: "✅", fail: "❌", unknown: "❓", lead: "🔎" };
const STATUS_TEXT: Record<Status, string> = { pass: "Pass", fail: "Fail", unknown: "Could not check", lead: "Lead, not fact" };

const cache: Record<string, Record<string, Detail>> = {};
async function loadDetail(apn: string): Promise<Detail | null> {
  const book = apn.slice(0, 3);
  if (!cache[book]) {
    const r = await fetch(`data/detail/${book}.json`);
    cache[book] = r.ok ? await r.json() : {};
  }
  return cache[book][apn] ?? null;
}

export default function ParcelPanel({ f, meta, weights, onClose }: { f: Feature; meta: Meta; weights: Weights; onClose: () => void }) {
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

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white text-sm">
      <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-semibold text-ink">{p.address ?? "No site address"}</div>
            <div className="text-xs text-stone-500">APN {p.apn} · zone {p.zone ?? "unknown"} · {p.acres} ac (computed)</div>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Close">✕</button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium">{p.label}</span>
          <span className="text-xs text-stone-600">Score {score(p.components, weights)}/100 <span className="text-amber-700">(ASSUMPTION weights)</span></span>
        </div>
      </div>

      {!d && <div className="p-4 text-stone-500">Loading details…</div>}
      {d && ex && (
        <div className="space-y-5 p-4">
          <section>
            <h3 className="mb-1 font-semibold text-ink">Why this site</h3>
            <p className="mb-2 text-xs text-stone-500">Written from the test results below. Each line is marked as verified data, an estimate, or something to confirm.</p>
            <List title="Verified in public data" items={ex.verified} cls="text-emerald-800" />
            <List title="Estimates" items={ex.estimates} cls="text-stone-700" />
            <List title="Needs confirmation" items={ex.confirm} cls="text-amber-800" />
          </section>

          <section>
            <h3 className="mb-2 font-semibold text-ink">Law-by-law site tests</h3>
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
                    <span className={r.status === "possible" ? "text-emerald-700" : r.status === "unclear" ? "text-amber-700" : "text-stone-500"}>· {head}</span>
                  </summary>
                  <div className="border-t px-3 py-2">
                    <p className="mb-2 text-xs text-stone-600">{law.what}</p>
                    <table className="w-full text-xs">
                      <tbody>
                        {tests.map((t) => {
                          const rule = law.tests.find((x) => x.id === t.id);
                          return (
                            <tr key={t.id} className="border-t align-top">
                              <td className="w-6 py-1">{ICON[t.status]}</td>
                              <td className="py-1">
                                <div className="font-medium">{rule?.label}</div>
                                <div className="text-stone-500">{STATUS_TEXT[t.status]}: {t.why}</div>
                                {rule?.note && <div className="text-amber-700">Note: {rule.note}</div>}
                                {rule?.quote && <div className="italic text-stone-400">“{rule.quote}”</div>}
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
            <h3 className="mb-2 font-semibold text-ink">Score breakdown</h3>
            <table className="w-full text-xs">
              <tbody>
                {(Object.keys(COMPONENT_LABELS) as (keyof Weights)[]).map((k) => (
                  <tr key={k} className="border-t">
                    <td className="py-1">{COMPONENT_LABELS[k]}</td>
                    <td className="py-1 text-right">{Math.round(p.components[k] * 100)}%</td>
                    <td className="py-1 pl-2 text-right text-stone-500">weight {weights[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-amber-700">ASSUMPTION: the weights and component formulas are illustrative, not a validated policy. See Sources & assumptions.</p>
          </section>

          {d.facts.surplus_notice && (
            <section>
              <h3 className="mb-1 font-semibold text-ink">Surplus Land Act notice</h3>
              <pre className="whitespace-pre-wrap rounded bg-stone-50 p-2 text-xs">{JSON.stringify(d.facts.surplus_notice, null, 1)}</pre>
            </section>
          )}

          <section>
            <button onClick={() => setShowEmail((s) => !s)} className="rounded border border-clay px-3 py-1.5 text-clay hover:bg-orange-50">
              {showEmail ? "Hide" : "Draft"} a question to city planning
            </button>
            {showEmail && (
              <div className="mt-2">
                <textarea readOnly className="h-64 w-full rounded border p-2 font-mono text-xs" value={draftEmail(p, d, meta)} />
                <p className="text-xs text-stone-500">Draft only. Copy it into your own email. This tool never sends anything.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function List({ title, items, cls }: { title: string; items: string[]; cls: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</div>
      <ul className={`list-disc pl-5 ${cls}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
