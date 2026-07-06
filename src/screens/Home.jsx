import { useRef, useState } from "react";
import { clubAverage, roundStats, calculatedHandicapIndex, setProfile, setHandicapIndex, removeGolfer, exportData, importData, replaceState, setAvatar, setCurrentCourse, toggleFavoriteCourse } from "../lib/store.js";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees, ATTRIBUTION } from "../lib/courseApi.js";
import { buildMailto, formatAllRoundsText } from "../lib/scorecardEmail.js";
import { distanceUnit, convertDistance, distanceLabel } from "../lib/units.js";
import logo from "../assets/brand/logo-1024.png";

const MAX_PLAYERS = 4;
const AVG_WINDOWS = [
  { label: "5", n: 5 },
  { label: "10", n: 10 },
  { label: "20", n: 20 },
  { label: "All", n: null },
];

export default function Home({ state, hero, update, onStartRound }) {
  const profileName = state.profile?.name || "You";
  const dUnit = distanceUnit(state);
  const [playerBoxes, setPlayerBoxes] = useState([profileName]);
  const [selectedCourse, setSelectedCourse] = useState(null); // { id, name, holes, tees }
  const [selectedTee, setSelectedTee] = useState(null); // { key, name, color, gender, rating, slope }
  const [avgWindow, setAvgWindow] = useState(null); // null = all rounds
  const [managingPlayers, setManagingPlayers] = useState(false);

  const [pickingCourse, setPickingCourse] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyMsg, setNearbyMsg] = useState("");
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [pickerTab, setPickerTab] = useState("nearby"); // "nearby" | "recent" | "favourites"
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchTimer = useRef(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(profileName);
  const [emailDraft, setEmailDraft] = useState(state.profile?.email || "");
  const [distanceUnitDraft, setDistanceUnitDraft] = useState(state.profile?.units?.distance || "yards");
  const [windUnitDraft, setWindUnitDraft] = useState(state.profile?.units?.wind || "mph");
  const [handicapDraft, setHandicapDraft] = useState(state.golfers?.[profileName]?.handicapIndex ?? "");
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const recent = state.rounds.slice(0, 4);

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
  const badgeHandicap = handicapCalc?.index ?? state.golfers?.[profileName]?.handicapIndex ?? null;
  const currentCourse = state.profile?.currentCourse || null;

  const bagPreview = state.bag.slice(0, 8);
  const maxYards = Math.max(...bagPreview.map((c) => clubAverage(c).yards), 1);
  const trackedTotal = state.bag.reduce((s, c) => s + c.shots.length, 0);
  const playerNames = playerBoxes.map((p) => p.trim()).filter(Boolean).slice(0, MAX_PLAYERS);
  const knownPlayers = Object.keys(state.golfers || {})
    .filter((n) => !playerNames.includes(n))
    .sort();

  function updateBox(i, value) {
    setPlayerBoxes((boxes) => boxes.map((b, idx) => (idx === i ? value : b)));
  }

  function addBox() {
    setPlayerBoxes((boxes) => (boxes.length < MAX_PLAYERS ? [...boxes, ""] : boxes));
  }

  function removeBox(i) {
    setPlayerBoxes((boxes) => (boxes.length > 1 ? boxes.filter((_, idx) => idx !== i) : boxes));
  }

  function addKnownPlayer(name) {
    if (!name) return;
    setPlayerBoxes((boxes) => {
      const emptyIdx = boxes.findIndex((b) => !b.trim());
      if (emptyIdx >= 0) return boxes.map((b, idx) => (idx === emptyIdx ? name : b));
      if (boxes.length < MAX_PLAYERS) return [...boxes, name];
      return boxes;
    });
  }

  function saveProfile() {
    const trimmed = nameDraft.trim();
    const finalName = trimmed || profileName;
    update(setProfile, {
      name: finalName,
      email: emailDraft.trim(),
      units: { distance: distanceUnitDraft, wind: windUnitDraft },
    });
    if (trimmed && trimmed !== profileName) {
      setPlayerBoxes((boxes) => boxes.map((b, i) => (i === 0 && b === profileName ? trimmed : b)));
    }
    if (!handicapCalc) {
      const parsed = parseFloat(handicapDraft);
      update(setHandicapIndex, finalName, Number.isNaN(parsed) ? null : parsed);
    }
    setProfileOpen(false);
  }

  function emailAllScorecards() {
    window.location.href = buildMailto({
      to: state.profile?.email || "",
      subject: "My Yardage — all scorecards",
      body: formatAllRoundsText(state.rounds, profileName),
    });
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
    setPickerTab("nearby");
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setPickingCourse(true);
    setNearbyBusy(true);
    try {
      const pos = await currentPosition();
      // Widen the radius until we've got a real list to choose from — a tight
      // 25mi radius can come back thin in less golf-dense areas, and "nearby"
      // shouldn't mean "the three closest" if there are more within reach.
      let courses = [];
      for (const radiusMi of [25, 50, 100]) {
        courses = await searchCourses({ lat: pos.lat, lng: pos.lon, radiusMi, limit: 50 });
        if (courses.length >= 20) break;
      }
      setNearby(courses);
      if (!courses.length) setNearbyMsg("No courses found nearby — you can still start without one.");
    } catch {
      setNearbyMsg("Couldn't read GPS — check location permission, or start without a course.");
    }
    setNearbyBusy(false);
  }

  function onSearchChange(value) {
    setSearchQuery(value);
    clearTimeout(searchTimer.current);
    if (!value.trim()) {
      setSearchResults([]);
      setSearchBusy(false);
      return;
    }
    setSearchBusy(true);
    searchTimer.current = setTimeout(async () => {
      const courses = await searchCourses({ q: value.trim() });
      setSearchResults(courses);
      setSearchBusy(false);
    }, 400);
  }

  async function pickCourse(c) {
    setLoadingCourse(true);
    const lat = c.lat ?? c.latitude ?? null;
    const lng = c.lng ?? c.longitude ?? null;
    const [holes, tees] = await Promise.all([fetchCourseHoles(c.id), fetchCourseTees(c.id)]);
    setSelectedCourse({ id: c.id, name: c.name, holes: holes.length ? holes : null, tees, lat, lng });
    const withRatings = tees.filter((t) => t.rating != null && t.slope != null);
    setSelectedTee(withRatings.length ? withRatings[0] : null);
    setLoadingCourse(false);
    update(setCurrentCourse, { id: c.id, name: c.name, city: c.city, state: c.state, lat, lng });
  }

  function courseRow(c) {
    const isFav = state.favoriteCourses.some((f) => f.id === c.id);
    const lat = c.lat ?? c.latitude ?? null;
    const lng = c.lng ?? c.longitude ?? null;
    return (
      <div key={c.id} className="list-row row course-row">
        <button
          className="course-row-main"
          onClick={() => pickCourse(c)}
        >
          <div style={{ fontSize: 14 }}>{c.name}</div>
          <div className="muted small">
            {[c.city, c.state].filter(Boolean).join(", ") || " "}
          </div>
        </button>
        <div className="row" style={{ gap: 8, width: "auto", flexShrink: 0 }}>
          {c.distance_mi != null && (
            <span className="small num" style={{ color: "var(--pine-200)" }}>
              {c.distance_mi.toFixed(1)} mi
            </span>
          )}
          <button
            className="star-btn"
            aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
            onClick={() => update(toggleFavoriteCourse, { id: c.id, name: c.name, city: c.city, state: c.state, lat, lng })}
          >
            {isFav ? "★" : "☆"}
          </button>
        </div>
      </div>
    );
  }

  function onAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => update(setAvatar, reader.result);
    reader.readAsDataURL(file);
  }

  function start(course) {
    const handicapIndexes = Object.fromEntries(
      playerNames
        .map((p) => [p, parseFloat(state.golfers?.[p]?.handicapIndex ?? "")])
        .filter(([, v]) => !Number.isNaN(v))
    );
    onStartRound({
      players: playerNames,
      course: course?.name || "New round",
      courseId: course?.id ?? null,
      courseLat: course?.lat ?? null,
      courseLng: course?.lng ?? null,
      courseHoles: course?.holes ?? null,
      handicapIndexes,
      teeRatingSlope: selectedTee ? { rating: selectedTee.rating, slope: selectedTee.slope } : null,
    });
    setPickingCourse(false);
  }

  return (
    <>
      <header
        className="hero hero--photo"
        style={
          hero && {
            backgroundImage: `linear-gradient(rgba(4,52,44,0.15), rgba(4,52,44,0.82) 75%), url(${hero.src})`,
          }
        }
      >
        <div className="row" style={{ alignItems: "flex-start" }}>
          <button
            className="avatar-btn"
            onClick={() => avatarInputRef.current?.click()}
            aria-label="Change profile photo"
          >
            {state.profile?.avatar ? (
              <img src={state.profile.avatar} alt="" />
            ) : (
              <img src={logo} alt="" />
            )}
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onAvatarFile}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="hero-greeting">Hi, {profileName}</p>
            {badgeHandicap != null && (
              <span className="pill gold" style={{ marginTop: 4 }}>HCP {badgeHandicap}</span>
            )}
          </div>

          <button
            className="chip"
            style={{ background: "rgba(255,255,255,0.14)", border: "none", color: "var(--pine-50)", flexShrink: 0 }}
            onClick={() => {
              setNameDraft(profileName);
              setEmailDraft(state.profile?.email || "");
              setDistanceUnitDraft(state.profile?.units?.distance || "yards");
              setWindUnitDraft(state.profile?.units?.wind || "mph");
              setHandicapDraft(state.golfers?.[profileName]?.handicapIndex ?? "");
              setImportMsg("");
              setProfileOpen(true);
            }}
            aria-label="Profile settings"
          >
            ⚙
          </button>
        </div>

        <div className="hero-course">
          {currentCourse ? (
            <>
              <p className="hero-course-name">📍 {currentCourse.name}</p>
              {(currentCourse.city || currentCourse.state) && (
                <p className="hero-course-loc">
                  {[currentCourse.city, currentCourse.state].filter(Boolean).join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="hero-course-name">📍 No course selected yet</p>
          )}
          <button className="hero-change-btn" onClick={openCoursePicker}>
            {currentCourse ? "Select different course" : "Choose a course"}
          </button>
        </div>
      </header>

      <button className="btn raise" onClick={openCoursePicker}>
        ▶ Start a round
      </button>

      <div className="card" style={{ marginTop: 14 }}>
        <label className="muted small">
          Playing with (up to {MAX_PLAYERS})
        </label>

        {playerBoxes.map((box, i) => (
          <div key={i} className="row" style={{ gap: 6, marginTop: 6 }}>
            <input
              type="text"
              value={box}
              onChange={(e) => updateBox(i, e.target.value)}
              placeholder={i === 0 ? profileName : `Player ${i + 1}`}
            />
            {playerBoxes.length > 1 && (
              <button className="chip" style={{ flexShrink: 0 }} onClick={() => removeBox(i)} aria-label="Remove player">
                ✕
              </button>
            )}
          </div>
        ))}

        {playerBoxes.length < MAX_PLAYERS && (
          <button className="btn ghost" style={{ marginTop: 8, height: 40 }} onClick={addBox}>
            + Add player
          </button>
        )}

        {knownPlayers.length > 0 && playerNames.length < MAX_PLAYERS && (
          <div style={{ marginTop: 10 }}>
            <div className="row">
              <p className="muted small" style={{ marginBottom: 0 }}>Previously played with</p>
              <button
                className="small"
                style={{ background: "none", border: "none", color: "var(--pine-200)", cursor: "pointer", padding: 0 }}
                onClick={() => setManagingPlayers((m) => !m)}
              >
                {managingPlayers ? "Done" : "Manage"}
              </button>
            </div>
            {managingPlayers ? (
              <div style={{ marginTop: 6 }}>
                {knownPlayers.map((n) => (
                  <div key={n} className="list-row row">
                    <span style={{ fontSize: 13 }}>
                      {n}{state.golfers[n]?.handicapIndex != null ? ` (${state.golfers[n].handicapIndex})` : ""}
                    </span>
                    <button
                      className="chip"
                      style={{ color: "var(--clay-500)" }}
                      onClick={() => update(removeGolfer, n)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => addKnownPlayer(e.target.value)}
                style={{ marginTop: 6 }}
              >
                <option value="" disabled>+ Add a previous player…</option>
                {knownPlayers.map((n) => (
                  <option key={n} value={n}>
                    {n}{state.golfers[n]?.handicapIndex != null ? ` (${state.golfers[n].handicapIndex})` : ""}
                  </option>
                ))}
              </select>
            )}
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
          <p className="label">Handicap</p>
          <p className="value num">{badgeHandicap ?? "—"}</p>
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
                  title={`${c.name}: ${convertDistance(yards, dUnit)} ${distanceLabel(dUnit)}`}
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
        <div className="picker-screen">
          <div className="picker-header">
            <button
              className="picker-back"
              aria-label={selectedCourse ? "Back to course list" : "Close"}
              onClick={() => (selectedCourse ? setSelectedCourse(null) : setPickingCourse(false))}
            >
              ←
            </button>
            <span className="picker-title">
              {selectedCourse ? "Pick your tee" : "Pick your course"}
            </span>
            {!selectedCourse && (
              <button
                className="chip"
                aria-label="Search courses"
                onClick={() => setSearchOpen((v) => !v)}
              >
                🔍
              </button>
            )}
          </div>

          {!selectedCourse && searchOpen && (
            <div style={{ padding: "12px 16px 0" }}>
              <input
                type="text"
                autoFocus
                placeholder="Search courses by name…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}

          {!selectedCourse && !(searchOpen && searchQuery.trim()) && (
            <div className="picker-tabs">
              <button className={`chip ${pickerTab === "nearby" ? "on" : ""}`} onClick={() => setPickerTab("nearby")}>Nearby</button>
              <button className={`chip ${pickerTab === "recent" ? "on" : ""}`} onClick={() => setPickerTab("recent")}>Recent</button>
              <button className={`chip ${pickerTab === "favourites" ? "on" : ""}`} onClick={() => setPickerTab("favourites")}>Favourites</button>
            </div>
          )}

          <div className="picker-body">
            {!selectedCourse && (
              <>
                {searchOpen && searchQuery.trim() ? (
                  <>
                    {searchBusy && <p className="muted small" style={{ marginTop: 12 }}>Searching…</p>}
                    {!searchBusy && !searchResults.length && (
                      <p className="muted small" style={{ marginTop: 12 }}>No courses matched "{searchQuery.trim()}".</p>
                    )}
                    <div style={{ marginTop: 8 }}>{searchResults.map(courseRow)}</div>
                  </>
                ) : (
                  <>
                    {loadingCourse && <p className="muted small" style={{ marginTop: 12 }}>Loading course details…</p>}

                    {pickerTab === "nearby" && (
                      <>
                        {nearbyBusy && (
                          <p className="muted small" style={{ marginTop: 12 }}>📍 Finding golf courses near you…</p>
                        )}
                        {nearbyMsg && <p className="muted small" style={{ marginTop: 12 }}>{nearbyMsg}</p>}
                        <div style={{ marginTop: 8 }}>{nearby.map(courseRow)}</div>
                        {nearby.length > 0 && (
                          <p className="small" style={{ opacity: 0.6, marginTop: 8 }}>{ATTRIBUTION}</p>
                        )}
                      </>
                    )}

                    {pickerTab === "recent" && (
                      <div style={{ marginTop: 8 }}>
                        {state.recentCourses.length === 0 ? (
                          <p className="muted small">No recently played courses yet.</p>
                        ) : (
                          state.recentCourses.map(courseRow)
                        )}
                      </div>
                    )}

                    {pickerTab === "favourites" && (
                      <div style={{ marginTop: 8 }}>
                        {state.favoriteCourses.length === 0 ? (
                          <p className="muted small">Tap the star on a course to save it here.</p>
                        ) : (
                          state.favoriteCourses.map(courseRow)
                        )}
                      </div>
                    )}
                  </>
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

            <p className="muted small" style={{ marginTop: 10, marginBottom: 4 }}>Your email</p>
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="you@example.com"
            />

            <label className="row" style={{ marginTop: 12, gap: 8, cursor: "pointer", justifyContent: "flex-start" }}>
              <input
                type="checkbox"
                checked={!!state.profile?.emailScorecardOnFinish}
                onChange={(e) => update(setProfile, { emailScorecardOnFinish: e.target.checked })}
                style={{ width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ fontSize: 14 }}>Email me the scorecard when I finish a round</span>
            </label>

            <p className="muted small" style={{ marginTop: 14, marginBottom: 4 }}>Distances</p>
            <div className="chips">
              <button
                className={`chip ${distanceUnitDraft === "yards" ? "on" : ""}`}
                onClick={() => setDistanceUnitDraft("yards")}
              >
                Yards
              </button>
              <button
                className={`chip ${distanceUnitDraft === "meters" ? "on" : ""}`}
                onClick={() => setDistanceUnitDraft("meters")}
              >
                Meters
              </button>
            </div>

            <p className="muted small" style={{ marginTop: 10, marginBottom: 4 }}>Wind speed</p>
            <div className="chips">
              <button
                className={`chip ${windUnitDraft === "mph" ? "on" : ""}`}
                onClick={() => setWindUnitDraft("mph")}
              >
                mph
              </button>
              <button
                className={`chip ${windUnitDraft === "kph" ? "on" : ""}`}
                onClick={() => setWindUnitDraft("kph")}
              >
                kph
              </button>
            </div>

            <p className="muted small" style={{ marginTop: 10 }}>
              No accounts here — this just saves your details on this device, the same way
              your bag already does, so you don't have to retype them every round. Emailing
              opens your phone's Mail app with everything filled in — you still tap send.
            </p>
            <button className="btn pine" style={{ marginTop: 12 }} onClick={saveProfile}>
              Save
            </button>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
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
                <>
                  <p className="muted small" style={{ marginTop: 4, marginBottom: 6 }}>
                    Set a default until we can calculate one from your rounds — link a course
                    with tee ratings and complete 18 holes to have it take over automatically.
                  </p>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={handicapDraft}
                    onChange={(e) => setHandicapDraft(e.target.value)}
                    placeholder="e.g. 14.2"
                    style={{ width: 90 }}
                  />
                </>
              )}
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 14 }}>All scorecards</strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                Email a compact summary of every round you've played ({state.rounds.length} so far).
              </p>
              <button className="btn ghost" style={{ marginTop: 8, height: 44 }} onClick={emailAllScorecards}>
                ✉ Email all scorecards
              </button>
            </div>

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
