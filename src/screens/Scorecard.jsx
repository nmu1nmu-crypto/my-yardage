import { useState } from "react";
import { setScoreForHole } from "../lib/store.js";
import { ATTRIBUTION } from "../lib/courseApi.js";
import ScoreGrid from "../components/ScoreGrid.jsx";
import LogoMark from "../components/LogoMark.jsx";

function toParLabel(n) {
  if (n == null) return "–";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function roundCardStats(round, you) {
  const holeByNum = Object.fromEntries(round.holes.map((h) => [h.number, h]));
  const allHoles = Array.from({ length: 18 }, (_, i) => i + 1);
  const strokesFor = (n) => holeByNum[n]?.strokes?.[you] ?? null;
  const parFor = (n) => holeByNum[n]?.par ?? null;
  const played = allHoles.filter((n) => strokesFor(n) != null);
  if (!played.length) return { score: null, toPar: null };
  const score = played.reduce((s, n) => s + strokesFor(n), 0);
  const parPlayed = played.map(parFor).filter((p) => p != null);
  const toPar = parPlayed.length === played.length ? score - parPlayed.reduce((a, b) => a + b, 0) : null;
  return { score, toPar };
}

export default function Scorecard({ state, update }) {
  const [expandedId, setExpandedId] = useState(null);

  const rounds = state.activeRound ? [state.activeRound, ...state.rounds] : state.rounds;

  if (!rounds.length) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No scorecard yet</strong>
        <p className="muted">Start a round to see the full 18-hole card here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="row" style={{ margin: "8px 0 4px" }}>
        <LogoMark size={36} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <strong style={{ fontSize: 17 }}>Scorecard</strong>
          <p className="muted small" style={{ margin: 0 }}>{state.rounds.length} rounds played</p>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {rounds.map((round) => {
        const isCurrent = state.activeRound && round.id === state.activeRound.id;
        const you = round.players[0];
        const { score, toPar } = roundCardStats(round, you);
        const isOpen = expandedId === round.id;
        return (
          <div key={round.id} className={`round-card ${isOpen ? "open" : ""}`}>
            <button className="round-summary" onClick={() => setExpandedId(isOpen ? null : round.id)}>
              <div>
                <p className="round-summary-date">{isCurrent ? "In progress" : new Date(round.startedAt).toLocaleDateString()}</p>
                <p className="round-summary-course">{round.course}</p>
                {round.handicaps?.[you]?.courseHandicap != null && (
                  <p className="round-summary-hcp">HCP {round.handicaps[you].courseHandicap}</p>
                )}
              </div>
              <div>
                <p className="round-summary-score">{score ?? "–"}</p>
                <p className="round-summary-topar">{toParLabel(toPar)}</p>
              </div>
            </button>
            <svg className="round-chevron" viewBox="0 0 20 20" fill="none">
              <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isOpen && (
              <div style={{ padding: "0 12px 14px" }}>
                <ScoreGrid
                  round={round}
                  mode="both"
                  editable={isCurrent}
                  onScoreChange={(holeNumber, player, strokes, par) => update(setScoreForHole, holeNumber, player, strokes, par)}
                />
              </div>
            )}
          </div>
        );
      })}

      <p className="small" style={{ opacity: 0.5, marginTop: 12 }}>
        {rounds.some((r) => r.courseId) ? ATTRIBUTION : "Par entered as each hole is played — link a course from Home for full yardage and stroke index."}
      </p>
    </>
  );
}
