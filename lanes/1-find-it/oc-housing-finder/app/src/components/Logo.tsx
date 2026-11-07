// Landora logo. A geometric mark: a bold "L" that is also the corner of a surveyed
// lot, with a roof chevron rising on it and a small sun. Two colors, flat, works at 16 px.
// Wordmark: tight geometric sans, navy, with an orange accent bar under the "L".

export const MARK_PATHS = {
  // L / lot corner
  l: "M13 11.5 h6.2 v18.6 h17.3 v6.4 H13 Z",
  // roof chevron sitting on the lot line
  roof: "M22.5 26.2 L29.4 19.6 L36.3 26.2",
};

export function LogoMark({ size = 40, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Landora">
      <rect width="48" height="48" rx="12" fill={dark ? "#ffffff" : "#14284b"} />
      <path d={MARK_PATHS.l} fill={dark ? "#14284b" : "#ffffff"} />
      <path d={MARK_PATHS.roof} fill="none" stroke="#f07a2c" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35.5" cy="12.8" r="2.7" fill="#ffb54d" />
    </svg>
  );
}

export function Wordmark({ size = 24, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none" style={{ fontSize: size }}>
      <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontWeight: 800, letterSpacing: "-0.035em", color: light ? "#fff" : "#14284b" }}>
        Landora
      </span>
    </span>
  );
}

export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <Wordmark size={size * 0.55} />
    </span>
  );
}
