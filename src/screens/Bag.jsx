import { useState } from "react";
import {
  CLUB_LIBRARY,
  clubAverage,
  clubCategory,
  addClub,
  removeClub,
  setManualYards,
} from "../lib/store.js";
import { distanceUnit, convertDistance, toYards } from "../lib/units.js";
import LogoMark from "../components/LogoMark.jsx";

const STEP_YARDS = 5;
const FLOOR_YARDS = 30;
const MAX_CLUBS = 14;

export default function Bag({ state, update }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const dUnit = distanceUnit(state);

  const inBag = new Set(state.bag.map((c) => c.id));
  const available = CLUB_LIBRARY.filter((c) => !inBag.has(c.id));

  function step(id, currentYards, dir) {
    const nextDisplay = Math.max(FLOOR_YARDS, convertDistance(currentYards, dUnit) + dir * STEP_YARDS);
    const yards = toYards(nextDisplay, dUnit);
    update(setManualYards, id, Math.round(yards));
  }

  return (
    <>
      <div className="row" style={{ margin: "8px 0 4px" }}>
        <LogoMark size={36} />
        <div style={{ textAlign: "center", flex: 1 }}>
          <strong style={{ fontSize: 17 }}>My Bag</strong>
          <p className="muted small" style={{ margin: 0 }}>Tap a yardage to adjust</p>
        </div>
        <span className={`pill ${state.bag.length >= MAX_CLUBS ? "" : "gold"}`} style={state.bag.length >= MAX_CLUBS ? { background: "rgba(217,119,87,0.16)" } : undefined}>
          <span className={state.bag.length >= MAX_CLUBS ? "bag-limit-warning" : ""}>{state.bag.length}/{MAX_CLUBS} clubs</span>
        </span>
      </div>

      <div className="card">
        {state.bag.map((c) => {
          const { yards, tracked } = clubAverage(c);
          return (
            <div className="bag-row list-row" key={c.id}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="bag-row-name">{c.name}</p>
                <p className="bag-row-cat">{clubCategory(c.name)}</p>
              </div>
              <div className="yardage-stepper">
                <button aria-label={`Decrease ${c.name} yardage`} onClick={() => step(c.id, yards, -1)}>−</button>
                <span className="value">{convertDistance(yards, dUnit)}</span>
                <button aria-label={`Increase ${c.name} yardage`} onClick={() => step(c.id, yards, 1)}>+</button>
              </div>
              <span className="muted small" style={{ flexShrink: 0 }}>{tracked ? `${tracked}✓` : "est."}</span>
              <button className="delete-btn" aria-label={`Remove ${c.name}`} onClick={() => update(removeClub, c.id)}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <p className="muted small" style={{ marginTop: 12 }}>
        Removed clubs keep their shot history — add one back and it resumes where it left off.
      </p>

      <div className="addclub-bar-wrap">
        {pickerOpen && (
          <div className="addclub-panel">
            <p className="muted small" style={{ marginTop: 0 }}>Clubs not in your bag</p>
            <div className="chips">
              {available.length === 0 && <span className="muted small">Nothing left to add</span>}
              {available.map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  onClick={() => {
                    update(addClub, c);
                    if (available.length <= 1) setPickerOpen(false);
                  }}
                >
                  {c.short} · {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {state.bag.length < MAX_CLUBS && (
          <button className="addclub-bar" onClick={() => setPickerOpen((o) => !o)}>
            + Add Club
          </button>
        )}
      </div>
    </>
  );
}
