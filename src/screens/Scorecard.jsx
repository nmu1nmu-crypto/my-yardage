import { useState } from "react";
import { setScoreForHole, strokesReceived } from "../lib/store.js";
import { ATTRIBUTION } from "../lib/courseApi.js";
import RoundPicker, { resolveRound } from "../components/RoundPicker.jsx";

const FRONT = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK = Array.from({ length: 9 }, (_, i) => i + 10);

// Filled-circle score convention (matches most commercial scorecard apps):
// red = birdie or better, blue = bogey, navy = double-bogey or worse,
// no fill = par.
function scoreCircle(strokes, par) {
  if (strokes == null || par == null) return null;
  const diff = strokes - par;
  if (diff <= -1) return { background: "#e0433d", color: "#fff", borderColor: "#e0433d" };
  if (diff === 1) return { background: "#2e6fd4", color: "#fff", borderColor: "#2e6fd4" };
  if (diff >= 2) return { background: "#132a52", color: "#fff", borderColor: "#132a52" };
  return null;
}

function toParLabel(n) {
  if (n == null) return "–";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

export default function Scorecard({ state, update }) {
  const [selectedId, setSelectedId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const round = resolveRound(state, selectedId);

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No scorecard yet</strong>
        <p className="muted">Start a round to see the full 18-hole card here.</p>
      </div>
    );
  }

  const isCurrent = state.activeRound && round.id === state.activeRound.id;

  const holeByNum = Object.fromEntries(round.holes.map((h) => [h.number, h]));
  const parFor = (n) => holeByNum[n]?.par ?? null;
  const siFor = (n) => holeByNum[n]?.strokeIndex ?? null;
  const strokesFor = (n, p) => holeByNum[n]?.strokes?.[p] ?? null;
  const courseHandicapFor = (p) => round.handicaps?.[p]?.courseHandicap ?? null;
  const netStrokesFor = (n, p) => {
    const gross = strokesFor(n, p);
    const ch = courseHandicapFor(p);
    if (gross == null || ch == null || siFor(n) == null) return null;
    return gross - strokesReceived(ch, siFor(n));
  };

  function sumRange(getter, nums) {
    const vals = nums.map(getter).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  }

  const hasSi = round.holes.some((h) => h.strokeIndex != null);
  const totalPar = sumRange(parFor, [...FRONT, ...BACK]);

  function summaryFor(p) {
    const played = [...FRONT, ...BACK].filter((n) => strokesFor(n, p) != null);
    const thru = played.length;
    if (!thru) return { thru: 0, score: null, toPar: null, net: null };
    const score = sumRange((n) => strokesFor(n, p), played);
    const parPlayed = sumRange(parFor, played);
    const hasNet = courseHandicapFor(p) != null && hasSi;
    const net = hasNet ? sumRange((n) => netStrokesFor(n, p), played) : null;
    return { thru, score, toPar: parPlayed != null ? score - parPlayed : null, net };
  }

  const ranked = round.players
    .map((p) => ({ p, ...summaryFor(p) }))
    .sort((a, b) => {
      if (a.thru === 0 && b.thru === 0) return 0;
      if (a.thru === 0) return 1;
      if (b.thru === 0) return -1;
      return (a.toPar ?? 0) - (b.toPar ?? 0);
    });

  function nineBlock(player, holeNums, sumLabel) {
    return (
      <>
        <div className="sg-holebar">
          <span className="sg-hb-label">Hole</span>
          {holeNums.map((n) => (
            <span key={n}>{n}</span>
          ))}
          <span className="sg-hb-label">{sumLabel}</span>
        </div>
        {hasSi && (
          <div className="sg-row">
            <span className="sg-row-label">Slope</span>
            {holeNums.map((n) => (
              <span key={n}>{siFor(n) ?? "–"}</span>
            ))}
            <span />
          </div>
        )}
        <div className="sg-row">
          <span className="sg-row-label">Par</span>
          {holeNums.map((n) => (
            <span key={n}>{parFor(n) ?? "–"}</span>
          ))}
          <span className="sg-row-sum">{sumRange(parFor, holeNums) ?? "–"}</span>
        </div>
        <div className="sg-row sg-score-row">
          <span className="sg-row-label">Score</span>
          {holeNums.map((n) => {
            const strokes = strokesFor(n, player);
            const circle = scoreCircle(strokes, parFor(n));
            return (
              <span key={n}>
                {isCurrent ? (
                  <input
                    className="sg-input num"
                    type="number"
                    inputMode="numeric"
                    value={strokes ?? ""}
                    style={circle ?? {}}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v) && v > 0 && v < 20) {
                        update(setScoreForHole, n, player, v, parFor(n));
                      }
                    }}
                  />
                ) : (
                  <span className="sg-input sg-input-ro num" style={circle ?? {}}>
                    {strokes ?? ""}
                  </span>
                )}
              </span>
            );
          })}
          <span className="sg-row-sum num">{sumRange((n) => strokesFor(n, player), holeNums) ?? "–"}</span>
        </div>
        {courseHandicapFor(player) != null && hasSi && (
          <div className="sg-row sg-net-row">
            <span className="sg-row-label">Net</span>
            {holeNums.map((n) => (
              <span key={n}>{netStrokesFor(n, player) ?? "–"}</span>
            ))}
            <span className="sg-row-sum num">{sumRange((n) => netStrokesFor(n, player), holeNums) ?? "–"}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="sg-header-card">
        <div className="row">
          <div>
            <strong style={{ fontSize: 18 }}>{round.course}</strong>
            <p className="muted small" style={{ margin: "2px 0 0" }}>
              {new Date(round.startedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="sg-brandmark">⛳ My Yardage</div>
        </div>
      </div>

      <div className="sg-banner">Stroke Play</div>

      <RoundPicker state={state} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="sg-colhead">
        <span style={{ width: 22, textAlign: "center" }}>#</span>
        <span style={{ flex: 1 }}>Name</span>
        <span style={{ minWidth: 30, textAlign: "right" }}>Score</span>
        <span style={{ minWidth: 36, textAlign: "right" }}>To par</span>
        <span style={{ minWidth: 26, textAlign: "right" }}>Thru</span>
      </div>

      {ranked.map(({ p, thru, score, toPar, net }, i) => {
        const isOpen = expanded === p;
        const ch = courseHandicapFor(p);
        return (
          <div key={p} className={`sg-card ${isOpen ? "open" : ""}`}>
            <button className="sg-summary" onClick={() => setExpanded(isOpen ? null : p)}>
              <span className="sg-rank">{i + 1}</span>
              <span style={{ flex: 1 }}>
                <div className="sg-name">{p}</div>
                {ch != null && <div className="sg-hcp">HCP {ch}</div>}
              </span>
              <span className="sg-score num">{score ?? "–"}</span>
              <span className={`sg-topar num ${toPar != null && toPar < 0 ? "good" : ""}`}>
                {toParLabel(toPar)}
              </span>
              <span className="sg-thru num">{thru || "–"}</span>
            </button>
            {isOpen && (
              <div className="sg-grid">
                {nineBlock(p, FRONT, "Out")}
                {nineBlock(p, BACK, "In")}
                <div className="sg-footer">
                  <span>
                    Par <strong className="num">{totalPar ?? "–"}</strong>
                  </span>
                  <span>
                    Score <strong className="num">{score ?? "–"}{net != null ? `/${net}` : ""}</strong>
                  </span>
                  <span>
                    Position <strong className="num">{thru ? `${i + 1}.` : "–"}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <p className="small" style={{ opacity: 0.5, marginTop: 12 }}>
        {round.courseId ? ATTRIBUTION : "Par entered as each hole is played — link a course from Home for full yardage and stroke index."}
      </p>
    </>
  );
}
