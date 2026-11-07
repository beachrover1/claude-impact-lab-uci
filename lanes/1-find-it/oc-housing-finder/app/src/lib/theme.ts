import type { Weights } from "./types";

// Warm ivory palette. Each scoring factor has its own color, used everywhere it appears.
export const FACTORS: { key: keyof Weights; label: string; color: string; hint: string }[] = [
  { key: "legal", label: "Zoning fit", color: "#1f3a5f", hint: "Share of the best open law's site tests that pass" },
  { key: "capacity", label: "Lot size", color: "#2a7f8f", hint: "Lot acres / 0.5, capped (ASSUMPTION)" },
  { key: "access", label: "Transit", color: "#7c6bc4", hint: "Inside a Caltrans high-quality transit area" },
  { key: "availability", label: "Vacant land", color: "#d9822b", hint: "Vacant, surplus, or possibly underused" },
  { key: "environment", label: "Low hazard risk", color: "#e2b33c", hint: "No flood, fire, liquefaction, landslide or steep-slope flags" },
];

// ASSUMPTION: presets are illustrative starting points, not validated policy.
export const PRESETS: Record<string, { label: string; w: Weights }> = {
  balanced: { label: "Balanced", w: { legal: 30, capacity: 25, availability: 20, access: 15, environment: 10 } },
  transit: { label: "Transit-first", w: { legal: 25, capacity: 15, availability: 15, access: 35, environment: 10 } },
  lots: { label: "Biggest lots", w: { legal: 25, capacity: 40, availability: 20, access: 5, environment: 10 } },
  risk: { label: "Lowest risk", w: { legal: 30, capacity: 15, availability: 15, access: 10, environment: 30 } },
};

export const C = {
  ivory: "#FAF7F2",
  paper: "#FFFDF9",
  line: "#E9E2D6",
  ink: "#1B2433",
  muted: "#6B6458",
  navy: "#1f3a5f",
  terracotta: "#c2562e",
  sage: "#3f7d5c",
  saffron: "#e2b33c",
};

export const LABEL_STYLE: Record<string, { dot: string; bg: string; text: string; map: string }> = {
  "Potentially suitable": { dot: "#3f7d5c", bg: "#e6f1ea", text: "#2f6448", map: "#3f7d5c" },
  "Needs review": { dot: "#c2562e", bg: "#fbeae2", text: "#a2441f", map: "#d9822b" },
  "Not enough data": { dot: "#8b8478", bg: "#efebe4", text: "#5f594f", map: "#9c958a" },
};
