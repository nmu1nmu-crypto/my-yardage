// Circular progress ring for the Home "My card" panel — shows handicap
// index as a fraction of a fixed 0-36 scale (36 is the highest index the
// WHS table supports for a men's/women's course handicap calc), clamped so
// a null/negative/very-low index still renders a sane ring instead of a
// wraparound or empty circle.
const MAX_SCALE = 36;
const R = 24;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function Gauge({ value, size = 58 }) {
  const pct = value == null ? 0 : Math.min(1, Math.max(0, value / MAX_SCALE));
  const dash = CIRCUMFERENCE * pct;

  return (
    <div className="gauge-wrap" style={{ width: size, height: size }}>
      <svg viewBox="0 0 58 58">
        <circle cx="29" cy="29" r={R} fill="none" stroke="rgba(245,241,230,0.12)" strokeWidth="5" />
        <circle
          cx="29"
          cy="29"
          r={R}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
        />
      </svg>
      <span className="gauge-value">{value ?? "—"}</span>
    </div>
  );
}
