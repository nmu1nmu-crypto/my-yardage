import { useRef, useState } from "react";
import { clubAverage, roundStats, skins, calculatedHandicapIndex, setProfile, exportData, importData, replaceState } from "../lib/store.js";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees, ATTRIBUTION } from "../lib/courseApi.js";

const MAX_PLAYERS = 4;
const AVG_WINDOWS = [
  { label: "5", n: 5 },
  { label: "10", n: 10 },
  { label: "20", n: 20 },
  { label: "All", n: null },
];

export default function Home({ state, hero, update, onStartRound }) {
  const profileName = state.profile?.name || "You";
  const [players, setPlayers] = useState(profileName);
  const [selectedCourse, setSelectedCourse] = useState(null); // { id, name, holes, tees }
  const [selectedTee, setSelectedTee] = useState(null); // { key, name, color, gender, rating, slope }
  const [handicaps, setHandicaps] = useState({}); // { playerName: indexString }
  const [avgWindow, setAvgWindow] = useState(null); // null = all rounds

  const [pickingCourse, setPickingCourse] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyMsg, setNearbyMsg] = useState("");
  const [loadingCourse, setLoadingCourse] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(profileName);
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef(null);

  const recent = state.rounds.slice(0, 4);

  const skinsWon = state.rounds.reduce((total, r) => {
    if (r.players.length < 2) return total;
    const { won } = skins(r);
    return total + (won[r.players[0]] || 0);
  }, 0);

  const avgScore = (() => {
    const windowed = avgWindow ? state.rounds.slice(0, avgWindow) : state.rounds;
    const full = windowed
      .map(roundStats)
      .filter((s) => s.holesPlayed >= 9);
    if (!full.length) return "—";
    return (
      full.reduce((s, r) => s + (r.strokes / r.holesPlayed) * 18, 0) /
      full.length
    ).toFixed(1);
  })();

  const handicapCalc = calculatedHandicapIndex(state.rounds, profileName);

  const bagPreview = state.bag.slice(0, 8);
  const maxYards = Math.max(...bagPreview.map((c) => clubAverage(c).yards), 1);
  const trackedTotal = state.bag.reduce((s, c) => s + c.shots.length, 0);
  const playerNames = players.split(",").map((p) => p.trim()).filter(Boolean).slice(0, MAX_PLAYERS);
  const playerCount = players.split(",").map((p) => p.trim()).filter(Boolean).length;
  const knownPlayers = Object.keys(state.golfers || {})
    .filter((n) => !playerNames.includes(n))
    .sort();

  function addKnownPlayer(name) {
    if (playerNames.length >= MAX_PLAYERS) return;
    const current = players.split(",").map((p) => p.trim()).filter(Boolean);
    setPlayers([...current, name].join(", "));
  }

  function saveProfile() {
    const trimmed = nameDraft.trim();
    if (trimmed) {
      update(setProfile, { name: trimmed });
      // Reflect the rename in the current "playing with" field if it still
      // has the old default name queued up as the first player.
      setPlayers((p) => {
        const parts = p.split(",").map((x) => x.trim());
        if (parts[0] === profileName) parts[0] = trimmed;
        return parts.join(", ");
      });
    }
    setProfileOpen(false);
  }

  function doExport() {
    const blob = new Blob([exportData(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-yardage-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = importData(reader.result);
        update(replaceState, imported);
        setImportMsg("Backup restored.");
      } catch (err) {
        setImportMsg(err.message || "Couldn't read that file.");
      }
    };
    reader.readAsText(file);
  }

  async function openCoursePicker() {
    setSelectedCourse(null);
    setSelectedTee(null);
    setNearby([]);
    setNearbyMsg("");
    setPickingCourse(true);
    setNearbyBusy(true);
    try {
      const pos = await currentPosition();
      const courses = await searchCourses({ lat: pos.lat, lng: pos.lon, radiusMi: 25 });
      setNearby(courses);
      if (!courses.length) setNearbyMsg("No courses found nearby — you can still start without one.");
    } catch {
      setNearbyMsg("Couldn't read GPS — check location permission, or start without a course.");
    }
    setNearbyBusy(false);
  }

  async function pickCourse(c) {
    setLoadingCourse(true);
    const [holes, tees] = await Promise.all([fetchCourseHoles(c.id), fetchCourseTees(c.id)]);
    setSelectedCourse({ id: c.id, name: c.name, holes: holes.length ? holes : null, tees });
    const withRatings = tees.filter((t) => t.rating != null && t.slope != null);
    setSelectedTee(withRatings.length ? withRatings[0] : null);
    setLoadingCourse(false);
  }

  function start(course) {
    const handicapIndexes = Object.fromEntries(
      playerNames
        .map((p) => [p, parseFloat(handicaps[p] ?? state.golfers?.[p]?.handicapIndex ?? "")])
        .filter(([, v]) => !Number.isNaN(v))
    );
    onStartRound({
      players: playerNames,
      course: course?.name || "New round",
      courseId: course?.id ?? null,
      courseHoles: course?.holes ?? null,
      handicapIndexes,
      teeRatingSlope: selectedTee ? { rating: selectedTee.rating, slope: selectedTee.slope } : null,
    });
    setPickingCourse(false);
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
        <div className="row">
          <div className="brandmark" style={{ marginBottom: 0 }}>
            <span className="dot" aria-hidden="true">⛳</span>
            My Yardage
          </div>
          <button
            className="chip"
            style={{ background: "rgba(255,255,255,0.14)", border: "none", color: "var(--pine-50)" }}
            onClick={() => {
              setNameDraft(profileName);
              setImportMsg("");
              setProfileOpen(true);
            }}
          >
            👤 {profileName}
          </button>
        </div>
        <p className="eyebrow">Welcome back</p>
        <h1>Ready when you are</h1>
      </header>

      <button className="btn raise" onClick={openCoursePicker}>
        ▶ Start a round
      </button>

      <div className="card" style={{ marginTop: 14 }}>
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

        {knownPlayers.length > 0 && playerNames.length < MAX_PLAYERS && (
          <div style={{ marginTop: 8 }}>
            <p className="muted small" style={{ marginBottom: 4 }}>Previously played with</p>
            <div className="chips">
              {knownPlayers.map((n) => (
                <button key={n} className="chip" onClick={() => addKnownPlayer(n)}>
                  + {n}
                  {state.golfers[n]?.handicapIndex != null ? ` (${state.golfers[n].handicapIndex})` : ""}
                </button>
              ))}
            </div>
          </div>
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

      {state.rounds.length > 1 && (
        <div className="row" style={{ marginTop: 12, gap: 6, justifyContent: "flex-start" }}>
          <span className="muted small">Average over</span>
          {AVG_WINDOWS.map((w) => (
            <button
              key={w.label}
              className={`chip ${avgWindow === w.n ? "on" : ""}`}
              style={{ padding: "3px 10px" }}
              onClick={() => setAvgWindow(w.n)}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

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
          <strong style={{ fontSize: 14 }}>Your handicap</strong>
          {handicapCalc && (
            <span className="muted small">{handicapCalc.roundsUsed} round{handicapCalc.roundsUsed === 1 ? "" : "s"}</span>
          )}
        </div>
        {handicapCalc ? (
          <>
            <p className="value num" style={{ fontSize: 28, margin: "4px 0 0", color: "var(--pine-200)" }}>
              {handicapCalc.index}
            </p>
            <p className="muted small" style={{ margin: "2px 0 0" }}>
              {handicapCalc.roundsUsed < 3
                ? "Provisional — plays more rounds with a linked course for a stable estimate."
                : "Estimated from your linked-course rounds (WHS-style) — not an official handicap."}
            </p>
          </>
        ) : (
          <p className="muted small" style={{ marginBottom: 0 }}>
            Link a course with tee ratings when starting a round and complete 18 holes — your handicap calculates itself from there.
          </p>
        )}
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

      {pickingCourse && (
        <div className="course-overlay">
          <div className="course-sheet">
            <div className="row">
              <strong style={{ fontSize: 16 }}>
                {selectedCourse ? "Pick your tee" : "Pick your course"}
              </strong>
              <button className="chip" onClick={() => setPickingCourse(false)}>✕</button>
            </div>

            {!selectedCourse && (
              <>
                {nearbyBusy && (
                  <p className="muted small" style={{ marginTop: 12 }}>📍 Finding golf courses near you…</p>
                )}
                {nearbyMsg && <p className="muted small" style={{ marginTop: 12 }}>{nearbyMsg}</p>}
                {loadingCourse && <p className="muted small" style={{ marginTop: 12 }}>Loading course details…</p>}
                <div style={{ marginTop: 8 }}>
                  {nearby.map((c) => (
                    <button
                      key={c.id}
                      className="list-row row"
                      style={{ width: "100%", background: "none", border: "none", textAlign: "left", cursor: "pointer", color: "var(--ink)" }}
                      onClick={() => pickCourse(c)}
                    >
                      <div>
                        <div style={{ fontSize: 14 }}>{c.name}</div>
                        <div className="muted small">
                          {[c.city, c.state].filter(Boolean).join(", ") || " "}
                        </div>
                      </div>
                      {c.distance_mi != null && (
                        <span className="small num" style={{ color: "var(--pine-200)" }}>
                          {c.distance_mi.toFixed(1)} mi
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {nearby.length > 0 && (
                  <p className="small" style={{ opacity: 0.6, marginTop: 8 }}>{ATTRIBUTION}</p>
                )}
                <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => start(null)}>
                  Skip — start without a course
                </button>
              </>
            )}

            {selectedCourse && (
              <>
                <p className="small" style={{ color: "var(--pine-200)", marginTop: 10 }}>
                  {selectedCourse.name}
                  {selectedCourse.holes ? ` · par/yardage loaded for ${selectedCourse.holes.length} holes` : " · no hole data available"}
                </p>
                {selectedCourse.tees?.some((t) => t.rating != null && t.slope != null) ? (
                  <div className="chips" style={{ marginTop: 10 }}>
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
                ) : (
                  <p className="muted small" style={{ marginTop: 8 }}>
                    No tee ratings available for this course — net scoring won't be available this round.
                  </p>
                )}
                <button className="btn pine" style={{ marginTop: 16 }} onClick={() => start(selectedCourse)}>
                  ▶ Start round at {selectedCourse.name}
                </button>
                <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setSelectedCourse(null)}>
                  ← Back to course list
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="course-overlay">
          <div className="course-sheet">
            <div className="row">
              <strong style={{ fontSize: 16 }}>Your profile</strong>
              <button className="chip" onClick={() => setProfileOpen(false)}>✕</button>
            </div>

            <p className="muted small" style={{ marginTop: 14, marginBottom: 4 }}>Your name</p>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="You"
            />
            <p className="muted small" style={{ marginTop: 10 }}>
              No accounts here — this just saves your name and handicap on this device, the
              same way your bag already does, so you don't have to retype them every round.
            </p>
            <button className="btn pine" style={{ marginTop: 12 }} onClick={saveProfile}>
              Save
            </button>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 14 }}>Backup</strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                Everything lives only on this device. Export a copy so a lost phone or
                reinstall doesn't lose your rounds, handicap, and bag.
              </p>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn ghost" style={{ flex: 1, height: 44 }} onClick={doExport}>
                  ⬇ Export backup
                </button>
                <button
                  className="btn ghost"
                  style={{ flex: 1, height: 44 }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  ⬆ Import backup
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={onImportFile}
              />
              {importMsg && <p className="small" style={{ marginTop: 8, color: "var(--pine-200)" }}>{importMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
