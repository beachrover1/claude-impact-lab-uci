import type { Detail } from "./types";

const cache: Record<string, Promise<Record<string, Detail>>> = {};

/** Per-parcel detail lives in shards by APN book (first 3 digits). */
export function loadDetail(apn: string): Promise<Detail | null> {
  const book = apn.slice(0, 3);
  if (!cache[book]) {
    cache[book] = fetch(`data/detail/${book}.json`).then((r) => (r.ok ? r.json() : {}));
  }
  return cache[book].then((d) => d[apn] ?? null);
}

export const LAW_SHORT: Record<string, string> = {
  SB9: "SB 9",
  SHRA_SB684: "SB 684",
  SHRA_SB1123: "SB 1123",
  AB2011: "AB 2011",
  SB4: "SB 4",
};

export const LAW_LONG: Record<string, string> = {
  SB9: "SB 9 duplex / lot split",
  SHRA_SB684: "SB 684 small-lot (multifamily zone)",
  SHRA_SB1123: "SB 1123 small-lot (vacant single-family)",
  AB2011: "AB 2011 commercial land",
  SB4: "SB 4 faith land (lead)",
};

export const LABEL_COLOR: Record<string, string> = {
  "Potentially suitable": "#10b981",
  "Needs review": "#f59e0b",
  "Not enough data": "#94a3b8",
};

export const ZONE_COLOR: Record<string, string> = {
  single_family: "#fbbf24",
  multifamily: "#f97316",
  mixed_use: "#ec4899",
  commercial: "#3b82f6",
  light_industrial: "#8b5cf6",
  heavy_industrial: "#6d28d9",
  review: "#94a3b8",
  other: "#22c55e",
};

export const ZONE_NAME: Record<string, string> = {
  single_family: "Single-family",
  multifamily: "Multifamily",
  mixed_use: "Mixed use",
  commercial: "Commercial / office",
  light_industrial: "Light industrial",
  heavy_industrial: "Heavy industrial",
  review: "Specific plan / review",
  other: "Other",
};

export function scoreColor(s: number) {
  return s >= 75 ? "#10b981" : s >= 55 ? "#f59e0b" : "#94a3b8";
}
