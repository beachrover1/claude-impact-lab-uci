// Template explanations, built only from the screening results. No API key needed.
// Every sentence is traceable to a test result or a fact with a source.
import type { Detail, Meta, ParcelProps } from "./types";
import { expandTests } from "./types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function explain(p: ParcelProps, d: Detail, meta: Meta): { verified: string[]; estimates: string[]; confirm: string[] } {
  const f = d.facts;
  const verified: string[] = [];
  const estimates: string[] = [];
  const confirm: string[] = [];

  if (f.zone) verified.push(`City zoning layer shows zone ${f.zone} (${f.zone_desc}).`);
  if (f.zone_conflict) confirm.push(`Zoning sources disagree: the city says ${f.zone}, SCAG's 2024 layer says ${f.zone_scag_local}. Check with Santa Ana Planning.`);
  if (f.zone_note) confirm.push(`Zone note: ${f.zone_note}`);

  const open = meta.laws.laws.filter((l) => ["possible", "unclear"].includes(d.results[l.id]?.status));
  for (const law of open) {
    const r = d.results[law.id];
    const tests = expandTests(r.tests, law);
    const passed = tests.filter((t) => t.status === "pass" || t.status === "lead").length;
    if (r.status === "unclear") continue; // summarized in one line below
    verified.push(`${law.name}: ${passed} of ${law.tests.length} site tests pass on public data, and none fail.`);
    for (const t of tests.filter((t) => t.status === "unknown")) {
      const label = law.tests.find((x) => x.id === t.id)?.label ?? t.id;
      confirm.push(`${law.name}: ${label}. ${t.why}`);
    }
    for (const t of tests.filter((t) => t.status === "lead")) confirm.push(t.why);
  }
  const unclear = open.filter((l) => d.results[l.id].status === "unclear").map((l) => l.id.replace("SHRA_", ""));
  if (unclear.length)
    confirm.unshift(`Zone ${f.zone ?? "?"} needs a person to read the city's code before ${unclear.join(", ")} can be judged. No other test fails for these laws (see the law-by-law tests below).`);

  estimates.push(`Lot size about ${f.acres} acres, computed from the county parcel outline.`);
  if (f.building_coverage != null || f.vacant)
    estimates.push(f.vacant ? `Appears vacant: buildings cover ${pct(f.building_coverage ?? 0)} of the lot.` : `Buildings cover about ${pct(f.building_coverage ?? 0)} of the lot.`);
  if (f.possibly_underused && !f.vacant)
    estimates.push(`Assessed improvements are under half the land value, a possible sign of underuse (ASSUMPTION threshold). Not an appraisal.`);
  if (f.transit_hqta?.length) verified.push(`Inside a Caltrans High-Quality Transit Area (${f.transit_hqta.join(", ")}). SB 9 and SB 4 limit parking requirements near major transit, per HCD.`);
  if (f.sfha) confirm.push(`In a FEMA special flood hazard area (zone ${f.flood_zone}). SB 9 and SB 4 exclude these sites.`);
  if (f.vhfhsz) confirm.push(`In a very high fire hazard severity zone.`);
  if (f.liquefaction_zone) confirm.push(`Inside a state-mapped liquefaction zone: geotechnical study likely needed.`);
  if (f.landslide_zone) confirm.push(`Inside a state-mapped landslide zone.`);
  if (f.surplus_notice) {
    const n = f.surplus_notice;
    verified.push(
      `${n["Local Agency"] ?? "A local agency"} issued a Surplus Land Act notice for this APN on ${n["Date Notice Issued"] ?? "an unknown date"}` +
        ` (case ${n["Parent Case"] ?? "?"}, HCD data). Status: ${n["NOA Status"] ?? "unknown"}.`
    );
    if (n.archived) confirm.push(`The surplus notice is archived (response due ${n["NOA Due Date"] ?? "?"}). Whether the land is still available is unknown: ask the agency.`);
    // Show source disagreements instead of picking one silently (lab rule)
    if (/vacant/i.test(n["Existing Use/Vacancy"] ?? "") && (f.building_coverage ?? 0) > 0.02)
      confirm.push(`Sources disagree on vacancy: the notice says "${String(n["Existing Use/Vacancy"]).trim()}", but county building footprints cover ${pct(f.building_coverage)} of the lot. The footprint layer may be older than the notice.`);
    if (n.size_acres_parsed && f.acres && Math.abs(n.size_acres_parsed - f.acres) / f.acres > 0.05)
      confirm.push(`Sources disagree on size: the notice says ${n["Parcel Size (Gross Acres)"]} (${n.size_acres_parsed.toFixed(2)} ac), the parcel outline is ${f.acres} ac.`);
  }
  if (f.he_may_be_stale) confirm.push(`Listed as a housing-element site, but buildings now cover much of it. The listing may be stale.`);

  if (f.surplus_notice) confirm.push(`Owner per the surplus notice: ${f.surplus_notice["Local Agency"] ?? "a public agency"}. Ask them whether it is still available and on what terms.`);
  else confirm.push("Who owns it and whether they would sell: not in free parcel data.");
  confirm.push("Water and sewer capacity, contamination (Phase I), and the city's objective standards (parking, setbacks).");
  return { verified, estimates, confirm };
}

export function draftEmail(p: ParcelProps, d: Detail, meta: Meta): string {
  const laws = meta.laws.laws.filter((l) => d.results[l.id]?.status === "possible").map((l) => l.name);
  return `Subject: Pre-application question: ${p.address ?? "parcel"} (APN ${p.apn})

Hello Santa Ana Planning,

Our organization is doing early site screening for affordable homes. Public data suggests the parcel at ${p.address ?? "[address]"} (APN ${p.apn}, zone ${p.zone ?? "unknown"}) may be eligible under:
${laws.map((l) => `  - ${l}`).join("\n")}

Could you confirm:
  1. The current zoning and any overlays or specific plan for this parcel.
  2. Whether the city has exempted it from AB 2011, or applies other local standards here.
  3. Any known constraints (utilities, easements, historic status).

Thank you,
[Your name, organization]

DRAFT ONLY. Generated by a hackathon prototype. Review it before sending; this tool does not send anything.`;
}
