// "Ask in plain English": turns a sentence into filter chips with keyword rules.
// Not an LLM: every chip shows what was understood, and the user can remove it.

export type Chip = { id: string; label: string };
export type Parsed = {
  chips: Chip[];
  zcat?: string[];
  vacant?: boolean;
  minAcres?: number;
  transit?: boolean;
  publicLand?: boolean;
  lowFlood?: boolean;
  laws?: string[];
};

export function parseQuery(q: string): Parsed {
  const s = q.toLowerCase();
  const out: Parsed = { chips: [] };
  const add = (id: string, label: string) => out.chips.push({ id, label });

  if (/single[- ]?family|\br-?1\b/.test(s)) { out.zcat = ["single_family"]; add("zcat", "Zone R1 / single-family"); }
  else if (/multi[- ]?family|apartment|\br-?[34]\b/.test(s)) { out.zcat = ["multifamily", "mixed_use"]; add("zcat", "Multifamily zone"); }
  else if (/commercial|retail|office|corridor/.test(s)) { out.zcat = ["commercial", "mixed_use"]; add("zcat", "Commercial zone"); }

  if (/vacant|empty|undeveloped/.test(s)) { out.vacant = true; add("vacant", "Vacant"); }

  const m = s.match(/(?:at least|over|more than|>=?|≥|min(?:imum)?)\s*(half|a|one|[\d.]+)\s*(?:an?\s*)?acres?/);
  if (m) {
    const v = m[1] === "half" ? 0.5 : m[1] === "a" || m[1] === "one" ? 1 : parseFloat(m[1]);
    if (!isNaN(v)) { out.minAcres = v; add("minAcres", `≥ ${v} ac`); }
  } else if (/half an acre/.test(s)) { out.minAcres = 0.5; add("minAcres", "≥ 0.5 ac"); }

  if (/transit|train|rail|bus|station|metrolink|streetcar/.test(s)) { out.transit = true; add("transit", "Near transit"); }
  if (/public land|surplus|city[- ]owned|government land/.test(s)) { out.publicLand = true; add("publicLand", "Public land"); }
  if (/low flood|no flood|flood[- ]?safe|low risk/.test(s)) { out.lowFlood = true; add("lowFlood", "Low flood risk"); }
  if (/church|faith|congregation|temple|mosque|synagogue|sb ?4\b/.test(s)) { out.laws = ["SB4"]; add("laws", "Faith land (SB 4)"); }
  else if (/lot split|duplex|sb ?9\b/.test(s)) { out.laws = ["SB9"]; add("laws", "SB 9"); }
  else if (/sb ?684|sb ?1123|small[- ]lot|starter home/.test(s)) { out.laws = ["SHRA_SB684", "SHRA_SB1123"]; add("laws", "SB 684 / 1123"); }
  else if (/ab ?2011/.test(s)) { out.laws = ["AB2011"]; add("laws", "AB 2011"); }
  return out;
}

export function removeChip(p: Parsed, id: string): Parsed {
  const n: Parsed = { ...p, chips: p.chips.filter((c) => c.id !== id) };
  delete (n as any)[id];
  return n;
}
