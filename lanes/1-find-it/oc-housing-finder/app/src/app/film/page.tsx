"use client";
// Demo film renderer. Draws a 50-second explainer from the app's real data onto a canvas,
// encodes it frame-by-frame with WebCodecs (faster than real time, works even when the tab
// is hidden) and muxes it to MP4. Every number shown is computed from data/ at render time.
import { useEffect, useRef, useState } from "react";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const W = 1920, H = 1080, FPS = 30, DUR = 72;
const IV = "#FAF7F2", PAPER = "#FFFDF9", INK = "#1B2433", MUTED = "#6B6458", LINE = "#E9E2D6";
const NAVY = "#1f3a5f", TEAL = "#2a7f8f", VIOLET = "#7c6bc4", AMBER = "#d9822b", SAFFRON = "#e2b33c", TERRA = "#c2562e", SAGE = "#3f7d5c";
const FACT = [
  { k: "legal", l: "Zoning fit", c: NAVY }, { k: "capacity", l: "Lot size", c: TEAL }, { k: "access", l: "Transit", c: VIOLET },
  { k: "availability", l: "Vacant land", c: AMBER }, { k: "environment", l: "Low hazard risk", c: SAFFRON },
];
const BAL: Record<string, number> = { legal: 30, capacity: 25, availability: 20, access: 15, environment: 10 };
const LAWS = ["SB 9", "SB 684", "SB 1123", "AB 2011", "SB 4"];
const LAWID = ["SB9", "SHRA_SB684", "SHRA_SB1123", "AB2011", "SB4"];

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = (x: number) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const outBack = (x: number) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

type Data = {
  feats: any[]; meta: any; matches: any[]; top: any; topDetail: any; bristol: any; bristolDetail: any; imgs: Record<string, HTMLImageElement>;
  bounds: [number, number, number, number]; topWhy?: Record<string, string>;
};

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function card(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 1, r = 28) {
  g.save(); g.globalAlpha *= a; g.shadowColor = "rgba(27,36,51,.16)"; g.shadowBlur = 40; g.shadowOffsetY = 14;
  rr(g, x, y, w, h, r); g.fillStyle = PAPER; g.fill(); g.shadowColor = "transparent"; g.strokeStyle = LINE; g.lineWidth = 2; g.stroke(); g.restore();
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; font?: "d" | "s"; w?: number; c?: string; a?: number; align?: CanvasTextAlign } = {}) {
  g.save(); g.globalAlpha *= o.a ?? 1; g.fillStyle = o.c ?? INK; g.textAlign = o.align ?? "left"; g.textBaseline = "alphabetic";
  g.font = `${o.w ?? 500} ${o.size ?? 40}px ${o.font === "d" ? "Fraunces, Georgia, serif" : "Inter, system-ui, sans-serif"}`;
  g.fillText(s, x, y); g.restore();
}
function pill(g: CanvasRenderingContext2D, s: string, x: number, y: number, bg: string, fg: string, size = 30, a = 1) {
  g.save(); g.globalAlpha *= a; g.font = `600 ${size}px Inter, system-ui`; const w = g.measureText(s).width + size * 1.2;
  rr(g, x, y, w, size * 1.7, size * 0.85); g.fillStyle = bg; g.fill(); g.fillStyle = fg; g.textBaseline = "middle"; g.fillText(s, x + size * 0.6, y + size * 0.87); g.restore();
  return w;
}
function caption(g: CanvasRenderingContext2D, s: string, a: number) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = "600 40px Inter, system-ui"; const w = g.measureText(s).width + 80;
  rr(g, (W - w) / 2, H - 130, w, 78, 39); g.fillStyle = "rgba(27,36,51,.92)"; g.fill();
  g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, W / 2, H - 91); g.restore();
}
function skyline(g: CanvasRenderingContext2D, a: number, rise: number) {
  g.save(); g.globalAlpha = a; const base = H - 40 + (1 - rise) * 200;
  const towers = [[260, 70, 300], [340, 90, 400], [440, 60, 330], [1380, 80, 380], [1470, 100, 450], [1580, 60, 320]];
  for (const [x, w, h] of towers) { g.fillStyle = "rgba(31,58,95,.16)"; g.fillRect(x, base - h, w, h); }
  const homes = [[60, 200, 150, TERRA], [280, 160, 120, SAFFRON], [470, 220, 190, NAVY], [720, 170, 140, TEAL], [920, 120, 170, AMBER], [1060, 120, 170, TERRA], [1210, 190, 130, VIOLET], [1430, 240, 210, TEAL], [1700, 180, 150, SAFFRON]];
  for (const [x, w, h, c] of homes as any) {
    g.fillStyle = c; g.globalAlpha = a * 0.28; g.fillRect(x, base - h, w, h);
    g.globalAlpha = a * 0.5; g.beginPath(); g.moveTo(x - 10, base - h); g.lineTo(x + w / 2, base - h - 55); g.lineTo(x + w + 10, base - h); g.closePath(); g.fill();
    g.globalAlpha = a * 0.9; g.fillStyle = "#f6d77a"; for (let i = 0; i < 2; i++) g.fillRect(x + 30 + i * (w - 90), base - h + 40, 28, 28);
  }
  g.globalAlpha = a * 0.6; g.fillStyle = "#e9dcc6"; g.fillRect(0, base, W, 60); g.restore();
}

