// Landora logo: a home rising on a surveyed parcel at sunrise.
// The mark: navy tile, a sun coming up behind a house, the house standing on a
// parcel line with dashed lot ticks (the "overlooked land" it was found on).
// The wordmark: "Land" in navy, "ora" in a sunset gradient, the "o" drawn as a rising sun.

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Landora">
      <defs>
        <linearGradient id="lm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#24487a" />
          <stop offset="1" stopColor="#14284b" />
        </linearGradient>
        <linearGradient id="lm-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#f07a2c" />
        </linearGradient>
        <clipPath id="lm-clip"><rect x="0" y="0" width="48" height="48" rx="13" /></clipPath>
      </defs>
      <g clipPath="url(#lm-clip)">
        <rect width="48" height="48" fill="url(#lm-bg)" />
        {/* rising sun with rays */}
        <circle cx="32" cy="22" r="9" fill="url(#lm-sun)" />
        {[-60, -30, 0, 30, 60].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={32 + Math.sin(r) * 11.5} y1={22 - Math.cos(r) * 11.5} x2={32 + Math.sin(r) * 14.5} y2={22 - Math.cos(r) * 14.5} stroke="#ffb54d" strokeWidth="1.8" strokeLinecap="round" />;
        })}
        {/* house */}
        <path d="M9 25.5 L19.5 15.5 L30 25.5 V35 H9 Z" fill="#FFFDF9" />
        <path d="M7 26.5 L19.5 14.5 L32 26.5" stroke="#FFFDF9" strokeWidth="2.6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="17.2" y="27.5" width="4.6" height="7.5" rx="1.2" fill="#f07a2c" />
        <rect x="11.6" y="27.2" width="3.6" height="3.4" rx="0.6" fill="#24487a" />
        <rect x="23.8" y="27.2" width="3.6" height="3.4" rx="0.6" fill="#24487a" />
        {/* parcel line with dashed lot ticks */}
        <rect x="0" y="35" width="48" height="13" fill="#2f6448" />
        <line x1="0" y1="35.6" x2="48" y2="35.6" stroke="#ffb54d" strokeWidth="1.6" />
        {[6, 16, 26, 36, 46].map((x) => (
          <line key={x} x1={x} y1="38.5" x2={x} y2="45" stroke="#a8d5b5" strokeWidth="1.3" strokeDasharray="1.6 1.6" />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ size = 24, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="font-display inline-flex items-baseline font-semibold tracking-tight" style={{ fontSize: size, lineHeight: 1 }}>
      <span style={{ color: light ? "#fff" : "#14284b" }}>Land</span>
      <span className="relative inline-block" style={{ width: size * 0.56, height: size * 0.56, margin: `0 ${size * 0.02}px` }}>
        {/* the "o" as a sun sitting on a short horizon */}
        <svg viewBox="0 0 20 20" width={size * 0.56} height={size * 0.56} style={{ position: "absolute", left: 0, bottom: -size * 0.02 }} aria-hidden="true">
          <defs>
            <linearGradient id="wm-o" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffb54d" /><stop offset="1" stopColor="#e0641f" />
            </linearGradient>
          </defs>
          <circle cx="10" cy="10.5" r="7" fill="none" stroke="url(#wm-o)" strokeWidth="3.4" />
          <path d="M5.2 10.5 a4.8 4.8 0 0 1 9.6 0 Z" fill="#ffb54d" opacity="0.55" />
          <line x1="3.5" y1="10.5" x2="16.5" y2="10.5" stroke="#e0641f" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <span style={{ background: "linear-gradient(90deg,#e0641f,#f2a03a)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>ra</span>
    </span>
  );
}

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <Wordmark size={size * 0.62} />
    </span>
  );
}
