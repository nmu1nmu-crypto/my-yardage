import { useEffect, useMemo, useState } from "react";
import { currentPosition, yardsBetween, bearingDegrees } from "../lib/geo.js";
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

export default function Round({ state, update, goGames }) {
  const round = state.activeRound;
  const [clubId, setClubId] = useState(state.bag[4]?.id ?? state.bag[0]?.id);
  const [weather, setWeather] = useState(null);
  const [greenPin, setGreenPin] = useState(null); // {lat, lon} dropped by the golfer
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

  const rawYards = useMemo(() => {
    if (!here || !greenPin) return null;
    return yardsBetween(here, greenPin);
  }, [here, greenPin]);

  const adjusted = useMemo(() => {
    if (rawYards == null) return null;
    const bearing = greenPin && here ? bearingDegrees(here, greenPin) : 0;
    return playsLike({ yards: rawYards, shotBearingDeg: bearing, weather });
  }, [rawYards, weather, here, greenPin]);

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No round in progress</strong>
        <p className="muted">Start one from the home screen.</p>
      </div>
    );
  }

  const you = round.players[0];
  const hole = round.holes.find((h) => h.number === round.currentHole);
  const stats = roundStats(round);
  const pending = round.pendingShot;
  const selected = state.bag.find((c) => c.id === clubId);
  const avg = selected ? clubAverage(selected) : null;

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

  async function dropPin() {
    const pos = await refreshPosition();
    if (pos) {
      setGreenPin(pos);
      setMsg("Green pinned. Distances now measure to this spot.");
    }
  }

  const last = round.lastLogged;

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

      <div className="card pine">
        <div className="row">
          <div>
            <p className="small" style={{ color: "var(--pine-100)", margin: 0 }}>
              To your green pin
            </p>
            <p className="num" style={{ fontSize: 30, fontWeight: 600, margin: "2px 0 0" }}>
              {rawYards ?? "—"}
              <span style={{ fontSize: 14, color: "var(--pine-100)" }}> yds</span>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="small" style={{ color: "var(--pine-100)", margin: 0 }}>
              Plays like
            </p>
            <p
              className="num"
              style={{ fontSize: 30, fontWeight: 600, margin: "2px 0 0", color: "var(--gold-200)" }}
            >
              {adjusted ? adjusted.adjusted : "—"}
            </p>
          </div>
        </div>
        <div className="small" style={{ color: "var(--pine-100)", marginTop: 8 }}>
          {adjusted?.parts.length
            ? adjusted.parts
                .map((p) => `${p.label} ${p.yards > 0 ? "+" : ""}${p.yards} (${p.detail})`)
                .join(" · ")
            : greenPin
              ? "Calm conditions"
              : "Walk to the green once and tap “Pin this green” — distances follow."}
        </div>
      </div>

      {!greenPin && (
        <button className="btn ghost" style={{ marginTop: 10 }} onClick={dropPin}>
          📍 Pin this green
        </button>
      )}

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
          <p className="small" style={{ color: "var(--pine-600)", margin: "6px 0 0" }}>
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
        <strong style={{ fontSize: 14 }}>Score this hole</strong>
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
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => update(nextHole)}>
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