function wordmark(g: CanvasRenderingContext2D, cx: number, y: number, size: number, a: number) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.font = `700 ${size}px Inter, system-ui, sans-serif`; g.textBaseline = "alphabetic";
  (g as any).letterSpacing = `${-0.02 * size}px`;
  const w = g.measureText("Landora").width; g.fillStyle = "#14284b"; g.fillText("Landora", cx - w / 2, y); g.restore();
}
function logo(g: CanvasRenderingContext2D, d: Data, cx: number, cy: number, s: number, a: number) {
  const im = d.imgs.logo; if (!im || a <= 0) return;
  g.save(); g.globalAlpha = a; g.shadowColor = "rgba(20,40,75,.3)"; g.shadowBlur = s * 0.25; g.shadowOffsetY = s * 0.08;
  g.drawImage(im, cx - s / 2, cy - s / 2, s, s); g.restore();
}

function project(b: [number, number, number, number], box: [number, number, number, number]) {
  const [minx, miny, maxx, maxy] = b; const [x, y, w, h] = box;
  const kx = w / (maxx - minx), ky = h / (maxy - miny), k = Math.min(kx, ky * 1.2);
  const ox = x + (w - (maxx - minx) * k) / 2, oy = y + (h - (maxy - miny) * k * 1.2) / 2;
  return (lon: number, lat: number) => [ox + (lon - minx) * k, oy + (maxy - lat) * k * 1.2] as [number, number];
}
function ring(f: any): number[][] {
  const g = f.geometry; return g.type === "Polygon" ? g.coordinates[0] : g.coordinates[0][0];
}
function centroid(f: any) { const r = ring(f); let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; }
function scoreOf(c: any) { let s = 0, t = 0; for (const k in BAL) { s += c[k] * BAL[k]; t += BAL[k]; } return Math.round((s / t) * 100); }

