import { useEffect, useRef, useState } from "react";
import { currentPosition, yardsBetween, bearingDegrees, closestEdgeYards } from "../lib/geo.js";
import { fetchCourseHoles } from "../lib/courseApi.js";
import { playsLike } from "../lib/playslike.js";
import { distanceUnit, convertDistance } from "../lib/units.js";
import HoleMap from "../components/HoleMap.jsx";

export default function Game({ state, update }) {
  const course = state.profile?.currentCourse || null;
  const activeRound = state.activeRound || null;
  const [holeIdx, setHoleIdx] = useState(activeRound?.currentHole || 0);
  const [distances, setDistances] = useState({ back: null, middle: null, front: null });
  const [playingLike, setPlayingLike] = useState({ back: null, middle: null, front: null });
  const [playerPos, setPlayerPos] = useState(null);
  const [lastShot, setLastShot] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [clubPickerOpen, setClubPickerOpen] = useState(false);
  const [selectedNine, setSelectedNine] = useState("front");

  // Fetch hole data if course present
  const holes = course?.holes || [];
  const hole = holes[holeIdx] || null;
  const par = hole?.par || 4;

  // Live GPS tracking
  useEffect(() => {
    if (!course || showMap) return;
    let mounted = true;
    const tick = async () => {
      try {
        const pos = await currentPosition();
        if (!mounted || !course.greens?.length) { setPlayerPos(pos); return; }
        const green = course.greens[0];
        const pts = green.points;
        const backYards = yardsBetween(pos, pts[pts.length - 1] || pts[0]);
        const midYards = yardsBetween(pos, { lat: pts.reduce((s,p)=>s+p.lat,0)/pts.length, lng: pts.reduce((s,p)=>s+p.lon,0)/pts.length });
        const frontYards = closestEdgeYards(pos, pts);
        const plays = {
          back:  Math.round(midYards === 0 ? 0 : midYards * 0.94),
          middle: Math.round(midYards),
          front: Math.round(frontYards === 0 ? 0 : frontYards * 1.08),
        };
        if (mounted) {
          setPlayerPos(pos);
          setDistances({ back: Math.round(backYards), middle: Math.round(midYards), front: Math.round(frontYards) });
          setPlayingLike(plays);
        }
      } catch {}
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { mounted = false; clearInterval(id); };
  }, [course, holeIdx, showMap]);

  // Score storage in round
  const scoreGrid = activeRound?.scorecard?.scores?.[0] || [];

  const updateScore = (h, value) => {
    if (!activeRound) return;
    const next = scoreGrid.slice();
    next[h] = value;
    update(round => {
      const sc = { ...(round.scorecard || {}) };
      sc.scores = [...(sc.scores || [])];
      sc.scores[0] = next;
      return { ...round, scorecard: sc };
    });
  };

  const logClub = (yardage, clubId) => {
    const history = [...(state.clubHistory || [])];
    history.unshift({ clubId, yards: yardage, at: Date.now() });
    update(s => ({ ...s, clubHistory: history }));
  };

  const cycleScore = (h) => {
    const cur = scoreGrid[h];
    const next = cur == null ? par : cur === par + 3 ? par - 2 : cur + 1;
    updateScore(h, next);
  };

  const prevNine = () => setSelectedNine(n => n === "front" ? "back" : "front");

  // Render
  if (showMap) {
    return (
      <HoleMap
        courseCache={{ [course?.id]: course }}
        courseId={course?.id}
        userGreenForCourse={null}
        onSaveUserGreen={() => {}}
        onClearUserGreen={() => {}}
        onClose={() => setShowMap(false)}
      />
    );
  }

  if (!course) {
    return <EmptyState title="No course selected" subtitle="Pick a course on the Home tab first." />;
  }

  const frontYards = distances.front || par * 30;
  const playsFront = playingLike.front || frontYards;
  const midYards = distances.middle || par * 35;
  const playsMid = playingLike.middle || midYards;
  const backYards = distances.back || par * 45;
  const playsBack = playingLike.back || backYards;

  // Recommended club (simplest heuristic)
  const recommended = recommendClub(playsMid, state);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "#0F2419" }}>
      {/* Top bar with logo + hole info + nav */}
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>Hole {holeIdx + 1}</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              Par {par} · {course.name || ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setHoleIdx(i => Math.max(0, i-1))}
              style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(201,169,78,0.2)", border: "none", color: "#C9A94E", cursor: "pointer", fontSize: 18 }}>
              ‹
            </button>
            <button onClick={() => setHoleIdx(i => Math.min(holes.length - 1, i+1))}
              style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(201,169,78,0.2)", border: "none", color: "#C9A94E", cursor: "pointer", fontSize: 18 }}>
              ›
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Distance to Pin card with thumbnail */}
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201,169,78,0.25)", borderRadius: 20,
          padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {/* Thumbnail that opens Map View */}
            <div onClick={() => setShowMap(true)}
              style={{ width: 90, height: 90, borderRadius: 12, flexShrink: 0, cursor: "pointer",
                background: "linear-gradient(160deg, #2d5a3f, #162f21)",
                border: "1px solid rgba(201,169,78,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#C9A94E", fontSize: 22 }}>
              
            </div>
            {/* GPS + Plays Like yards */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <DistRow label="Back"   gps={backYards} adj={playsBack} />
              <DistRow label="Middle" gps={midYards} adj={playsMid} mid />
              <DistRow label="Front"  gps={frontYards} adj={playsFront} />
            </div>
          </div>
        </div>

        {/* Recommended Club + Last Shot */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <GoldBorderCard title="Recommended Club" subtitle={`${recommended.name} · ${recommended.yards} yd avg`} />
          <button onClick={() => setClubPickerOpen(true)}
            style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
              border: "2.5px solid #C9A94E", borderRadius: 20, padding: "13px 12px",
              boxShadow: "0 8px 20px rgba(201,169,78,0.15)", cursor: "pointer", textAlign: "left" }}>
            <div style={{ color: "rgba(245,241,230,0.6)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Last Shot</div>
            <div style={{ color: "#C9A94E", fontSize: 20, fontWeight: 800, marginTop: 4 }}>
              {lastShot ? `${lastShot.yards} · ${lastShot.club}` : "265 yds · Driver ▾"}
            </div>
          </button>
        </div>

        {/* Scorecard section */}
        <div style={{ background: "linear-gradient(160deg, #1F6349, #143D2C)",
          borderRadius: 20, overflow: "hidden", marginTop: 6 }}>
          {/* Front/Back nine toggle */}
          <div style={{ display: "flex", gap: 4, padding: "10px", background: "#123822" }}>
            {["front", "back"].map(n => (
              <button key={n} onClick={() => setSelectedNine(n)}
                style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
                  background: selectedNine === n ? "#C9A94E" : "transparent",
                  color: selectedNine === n ? "#123822" : "rgba(245,241,230,0.6)",
                  fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>
                {n} 9
              </button>
            ))}
          </div>
          {/* Header */}
          <div style={{ display: "flex", padding: "6px 8px", background: "#123822",
            borderBottom: "1px solid rgba(201,169,78,0.2)" }}>
            <div style={{ width: 56, flexShrink: 0 }} />
            {range(9).map(i => (
              <div key={i} style={{ width: 28, textAlign: "center", fontSize: 10, fontWeight: 700,
                color: i + (selectedNine==="front"?1:10) === holeIdx+1 ? "#C9A94E" : "rgba(245,241,230,0.5)" }}>
                {i + (selectedNine==="front"?1:10)}
              </div>
            ))}
            <div style={{ width: 34, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(245,241,230,0.5)" }}>Out</div>
            <div style={{ width: 28, textAlign: "center", fontSize: 10, fontWeight: 700, color: "rgba(245,241,230,0.5)" }}>+/-</div>
          </div>
          {/* Score row */}
          <div style={{ display: "flex", padding: "6px 8px" }}>
            <div style={{ width: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#C9A94E", color: "#123822",
                fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {((state.profile?.user?.name || "Y")[0]).toUpperCase()}
              </div>
              <div style={{ color: "rgba(245,241,230,0.8)", fontSize: 10, fontWeight: 700 }}>You</div>
            </div>
            {range(9).map(i => {
              const h = i + (selectedNine === "front" ? 0 : 9);
              const s = scoreGrid[h];
              const hPar = holes[h]?.par || par;
              let chipStyle = {};
              let symbol = "";
              if (s != null) {
                if (s === hPar - 1) { chipStyle = { border: "1.5px solid #C9A94E", borderRadius: "50%" }; }
                else if (s === hPar + 1) { chipStyle = { background: "rgba(217,119,87,0.2)", border: "1.5px solid #D97757", borderRadius: 4 }; }
                else if (s < hPar - 1) { chipStyle = { border: "2.5px solid #C9A94E", borderRadius: "50%" }; symbol = "●"; }
                else if (s > hPar + 1) { chipStyle = { background: "rgba(217,119,87,0.2)", border: "1.5px solid #D97757", borderRadius: 4 }; }
              }
              const isCurrent = i + (selectedNine==="front"?1:10) === holeIdx+1;
              return (
                <div key={i} onClick={() => cycleScore(h)}
                  style={{ width: 28, textAlign: "center", padding: "4px 0", cursor: "pointer",
                    background: isCurrent ? "rgba(201,169,78,0.2)" : "transparent",
                    borderRadius: 6, ...chipStyle }}>
                  <div style={{ color: "#F5F1E6", fontSize: 11, fontWeight: 700 }}>
                    {symbol || (s ?? "")}
                  </div>
                </div>
              );
            })}
            <div style={{ width: 34, textAlign: "center", color: "#C9A94E", fontSize: 11, fontWeight: 800 }}>
              {nineTotal(scoreGrid, selectedNine === "front" ? 0 : 9)}
            </div>
            <div style={{ width: 28, textAlign: "center", color: "rgba(245,241,230,0.7)", fontSize: 11, fontWeight: 700 }}>
              {nineParDelta(scoreGrid, holes, selectedNine === "front" ? 0 : 9)}
            </div>
          </div>
        </div>
      </div>

      {/* Club picker modal */}
      {clubPickerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#12281B", width: "100%", maxHeight: "70vh", overflow: "auto",
            borderTop: "1px solid rgba(201,169,78,0.2)", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: "#F5F1E6", fontWeight: 800, fontSize: 17 }}>Select club</div>
              <button onClick={() => setClubPickerOpen(false)}
                style={{ background: "none", border: "none", color: "#C9A94E",
                  fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
            {["Driver","3 Wood","5 Wood","Hybrid","4 Iron","5 Iron","6 Iron","7 Iron","8 Iron","9 Iron","PW","GW","SW","Putter"].map(n => (
              <button key={n} onClick={() => { setLastShot({ yards: midYards, club: n }); setClubPickerOpen(false); }}
                style={{ width: "100%", textAlign: "left", padding: "12px 0", background: "none",
                  border: "none", borderBottom: "1px solid rgba(201,169,78,0.1)",
                  color: "#F5F1E6", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DistRow({ label, gps, adj, mid }) {
  return (
    <div style={{ background: mid ? "rgba(201,169,78,0.18)" : "transparent",
      borderRadius: 8, padding: "6px 8px", textAlign: mid ? "center" : "left" }}>
      <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: "#F5F1E6", fontWeight: 800, fontSize: mid ? 20 : 15 }}>{gps}</div>
      <div style={{ color: "#4ADE80", fontSize: 10, fontWeight: 700 }}>{adj} ≈ carry</div>
    </div>
  );
}

function GoldBorderCard({ title, subtitle }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
      border: "2.5px solid #C9A94E", borderRadius: 20, padding: "13px 12px",
      boxShadow: "0 8px 20px rgba(201,169,78,0.15)" }}>
      <div style={{ color: "rgba(245,241,230,0.6)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
      <div style={{ color: "#C9A94E", fontSize: 20, fontWeight: 800, marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0F2419", padding: 30, textAlign: "center" }}>
      <div>
        <div style={{ color: "#C9A94E", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{title}</div>
        <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 14, lineHeight: 1.5 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10,
      background: "linear-gradient(160deg, #1B3B26, #0F2419)",
      border: "1.3px solid rgba(201,169,78,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 27, height: 27, borderRadius: "50%",
        background: "radial-gradient(circle, #fff, #E4E4DE)" }}>
        <span style={{ position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#123822", fontSize: 9, fontWeight: 700,
          fontFamily: "Space Grotesk, system-ui, sans-serif" }}>MY</span>
      </div>
    </div>
  );
}

function range(n) { return Array.from({ length: n }, (_, i) => i); }

function recommendClub(yards, state) {
  // Simple yardage ladder — replace with state.clubHistory when available
  const ladder = [
    { name: "Putter",    min: 0,   max: 5 },
    { name: "SW",        min: 5,   max: 30 },
    { name: "GW",        min: 30,  max: 60 },
    { name: "PW",        min: 60,  max: 95 },
    { name: "9 Iron",    min: 95,  max: 115 },
    { name: "8 Iron",    min: 115, max: 130 },
    { name: "7 Iron",    min: 130, max: 145 },
    { name: "6 Iron",    min: 145, max: 160 },
    { name: "5 Iron",    min: 160, max: 175 },
    { name: "4 Iron",    min: 175, max: 190 },
    { name: "Hybrid",    min: 190, max: 205 },
    { name: "5 Wood",    min: 205, max: 220 },
    { name: "3 Wood",    min: 220, max: 240 },
    { name: "Driver",    min: 240, max: 400 },
  ];
  for (const c of ladder) if (yards >= c.min && yards < c.max) return { ...c, yards: Math.round((c.min + c.max) / 2) };
  return { name: "Driver", yards: 240 };
}

function nineTotal(grid, offset) {
  return range(9).reduce((s, i) => s + (grid[offset + i] || 0), 0);
}
function nineParDelta(grid, holes, offset) {
  let d = 0;
  for (let i = 0; i < 9; i++) {
    const s = grid[offset + i];
    const p = holes[offset + i]?.par || 4;
    if (s != null) d += s - p;
  }
  return d === 0 ? "E" : (d > 0 ? "+" + d : d);
}
