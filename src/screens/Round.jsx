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
} from "../lib/geo.js";
import { fetchCourseGreens } from "../lib/greenApi.js";
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
import { buildMailto, formatRoundText } from "../lib/scorecardEmail.js";
import { distanceUnit, windUnit, convertDistance, distanceLabel } from "../lib/units.js";
import GreenView from "../components/GreenView.jsx";

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
  const [courseGreens, setCourseGreens] = useState([]); // real green polygons from OSM, fetched once per round
  const [usedGreenIds, setUsedGreenIds] = useState(() => new Set());
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

  useEffect(() => {
    // Real green boundary data, when this course happens to be mapped on
    // OpenStreetMap — fetched once per round, covering the whole course.
    if (round?.courseLat == null || round?.courseLng == null) return;
    fetchCourseGreens({ lat: round.courseLat, lng: round.courseLng, radiusM: 2500 }).then(setCourseGreens);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.courseLat, round?.courseLng]);

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
  }, [here, courseGreens, usedGreenIds]);

  const autoDistances = useMemo(() => {
    if (!here || !selectedGreen) return null;
    const centroid = polygonCentroid(selectedGreen.points);
    return {
      front: closestEdgeYards(here, selectedGreen.points),
      middle: yardsBetween(here, centroid),
      back: farthestVertexYards(here, selectedGreen.points),
      middlePoint: centroid,
    };
  }, [here, selectedGreen]);

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
    return playsLike({ yards: distances.middle, shotBearingDeg: bearing, weather, elevationDeltaFt, windUnit: wUnit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distances.middle, weather, here, middlePoint]);

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

  function advanceHole() {
    if (usingAuto && selectedGreen) {
      setUsedGreenIds((s) => new Set([...s, selectedGreen.id]));
    }
    resetGreen();
    setManualOverride(false);
    update(nextHole);
  }

  const last = round.lastLogged;
  const greenReady = usingAuto || manuallyMarked;

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
          <div style={{ display: "flex", gap: 6 }}>
            {greenReady && (
              <span className="chip sky" style={{ padding: "3px 10px", height: "auto", cursor: "default" }}>
                {usingAuto ? "📡 Auto" : "📍 Manual"}
              </span>
            )}
            {usingAuto && (
              <button
                className="chip sky"
                style={{ padding: "3px 10px", height: "auto" }}
                onClick={() => setManualOverride(true)}
              >
                Not this green?
              </button>
            )}
            {!usingAuto && manuallyMarked && (
              <button
                className="chip sky"
                style={{ padding: "3px 10px", height: "auto" }}
                onClick={resetGreen}
              >
                Re-pin
              </button>
            )}
            {!usingAuto && manualOverride && autoDistances && (
              <button
                className="chip sky"
                style={{ padding: "3px 10px", height: "auto" }}
                onClick={() => setManualOverride(false)}
              >
                Use auto-detected
              </button>
            )}
          </div>
        </div>

        {greenReady ? (
          <>
            <GreenView
              points={usingAuto ? selectedGreen.points : null}
              here={here}
              isReal={usingAuto}
              front={convertDistance(distances.front, dUnit)}
              middle={convertDistance(distances.middle, dUnit)}
              back={convertDistance(distances.back, dUnit)}
            />
            <div className="row" style={{ marginTop: 14, alignItems: "flex-end" }}>
              <span className="small" style={{ opacity: 0.8 }}>Plays like ({distanceLabel(dUnit)})</span>
              <span className="num" style={{ fontSize: 32, fontWeight: 600, color: "var(--gold-200)" }}>
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
            <p className="small" style={{ opacity: 0.85, marginTop: 4 }}>
              {manualOverride && autoDistances
                ? "Switched to manual marking — tap \"Use auto-detected\" above to switch back."
                : courseGreens.length
                  ? "No mapped green nearby yet — walk to the green once per hole and tap as you reach each spot."
                  : "This course's green isn't mapped — walk to the green once per hole and tap as you reach each spot."}
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
            {selected.name} carries {convertDistance(avg.yards, dUnit)} {distanceLabel(dUnit)}{" "}
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
              ? `Logged: ${state.bag.find((c) => c.id === last.clubId)?.short} · ${convertDistance(last.yards, dUnit)} ${distanceLabel(dUnit)} — added to your averages`
              : `Ignored a ${convertDistance(last.yards, dUnit)} ${distanceLabel(dUnit)} reading (out of range)`
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
        <button className="btn ghost" style={{ flex: 1 }} onClick={advanceHole}>
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
