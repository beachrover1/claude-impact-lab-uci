// Original vector scene (no external image): Santa Ana / Orange County at golden hour.
// Sunset sky, Santa Ana Mountains, downtown high-rises with lit windows, palms and
// terracotta-roof homes. Fades to cream on the left so the headline stays readable.

const TOWERS: [number, number, number, number][] = [
  // x, width, height, shade (0 = far/light, 1 = near/dark)
  [470, 60, 250, 0.35], [540, 46, 190, 0.3], [600, 88, 430, 0.75], [700, 54, 300, 0.5],
  [765, 70, 360, 0.6], [845, 44, 220, 0.35], [900, 64, 280, 0.55], [975, 50, 200, 0.4],
  [1035, 80, 330, 0.65], [1125, 46, 230, 0.4], [1180, 60, 260, 0.5],
];

function towerColor(s: number) {
  // blend from hazy lavender to deep slate-blue
  const a = [184, 170, 196], b = [70, 84, 112];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * s));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function Tower({ x, w, h, s }: { x: number; w: number; h: number; s: number }) {
  const base = 560, top = base - h, rows = Math.floor(h / 18), cols = Math.max(2, Math.floor(w / 14));
  const lit: JSX.Element[] = [];
  for (let r = 1; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if ((r * 7 + c * 13 + x) % 5 === 0)
        lit.push(<rect key={`${r}-${c}`} x={x + 5 + c * ((w - 10) / cols)} y={top + r * 18} width={(w - 10) / cols - 3} height={7} fill="#ffd79a" opacity={0.55 + s * 0.35} />);
  return (
    <g>
      <rect x={x} y={top} width={w} height={h} fill={towerColor(s)} />
      {/* sunlit edge */}
      <rect x={x + w - Math.max(6, w * 0.18)} y={top} width={Math.max(6, w * 0.18)} height={h} fill="#ffb27a" opacity={0.28} />
      {h > 400 && <rect x={x + w * 0.25} y={top - 22} width={w * 0.5} height={22} fill={towerColor(s)} />}
      {lit}
    </g>
  );
}

function Palm({ x, base, h, lean = 0, o = 1 }: { x: number; base: number; h: number; lean?: number; o?: number }) {
  const tx = x + lean, ty = base - h;
  const fronds = [-170, -140, -110, -70, -40, -10, 20, 200, 160];
  return (
    <g opacity={o}>
      <path d={`M${x},${base} C${x + lean * 0.2},${base - h * 0.5} ${tx - lean * 0.1},${ty + h * 0.2} ${tx},${ty}`} stroke="#3a2a33" strokeWidth={h * 0.035} fill="none" strokeLinecap="round" />
      {fronds.map((a, i) => {
        const r = (a * Math.PI) / 180, L = h * 0.32;
        const ex = tx + Math.cos(r) * L, ey = ty + Math.sin(r) * L * 0.55 + L * 0.35;
        const cx = tx + Math.cos(r) * L * 0.5, cy = ty - L * 0.18;
        return <path key={i} d={`M${tx},${ty} Q${cx},${cy} ${ex},${ey}`} stroke="#2f2a2e" strokeWidth={h * 0.04} fill="none" strokeLinecap="round" />;
      })}
    </g>
  );
}

function House({ x, base, w, h, roof = "#c2562e", wall = "#f4e2cc" }: { x: number; base: number; w: number; h: number; roof?: string; wall?: string }) {
  return (
    <g>
      <rect x={x} y={base - h} width={w} height={h} fill={wall} />
      <path d={`M${x - 8},${base - h} L${x + w / 2},${base - h - h * 0.55} L${x + w + 8},${base - h} Z`} fill={roof} />
      <rect x={x + w * 0.18} y={base - h * 0.62} width={w * 0.18} height={h * 0.28} fill="#ffcf8a" />
      <rect x={x + w * 0.62} y={base - h * 0.62} width={w * 0.18} height={h * 0.28} fill="#ffcf8a" />
    </g>
  );
}

export default function HeroSunset() {
  return (
    <svg className="pointer-events-none absolute bottom-0 right-0 h-full w-full md:w-[66%]" viewBox="380 0 1220 640" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ec3e6" />
          <stop offset="0.45" stopColor="#e9d6d2" />
          <stop offset="0.72" stopColor="#ffcf9f" />
          <stop offset="1" stopColor="#ffb27a" />
        </linearGradient>
        <radialGradient id="hs-sun" cx="0.62" cy="0.72" r="0.45">
          <stop offset="0" stopColor="#fff1c9" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffd08f" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffd08f" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff3e6" stopOpacity="1" />
          <stop offset="0.1" stopColor="#fff3e6" stopOpacity="0.85" />
          <stop offset="0.3" stopColor="#fff3e6" stopOpacity="0.25" />
          <stop offset="0.45" stopColor="#fff3e6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hs-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#ffcf9f" stopOpacity="0" />
          <stop offset="1" stopColor="#ffb98a" stopOpacity="0.45" />
        </linearGradient>
      </defs>

            <rect width="1600" height="640" fill="url(#hs-sun)" />

      {/* Santa Ana Mountains, three hazy layers */}
      <path d="M380,420 C520,330 640,360 760,300 C860,250 940,290 1040,250 C1150,205 1260,270 1380,240 C1480,215 1560,250 1600,240 V640 H380 Z" fill="#c9b3cf" opacity="0.75" />
      <path d="M420,450 C560,390 700,410 820,370 C960,325 1080,380 1220,345 C1360,312 1480,350 1600,330 V640 H420 Z" fill="#b39cc0" opacity="0.8" />

      {/* downtown high-rises */}
      {TOWERS.map(([x, w, h, s]) => <Tower key={x} x={x + 230} w={w} h={h} s={s} />)}
      <rect x="380" y="0" width="1220" height="640" fill="url(#hs-haze)" />

      {/* mid-rise blocks and trees */}
      <path d="M420,560 V520 H520 V500 H640 V530 H760 V505 H880 V525 H1010 V495 H1150 V520 H1300 V505 H1450 V525 H1600 V560 Z" fill="#8f7f98" opacity="0.9" />
      {[480, 560, 700, 830, 960, 1090, 1240, 1380, 1520].map((x, i) => (
        <ellipse key={x} cx={x} cy={548} rx={34 + (i % 3) * 8} ry={20} fill="#5e6b4f" opacity={0.85} />
      ))}

      {/* terracotta-roof homes in front */}
      {[[500, 70, 46], [590, 90, 54], [705, 76, 48], [800, 96, 58], [920, 80, 50], [1020, 104, 60], [1150, 84, 52], [1260, 92, 56], [1375, 78, 48], [1470, 100, 58]].map(([x, w, h], i) => (
        <House key={x} x={x} base={620} w={w} h={h} roof={i % 3 === 1 ? "#b8492a" : "#c96a3c"} wall={i % 2 ? "#f6e6d2" : "#efd8bf"} />
      ))}
      <rect x="380" y="618" width="1220" height="22" fill="#6f7a55" />

      {/* palms */}
      <Palm x={560} base={640} h={210} lean={6} o={0.92} />
      <Palm x={1290} base={640} h={300} lean={-8} />
      <Palm x={1400} base={640} h={250} lean={10} />
      <Palm x={1530} base={640} h={330} lean={-5} />
      <Palm x={980} base={640} h={180} lean={5} o={0.85} />

      {/* cream fade so the text side stays clean */}
      <rect x="380" width="1220" height="640" fill="url(#hs-fade)" />
    </svg>
  );
}
