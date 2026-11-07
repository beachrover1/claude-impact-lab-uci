"use client";
// Feasibility Copilot: a one-screen site assessment built only from the parcel's
// screening results. No LLM: every sentence is assembled from tested facts, and the
// score is broken down point by point. Weights are ASSUMPTIONS, not eligibility criteria.
import type { Detail, Feature, Meta, Weights } from "@/lib/types";
import { expandTests, score } from "@/lib/types";
import { FACTORS } from "@/lib/theme";
import Massing3D from "./Massing3D";
import { PRICE_NOTE, money, perAcre } from "@/lib/price";

function Gauge({ value }: { value: number }) {
  const a = Math.PI * (1 - value / 100);
  const nx = 60 + Math.cos(a) * 38, ny = 62 - Math.sin(a) * 38;
  return (
    <svg viewBox="0 0 120 72" className="h-28 w-44">
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e5533d" /><stop offset="0.45" stopColor="#f0a03a" /><stop offset="0.75" stopColor="#a6c94a" /><stop offset="1" stopColor="#3f9d5c" />
        </linearGradient>
      </defs>
      <path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="url(#fg)" strokeWidth="11" strokeLinecap="round" />
      <line x1="60" y1="62" x2={nx} y2={ny} stroke="#14284b" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="62" r="5" fill="#fff" stroke="#14284b" strokeWidth="2.5" />
    </svg>
  );
}

