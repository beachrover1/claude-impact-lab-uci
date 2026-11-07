// Original illustration (no external image): a Santa Ana street of small homes,
// bungalows, duplexes, townhomes and a small apartment building, with palms and
// dashed parcel lines. Drawn in the app's palette so it sits behind the search bar.

type B = { x: number; w: number; h: number; roof: "gable" | "flat" | "hip" | "shed"; c: string; win: number; door?: boolean };

const BUILDINGS: B[] = [
  { x: 40, w: 120, h: 70, roof: "gable", c: "#c2562e", win: 2, door: true },
  { x: 175, w: 90, h: 58, roof: "hip", c: "#e2b33c", win: 1, door: true },
  { x: 280, w: 150, h: 112, roof: "flat", c: "#1f3a5f", win: 6 },
  { x: 445, w: 110, h: 76, roof: "gable", c: "#2a7f8f", win: 2, door: true },
  { x: 570, w: 64, h: 92, roof: "shed", c: "#d9822b", win: 2 },
  { x: 640, w: 64, h: 92, roof: "shed", c: "#c2562e", win: 2 },
  { x: 710, w: 64, h: 92, roof: "shed", c: "#e2b33c", win: 2 },
  { x: 800, w: 130, h: 64, roof: "hip", c: "#7c6bc4", win: 2, door: true },
  { x: 945, w: 170, h: 128, roof: "flat", c: "#2a7f8f", win: 8 },
  { x: 1130, w: 104, h: 72, roof: "gable", c: "#1f3a5f", win: 2, door: true },
  { x: 1250, w: 96, h: 60, roof: "hip", c: "#d9822b", win: 1, door: true },
  { x: 1360, w: 140, h: 96, roof: "flat", c: "#c2562e", win: 4 },
  { x: 1515, w: 100, h: 70, roof: "gable", c: "#e2b33c", win: 2, door: true },
];

const GROUND = 250;

const TOWERS: { x: number; w: number; h: number; c: string; cap?: boolean }[] = [
  { x: 228, w: 44, h: 150, c: "#1f3a5f" },
  { x: 300, w: 58, h: 205, c: "#1f3a5f", cap: true },
  { x: 368, w: 40, h: 168, c: "#2a7f8f" },
  { x: 520, w: 50, h: 182, c: "#1f3a5f" },
  { x: 860, w: 46, h: 160, c: "#2a7f8f" },
  { x: 912, w: 62, h: 215, c: "#1f3a5f", cap: true },
  { x: 982, w: 44, h: 176, c: "#1f3a5f" },
  { x: 1040, w: 36, h: 140, c: "#2a7f8f" },
  { x: 1290, w: 52, h: 190, c: "#1f3a5f" },
  { x: 1350, w: 40, h: 150, c: "#2a7f8f" },
];

function Building({ b }: { b: B }) {
  const top = GROUND - b.h;
  const roof =
    b.roof === "gable" ? `M${b.x - 6},${top} L${b.x + b.w / 2},${top - 34} L${b.x + b.w + 6},${top} Z`
    : b.roof === "hip" ? `M${b.x - 6},${top} L${b.x + 22},${top - 22} L${b.x + b.w - 22},${top - 22} L${b.x + b.w + 6},${top} Z`
    : b.roof === "shed" ? `M${b.x - 3},${top} L${b.x + b.w + 3},${top - 18} L${b.x + b.w + 3},${top} Z`
    : `M${b.x - 4},${top - 6} H${b.x + b.w + 4} V${top} H${b.x - 4} Z`;
  const rows = b.roof === "flat" ? Math.max(2, Math.floor(b.h / 34)) : 1;
  const cols = Math.max(1, Math.ceil(b.win / rows));
  const ww = 16, wh = 16;
  const gapX = (b.w - cols * ww) / (cols + 1);
  const wins: JSX.Element[] = [];
  for (let r = 0; r < rows; r++)
    for (let i = 0; i < cols; i++)
      wins.push(<rect key={`${r}-${i}`} x={b.x + gapX + i * (ww + gapX)} y={top + 16 + r * 32} width={ww} height={wh} rx={2} fill={(r + i + b.x) % 3 === 0 ? "#f6d77a" : "#FFFDF9"} opacity={0.9} />);
  return (
    <g>
      <rect x={b.x} y={top} width={b.w} height={b.h} fill={b.c} opacity={0.3} />
      <path d={roof} fill={b.c} opacity={0.55} />
      {wins}
      {b.door && <rect x={b.x + b.w / 2 - 9} y={GROUND - 28} width={18} height={28} rx={2} fill={b.c} opacity={0.5} />}
    </g>
  );
}

