import { useEffect, useMemo, useState } from "react";
import {
  currentPosition,
  watchPosition,
  yardsBetween,
  bearingDegrees,
  elevationDeltaFeet,
  polygonCentroid,
  closestEdgeYards,
  farthestVertexYards,
  findConnectedFairway,
  findConnectedTee,
  minDistanceBetweenPolygonsM,
  metresToYards,
} from "../lib/geo.js";
import { fetchWeather, playsLike } from "../lib/playslike.js";
import {
  clubAverage,
  markShotStart,
  markShotEnd,
  setScoreForHole,
  setCurrentHole,
  nextHole,
  finishRound,
  roundStats,
} from "../lib/store.js";
import { buildMailto, formatRoundText } from "../lib/scorecardEmail.js";
import { distanceUnit, windUnit, convertDistance, distanceLabel } from "../lib/units.js";
import HoleView from "../components/HoleView.jsx";
import ScoreGrid from "../components/ScoreGrid.jsx";
import LogoMark from "../components/LogoMark.jsx";

const GREEN_STEPS = [
  { key: "front", label: "front of green" },
  { key: "middle", label: "middle (pin)" },
  { key: "back", label: "back of green" },
];

// Generous cutoff — this only exists to reject GPS glitches (e.g. an
// indoor multipath fix jumping miles away), not to second-guess a real
// long par 5 approach.
const MAX_GREEN_RANGE_YARDS = 700;