function drawParcels(g: CanvasRenderingContext2D, d: Data, P: (a: number, b: number) => [number, number], reveal: number, dim: number) {
  const n = Math.floor(d.feats.length * reveal);
  for (let i = 0; i < n; i++) {
    const f = d.feats[i]; const r = ring(f); const lab = f.properties.label;
    g.beginPath(); r.forEach((p: number[], j: number) => { const [x, y] = P(p[0], p[1]); j ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.fillStyle = lab === "Potentially suitable" ? `rgba(63,125,92,${0.75 * (1 - dim) + 0.12})` : lab === "Needs review" ? `rgba(217,130,43,${0.8 * (1 - dim) + 0.12})` : `rgba(156,149,138,${0.35 * (1 - dim) + 0.08})`;
    g.fill();
  }
}

function frame(g: CanvasRenderingContext2D, t: number, d: Data) {
  g.fillStyle = IV; g.fillRect(0, 0, W, H);
  const map = project(d.bounds, [960, 150, 860, 760]);

  // S1 Title 0-4.5
  if (t < 5) {
    const a = 1 - seg(t, 4.2, 5);
    skyline(g, a, ease(seg(t, 0, 1.6)));
    const pl = outBack(seg(t, 0.2, 1.1));
    logo(g, d, W / 2, 230 + (1 - clamp(pl)) * 30, 170 * clamp(pl, 0, 1.2), a * clamp(pl));
    wordmark(g, W / 2, 440, 130, a * ease(seg(t, 0.7, 1.6)));
    text(g, "Turn overlooked land into affordable homes.", W / 2, 520, { size: 48, c: MUTED, align: "center", a: a * ease(seg(t, 1.0, 2.0)) });
    pill(g, "PROTOTYPE · SANTA ANA PILOT", 760, 575, TERRA, "#fff", 26, a * ease(seg(t, 1.6, 2.4)));
  }
  // S2 Problem 4.5-10
  if (t >= 4.5 && t < 10.5) {
    const a = ease(seg(t, 4.5, 5.2)) * (1 - seg(t, 10, 10.5));
    text(g, "Today, nonprofits find land by luck.", 160, 230, { font: "d", size: 76, w: 600, a });
    const items: [string, string, string][] = [["☎", "A city calls about surplus land", NAVY], ["⛪", "A congregation offers its parking lot", TERRA], ["🗺", "5 laws × 5–10 maps for every parcel", TEAL]];
    items.forEach(([ic, s, c], i) => {
      const p = outBack(seg(t, 5.4 + i * 0.7, 6.2 + i * 0.7)); const y = 330 + i * 200 + (1 - p) * 60;
      card(g, 160, y, 1100, 160, a * clamp(p));
      g.save(); g.globalAlpha = a * clamp(p); rr(g, 190, y + 30, 100, 100, 24); g.fillStyle = c; g.fill(); g.restore();
      text(g, ic, 240, y + 103, { size: 52, align: "center", a: a * clamp(p), c: "#fff" });
      text(g, s, 330, y + 98, { size: 46, w: 600, a: a * clamp(p) });
    });
    text(g, "No one has connected the laws to the parcel data.", 160, 1000, { size: 40, c: TERRA, w: 600, a: a * ease(seg(t, 7.8, 8.6)) });
  }
  // S3 Screening 10-17
  if (t >= 10 && t < 17.5) {
    const a = ease(seg(t, 10, 10.6)) * (1 - seg(t, 17, 17.5));
    g.save(); g.globalAlpha = a; drawParcels(g, d, map, ease(seg(t, 10.3, 14.5)), 0); g.restore();
    text(g, "We screened every parcel", 140, 260, { font: "d", size: 72, w: 600, a });
    text(g, "in Santa Ana", 140, 345, { font: "d", size: 72, w: 600, a, c: NAVY });
    const n = d.meta.counts.parcels_screened * ease(seg(t, 10.5, 14));
    text(g, fmt(n), 140, 520, { size: 150, w: 700, a, c: INK });
    text(g, "parcels × 5 state housing laws", 145, 580, { size: 40, c: MUTED, a });
    let x = 140; LAWS.forEach((l, i) => { const p = outBack(seg(t, 12 + i * 0.35, 12.6 + i * 0.35)); x += pill(g, l, x, 640 + (1 - p) * 30, "rgba(42,127,143,.14)", "#1d5d69", 34, a * clamp(p)) + 16; });
    text(g, "Each test: ✓ pass  ✕ fail  ? can't be checked, with the HCD source", 140, 800, { size: 34, c: MUTED, a: a * ease(seg(t, 13.5, 14.3)) });
    caption(g, "Public parcels, zoning, flood, fire, transit, surplus land, footprints", a * ease(seg(t, 14.5, 15)));
  }
  // S4 Ask 17-23.5
  if (t >= 17 && t < 24) {
    const a = ease(seg(t, 17, 17.6)) * (1 - seg(t, 23.5, 24));
    text(g, "Ask in plain English", 160, 210, { font: "d", size: 72, w: 600, a });
    card(g, 160, 270, 1600, 140, a, 32);
    const q = "Vacant single-family lots near transit, at least half an acre";
    const k = Math.floor(q.length * seg(t, 17.6, 20));
    text(g, "✦", 215, 362, { size: 48, c: SAFFRON, a }); text(g, q.slice(0, k) + (Math.floor(t * 3) % 2 && k < q.length ? "|" : ""), 280, 360, { size: 46, a });
    const chips = ["Zone R1", "Vacant", "≥ 0.5 ac", "Near transit"]; let x = 160;
    chips.forEach((c, i) => { const p = outBack(seg(t, 20.1 + i * 0.25, 20.6 + i * 0.25)); x += pill(g, c + "  ×", x, 450, "#fff", INK, 32, a * clamp(p)) + 16; });
    const rows: [string, number, string][] = [["Parcels screened", d.meta.counts.parcels_screened, INK], ["Potentially suitable", d.meta.counts["Potentially suitable"], SAGE], ["Match your question", d.matches.length, NAVY]];
    rows.forEach(([l, n, c], i) => {
      const p = ease(seg(t, 20.8 + i * 0.5, 21.8 + i * 0.5)); const y = 600 + i * 130;
      text(g, l, 160, y, { size: 38, a: a * clamp(p * 2) }); text(g, fmt(n * p), 1760, y, { size: 44, w: 700, align: "right", a: a * clamp(p * 2) });
      rr(g, 160, y + 20, 1600, 30, 15); g.save(); g.globalAlpha = a; g.fillStyle = "#efe9df"; g.fill(); g.restore();
      const wv = Math.max(30, 1600 * (n / d.meta.counts.parcels_screened)) * p; rr(g, 160, y + 20, wv, 30, 15); g.save(); g.globalAlpha = a; g.fillStyle = c; g.fill(); g.restore();
    });
  }
  // S5 Map + pins 23.5-30
  if (t >= 23.5 && t < 30.5) {
    const a = ease(seg(t, 23.5, 24.1)) * (1 - seg(t, 30, 30.5));
    const P = project(d.bounds, [120, 120, 1100, 860]);
    g.save(); g.globalAlpha = a; drawParcels(g, d, P, 1, ease(seg(t, 24, 25))); g.restore();
    d.matches.slice(0, 18).forEach((m, i) => {
      const p = outBack(seg(t, 25 + i * 0.12, 25.6 + i * 0.12)); if (p <= 0) return;
      const [x, y] = P(m.c[0], m.c[1]); const r = 26 * clamp(p, 0, 1.3);
      g.save(); g.globalAlpha = a; g.beginPath(); g.arc(x, y - (1 - clamp(p)) * 40, r, 0, 7); g.fillStyle = m.s >= 75 ? NAVY : TERRA; g.fill(); g.lineWidth = 5; g.strokeStyle = PAPER; g.stroke();
      g.fillStyle = "#fff"; g.font = "700 20px Inter"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(m.s), x, y - (1 - clamp(p)) * 40); g.restore();
    });
    text(g, `${d.matches.length} sites`, 1300, 330, { font: "d", size: 110, w: 700, a, c: NAVY });
    text(g, "ranked by a score", 1300, 400, { size: 44, a, c: MUTED });
    text(g, "you control", 1300, 455, { size: 44, a, c: MUTED });
    FACT.forEach((f, i) => { const p = ease(seg(t, 26 + i * 0.3, 26.8 + i * 0.3)); const y = 540 + i * 62;
      g.save(); g.globalAlpha = a; rr(g, 1300, y, 24, 24, 6); g.fillStyle = f.c; g.fill(); g.restore();
      text(g, f.l, 1345, y + 21, { size: 32, a }); rr(g, 1620, y + 4, 200, 16, 8); g.save(); g.globalAlpha = a; g.fillStyle = "#ebe5da"; g.fill(); g.restore();
      rr(g, 1620, y + 4, 200 * (BAL[f.k] / 30) * 0.66 * p, 16, 8); g.save(); g.globalAlpha = a; g.fillStyle = f.c; g.fill(); g.restore(); });
    caption(g, "Change the weights and the pins re-rank live", a * ease(seg(t, 27.5, 28)));
  }
  // S6 Breakdown 30-37
  if (t >= 30 && t < 37.5) {
    const a = ease(seg(t, 30, 30.6)) * (1 - seg(t, 37, 37.5));
    const top = d.top; const s = scoreOf(top.properties.components);
    card(g, 140, 120, 1640, 820, a, 36);
    text(g, String(s), 200, 300, { font: "d", size: 150, w: 600, c: NAVY, a });
    text(g, `#1  ${top.properties.address}`, 470, 230, { size: 56, w: 700, a });
    pill(g, "● Potentially suitable", 470, 260, "#e6f1ea", "#2f6448", 28, a);
    text(g, `${top.properties.acres} ac · zone ${top.properties.zone} · vacant · near transit`, 860, 300, { size: 32, c: MUTED, a });
    // stacked bar
    let x = 200; const tot = Object.values(BAL).reduce((m, n) => m + n, 0);
    FACT.forEach((f, i) => { const pts = top.properties.components[f.k] * BAL[f.k] / tot; const p = ease(seg(t, 31 + i * 0.35, 31.6 + i * 0.35)); const w = 1520 * pts * p;
      g.save(); g.globalAlpha = a; g.fillStyle = f.c; g.fillRect(x, 360, w, 26); g.restore(); x += w; });
    text(g, "SCORE BREAKDOWN · factor × weight", 200, 470, { size: 26, w: 700, c: MUTED, a });
    FACT.forEach((f, i) => { const v = top.properties.components[f.k]; const p = ease(seg(t, 31.3 + i * 0.3, 32 + i * 0.3)); const y = 520 + i * 72;
      text(g, f.l, 200, y + 22, { size: 32, a }); rr(g, 470, y + 6, 380, 18, 9); g.save(); g.globalAlpha = a; g.fillStyle = "#ebe5da"; g.fill(); g.restore();
      rr(g, 470, y + 6, 380 * v * p, 18, 9); g.save(); g.globalAlpha = a; g.fillStyle = f.c; g.fill(); g.restore();
      text(g, `+${(v * BAL[f.k] * 100 / tot * p).toFixed(1)}`, 900, y + 24, { size: 32, w: 700, a }); });
    text(g, "PATHWAY CHECKS · from HCD fact sheets", 1060, 470, { size: 26, w: 700, c: MUTED, a });
    LAWID.forEach((id, i) => { const st = top.properties.laws[id]; const p = outBack(seg(t, 32.5 + i * 0.35, 33 + i * 0.35)); const y = 520 + i * 72;
      const [ic, bg, fg, why] = st === "possible" ? ["✓", "#e6f1ea", "#2f6448", "No test fails"] : st === "no_lead" ? ["–", "#efe9df", MUTED, "No ownership lead"] : st === "unclear" ? ["?", "#fbf3dc", "#9a7414", "Zone needs review"] : ["✕", "#fbeae2", "#a2441f", d.topWhy?.[id] ?? "A test fails"];
      g.save(); g.globalAlpha = a * clamp(p); rr(g, 1060, y, 44, 44, 10); g.fillStyle = bg; g.fill(); g.fillStyle = fg; g.font = "700 28px Inter"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ic, 1082, y + 23); g.restore();
      text(g, LAWS[i], 1125, y + 33, { size: 32, w: 700, a: a * clamp(p) }); text(g, why, 1290, y + 33, { size: 28, c: MUTED, a: a * clamp(p) }); });
    caption(g, "Pass, fail or unknown, for every test, with its source", a * ease(seg(t, 33, 33.5)));
  }
  // S7 Real case 37-43
  if (t >= 37 && t < 43.5) {
    const a = ease(seg(t, 37, 37.6)) * (1 - seg(t, 43, 43.5));
    const f = d.bristolDetail.facts; const n = f.surplus_notice;
    pill(g, "REAL TEST CASE", 160, 120, TERRA, "#fff", 26, a);
    text(g, "1111 N Bristol St, Santa Ana", 160, 260, { font: "d", size: 80, w: 600, a });
    text(g, `Land the city itself offered as surplus · HCD case ${n["Parent Case"]}`, 160, 330, { size: 38, c: MUTED, a });
    const facts: [string, string, string, string][] = [
      ["Vacancy", `Notice: “${String(n["Existing Use/Vacancy"]).trim()}”`, `Footprints: ${Math.round(f.building_coverage * 100)}% built`, TERRA],
      ["Lot size", `Notice: ${n["Parcel Size (Gross Acres)"]} (${n.size_acres_parsed.toFixed(2)} ac)`, `Parcel outline: ${f.acres} ac`, AMBER],
      ["Zoning", `Zone ${f.zone}: specific plan`, "A person must read the plan", NAVY],
    ];
    facts.forEach(([h, l, r, c], i) => { const p = outBack(seg(t, 38 + i * 0.6, 38.7 + i * 0.6)); const y = 400 + i * 175 + (1 - clamp(p)) * 40;
      card(g, 160, y, 1600, 145, a * clamp(p)); g.save(); g.globalAlpha = a * clamp(p); g.fillStyle = c; rr(g, 160, y, 14, 145, 7); g.fill(); g.restore();
      text(g, h, 210, y + 88, { size: 40, w: 700, a: a * clamp(p) }); text(g, l, 520, y + 88, { size: 36, a: a * clamp(p) }); text(g, r, 1150, y + 88, { size: 36, w: 600, c, a: a * clamp(p) }); });
    caption(g, "Sources disagree, and the tool shows it instead of picking one", a * ease(seg(t, 40, 40.5)));
  }
  // S7b Who it helps 43-50.5
  if (t >= 43 && t < 51) {
    const a = ease(seg(t, 43, 43.6)) * (1 - seg(t, 50.4, 51));
    text(g, "Who it helps", 160, 200, { font: "d", size: 76, w: 600, a });
    text(g, "Land is the biggest line on the bill, and small teams can't see it.", 160, 262, { size: 36, c: MUTED, a });
    const people: [string, string, string, string][] = [
      ["Small housing nonprofits", "Get a ranked call list without a GIS team", "🏘️", NAVY],
      ["Congregations with a lot", "See if their land could host homes (SB 4)", "⛪", TERRA],
      ["City housing staff", "Flag hazards and stale site lists first", "🏛️", TEAL],
    ];
    people.forEach(([h, sub, ic, c], i) => {
      const p = outBack(seg(t, 44 + i * 0.6, 44.8 + i * 0.6)); const x = 160 + i * 560, y = 330 + (1 - clamp(p)) * 60;
      card(g, x, y, 520, 330, a * clamp(p));
      g.save(); g.globalAlpha = a * clamp(p); rr(g, x + 36, y + 36, 96, 96, 24); g.fillStyle = c; g.fill(); g.restore();
      text(g, ic, x + 84, y + 106, { size: 52, align: "center", a: a * clamp(p), c: "#fff" });
      text(g, h, x + 36, y + 205, { size: 38, w: 700, a: a * clamp(p) });
      text(g, sub.length > 34 ? sub.slice(0, sub.lastIndexOf(" ", 34)) : sub, x + 36, y + 255, { size: 28, c: MUTED, a: a * clamp(p) });
      if (sub.length > 34) text(g, sub.slice(sub.lastIndexOf(" ", 34) + 1), x + 36, y + 292, { size: 28, c: MUTED, a: a * clamp(p) });
    });
    const nLayers = Object.values(d.meta.layers).filter(Boolean).length + 2;
    const stats: [string, string][] = [[String(d.meta.laws.laws.length), "state laws tested"], [String(nLayers), "public data layers checked"], [fmt(d.meta.counts.parcels_screened), "parcels screened"]];
    stats.forEach(([n, l], i) => { const p = ease(seg(t, 46.4 + i * 0.4, 47.2 + i * 0.4));
      text(g, n, 160 + i * 560, 800, { font: "d", size: 84, w: 700, c: NAVY, a: a * p }); text(g, l, 160 + i * 560, 850, { size: 32, c: MUTED, a: a * p }); });
    text(g, "From weeks of map-hopping to one ranked list, with the sources on screen.", 160, 960, { size: 38, w: 600, c: TERRA, a: a * ease(seg(t, 48.2, 49)) });
  }
  // S7c Where the intelligence is 51-58.5
  if (t >= 51 && t < 59) {
    const a = ease(seg(t, 51, 51.6)) * (1 - seg(t, 58.4, 59));
    text(g, "Where the intelligence is", 160, 190, { font: "d", size: 76, w: 600, a });
    // left: built with Claude
    card(g, 160, 250, 800, 640, a * ease(seg(t, 51.4, 52)));
    pill(g, "BUILT WITH CLAUDE", 200, 290, NAVY, "#fff", 24, a * ease(seg(t, 51.6, 52.2)));
    const built = ["Read HCD's fact sheets and turned each law into tests, with quotes", "Inspected every data layer's fields before using it", "Wrote the pipeline, the rules engine and this app", "Caught source conflicts: size, vacancy, zone"];
    built.forEach((b, i) => { const p = ease(seg(t, 52.2 + i * 0.5, 52.9 + i * 0.5)); const y = 410 + i * 120;
      g.save(); g.globalAlpha = a * p; g.fillStyle = TEAL; g.beginPath(); g.arc(215, y - 10, 9, 0, 7); g.fill(); g.restore();
      const words = b.split(" "); let line = "", ly = y; for (const w of words) { if ((line + w).length > 36) { text(g, line, 245, ly, { size: 30, a: a * p }); line = ""; ly += 40; } line += w + " "; } text(g, line, 245, ly, { size: 30, a: a * p }); });
    // right: inside the app
    card(g, 1000, 250, 760, 640, a * ease(seg(t, 51.8, 52.4)));
    pill(g, "INSIDE THE APP · RULES OVER DATA", 1040, 290, TERRA, "#fff", 24, a * ease(seg(t, 52, 52.6)));
    const feats: [string, string][] = [["Plain-English search", "→ filter chips you can remove"], ["Feasibility Copilot", "score, assessment, next step"], ["Assistant", "answers only from screening data"], ["Drafted city email", "never sent for you"]];
    feats.forEach(([h, sub], i) => { const p = outBack(seg(t, 53 + i * 0.5, 53.7 + i * 0.5)); const y = 395 + i * 118 + (1 - clamp(p)) * 30;
      g.save(); g.globalAlpha = a * clamp(p); rr(g, 1040, y - 38, 56, 56, 14); g.fillStyle = "#fff4ea"; g.fill(); g.restore();
      text(g, "✦", 1068, y - 2, { size: 32, c: "#f07a2c", align: "center", a: a * clamp(p) });
      text(g, h, 1115, y - 6, { size: 34, w: 700, a: a * clamp(p) }); text(g, sub, 1115, y + 30, { size: 26, c: MUTED, a: a * clamp(p) }); });
    text(g, "No language model runs in the app, so nothing can be invented. Every line traces to a test result.", 960, 970, { size: 34, w: 600, c: NAVY, align: "center", a: a * ease(seg(t, 55.8, 56.6)) });
  }
  // S7d Technology 59-65.5
  if (t >= 59 && t < 66) {
    const a = ease(seg(t, 59, 59.6)) * (1 - seg(t, 65.4, 66));
    text(g, "Technology", 160, 200, { font: "d", size: 76, w: 600, a });
    const groups: [string, string, string[]][] = [
      ["Interface", NAVY, ["Next.js 14", "React 18", "TypeScript", "Tailwind CSS", "Leaflet maps"]],
      ["Data pipeline", TEAL, ["Python 3.9", "Shapely 2.0", "ArcGIS REST", "GeoJSON"]],
      ["Public data", AMBER, ["Santa Ana GIS", "SCAG", "FEMA NFHL", "CAL FIRE", "Caltrans", "HCD", "OpenStreetMap", "US Census"]],
      ["Built and filmed with", VIOLET, ["Claude Code", "WebCodecs + mp4-muxer"]],
    ];
    groups.forEach(([h, c, items], gi) => { const gy = 290 + gi * 185; const gp = ease(seg(t, 59.5 + gi * 0.5, 60.2 + gi * 0.5));
      g.save(); g.globalAlpha = a * gp; rr(g, 160, gy - 40, 10, 130, 5); g.fillStyle = c; g.fill(); g.restore();
      text(g, h, 200, gy, { size: 34, w: 700, c, a: a * gp });
      let x = 200; items.forEach((it, i) => { const p = outBack(seg(t, 60 + gi * 0.5 + i * 0.12, 60.6 + gi * 0.5 + i * 0.12));
        x += pill(g, it, x, gy + 24 + (1 - clamp(p)) * 20, "#fff", INK, 30, a * clamp(p)) + 14; }); });
    caption(g, "All public data, all free to use. On a fresh laptop: npm install, then npm run dev.", a * ease(seg(t, 63.2, 63.9)));
  }
  // S8 App montage 65-69.5
  if (t >= 65 && t < 70) {
    const a = ease(seg(t, 65, 65.6)) * (1 - seg(t, 69.4, 70));
    const shots = ["workbench", "compare", "layers"];
    shots.forEach((k, i) => { const im = d.imgs[k]; if (!im) return; const p = ease(seg(t, 65.3 + i * 0.5, 66.1 + i * 0.5));
      const w = 820, h = w * im.height / im.width; const x = 120 + i * 560, y = 250 + (i % 2) * 120 + (1 - p) * 80;
      g.save(); g.globalAlpha = a * p; g.shadowColor = "rgba(27,36,51,.25)"; g.shadowBlur = 50; g.shadowOffsetY = 20; rr(g, x, y, w, h, 18); g.clip(); g.drawImage(im, x, y, w, h); g.restore(); });
    text(g, "Search · score · compare · map layers · ask", W / 2, 170, { font: "d", size: 60, w: 600, align: "center", a });
  }
  // S9 End 69.5-72
  if (t >= 69.5) {
    const a = ease(seg(t, 69.5, 70.2));
    skyline(g, a, 1);
    logo(g, d, W / 2 - 250, 300, 120, a);
    wordmark(g, W / 2 + 60, 335, 110, a);
    text(g, "From luck to a call list.", W / 2, 470, { font: "d", size: 76, w: 600, align: "center", a });
    text(g, "github.com/beachrover1/claude-impact-lab-uci", W / 2, 545, { size: 36, c: NAVY, w: 600, align: "center", a });
    text(g, "Public data only · prototype, not legal advice · every result confirmed with the city", W / 2, 600, { size: 28, c: MUTED, align: "center", a });
  }
}

