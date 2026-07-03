import { useState } from "react";
import { setScoreForHole } from "../lib/store.js";
import { ATTRIBUTION } from "../lib/courseApi.js";

const TEE_DOT = {
  red: "#d43d2e",
  white: "#f2f6f2",
  yellow: "#f2c94c",
  gold: "#f2c94c",
  blue: "#2e6fd4",
  green: "#1d9e75",
  black: "#111111",
};

const FRONT = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK = Array.from({ length: 9 }, (_, i) => i + 10);

// Standard scorecard colour convention: par blue, bogey red, double-bogey+
// black, birdie green, eagle-or-better green with a circle round the score.
function scoreStyle(strokes, par) {
  if (strokes == null || par == null) return {};
  const diff = strokes - par;
  if (diff <= -2) {
    return { color: "#16a34a", borderColor: "#16a34a", borderWidth: 2, borderRadius: "50%", fontWeight: 700 };
  }
  if (diff === -1) return { color: "#16a34a", fontWeight: 700 };
  if (diff === 0) return { color: "#2e6fd4" };
  if (diff === 1) return { color: "#d43d2e" };
  return { color: "#111111", fontWeight: 700 };
}

export default function Scorecard({ state, update }) {
  const round = state.activeRound ?? state.rounds[0];
  const [teeKey, setTeeKey] = useState(null);

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No scorecard yet</strong>
        <p className="muted">Start a round to see the full 18-hole card here.</p>
      </div>
    );
  }

  const holeByNum = Object.fromEntries(round.holes.map((h) => [h.number, h]));
  const availableTees = Array.from(
    new Set(round.holes.flatMap((h) => (h.yardages ? Object.keys(h.yardages) : [])))
  );
  const tee = teeKey && availableTees.includes(teeKey) ? teeKey : availableTees[0];

  const parFor = (n) => holeByNum[n]?.par ?? null;
  const siFor = (n) => holeByNum[n]?.strokeIndex ?? null;
  const ydsFor = (n) => (tee ? holeByNum[n]?.yardages?.[tee] ?? null : null);
  const strokesFor = (n, p) => holeByNum[n]?.strokes?.[p] ?? null;

  function sumRange(getter, nums) {
    const vals = nums.map(getter).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  const hasPar = round.holes.some((h) => h.par != null);
  const hasSi = round.holes.some((h) => h.strokeIndex != null);
  const hasYds = round.holes.some((h) => h.yardages);

  function scoreInput(n, p) {
    const strokes = strokesFor(n, p);
    return (
      <td key={n}>
        <input
          className="sc-input num"
          type="number"
          inputMode="numeric"
          value={strokes ?? ""}
          style={scoreStyle(strokes, parFor(n))}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!Number.isNaN(v) && v > 0 && v < 20) {
              update(setScoreForHole, n, p, v, parFor(n));
            }
          }}
        />
      </td>
    );
  }

  return (
    <>
      <div className="row" style={{ margin: "8px 0 12px" }}>
        <div>
          <strong style={{ fontSize: 18 }}>Scorecard</strong>
          <div className="muted small">{round.course}</div>
        </div>
        {availableTees.length > 1 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {availableTees.map((t) => (
              <button
                key={t}
                className={`chip ${t === tee ? "on" : ""}`}
                style={{ padding: "3px 8px" }}
                onClick={() => setTeeKey(t)}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: TEE_DOT[t] || "#999",
                    marginRight: 4,
                    border: t === "white" ? "1px solid #999" : "none",
                  }}
                />
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sc-wrap">
        <table className="sc-table">
          <thead>
            <tr>
              <th className="sc-label" />
              {FRONT.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th className="sc-sub">OUT</th>
              {BACK.map((n) => (
                <th key={n}>{n}</th>
              ))}
              <th className="sc-sub">IN</th>
              <th className="sc-sub">TOT</th>
            </tr>
          </thead>
          <tbody>
            {hasPar && (
              <tr className="sc-meta">
                <td className="sc-label">Par</td>
                {FRONT.map((n) => (
                  <td key={n}>{parFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub">{sumRange(parFor, FRONT) ?? "–"}</td>
                {BACK.map((n) => (
                  <td key={n}>{parFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub">{sumRange(parFor, BACK) ?? "–"}</td>
                <td className="sc-sub">{sumRange(parFor, [...FRONT, ...BACK]) ?? "–"}</td>
              </tr>
            )}
            {hasSi && (
              <tr className="sc-meta">
                <td className="sc-label">S.I.</td>
                {FRONT.map((n) => (
                  <td key={n}>{siFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub" />
                {BACK.map((n) => (
                  <td key={n}>{siFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub" />
                <td className="sc-sub" />
              </tr>
            )}
            {hasYds && (
              <tr className="sc-meta">
                <td className="sc-label">Yds</td>
                {FRONT.map((n) => (
                  <td key={n}>{ydsFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub">{sumRange(ydsFor, FRONT) ?? "–"}</td>
                {BACK.map((n) => (
                  <td key={n}>{ydsFor(n) ?? "–"}</td>
                ))}
                <td className="sc-sub">{sumRange(ydsFor, BACK) ?? "–"}</td>
                <td className="sc-sub">{sumRange(ydsFor, [...FRONT, ...BACK]) ?? "–"}</td>
              </tr>
            )}
            {round.players.map((p) => (
              <tr key={p}>
                <td className="sc-label">{p}</td>
                {FRONT.map((n) => scoreInput(n, p))}
                <td className="sc-sub num">{sumRange((n) => strokesFor(n, p), FRONT) ?? "–"}</td>
                {BACK.map((n) => scoreInput(n, p))}
                <td className="sc-sub num">{sumRange((n) => strokesFor(n, p), BACK) ?? "–"}</td>
                <td className="sc-sub num">
                  {sumRange((n) => strokesFor(n, p), [...FRONT, ...BACK]) ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10,
          background: "#fdfaf2", borderRadius: 14, padding: "8px 10px",
        }}
      >
        {[
          { label: "Eagle+", style: scoreStyle(-2, 0) },
          { label: "Birdie", style: scoreStyle(-1, 0) },
          { label: "Par", style: scoreStyle(0, 0) },
          { label: "Bogey", style: scoreStyle(1, 0) },
          { label: "Double+", style: scoreStyle(2, 0) },
        ].map(({ label, style }) => (
          <span key={label} className="small" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                width: 14, height: 14, borderRadius: style.borderRadius ?? "50%",
                border: `2px solid ${style.borderColor ?? style.color}`,
                background: "#fdfaf2",
              }}
            />
            <span style={{ color: style.color, opacity: 0.9 }}>{label}</span>
          </span>
        ))}
      </div>

      <p className="small" style={{ opacity: 0.5, marginTop: 10 }}>
        {round.courseId ? ATTRIBUTION : "Par entered as each hole is played — link a course from Home for full yardage and stroke index."}
      </p>
    </>
  );
}
