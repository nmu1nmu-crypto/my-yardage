import { useState } from "react";
import {
  CLUB_LIBRARY,
  clubAverage,
  addClub,
  removeClub,
  setManualYards,
} from "../lib/store.js";
import { distanceUnit, convertDistance, distanceLabel, toYards } from "../lib/units.js";

export default function Bag({ state, update }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // club id
  const [draftYards, setDraftYards] = useState("");
  const dUnit = distanceUnit(state);

  const inBag = new Set(state.bag.map((c) => c.id));
  const available = CLUB_LIBRARY.filter((c) => !inBag.has(c.id));

  function commitEdit(id) {
    const entered = parseInt(draftYards, 10);
    const yards = toYards(entered, dUnit);
    if (yards != null && !Number.isNaN(yards) && yards > 0 && yards < 400) update(setManualYards, id, yards);
    setEditing(null);
  }

  return (
    <>
      <div className="row" style={{ margin: "8px 0 4px" }}>
        <strong style={{ fontSize: 18 }}>My bag</strong>
        <span className="pill num">{state.bag.length} of 14 clubs</span>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Carries update automatically as you track shots
      </p>

      <div className="card">
        {state.bag.map((c) => {
          const { yards, tracked } = clubAverage(c);
          return (
            <div className="list-row row" key={c.id}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--pine-800)",
                  color: "var(--pine-100)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {c.short}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{c.name}</div>
                {editing === c.id ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <input
                      type="number"
                      value={draftYards}
                      onChange={(e) => setDraftYards(e.target.value)}
                      style={{ height: 34, width: 70 }}
                      autoFocus
                    />
                    <span className="muted small" style={{ alignSelf: "center" }}>{distanceLabel(dUnit)}</span>
                    <button className="chip on" onClick={() => commitEdit(c.id)}>
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="small num" style={{ color: "var(--pine-200)" }}>
                    {convertDistance(yards, dUnit)} {distanceLabel(dUnit)} {tracked ? "avg carry" : "estimated"}
                  </div>
                )}
              </div>
              <span className={tracked ? "muted small" : "pill gold"}>
                {tracked ? `${tracked} shots` : "manual"}
              </span>
              <button
                className="chip"
                aria-label={`Edit ${c.name}`}
                onClick={() => {
                  setEditing(c.id);
                  setDraftYards(String(convertDistance(yards, dUnit)));
                }}
              >
                ✎
              </button>
              <button
                className="chip"
                aria-label={`Remove ${c.name}`}
                style={{ color: "var(--clay-500)" }}
                onClick={() => update(removeClub, c.id)}
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>

      {state.bag.length < 14 && (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setPickerOpen((o) => !o)}>
          + Add a club
        </button>
      )}

      {pickerOpen && (
        <div className="card" style={{ background: "var(--pine-50)", border: "none" }}>
          <strong className="small" style={{ color: "var(--pine-800)" }}>
            Pick a club to add
          </strong>
          <div className="chips" style={{ marginTop: 8 }}>
            {available.length === 0 && (
              <span className="small" style={{ color: "var(--pine-600)" }}>
                Nothing left to add
              </span>
            )}
            {available.map((c) => (
              <button
                key={c.id}
                className="chip"
                style={{ background: "#ffffff", color: "var(--pine-800)", borderColor: "var(--pine-100)" }}
                onClick={() => update(addClub, c)}
              >
                {c.short} · {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="muted small" style={{ marginTop: 12 }}>
        Removed clubs keep their shot history — add one back and it resumes
        where it left off.
      </p>
    </>
  );
}