async function loadData(): Promise<Data> {
  const [fc, meta] = await Promise.all([fetch("data/parcels.geojson").then((r) => r.json()), fetch("data/meta.json").then((r) => r.json())]);
  const feats = fc.features as any[];
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const f of feats) for (const p of ring(f)) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  // Same filter as the app for "Vacant single-family lots near transit, at least half an acre" (4–12 homes size)
  const matches = feats.filter((f) => { const p = f.properties;
    return ["Potentially suitable", "Needs review"].includes(p.label) && LAWID.some((l) => p.laws[l] === "possible") && p.acres >= 0.5 && p.acres <= 5 && p.zcat === "single_family" && p.flags.vacant && p.flags.transit; })
    .map((f) => ({ f, s: scoreOf(f.properties.components), c: centroid(f) })).sort((a, b) => b.s - a.s);
  const top = matches[0].f;
  const topDetail = (await fetch(`data/detail/${top.properties.apn.slice(0, 3)}.json`).then((r) => r.json()))[top.properties.apn];
  const bristol = feats.find((f) => f.properties.apn === "405-274-10");
  const bristolDetail = (await fetch("data/detail/405.json").then((r) => r.json()))["405-274-10"];
  const imgs: Record<string, HTMLImageElement> = {};
  await Promise.all(["workbench", "compare", "layers", "logo"].map((k) => new Promise<void>((res) => { const im = new Image(); im.onload = () => { imgs[k] = im; res(); }; im.onerror = () => res(); im.src = k === "logo" ? "film/logo.svg" : `film/${k}.jpg`; })));
  return { feats, meta, matches, top, topDetail, bristol, bristolDetail, imgs, bounds: [minx, miny, maxx, maxy] } as Data;
}

