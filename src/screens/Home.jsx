import { useState } from "react";
import { clubAverage, roundStats, skins } from "../lib/store.js";

export default function Home({ state, hero, onStartRound }) {
  const [players, setPlayers] = useState("You");
  const recent = state.rounds.slice(0, 4);

  const skinsWon = state.rounds.reduce((total, r) => {
    if (r.players.length < 2) return total;
    const { won } = skins(r);
    return total + (won[r.players[0]] || 0);
  }, 0);

  const avgScore = (() => {
    const full = state.rounds
      .map(roundStats)
      .filter((s) => s.holesPlayed >= 9);
    if (!full.length) return "—";
    return (
      full.reduce((s, r) => s + (r.strokes / r.holesPlayed) * 18, 0) /
      full.length
    ).toFixed(1);
  })();

  const bagPreview = state.bag.slice(0, 8);
  const maxYards = Math.max(...bagPreview.map((c) => clubAverage(c).yards), 1);
  const trackedTotal = state.bag.reduce((s, c) => s + c.shots.length, 0);

  return (
    <>
      <header
        className="hero"
        style={
          hero && {
            backgroundImage: `linear-gradient(rgba(4,52,44,0.55), rgba(4,52,44,0.88)), url(${hero.src})`,
          }
        }
      >
        <div className="brandmark">
          <span className="dot" aria-hidden="true">⛳</span>
          My Yardage
        </div>
        <p className="eyebrow">Welcome back</p>
        <h1>Ready when you are</h1>
      </header>

      <button
        className="btn raise"
        onClick={() =>
          onStartRound({
            players: players
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
          })
        }
      >
        ▶ Start a round
      </button>

      <div className="card" style={{ marginTop: 14 }}>
        <label className="muted small" htmlFor="players">
          Playing with (comma-separated — first name is you)
        </label>
        <input
          id="players"
          type="text"
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          placeholder="You, Dave, Raj"
          style={{ marginTop: 6 }}
        />
      </div>

      <div className="metric-row">
        <div className="metric">
          <p className="label">Rounds</p>
          <p className="value num">{state.rounds.length}</p>
        </div>
        <div className="metric">
          <p className="label">Avg score</p>
          <p className="value num">{avgScore}</p>
        </div>
        <div className="metric gold">
          <p className="label">Skins won</p>
          <p className="value num">£{skinsWon}</p>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <strong style={{ fontSize: 14 }}>Your bag</strong>
          <span className="small" style={{ color: "var(--pine-200)" }}>
            {trackedTotal} shots tracked
          </span>
        </div>
        <div className="clubbar">
          {bagPreview.map((c) => {
            const { yards } = clubAverage(c);
            return (
              <div className="col" key={c.id}>
                <div
                  className="bar"
                  style={{ height: `${Math.max(12, (yards / maxYards) * 60)}px` }}
                  title={`${c.name}: ${yards} yds`}
                />
                <div className="lbl">{c.short}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <strong style={{ fontSize: 14 }}>Recent rounds</strong>
        {recent.length === 0 && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Your first round will show up here.
          </p>
        )}
        {recent.map((r) => {
          const s = roundStats(r);
          return (
            <div className="list-row row" key={r.id}>
              <div>
                <div style={{ fontSize: 14 }}>{r.course}</div>
                <div className="muted small">
                  {new Date(r.startedAt).toLocaleDateString()} ·{" "}
                  {r.players.join(", ")}
                </div>
              </div>
              <strong className="num">
                {s.holesPlayed ? s.strokes : "—"}
              </strong>
            </div>
          );
        })}
      </div>
    </>
  );
}
