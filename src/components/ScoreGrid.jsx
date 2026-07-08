import { useState } from "react";
import ScoreChip from "./ScoreChip.jsx";

const FRONT = Array.from({ length: 9 }, (_, i) => i + 1);
const BACK = Array.from({ length: 9 }, (_, i) => i + 10);

function initial(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function toParLabel(n) {
  if (n == null) return "–";
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `${n}`;
}

function sumRange(getter, nums) {
  const vals = nums.map(getter).filter((v) => v != null);
  return vals.length === nums.length ? vals.reduce((a, b) => a + b, 0) : null;
}

/** Shared editable scorecard grid — used inline on the Game screen (live,
 * editable, current-hole tinted) and on the Scorecard screen's expanded
 * round-history rows (read-only, both nines stacked, no toggle). One
 * component so the score-chip visual language never drifts between the two
 * places it appears. */
export default function ScoreGrid({ round, editable = false, currentHole = null, mode = "toggle", onScoreChange }) {
  const [nine, setNine] = useState("front");

  const holeByNum = Object.fromEntries(round.holes.map((h) => [h.number, h]));
  const parFor = (n) => holeByNum[n]?.par ?? 4;
  const strokesFor = (n, p) => holeByNum[n]?.strokes?.[p] ?? null;

  function nineTable(holeNums, label, showTotAndToPar) {
    const cols = showTotAndToPar ? holeNums.length + 3 : holeNums.length + 2;
    const gridTemplateColumns = `64px repeat(${holeNums.length}, 1fr) ${showTotAndToPar ? "30px 34px 34px" : "30px"}`;

    return (
      <div key={label} style={{ marginTop: 8 }}>
        <div className="scoregrid-head" style={{ gridTemplateColumns }}>
          <span />
          {holeNums.map((n) => (
            <span key={n} className={n === currentHole ? "current" : ""}>{n}</span>
          ))}
          <span>{label}</span>
          {showTotAndToPar && (
            <>
              <span>Tot</span>
              <span>+/-</span>
            </>
          )}
        </div>
        {round.players.map((p) => {
          const outIn = sumRange((n) => strokesFor(n, p), holeNums);
          const parSum = sumRange(parFor, holeNums);
          const toParNine = outIn != null && parSum != null ? outIn - parSum : null;

          const frontSum = sumRange((n) => strokesFor(n, p), FRONT);
          const backSum = sumRange((n) => strokesFor(n, p), BACK);
          const fullTot = frontSum != null && backSum != null ? frontSum + backSum : null;
          const fullPar = sumRange(parFor, [...FRONT, ...BACK]);
          const fullToPar = fullTot != null && fullPar != null ? fullTot - fullPar : null;

          return (
            <div className="scoregrid-row player-row" key={p} style={{ gridTemplateColumns }}>
              <div className="scoregrid-player">
                <span className="scoregrid-avatar">{initial(p)}</span>
                <span className="scoregrid-name">{p}</span>
              </div>
              {holeNums.map((n) => (
                <div className="scoregrid-cell" key={n}>
                  <ScoreChip
                    strokes={strokesFor(n, p)}
                    par={parFor(n)}
                    showToPar={false}
                    onChange={editable ? (v) => onScoreChange(n, p, v, parFor(n)) : undefined}
                  />
                </div>
              ))}
              <div className="scoregrid-total">{outIn ?? "–"}</div>
              {showTotAndToPar && (
                <>
                  <div className="scoregrid-total">{fullTot ?? "–"}</div>
                  <div className="scoregrid-total">{toParLabel(fullToPar)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (mode === "both") {
    return (
      <div className="scoregrid-panel">
        {nineTable(FRONT, "Out", false)}
        {nineTable(BACK, "In", true)}
      </div>
    );
  }

  return (
    <div className="scoregrid-panel">
      <div className="segmented">
        <button className={nine === "front" ? "on" : ""} onClick={() => setNine("front")}>Front 9</button>
        <button className={nine === "back" ? "on" : ""} onClick={() => setNine("back")}>Back 9</button>
      </div>
      {nine === "front" ? nineTable(FRONT, "Out", false) : nineTable(BACK, "In", true)}
    </div>
  );
}
