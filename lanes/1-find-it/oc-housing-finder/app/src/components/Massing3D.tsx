"use client";
// Illustrative 3D massing: the parcel's real outline, extruded into floors and drawn
// isometrically (pure SVG, no library). Floors and floor height are ASSUMPTIONS and the
// drawing says so. It is not a design and not a unit count.
import { useMemo, useState } from "react";
import type { Feature } from "@/lib/types";

// ASSUMPTIONS (labelled on screen)
const FLOOR_FT = 10;          // storey height
const COVERAGE = 0.6;         // building footprint as a share of the lot
const M_PER_DEG_LAT = 111_320;

function ringOf(f: Feature): number[][] {
  const g: any = f.geometry;
  return g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0];
}

export default function Massing3D({ f }: { f: Feature }) {
  const [floors, setFloors] = useState(3);
  const [angle, setAngle] = useState(35);

  const shape = useMemo(() => {
    const ring = ringOf(f);
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const kx = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180), ky = M_PER_DEG_LAT;
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    // meters, centered, y up. Shrink toward the centroid so the building sits inside the lot.
    const sc = Math.sqrt(COVERAGE);
    const lot = ring.map((p) => [(p[0] - cx) * kx, (p[1] - cy) * ky]);
    const bld = lot.map(([x, y]) => [x * sc, y * sc]);
    return { lot, bld };
  }, [f]);

  const W = 360, H = 250;
  const rad = (angle * Math.PI) / 180;
  const heightM = floors * FLOOR_FT * 0.3048;

  // isometric projection with a user-controlled yaw
  const proj = (x: number, y: number, z: number) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return [rx, -(ry * 0.5) - z * 0.95];
  };
  const all = [...shape.lot.map(([x, y]) => proj(x, y, 0)), ...shape.bld.map(([x, y]) => proj(x, y, heightM))];
  const minx = Math.min(...all.map((p) => p[0])), maxx = Math.max(...all.map((p) => p[0]));
  const miny = Math.min(...all.map((p) => p[1])), maxy = Math.max(...all.map((p) => p[1]));
  const k = Math.min((W - 40) / (maxx - minx || 1), (H - 40) / (maxy - miny || 1));
  const tx = (W - (maxx - minx) * k) / 2 - minx * k, ty = (H - (maxy - miny) * k) / 2 - miny * k;
  const P = (x: number, y: number, z: number) => { const [a, b] = proj(x, y, z); return `${(a * k + tx).toFixed(1)},${(b * k + ty).toFixed(1)}`; };

  // walls, sorted back to front by their midpoint depth
  const n = shape.bld.length;
  const walls = shape.bld.slice(0, n - 1).map((p, i) => {
    const q = shape.bld[i + 1];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const depth = mx * Math.sin(rad) + my * Math.cos(rad); // larger = nearer
    // outward-ish light: shade by edge direction
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const shade = 0.55 + 0.4 * Math.abs(Math.cos(Math.atan2(ey, ex) - rad));
    return { i, p, q, depth, shade };
  }).sort((a, b) => a.depth - b.depth);

  const acres = f.properties.acres;
  const footprintAcres = acres * COVERAGE;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-[#E9E2D6] bg-[#fbf8f2] p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[#6B6458]">3D massing · illustrative</span>
        <span className="text-[10.5px] text-[#c2562e]">ASSUMPTION, not a design</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-gradient-to-b from-[#e8f0f7] to-[#fbeedd]">
        <polygon points={shape.lot.map(([x, y]) => P(x, y, 0)).join(" ")} fill="#b9d3a2" stroke="#7f9f6a" strokeWidth="1.2" strokeDasharray="4 3" />
        <polygon points={shape.lot.map(([x, y]) => P(x, y, 0)).join(" ")} fill="url(#hatch)" opacity="0.0" />
        {walls.map((w) => (
          <polygon key={w.i} points={`${P(w.p[0], w.p[1], 0)} ${P(w.q[0], w.q[1], 0)} ${P(w.q[0], w.q[1], heightM)} ${P(w.p[0], w.p[1], heightM)}`}
            fill={`rgb(${Math.round(244 * w.shade)},${Math.round(214 * w.shade)},${Math.round(150 * w.shade)})`} stroke="#8a6a2c" strokeWidth="0.6" />
        ))}
        {/* floor lines */}
        {Array.from({ length: floors - 1 }).map((_, fi) => (
          <polyline key={fi} points={shape.bld.map(([x, y]) => P(x, y, ((fi + 1) / floors) * heightM)).join(" ")} fill="none" stroke="#8a6a2c" strokeWidth="0.5" opacity="0.5" />
        ))}
        <polygon points={shape.bld.map(([x, y]) => P(x, y, heightM)).join(" ")} fill="#e9a35a" stroke="#8a6a2c" strokeWidth="0.8" />
      </svg>
      <div className="mt-2 grid grid-cols-2 gap-3 text-[11.5px] text-[#1B2433]">
        <label>Floors: <b>{floors}</b> <span className="text-[#9c958a]">({Math.round(floors * FLOOR_FT)} ft)</span>
          <input type="range" min={1} max={6} value={floors} onChange={(e) => setFloors(+e.target.value)} className="factor w-full" style={{ ["--c" as any]: "#d9822b", ["--p" as any]: `${((floors - 1) / 5) * 100}%` }} />
        </label>
        <label>Rotate: <b>{angle}°</b>
          <input type="range" min={0} max={360} value={angle} onChange={(e) => setAngle(+e.target.value)} className="factor w-full" style={{ ["--c" as any]: "#2a7f8f", ["--p" as any]: `${(angle / 360) * 100}%` }} />
        </label>
      </div>
      <p className="mt-1.5 text-[10.5px] leading-snug text-[#6B6458]">
        Real lot outline ({acres} ac). Building footprint {footprintAcres.toFixed(2)} ac ({Math.round(COVERAGE * 100)}% coverage, ASSUMPTION), {FLOOR_FT} ft per floor (ASSUMPTION). Not zoning-limited, not a unit count.
      </p>
    </div>
  );
}