export default function Round({ state, update, goGames }) {
  const round = state.activeRound;
  const dUnit = distanceUnit(state);
  const wUnit = windUnit(state);
  const [clubId, setClubId] = useState(state.bag[4]?.id ?? state.bag[0]?.id);
  const [weather, setWeather] = useState(null);
  const [green, setGreen] = useState({ front: null, middle: null, back: null }); // manual fallback: GPS points the golfer walks and taps once per hole
  const [here, setHere] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [usedGreenIds, setUsedGreenIds] = useState(() => new Set());
  const [usedFairwayIds, setUsedFairwayIds] = useState(() => new Set());
  const [usedTeeIds, setUsedTeeIds] = useState(() => new Set());
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    // Continuous GPS — distances to the green should update as the golfer
    // walks, not just once when the screen opens. Weather is still a
    // one-shot fetch off the first fix (it doesn't change hole to hole).
    let stop = () => {};
    let gotWeather = false;
    watchPosition((pos) => {
      setHere(pos);
      if (!gotWeather) {
        gotWeather = true;
        fetchWeather(pos).then(setWeather).catch(() => {});
      }
    })
      .then((stopFn) => {
        stop = stopFn;
      })
      .catch(() => setMsg("GPS unavailable — distances need location access."));
    return () => stop();
  }, []);

  // Green/fairway/tee/hazard geometry was already fetched once when this
  // course was selected on Home (see Home.jsx's pickCourse) and lives on
  // the round object itself — no network call happens here, ever.
  const courseGreens = round?.greens ?? [];
  const courseFairways = round?.fairways ?? [];
  const courseTeeBoxes = round?.teeBoxes ?? [];
  const courseHazards = round?.hazards ?? [];

  // Nearest not-yet-played green to wherever the golfer is standing right
  // now. There's no reliable hole-number tag in the open data, so "nearest,
  // not already used this round" is the best available heuristic — the
  // manual override below exists for when it guesses wrong.
  const selectedGreen = useMemo(() => {
    if (!here || !courseGreens.length) return null;
    let best = null;
    let bestYards = Infinity;
    for (const g of courseGreens) {
      if (usedGreenIds.has(g.id)) continue;
      const centroid = polygonCentroid(g.points);
      const d = yardsBetween(here, centroid);
      if (d < bestYards) {
        bestYards = d;
        best = g;
      }
    }
    return bestYards <= MAX_GREEN_RANGE_YARDS ? best : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, courseGreens, usedGreenIds]);

  const autoDistances = useMemo(() => {
    if (!here || !selectedGreen) return null;
    const centroid = polygonCentroid(selectedGreen.points);
    return {
      front: closestEdgeYards(here, selectedGreen.points),
      middle: yardsBetween(here, centroid),
      back: farthestVertexYards(here, selectedGreen.points),
      // Real terrain elevation (Copernicus DEM, fetched once at course
      // selection) for the green — far steadier than a single GPS altitude
      // reading, and the only way auto-detected greens get an elevation
      // figure at all (a bare polygon centroid has no altitude of its own).
      middlePoint: { ...centroid, altitude: selectedGreen.elevationM },
    };
  }, [here, selectedGreen]);

  // No route=golf relation exists in the open data to say "this fairway/
  // tee belongs to this green" (checked live — empty even at Pebble
  // Beach), so both are found geometrically: nearest not-yet-used fairway
  // touching the green, then nearest not-yet-used tee touching that
  // fairway. Shows the whole hole when it works, just the green when it
  // doesn't — never a guessed connection.
  const selectedFairway = useMemo(() => {
    if (!selectedGreen || !courseFairways.length) return null;
    return findConnectedFairway(selectedGreen, courseFairways, usedFairwayIds);
  }, [selectedGreen, courseFairways, usedFairwayIds]);

  const selectedTee = useMemo(() => {
    if (!selectedFairway || !courseTeeBoxes.length) return null;
    return findConnectedTee(selectedFairway, courseTeeBoxes, usedTeeIds);
  }, [selectedFairway, courseTeeBoxes, usedTeeIds]);

  // Hazards relevant to what's currently on screen — boundary-to-boundary
  // proximity to the green itself, or to the fairway already matched to
  // this hole (a fairway bunker), not a raw radius circle around the
  // golfer or green centroid. A radius circle on a dense course like
  // Pebble Beach pulls in bunkers that belong to the next hole over;
  // checking against the actual matched fairway polygon doesn't.
  const nearbyHazards = useMemo(() => {
    if (!selectedGreen || !courseHazards.length) return [];
    return courseHazards.filter((h) => {
      const nearGreen = metresToYards(minDistanceBetweenPolygonsM(selectedGreen.points, h.points)) <= 40;
      const nearFairway = selectedFairway
        ? metresToYards(minDistanceBetweenPolygonsM(selectedFairway.points, h.points)) <= 15
        : false;
      return nearGreen || nearFairway;
    });
  }, [selectedGreen, selectedFairway, courseHazards]);

  const usingAuto = !!autoDistances && !manualOverride;
  const manuallyMarked = green.front && green.middle && green.back;

  const distances = usingAuto
    ? { front: autoDistances.front, middle: autoDistances.middle, back: autoDistances.back }
    : {
        front: here && green.front ? yardsBetween(here, green.front) : null,
        middle: here && green.middle ? yardsBetween(here, green.middle) : null,
        back: here && green.back ? yardsBetween(here, green.back) : null,
      };
  const middlePoint = usingAuto ? autoDistances.middlePoint : green.middle;

  const adjusted = useMemo(() => {
    if (distances.middle == null || !here || !middlePoint) return null;
    const bearing = bearingDegrees(here, middlePoint);
    const elevationDeltaFt = elevationDeltaFeet(here, middlePoint);
    return playsLike({ yards: distances.middle, shotBearingDeg: bearing, weather, elevationDeltaFt, windUnit: wUnit, distanceUnit: dUnit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distances.middle, weather, here, middlePoint]);

  // Nearest-average-carry club to the distance actually needed right now —
  // purely a suggestion; tapping "Mark shot" still uses whatever club is
  // selected in the dropdown below, never this automatically.
  const recommended = useMemo(() => {
    if (distances.middle == null) return null;
    let best = null;
    let bestDiff = Infinity;
    for (const c of state.bag) {
      const diff = Math.abs(clubAverage(c).yards - distances.middle);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = c;
      }
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.bag, distances.middle]);

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
  const recommendedAvg = recommended ? clubAverage(recommended) : null;

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

  function advanceHole() {
    if (usingAuto && selectedGreen) {
      setUsedGreenIds((s) => new Set([...s, selectedGreen.id]));
      if (selectedFairway) setUsedFairwayIds((s) => new Set([...s, selectedFairway.id]));
      if (selectedTee) setUsedTeeIds((s) => new Set([...s, selectedTee.id]));
    }
    resetGreen();
    setManualOverride(false);
    update(nextHole);
  }

  function retreatHole() {
    resetGreen();
    setManualOverride(false);
    update(setCurrentHole, round.currentHole - 1);
  }

  const last = round.lastLogged;
  const greenReady = usingAuto || manuallyMarked;

  return (
    <>
      <div className="game-topbar">
        <LogoMark size={36} />
        <div className="game-topbar-hole">
          <strong>Hole {round.currentHole}</strong>
          <span>Par {hole?.par ?? 4} · {round.course}</span>
        </div>
        <button className="hole-nav-btn" aria-label="Previous hole" onClick={retreatHole} disabled={round.currentHole <= 1}>
          ‹
        </button>
        <button className="hole-nav-btn" aria-label="Next hole" onClick={advanceHole} disabled={round.currentHole >= 18}>
          ›
        </button>
      </div>

      <div className="card">
        <div className="row">
          <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted-55)" }}>
            Distance to Pin
          </strong>
          <div style={{ display: "flex", gap: 6 }}>
            {greenReady && (
              <span className="chip sky" style={{ padding: "3px 10px", height: "auto", cursor: "default" }}>
                {usingAuto ? "📡 Auto" : "📍 Manual"}
              </span>
            )}
            {usingAuto && (
              <button className="chip sky" style={{ padding: "3px 10px", height: "auto" }} onClick={() => setManualOverride(true)}>
                Not this green?
              </button>
            )}
            {!usingAuto && manuallyMarked && (
              <button className="chip sky" style={{ padding: "3px 10px", height: "auto" }} onClick={resetGreen}>
                Re-pin
              </button>
            )}
            {!usingAuto && manualOverride && autoDistances && (
              <button className="chip sky" style={{ padding: "3px 10px", height: "auto" }} onClick={() => setManualOverride(false)}>
                Use auto-detected
              </button>
            )}
          </div>
        </div>

        {greenReady ? (
          <>
            <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "stretch" }}>
              <div style={{ flex: 1.3, minWidth: 0 }}>
                <HoleView
                  greenPoints={usingAuto ? selectedGreen.points : null}
                  fairwayPoints={usingAuto ? selectedFairway?.points : null}
                  teePoints={usingAuto ? selectedTee?.points : null}
                  hazards={usingAuto ? nearbyHazards : []}
                  here={here}
                  isReal={usingAuto}
                />
              </div>
              <div className="distance-readouts" style={{ width: 84, flexShrink: 0, justifyContent: "space-between" }}>
                <div className="distance-readout">
                  <p className="label">Back</p>
                  <p className="value num">{convertDistance(distances.back, dUnit) ?? "–"}</p>
                </div>
                <div className="distance-readout mid">
                  <p className="label">Middle</p>
                  <p className="value num">{convertDistance(distances.middle, dUnit) ?? "–"}</p>
                </div>
                <div className="distance-readout">
                  <p className="label">Front</p>
                  <p className="value num">{convertDistance(distances.front, dUnit) ?? "–"}</p>
                </div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
              <span className="small" style={{ opacity: 0.8 }}>Plays like ({distanceLabel(dUnit)})</span>
              <span className="num" style={{ fontSize: 32, fontWeight: 700, color: "var(--gold)" }}>
                {convertDistance(adjusted ? adjusted.adjusted : distances.middle, dUnit) ?? "—"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {adjusted?.parts.length ? (
                adjusted.parts.map((p) => {
                  const disp = convertDistance(Math.abs(p.yards), dUnit) * Math.sign(p.yards || 1);
                  return (
                    <span key={p.label} className="chip sky" style={{ height: "auto", padding: "5px 10px" }}>
                      {p.label} {disp > 0 ? "+" : ""}
                      {disp} ({p.detail})
                    </span>
                  );
                })
              ) : (
                <span className="small" style={{ opacity: 0.75 }}>Calm conditions</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="small" style={{ opacity: 0.85, marginTop: 8 }}>
              {manualOverride && autoDistances
                ? "Switched to manual marking — tap \"Use auto-detected\" above to switch back."
                : courseGreens.length
                  ? "No mapped green nearby yet — walk to the green once per hole and tap as you reach each spot."
                  : "This course's green isn't mapped — walk to the green once per hole and tap as you reach each spot."}
            </p>
            <button className="btn" style={{ marginTop: 10 }} onClick={() => markGreenPoint(nextGreenStep.key)}>
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

      <div className="dual-panel">
        <div className="card spotlight">
          <p className="panel-label">Recommended Club</p>
          <p className="panel-value">{recommended ? recommended.name : "—"}</p>
          <p className="panel-sub">{recommendedAvg ? `${convertDistance(recommendedAvg.yards, dUnit)} ${distanceLabel(dUnit)} avg` : "Walk closer for a suggestion"}</p>
        </div>
        <div className="card spotlight">
          <p className="panel-label">Last Shot</p>
          <p className="panel-value num">{last ? `${convertDistance(last.yards, dUnit)} ${distanceLabel(dUnit)}` : "—"}</p>
          <select value={clubId} onChange={(e) => !pending && setClubId(e.target.value)} disabled={!!pending} style={{ marginTop: 6, height: 34, fontSize: 12 }}>
            {state.bag.map((c) => (
              <option key={c.id} value={c.id}>{c.short} · {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn" style={{ marginTop: 14 }} onClick={onMark} disabled={busy}>
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
              ? `Logged: added to your averages`
              : `Ignored a ${convertDistance(last.yards, dUnit)} ${distanceLabel(dUnit)} reading (out of range)`
            : avg
              ? `${selected.name} carries ${convertDistance(avg.yards, dUnit)} ${distanceLabel(dUnit)} ${avg.tracked ? `on average (${avg.tracked} tracked)` : "(your estimate — track shots to learn it)"}`
              : "One tap here, one tap at your ball"}
      </p>
      {msg && <p className="muted small" style={{ textAlign: "center" }}>{msg}</p>}

      <ScoreGrid
        round={round}
        editable
        currentHole={round.currentHole}
        onScoreChange={(holeNumber, player, strokes, par) => update(setScoreForHole, holeNumber, player, strokes, par)}
      />

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={goGames}>
          🪙 Games
        </button>
      </div>

      {round.currentHole >= 2 && (
        <button
          className="btn ghost"
          style={{ marginTop: 8, borderStyle: "solid" }}
          onClick={() => {
            const profile = state.profile;
            if (profile?.emailScorecardOnFinish && profile?.email) {
              window.location.href = buildMailto({
                to: profile.email,
                subject: `Scorecard — ${round.course}`,
                body: formatRoundText(round),
              });
            }
            update(finishRound);
          }}
        >
          Finish round
        </button>
      )}
    </>
  );
}
