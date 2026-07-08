import { scoreChipClass, toParLabel, cycleScore } from "../lib/scoreChip.js";

// Editable when onChange is passed (Game screen, current round); read-only
// otherwise (Scorecard screen's history, or another player's column).
export default function ScoreChip({ strokes, par, onChange, showToPar = true }) {
  const cls = scoreChipClass(strokes, par);
  const display = strokes ?? (par != null ? par : "");

  const content = (
    <>
      <span className="shape" />
      <span style={{ position: "relative" }}>{display === "" ? "" : display}</span>
    </>
  );

  return (
    <span style={{ display: "inline-block" }}>
      {onChange ? (
        <button
          type="button"
          className={`score-chip editable ${cls}`}
          onClick={() => onChange(cycleScore(strokes, par))}
          aria-label={`Score ${display || "unset"}, tap to change`}
        >
          {content}
        </button>
      ) : (
        <span className={`score-chip ${cls}`}>{content}</span>
      )}
      {showToPar && strokes != null && par != null && (
        <div className="to-par" style={{ textAlign: "center", fontSize: 8, color: "var(--muted-55)", marginTop: 1 }}>
          {toParLabel(strokes, par)}
        </div>
      )}
    </span>
  );
}
