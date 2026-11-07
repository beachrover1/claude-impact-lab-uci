// Landora logo: a navy house outline (open on the right, where it grows), a 2x2 orange
// window, and an orange leaf for growth and livability. Matches the team's chosen design.

export const MARK_SVG_INNER = `
  <defs>
    <linearGradient id="ld-leaf" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#f6a13a"/><stop offset="1" stop-color="#e8641e"/>
    </linearGradient>
  </defs>
  <path d="M5.5 23.5 L24 7.5 L42.5 23.5" fill="none" stroke="#1f3a5f" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11.5 19 V40.5 H23" fill="none" stroke="#1f3a5f" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="17.4" y="22.4" width="4.6" height="4.6" rx="1" fill="#f07a2c"/>
  <rect x="23.4" y="22.4" width="4.6" height="4.6" rx="1" fill="#f07a2c"/>
  <rect x="17.4" y="28.4" width="4.6" height="4.6" rx="1" fill="#f07a2c"/>
  <rect x="23.4" y="28.4" width="4.6" height="4.6" rx="1" fill="#f07a2c"/>
  <path d="M24.5 42 C26.5 34.5 33.5 29.8 43.5 30 C42.6 38.6 35.6 43.4 24.5 42 Z" fill="url(#ld-leaf)"/>
  <path d="M26.5 40.8 C31 37.6 35.5 35.2 40.5 33.2" fill="none" stroke="#ffe2bf" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
`;

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Landora" dangerouslySetInnerHTML={{ __html: MARK_SVG_INNER }} />
  );
}

export function Wordmark({ size = 24, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700, letterSpacing: "-0.02em", color: light ? "#fff" : "#14284b" }}>
      Landora
    </span>
  );
}

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <Wordmark size={size * 0.6} />
    </span>
  );
}