export default function Film() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading data…");
  const dataRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      await Promise.all([document.fonts.load("600 80px Fraunces"), document.fonts.load("500 40px Inter"), document.fonts.load("700 40px Inter")]).catch(() => {});
      const d: any = await loadData();
      // why each failing law fails for the #1 site, from its real test results
      d.topWhy = {};
      for (const id of LAWID) { const r = d.topDetail.results[id]; const fail = r?.tests.find((x: any) => x[1] === "f");
        if (fail) { const rule = d.meta.laws.laws.find((l: any) => l.id === id).tests.find((x: any) => x.id === fail[0]); const why = "Fails: " + rule.label.toLowerCase().replace(/ \(.*\)/, ""); d.topWhy[id] = why.length > 38 ? why.slice(0, 37) + "…" : why; } }
      dataRef.current = d;
      const g = ref.current!.getContext("2d")!;
      frame(g, 31.5, d);
      (window as any).__frame = (tt: number) => frame(g, tt, d);
      setStatus(`Ready. ${d.matches.length} matches, #1 ${d.top.properties.address}. Press Render.`);
      if (location.search.includes("go=1")) render();
    })().catch((e) => setStatus("Error: " + e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function render() {
    const d = dataRef.current; const g = ref.current!.getContext("2d")!;
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => setStatus("Encoder error: " + e) });
    enc.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 10_000_000, framerate: FPS });
    const N = DUR * FPS;
    for (let i = 0; i < N; i++) {
      frame(g, i / FPS, d);
      const vf = new VideoFrame(ref.current!, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(vf, { keyFrame: i % (FPS * 2) === 0 }); vf.close();
      if (enc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      if (i % 30 === 0) { setStatus(`Rendering ${Math.round((i / N) * 100)}%`); await new Promise((r) => setTimeout(r, 0)); }
    }
    await enc.flush(); muxer.finalize();
    const buf = target.buffer;
    setStatus(`Encoded ${(buf.byteLength / 1e6).toFixed(1)} MB. Saving…`);
    try {
      const r = await fetch("http://127.0.0.1:8765/upload", { method: "POST", body: buf, headers: { "Content-Type": "video/mp4" } });
      setStatus("Done: " + (await r.text()));
    } catch (e) { setStatus("Saved failed: " + e); }
    (window as any).__filmDone = true;
  }

  return (
    <div style={{ background: "#1B2433", minHeight: "100vh", padding: 16, color: "#fff", fontFamily: "Inter, sans-serif" }}>
      <div style={{ marginBottom: 8 }}>
        <button onClick={render} style={{ background: "#e2b33c", color: "#1B2433", fontWeight: 700, padding: "6px 14px", borderRadius: 8, marginRight: 12 }}>Render</button>
        <span id="film-status">{status}</span>
      </div>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", maxWidth: 1280, aspectRatio: "16/9", borderRadius: 12 }} />
    </div>
  );
}
