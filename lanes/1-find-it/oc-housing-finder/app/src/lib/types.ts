export type Status = "pass" | "fail" | "unknown" | "lead";
export type LawStatus = "possible" | "no" | "no_lead" | "unclear";

export type Components = {
  legal: number;
  capacity: number;
  availability: number;
  access: number;
  environment: number;
};
export type Weights = Components;

export type ParcelProps = {
  apn: string;
  address: string | null;
  zip: string | null;
  label: "Potentially suitable" | "Needs review" | "Not enough data";
  laws: Record<string, LawStatus>;
  components: Components;
  unknowns: number;
  flags: Record<string, boolean | null>;
  acres: number;
  zone: string | null;
};

export type Feature = {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: ParcelProps;
};

export type TestResult = { id: string; status: Status; why: string };
// On disk: [id, "p"|"f"|"u"|"l", why?]. An empty why means "use the rule's static why".
export type RawTest = [string, string, string?];
export type LawResult = { status: LawStatus; tests: TestResult[] };

const S: Record<string, Status> = { p: "pass", f: "fail", u: "unknown", l: "lead" };
export function expandTests(raw: RawTest[], rule: LawRule): TestResult[] {
  return raw.map(([id, s, why]) => ({
    id,
    status: S[s] ?? "unknown",
    why: why || rule.tests.find((t) => t.id === id)?.why || "",
  }));
}

export type Detail = {
  facts: Record<string, any>;
  results: Record<string, { status: LawStatus; tests: RawTest[] }>;
};

export type LawRule = {
  id: string;
  name: string;
  what: string;
  source: string;
  tests: { id: string; label: string; check: string; quote?: string; note?: string; conflict?: string; why?: string }[];
};

export type Meta = {
  city: string;
  generated: string;
  counts: Record<string, number>;
  law_counts: Record<string, number>;
  assumptions: Record<string, { value: any; why: string }>;
  laws: { checked: string; sources: Record<string, { title: string; url: string; statute: string }>; laws: LawRule[] };
  city_rules: any;
  layers: Record<string, { url: string; where?: string; fetched: string } | null>;
  layers_extra: Record<string, any>;
  surplus_santa_ana: Record<string, any>[];
  data_gaps: string[];
};

export const COMPONENT_LABELS: Record<keyof Components, string> = {
  legal: "Zoning & legal pathway",
  capacity: "Potential capacity",
  availability: "Land availability",
  access: "Transit access",
  environment: "Environmental constraints",
};

export function score(c: Components, w: Weights): number {
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const s = (Object.keys(w) as (keyof Weights)[]).reduce((acc, k) => acc + (c[k] ?? 0) * w[k], 0);
  return Math.round((s / total) * 100);
}
