import { useRef, useState } from "react";
import { clubAverage, roundStats, calculatedHandicapIndex, setProfile, setHandicapIndex, removeGolfer, exportData, importData, replaceState, setAvatar, setCurrentCourse, toggleFavoriteCourse, cacheCourseData } from "../lib/store.js";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees, ATTRIBUTION } from "../lib/courseApi.js";
import { fetchCourseGeometry } from "../lib/greenApi.js";
import { buildMailto, formatAllRoundsText } from "../lib/scorecardEmail.js";
import { distanceUnit, convertDistance, distanceLabel } from "../lib/units.js";
import Gauge from "../components/Gauge.jsx";

const MAX_EXTRA_PLAYERS = 3;
const AVG_WINDOWS = [
  { label: "5", n: 5 },
  { label: "10", n: 10 },
  { label: "20", n: 20 },
  { label: "All", n: null },
];

function initial(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function Home({ state, hero, update, onStartRound }) {
  const profileName = state.profile?.name || "You";
  const dUnit = distanceUnit(state);
  const [extraPlayers, setExtraPlayers] = useState([]); // names of players 2..4
  const [pickerOpenIdx, setPickerOpenIdx] = useState(null);
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
  const lastRoundScore = (() => {
    const last = state.rounds.find((r) => roundStats(r).holesPlayed >= 9);
    return last ? roundStats(last).strokes : null;
  })();

  const handicapCalc = calculatedHandicapIndex(state.rounds, profileName);
  const badgeHandicap = handicapCalc?.index ?? state.golfers?.[profileName]?.handicapIndex ?? null;
  const currentCourse = state.profile?.currentCourse || null;

  const playerNames = [profileName, ...extraPlayers.map((p) => p.trim()).filter(Boolean)].slice(0, 1 + MAX_EXTRA_PLAYERS);
  const knownPlayers = Object.keys(state.golfers || {})
    .filter((n) => n !== profileName && !extraPlayers.includes(n))
    .sort();

  function updateExtra(i, value) {
    setExtraPlayers((boxes) => boxes.map((b, idx) => (idx === i ? value : b)));
    setPickerOpenIdx(null);
  }

  function addExtra() {
    setExtraPlayers((boxes) => (boxes.length < MAX_EXTRA_PLAYERS ? [...boxes, ""] : boxes));
  }

  function removeExtra(i) {
    setExtraPlayers((boxes) => boxes.filter((_, idx) => idx !== i));
  }

  function saveProfile() {
    const trimmed = nameDraft.trim();
    const finalName = trimmed || profileName;
    update(setProfile, {
      name: finalName,
      email: emailDraft.trim(),
      units: { distance: distanceUnitDraft, wind: windUnitDraft },
    });
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

    // A course already played once (this round or any past one) is never
    // re-fetched — holes/tees/greens/hazards/elevation are cached forever
    // by course id. Green/hazard/elevation geometry is fetched here, once,
    // alongside holes/tees — never from the Round screen, so playing a
    // round makes no network calls for any of it (and the shared Overpass
    // server can't be hammered by repeated visits to the same course).
    const cached = state.courseCache?.[c.id];
    let holes, tees, greens, fairways, teeBoxes, hazards;
    if (cached) {
      ({ holes, tees, greens, fairways, teeBoxes, hazards } = cached);
    } else {
      const [h, t, geometry] = await Promise.all([
        fetchCourseHoles(c.id),
        fetchCourseTees(c.id),
        fetchCourseGeometry({ lat, lng }),
      ]);
      holes = h;
      tees = t;
      greens = geometry.greens;
      fairways = geometry.fairways;
      teeBoxes = geometry.teeBoxes;
      hazards = geometry.hazards;
      update(cacheCourseData, c.id, { holes, tees, greens, fairways, teeBoxes, hazards, lat, lng });
    }

    setSelectedCourse({
      id: c.id,
      name: c.name,
      holes: holes.length ? holes : null,
      tees,
      lat,
      lng,
      greens,
      fairways,
      teeBoxes,
      hazards,
    });
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
            <span className="small num" style={{ color: "var(--gold)" }}>
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

  function openProfile() {
    setNameDraft(profileName);
    setEmailDraft(state.profile?.email || "");
    setDistanceUnitDraft(state.profile?.units?.distance || "yards");
    setWindUnitDraft(state.profile?.units?.wind || "mph");
    setHandicapDraft(state.golfers?.[profileName]?.handicapIndex ?? "");
    setImportMsg("");
    setProfileOpen(true);
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
      courseGreens: course?.greens ?? [],
      courseFairways: course?.fairways ?? [],
      courseTeeBoxes: course?.teeBoxes ?? [],
      courseHazards: course?.hazards ?? [],
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
            backgroundImage: `url(${hero.src})`,
          }
        }
      >
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="hero-greeting">Good morning, {profileName}</p>
          </div>
          <button className="avatar-btn" onClick={openProfile} aria-label="Profile">
            👤
          </button>
        </div>

        <div className="hero-course">
          {currentCourse ? (
            <p className="hero-course-name">{currentCourse.name}</p>
          ) : (
            <p className="hero-course-name">No course selected yet</p>
          )}
          <button className="hero-change-btn" onClick={openCoursePicker}>
            {currentCourse ? "Change course" : "Choose a course"}
          </button>
        </div>
      </header>

      <div className="card mycard">
        <div className="row" style={{ alignItems: "center" }}>
          <div className="row" style={{ gap: 12, width: "auto", flex: 1 }}>
            <div className="mycard-avatar">
              {state.profile?.avatar ? <img src={state.profile.avatar} alt="" /> : initial(profileName)}
            </div>
            <div>
              <p className="mycard-name">{profileName}</p>
              <p className="mycard-sub">Handicap Index</p>
            </div>
          </div>
          <Gauge value={badgeHandicap} />
        </div>
        <div className="stat-tile-row">
          <div className="stat-tile">
            <p className="label">Avg score</p>
            <p className="value num">{avgScore}</p>
          </div>
          <div className="stat-tile">
            <p className="label">Last round</p>
            <p className="value num">{lastRoundScore ?? "—"}</p>
          </div>
        </div>
        {state.rounds.length > 1 && (
          <div className="row" style={{ marginTop: 10, gap: 6, justifyContent: "flex-start" }}>
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
      </div>

      <div className="card">
        <div className="row">
          <strong style={{ fontSize: 14 }}>Players</strong>
          <span className="muted small">{playerNames.length} of {1 + MAX_EXTRA_PLAYERS} added</span>
        </div>

        <div className="player-row-card">
          <div className="player-avatar">{initial(profileName)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{profileName}</div>
            {badgeHandicap != null && <div className="muted small">HCP {badgeHandicap}</div>}
          </div>
        </div>

        {extraPlayers.map((name, i) => (
          <div key={i}>
            <div className="player-row-card">
              <div className="player-avatar">{initial(name || `P${i + 2}`)}</div>
              <input
                type="text"
                value={name}
                onChange={(e) => updateExtra(i, e.target.value)}
                placeholder={`Player ${i + 2}`}
                style={{ flex: 1 }}
              />
              {state.golfers?.[name]?.handicapIndex != null && (
                <span className="muted small" style={{ flexShrink: 0 }}>HCP {state.golfers[name].handicapIndex}</span>
              )}
              <button
                className="player-chevron"
                aria-label="Swap in a recent player"
                onClick={() => setPickerOpenIdx(pickerOpenIdx === i ? null : i)}
              >
                {pickerOpenIdx === i ? "▲" : "▼"}
              </button>
              <button className="player-chevron" aria-label="Remove player" onClick={() => removeExtra(i)}>
                ✕
              </button>
            </div>
            {pickerOpenIdx === i && knownPlayers.length > 0 && (
              <div className="chips" style={{ marginBottom: 8 }}>
                {knownPlayers.map((n) => (
                  <button key={n} className="chip" onClick={() => updateExtra(i, n)}>
                    {n}{state.golfers[n]?.handicapIndex != null ? ` (${state.golfers[n].handicapIndex})` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {extraPlayers.length < MAX_EXTRA_PLAYERS && (
          <button className="btn ghost" style={{ marginTop: 8, height: 40 }} onClick={addExtra}>
            + Add player
          </button>
        )}

        {knownPlayers.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <button
              className="small"
              style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", padding: 0 }}
              onClick={() => setManagingPlayers((m) => !m)}
            >
              {managingPlayers ? "Done managing" : "Manage remembered players"}
            </button>
            {managingPlayers && (
              <div style={{ marginTop: 6 }}>
                {knownPlayers.map((n) => (
                  <div key={n} className="list-row row">
                    <span style={{ fontSize: 13 }}>
                      {n}{state.golfers[n]?.handicapIndex != null ? ` (${state.golfers[n].handicapIndex})` : ""}
                    </span>
                    <button
                      className="chip"
                      style={{ color: "var(--coral-delete)" }}
                      onClick={() => update(removeGolfer, n)}
                    >
                      🗑 Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={openCoursePicker}>
        Start Round
      </button>

      <div className="card">
        <strong style={{ fontSize: 14 }}>Your bag</strong>
        <div className="clubbar">
          {state.bag.slice(0, 8).map((c) => {
            const { yards } = clubAverage(c);
            const maxYards = Math.max(...state.bag.slice(0, 8).map((x) => clubAverage(x).yards), 1);
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
                <p className="small" style={{ color: "var(--gold)", marginTop: 10 }}>
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
                <button className="btn" style={{ marginTop: 16 }} onClick={() => start(selectedCourse)}>
                  Start round at {selectedCourse.name}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {profileOpen && (
        <div className="profile-screen">
          <div className="profile-topbar">
            <button className="profile-topbar-btn" onClick={() => setProfileOpen(false)} aria-label="Back">‹</button>
            <span className="profile-topbar-title">Profile</span>
            <button className="profile-save" onClick={saveProfile}>Save</button>
          </div>
          <div className="profile-body">
            <div className="row" style={{ gap: 12, justifyContent: "flex-start" }}>
              <button
                className="mycard-avatar"
                style={{ width: 56, height: 56, border: "none", cursor: "pointer" }}
                onClick={() => avatarInputRef.current?.click()}
                aria-label="Change profile photo"
              >
                {state.profile?.avatar ? <img src={state.profile.avatar} alt="" /> : initial(nameDraft)}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAvatarFile}
              />
              <div style={{ flex: 1 }}>
                <p className="field-label" style={{ margin: "0 0 6px" }}>Name</p>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="You"
                />
              </div>
            </div>

            <p className="field-label">Email Scorecards</p>
            <div className="card" style={{ marginTop: 0 }}>
              <input
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder="you@email.com"
              />
              <label className="checkbox-row" style={{ marginTop: 12 }}>
                <span
                  className={`checkbox-box ${state.profile?.emailScorecardOnFinish ? "checked" : ""}`}
                  onClick={() => update(setProfile, { emailScorecardOnFinish: !state.profile?.emailScorecardOnFinish })}
                >
                  {state.profile?.emailScorecardOnFinish ? "✓" : ""}
                </span>
                <span style={{ fontSize: 14 }}>Email me my scorecard after each round</span>
              </label>
            </div>

            <p className="field-label">Distance Units</p>
            <div className="segmented">
              <button className={distanceUnitDraft === "yards" ? "on" : ""} onClick={() => setDistanceUnitDraft("yards")}>Yards</button>
              <button className={distanceUnitDraft === "meters" ? "on" : ""} onClick={() => setDistanceUnitDraft("meters")}>Meters</button>
            </div>

            <p className="field-label">Wind Speed</p>
            <div className="segmented">
              <button className={windUnitDraft === "mph" ? "on" : ""} onClick={() => setWindUnitDraft("mph")}>mph</button>
              <button className={windUnitDraft === "kph" ? "on" : ""} onClick={() => setWindUnitDraft("kph")}>kph</button>
            </div>

            <p className="field-label">Handicap Index</p>
            <div className="card" style={{ marginTop: 0 }}>
              {handicapCalc ? (
                <>
                  <div className="row">
                    <span className="muted small">Calculated from your rounds</span>
                    <span className="muted small">{handicapCalc.roundsUsed} round{handicapCalc.roundsUsed === 1 ? "" : "s"}</span>
                  </div>
                  <p className="value num" style={{ fontSize: 28, margin: "4px 0 0", color: "var(--gold)" }}>
                    {handicapCalc.index}
                  </p>
                  <p className="muted small" style={{ margin: "2px 0 0" }}>
                    {handicapCalc.roundsUsed < 3
                      ? "Provisional — play more rounds with a linked course for a stable estimate."
                      : "Estimated (WHS-style) from your linked-course rounds — not an official handicap."}
                  </p>
                </>
              ) : (
                <>
                  <p className="muted small" style={{ marginTop: 0 }}>Manually update your handicap</p>
                  <div className="stepper">
                    <button onClick={() => setHandicapDraft((h) => (Math.round((parseFloat(h || 0) - 0.1) * 10) / 10).toFixed(1))}>−</button>
                    <span className="stepper-value num">{handicapDraft === "" ? "—" : handicapDraft}</span>
                    <button onClick={() => setHandicapDraft((h) => (Math.round((parseFloat(h || 0) + 0.1) * 10) / 10).toFixed(1))}>+</button>
                  </div>
                </>
              )}
            </div>

            <button className="btn" style={{ marginTop: 20 }} onClick={saveProfile}>
              Save
            </button>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--card-border)" }}>
              <strong style={{ fontSize: 14 }}>All scorecards</strong>
              <p className="muted small" style={{ marginTop: 4 }}>
                Email a compact summary of every round you've played ({state.rounds.length} so far).
              </p>
              <button className="btn ghost" style={{ marginTop: 8, height: 44 }} onClick={emailAllScorecards}>
                ✉ Email all scorecards
              </button>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--card-border)" }}>
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
              {importMsg && <p className="small" style={{ marginTop: 8, color: "var(--gold)" }}>{importMsg}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
