import { useEffect, useMemo, useState } from "react";
import { currentPosition, yardsBetween, bearingDegrees, elevationDeltaFeet } from "../lib/geo.js";
import { fetchWeather, playsLike } from "../lib/playslike.js";
import {
  clubAverage,
  markShotStart,
  markShotEnd,
  setHoleScore,
  nextHole,
  finishRound,
  roundStats,
} from "../lib/store.js";

const GREEN_STEPS = [
  { key: "front", label: "front of green" },
  { key: "middle", label: "middle (pin)" },
  { key: "back", label: "back of green" },
];

export default function Round({ state, update, goGames }) {
  const round = state.activeRound;
  const [clubId, setClubId] = useState(state.bag[4]?.id ?? state.bag[0]?.id);
  const [weather, setWeather] = useState(null);
  const [green, setGreen] = useState({ front: null, middle: null, back: null }); // GPS points the golfer walks and taps once per hole
  const [here, setHere] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // One position + one weather fetch when the screen opens. Both optional.
    currentPosition()
      .then((pos) => {
        setHere(pos);
        return fetchWeather(pos).then(setWeather);
      })
      .catch(() => setMsg("GPS or weather unavailable — distances still work once GPS wakes up."));
  }, []);

  const distances = useMemo(() => {
    if (!here) return { front: null, middle: null, back: null };
    return {
      front: green.front ? yardsBetween(here, green.front) : null,
      middle: green.middle ? yardsBetween(here, green.middle) : null,
      back: green.back ? yardsBetween(here, green.back) : null,
    };
  }, [here, green]);

  const adjusted = useMemo(() => {
    if (distances.middle == null) return null;
    const bearing = bearingDegrees(here, green.middle);
    const elevationDeltaFt = elevationDeltaFeet(here, green.middle);
    return playsLike({ yards: distances.middle, shotBearingDeg: bearing, weather, elevationDeltaFt });
  }, [distances.middle, weather, here, green.middle]);

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No round in progress</strong>
        <p className="muted">Start one from the home screen.</p>
      </div>
    );
  }

  const hole = round.holes.find((h) => h.number === round.currentHole);
  const stats = roundStats(round);
  const pending = round.pendingShot;
  const selected = state.bag.find((c) => c.id === clubId);
  const avg = selected ? clubAverage(selected) : null;
  const nextGreenStep = GREEN_STEPS.find((s) => !green[s.key]);

  async function refreshPosition() {
    try {
      const pos = await currentPosition();
      setHere(pos);
      return pos;
    } catch {
      setMsg("Couldn't read GPS — check location permission.");
      return null;
    }
  }

  async function onMark() {
    setBusy(true);
    const pos = await refreshPosition();
    setBusy(false);
    if (!pos) return;
    if (!pending) {
      update(markShotStart, clubId, pos);
      setMsg("");
    } else {
      update(markShotEnd, pos, yardsBetween);
    }
  }

  async function markGreenPoint(key) {
    const pos = await refreshPosition();
    if (pos) {
      setGreen((g) => ({ ...g, [key]: pos }));
      setMsg("");
    }
  }

  function resetGreen() {
    setGreen({ front: null, middle: null, back: null });
  }

  const last = round.lastLogged;
  const greenDone = green.front && green.middle && green.back;

  return (
    <>
      <div className="row" style={{ margin: "8px 0 12px" }}>
        <div>
          <strong style={{ fontSize: 18 }}>Hole {round.currentHole}</strong>{" "}
          <span className="muted">Par {hole?.par ?? 4}</span>
        </div>
        <span className="pill num">
          {stats.holesPlayed
            ? `${stats.toPar >= 0 ? "+" : ""}${stats.toPar} thru ${stats.holesPlayed}`
            : "Round started"}
        </span>
      </div>

      <div className="card sky">
        <div className="row">
          <strong style={{ fontSize: 13 }}>⛳ Green complex</strong>
          {greenDone && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="chip sky"
                style={{ padding: "3px 10px", height: "auto" }}
                onClick={refreshPosition}
              >
                ↻ Refresh
              </button>
              <button
                className="chip sky"
                style={{ padding: "3px 10px", height: "auto" }}
                onClick={resetGreen}
              >
                Re-pin
              </button>
            </div>
          )}
        </div>

        {greenDone ? (
          <>
            <div className="green-grid">
              <div className="g">
                <div className="lbl">Front</div>
                <div className="val num">{distances.front ?? "—"}</div>
              </div>
              <div className="g active">
                <div className="lbl">Middle</div>
                <div className="val num">{distances.middle ?? "—"}</div>
              </div>
              <div className="g">
                <div className="lbl">Back</div>
                <div className="val num">{distances.back ?? "—"}</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
              <span className="small" style={{ opacity: 0.8 }}>Plays like</span>
              <span className="num" style={{ fontSize: 32, fontWeight: 600, color: "var(--gold-200)" }}>
                {adjusted ? adjusted.adjusted : distances.middle ?? "—"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {adjusted?.parts.length ? (
                adjusted.parts.map((p) => (
                  <span key={p.label} className="chip sky" style={{ height: "auto", padding: "5px 10px" }}>
                    {p.label} {p.yards > 0 ? "+" : ""}
                    {p.yards} ({p.detail})
                  </span>
                ))
              ) : (
                <span className="small" style={{ opacity: 0.75 }}>Calm conditions</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="small" style={{ opacity: 0.85, marginTop: 4 }}>
              Walk to the green once per hole and tap as you reach each spot —
              distances and plays-like follow for the rest of the hole.
            </p>
            <button
              className="btn"
              style={{ marginTop: 10, background: "var(--sky-400)", color: "var(--sky-900)" }}
              onClick={() => markGreenPoint(nextGreenStep.key)}
            >
              📍 Mark {nextGreenStep.label}
            </button>
            {(green.front || green.middle) && (
              <p className="small" style={{ opacity: 0.75, marginTop: 8 }}>
                {GREEN_STEPS.filter((s) => green[s.key]).map((s) => `${s.label} ✓`).join(" · ")}
              </p>
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <p className="muted small" style={{ marginBottom: 6 }}>
          Club · your real carry
        </p>
        <div className="chips">
          {state.bag.map((c) => (
            <button
              key={c.id}
              className={`chip ${c.id === clubId ? "on" : ""}`}
              onClick={() => !pending && setClubId(c.id)}
            >
              {c.short}
            </button>
          ))}
        </div>
        {avg && (
          <p className="small" style={{ color: "var(--pine-200)", margin: "6px 0 0" }}>
            {selected.name} carries {avg.yards} yds{" "}
            {avg.tracked ? `on average (${avg.tracked} tracked)` : "(your estimate — track shots to learn it)"}
          </p>
        )}
      </div>

      <button
        className={`btn ${pending ? "" : "pine"}`}
        style={{ marginTop: 14 }}
        onClick={onMark}
        disabled={busy}
      >
        {busy
          ? "Reading GPS…"
          : pending
            ? "Tap when you reach your ball"
            : `Mark shot — ${selected?.short ?? ""}`}
      </button>
      <p className="muted small" style={{ textAlign: "center", marginTop: 6 }}>
        {pending
          ? `${selected?.short} in flight — GPS is watching the distance`
          : last
            ? last.valid
              ? `Logged: ${state.bag.find((c) => c.id === last.clubId)?.short} · ${last.yards} yds — added to your averages`
              : `Ignored a ${last.yards} yd reading (out of range)`
            : "One tap here, one tap at your ball"}
      </p>
      {msg && <p className="muted small" style={{ textAlign: "center" }}>{msg}</p>}

      <div className="card">
        <div className="row">
          <strong style={{ fontSize: 14 }}>Score this hole</strong>
          <span className="pill num">Hole {round.currentHole}</span>
        </div>
        {round.players.map((p) => (
          <div className="list-row row" key={p}>
            <span style={{ fontSize: 14 }}>{p}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {[3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  className={`chip num ${hole?.strokes[p] === n ? "on" : ""}`}
                  onClick={() => update(setHoleScore, p, n, hole?.par ?? 4)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => { resetGreen(); update(nextHole); }}>
          Next hole →
        </button>
        <button className="btn ghost" style={{ flex: 1 }} onClick={goGames}>
          🪙 Games
        </button>
      </div>

      {round.currentHole >= 2 && (
        <button
          className="btn ghost"
          style={{ marginTop: 8, borderStyle: "solid" }}
          onClick={() => update(finishRound)}
        >
          Finish round
        </button>
      )}
    </>
  );
}
