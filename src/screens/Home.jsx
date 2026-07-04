import { useState } from "react";
import { clubAverage, roundStats, skins } from "../lib/store.js";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees, ATTRIBUTION } from "../lib/courseApi.js";

const MAX_PLAYERS = 4;

export default function Home({ state, hero, onStartRound }) {
  const [players, setPlayers] = useState("You");
  const [courseName, setCourseName] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null); // { id, name, holes, tees }
  const [selectedTee, setSelectedTee] = useState(null); // { key, name, color, gender, rating, slope }
  const [handicaps, setHandicaps] = useState({}); // { playerName: indexString }
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");

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
  const playerNames = players.split(",").map((p) => p.trim()).filter(Boolean).slice(0, MAX_PLAYERS);
  const playerCount = players.split(",").map((p) => p.trim()).filter(Boolean).length;

  async function runSearch(q) {
    setBusy(true);
    setSearchMsg("");
    const courses = await searchCourses({ q });
    setBusy(false);
    setResults(courses);
    if (!courses.length) setSearchMsg("No matches — you can still type the course name manually.");
  }

  async function findNearby() {
    setBusy(true);
    setSearchMsg("");
    try {
      const pos = await currentPosition();
      const courses = await searchCourses({ lat: pos.lat, lng: pos.lon, radiusMi: 25 });
      setResults(courses);
      if (!courses.length) setSearchMsg("Nothing found nearby — try searching by name.");
    } catch {
      setSearchMsg("Couldn't read GPS — check location permission, or search by name.");
    }
    setBusy(false);
  }

  async function pickCourse(c) {
    setCourseName(c.name);
    setSearchOpen(false);
    setResults([]);
    setSelectedTee(null);
    const [holes, tees] = await Promise.all([fetchCourseHoles(c.id), fetchCourseTees(c.id)]);
    setSelectedCourse({ id: c.id, name: c.name, holes: holes.length ? holes : null, tees });
    const withRatings = tees.filter((t) => t.rating != null && t.slope != null);
    if (withRatings.length) setSelectedTee(withRatings[0]);
  }

  function start() {
    const handicapIndexes = Object.fromEntries(
      playerNames
        .map((p) => [p, parseFloat(handicaps[p] ?? state.golfers?.[p]?.handicapIndex ?? "")])
        .filter(([, v]) => !Number.isNaN(v))
    );
    onStartRound({
      players: playerNames,
      course: courseName.trim() || "New round",
      courseId: selectedCourse?.id ?? null,
      courseHoles: selectedCourse?.holes ?? null,
      handicapIndexes,
      teeRatingSlope: selectedTee ? { rating: selectedTee.rating, slope: selectedTee.slope } : null,
    });
  }

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

      <button className="btn raise" onClick={start}>
        ▶ Start a round
      </button>

      <div className="card" style={{ marginTop: 14 }}>
        <label className="muted small" htmlFor="course">
          Course
        </label>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <input
            id="course"
            type="text"
            value={courseName}
            onChange={(e) => {
              setCourseName(e.target.value);
              setSelectedCourse(null);
            }}
            placeholder="Type a name, or find one below"
          />
          <button
            className="chip"
            style={{ flexShrink: 0 }}
            onClick={() => setSearchOpen((o) => !o)}
          >
            🔍 Find
          </button>
        </div>
        {selectedCourse?.holes && (
          <p className="small" style={{ color: "var(--pine-200)", margin: "6px 0 0" }}>
            ✓ Par/yardage loaded for {selectedCourse.holes.length} holes
          </p>
        )}

        {selectedCourse?.tees?.some((t) => t.rating != null && t.slope != null) && (
          <div style={{ marginTop: 8 }}>
            <p className="muted small" style={{ marginBottom: 4 }}>
              Tee (for handicap calculation)
            </p>
            <div className="chips">
              {selectedCourse.tees
                .filter((t) => t.rating != null && t.slope != null)
                .map((t) => (
                  <button
                    key={t.key}
                    className={`chip ${selectedTee?.key === t.key ? "on" : ""}`}
                    onClick={() => setSelectedTee(t)}
                  >
                    {t.name} {t.gender ? `(${t.gender[0]})` : ""} · {t.rating}/{t.slope}
                  </button>
                ))}
            </div>
          </div>
        )}

        {searchOpen && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            <div className="row" style={{ gap: 6 }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search course name"
              />
              <button
                className="chip"
                style={{ flexShrink: 0 }}
                onClick={() => query.trim().length > 1 && runSearch(query.trim())}
              >
                Go
              </button>
            </div>
            <button className="btn ghost" style={{ marginTop: 8, height: 40 }} onClick={findNearby}>
              📍 Find courses near me
            </button>
            {busy && <p className="muted small" style={{ marginTop: 6 }}>Searching…</p>}
            {searchMsg && <p className="muted small" style={{ marginTop: 6 }}>{searchMsg}</p>}
            {results.map((c) => (
              <button
                key={c.id}
                className="list-row row"
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--ink)",
                }}
                onClick={() => pickCourse(c)}
              >
                <div>
                  <div style={{ fontSize: 14 }}>{c.name}</div>
                  <div className="muted small">
                    {[c.city, c.state].filter(Boolean).join(", ") || " "}
                  </div>
                </div>
                {c.distance_mi != null && (
                  <span className="small num" style={{ color: "var(--pine-200)" }}>
                    {c.distance_mi.toFixed(1)} mi
                  </span>
                )}
              </button>
            ))}
            {results.length > 0 && (
              <p className="small" style={{ opacity: 0.6, marginTop: 6 }}>{ATTRIBUTION}</p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <label className="muted small" htmlFor="players">
          Playing with (comma-separated — first name is you, up to {MAX_PLAYERS})
        </label>
        <input
          id="players"
          type="text"
          value={players}
          onChange={(e) => setPlayers(e.target.value)}
          placeholder="You, Dave, Raj"
          style={{ marginTop: 6 }}
        />
        {playerCount > MAX_PLAYERS && (
          <p className="small" style={{ color: "var(--gold-200)", margin: "6px 0 0" }}>
            Only the first {MAX_PLAYERS} will be added to the round.
          </p>
        )}

        {playerNames.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            <p className="muted small" style={{ marginBottom: 6 }}>
              Handicap index (optional — enables net scoring on the Scorecard)
            </p>
            {playerNames.map((p) => (
              <div key={p} className="row" style={{ gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 13, flex: 1 }}>{p}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={handicaps[p] ?? state.golfers?.[p]?.handicapIndex ?? ""}
                  onChange={(e) => setHandicaps((h) => ({ ...h, [p]: e.target.value }))}
                  placeholder="e.g. 14.2"
                  style={{ width: 90, height: 36 }}
                />
              </div>
            ))}
          </div>
        )}
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
