// Assessed land value comes from the county parcel layer (Santa Ana Assessor Parcels, LandVal).
// It is the county's tax assessment, NOT a market price: Prop 13 caps annual increases, so
// long-held parcels are often assessed far below what they would sell for.
export const PRICE_NOTE = "County assessed land value, not a market price. Prop 13 often keeps it well below what a parcel would sell for.";

export function money(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v <= 0) return "n/a";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000).toLocaleString("en-US")}K`;
  return `$${Math.round(v)}`;
}
export function perAcre(v: number | null | undefined, acres: number): number | null {
  return v && acres > 0 ? v / acres : null;
}
export const PRICE_LIMITS: Record<string, { label: string; max: number }> = {
  any: { label: "Any assessed value", max: Infinity },
  p250: { label: "Up to $250K", max: 250_000 },
  p500: { label: "Up to $500K", max: 500_000 },
  p1m: { label: "Up to $1M", max: 1_000_000 },
  p2m: { label: "Up to $2M", max: 2_000_000 },
};