export default function Feasibility({ f, d, meta, weights }: { f: Feature; d: Detail; meta: Meta; weights: Weights }) {
  const p = f.properties, x = d.facts;
  const s = score(p.components, weights);
  const total = Object.values(weights).reduce((m, n) => m + n, 0) || 1;

  const laws = meta.laws.laws.map((l) => ({ l, r: d.results[l.id], t: expandTests(d.results[l.id].tests, l) }));
  const possible = laws.filter((z) => z.r.status === "possible");
  const unclear = laws.filter((z) => z.r.status === "unclear");
  const best = possible.sort((a, b) => b.t.filter((t) => t.status !== "unknown").length - a.t.filter((t) => t.status !== "unknown").length)[0];
  const allTests = laws.flatMap((z) => z.t);
  const checked = allTests.filter((t) => t.status !== "unknown").length;
  const completeness = Math.round((checked / Math.max(1, allTests.length)) * 100);
  const unknownForBest = best ? best.t.filter((t) => t.status === "unknown").length : 0;

  const pathway = best ? `${best.l.name.split(":")[0]}: no test fails, ${unknownForBest} to confirm` : unclear.length ? `Zone ${p.zone} needs review (${unclear.map((z) => z.l.id.replace("SHRA_", "")).join(", ")})` : "None of the five passes";
  const ownership = x.surplus_notice ? `Public: ${x.surplus_notice["Local Agency"]} (HCD notice)` : x.worship_sites?.length ? "Lead: place of worship mapped (unverified)" : "Not verified";
  const transit = x.transit_hqta?.length ? "Inside a high-quality transit area" : "Not in a high-quality transit area";

  // Assessment: assembled from facts, strongest signal first
  const strengths: string[] = [], cautions: string[] = [];
  if (p.acres >= 0.5) strengths.push(`a ${p.acres}-acre lot, large enough for a small multi-home project`);
  else strengths.push(`a ${p.acres}-acre lot`);
  if (best) strengths.push(`${best.l.name.split(":")[0]} has no failing site test`);
  if (x.vacant) strengths.push("it appears vacant");
  if (x.transit_hqta?.length) strengths.push("it sits in a high-quality transit area");
  if (x.surplus_notice) strengths.push(`the city filed a surplus-land notice for it`);
  if (x.sfha) cautions.push(`a FEMA flood hazard area (${x.flood_zone})`);
  if (x.vhfhsz) cautions.push("a very high fire hazard zone");
  if (x.liquefaction_zone) cautions.push("a mapped liquefaction zone");
  if (x.zone_conflict) cautions.push("zoning sources that disagree");
  if (unclear.length && !best) cautions.push(`zone ${p.zone}, which a person must read before any pathway can be judged`);
  const assessment =
    `Worth a closer look: ${strengths.join(", ")}.` +
    (cautions.length ? ` Watch for ${cautions.join(", ")}.` : "") +
    ` ${completeness}% of the site tests could be checked with public data; the rest need confirmation.`;

  const next = x.surplus_notice
    ? `Contact ${x.surplus_notice["Local Agency"]} about surplus notice ${x.surplus_notice["Parent Case"]} and ask whether the site is still available${x.surplus_notice.archived ? " (the notice is archived)" : ""}.`
    : x.worship_sites?.length && p.laws.SB4 === "possible"
      ? "Reach out to the congregation to confirm it owned the land on Jan 1, 2024, then request an SB 4 pre-application meeting."
      : best
        ? `Request a preliminary planning review with Santa Ana for ${best.l.name.split(":")[0]} and resolve the ${unknownForBest} open test${unknownForBest === 1 ? "" : "s"}.`
        : unclear.length
          ? `Ask Santa Ana Planning which rules of zone ${p.zone} apply before spending more time on this site.`
          : "Not a strong candidate under the five screened pathways. Move on to the next site.";

  const pts = FACTORS.map((fc) => ({ ...fc, max: (weights[fc.key] / total) * 100, got: (p.components[fc.key] * weights[fc.key] * 100) / total }));

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E9E2D6] bg-white">
      <div className="flex items-center justify-between bg-gradient-to-r from-[#14284b] to-[#24487a] px-4 py-2.5 text-white">
        <span className="text-[13px] font-semibold tracking-wide">✦ Feasibility Copilot</span>
        <span className="text-[10.5px] text-white/70">generated from screening data · no LLM</span>
      </div>
      <div className="flex flex-col items-center px-4 pt-3">
        <Gauge value={s} />
        <div className="-mt-1 mb-3 text-center">
          <span className="num text-[30px] font-bold text-[#14284b]">{s}</span><span className="text-sm text-[#6B6458]"> / 100 site score</span>
        </div>
        <div className="grid w-full grid-cols-2 gap-1.5 text-[11.5px]">
          {[["Parcel size", `${p.acres} acres`], ["Assessed land value", p.land_value ? `${money(p.land_value)} · ${money(perAcre(p.land_value, p.acres))} per acre` : "Not assessed (exempt or public?)"], ["Data completeness", `${completeness}% checked`], ["Best pathway", pathway], ["Transit", transit], ["Ownership", ownership], ["Zone", `${p.zone ?? "?"}${x.zone_desc ? " · " + x.zone_desc : ""}`]].map(([k, v]) => (
            <div key={k} className={`rounded-lg bg-[#f6f1e8] px-2 py-1.5 ${k === "Best pathway" || k === "Ownership" ? "col-span-2" : ""}`}>
              <div className="text-[9.5px] font-semibold uppercase tracking-wider text-[#9c958a]">{k}</div>
              <div className="font-medium leading-snug text-[#1B2433]">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B6458]">Why {s}? Points earned / available</div>
        {pts.map((r) => (
          <div key={r.key} className="mb-1 grid grid-cols-[110px_1fr_70px] items-center gap-2 text-[12px]">
            <span className="text-[#1B2433]">{r.label}</span>
            <div className="relative h-2 overflow-hidden rounded-full bg-[#efe9df]">
              <div className="absolute inset-y-0 left-0 rounded-full opacity-25" style={{ width: "100%", background: r.color }} />
              <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.got / Math.max(r.max, 0.01)) * 100}%`, background: r.color }} />
            </div>
            <span className="num text-right text-[#6B6458]"><b className="text-[#1B2433]">{r.got.toFixed(1)}</b> / {r.max.toFixed(0)}</span>
          </div>
        ))}
        <p className="text-[10.5px] text-[#c2562e]">Weights are ASSUMPTIONS for ranking, not legal eligibility criteria.</p>
        <p className="mt-0.5 text-[10.5px] text-[#6B6458]">Land value: {PRICE_NOTE}</p>
      </div>

      <Massing3D f={f} />
      <div className="mx-4 mt-3 rounded-xl bg-[#f3eee5] p-3">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#6B6458]">Site assessment</div>
        <p className="text-[12.5px] leading-relaxed text-[#1B2433]">{assessment}</p>
      </div>
      <div className="m-4 mt-2 rounded-xl border-l-4 border-[#f07a2c] bg-[#fff4ea] p-3">
        <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-[#e0641f]">Next step</div>
        <p className="text-[12.5px] leading-relaxed text-[#1B2433]">{next}</p>
      </div>
    </section>
  );
}