function Palm({ x, h }: { x: number; h: number }) {
  const top = GROUND - h;
  return (
    <g opacity={0.45}>
      <path d={`M${x},${GROUND} C${x + 4},${GROUND - h / 2} ${x - 4},${top + 20} ${x + 2},${top}`} stroke="#6B6458" strokeWidth={4} fill="none" strokeLinecap="round" />
      {[-60, -25, 10, 45, 80, 120].map((a) => (
        <path key={a} d={`M${x + 2},${top} q${Math.cos((a * Math.PI) / 180) * 18},${-14 + Math.sin((a * Math.PI) / 180) * 6} ${Math.cos((a * Math.PI) / 180) * 34},${Math.sin((a * Math.PI) / 180) * 14 + 6}`} stroke="#3f7d5c" strokeWidth={5} fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

export default function HeroArt() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] w-full" viewBox="0 0 1660 270" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FAF7F2" stopOpacity="0" />
          <stop offset="1" stopColor="#f3e7d6" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1660" height="270" fill="url(#sky)" />
      <circle cx="1460" cy="70" r="46" fill="#e2b33c" opacity="0.28" />
      {/* Saddleback: the twin peaks (Santiago and Modjeska) that frame Orange County's skyline */}
      <path d="M0,170 C120,150 220,120 330,110 C390,104 420,60 455,42 C480,30 498,58 515,70 C535,84 552,62 578,48 C602,36 628,70 660,96 C760,150 900,128 1040,140 C1180,152 1300,112 1420,124 C1530,134 1600,150 1660,148 V270 H0 Z" fill="#2a7f8f" opacity="0.10" />
      <path d="M0,196 C200,176 400,190 600,178 C820,166 1000,186 1200,174 C1400,162 1560,182 1660,176 V270 H0 Z" fill="#1f3a5f" opacity="0.06" />
      {/* OC business-district towers (Santa Ana / Irvine), behind the homes */}
      {TOWERS.map((t, i) => (
        <g key={i} opacity={0.24}>
          <rect x={t.x} y={GROUND - t.h} width={t.w} height={t.h} fill={t.c} />
          {t.cap && <rect x={t.x + t.w * 0.2} y={GROUND - t.h - 10} width={t.w * 0.6} height={10} fill={t.c} />}
          {Array.from({ length: Math.floor(t.h / 14) }).map((_, r) => (
            <line key={r} x1={t.x + 4} x2={t.x + t.w - 4} y1={GROUND - t.h + 10 + r * 14} y2={GROUND - t.h + 10 + r * 14} stroke="#FFFDF9" strokeWidth={2} opacity={0.7} />
          ))}
        </g>
      ))}
      {BUILDINGS.map((b) => <Building key={b.x} b={b} />)}
      <Palm x={20} h={150} />
      <Palm x={790} h={170} />
      <Palm x={1245} h={140} />
      <Palm x={1640} h={160} />
      {/* ground and dashed parcel lines */}
      <rect x="0" y={GROUND} width="1660" height="20" fill="#e9dcc6" opacity="0.8" />
      {[165, 270, 437, 562, 785, 937, 1122, 1242, 1352, 1507].map((x) => (
        <line key={x} x1={x} y1={GROUND + 2} x2={x} y2={GROUND + 18} stroke="#c2562e" strokeWidth={1.5} strokeDasharray="3 3" opacity={0.55} />
      ))}
      <line x1="0" y1={GROUND + 10} x2="1660" y2={GROUND + 10} stroke="#c2562e" strokeWidth={1} strokeDasharray="6 5" opacity={0.35} />
    </svg>
  );
}
