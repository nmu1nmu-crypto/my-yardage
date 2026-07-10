import { useState, useMemo } from "react";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees } from "../lib/courseApi.js";
import { fetchCourseGeometry } from "../lib/greenApi.js";
import { setProfile, setCurrentCourse, cacheCourseData } from "../lib/store.js";

const UK_FAVORITES = [
  { id: "woolston-manor", name: "Woolston Manor Golf & Country Club", city: "Warrington", state: "UK", lat: 53.4080, lng: -2.5460 },
];

export default function Home({ state, update, onOpenTab }) {
  const [showProfile, setShowProfile] = useState(false);
  const [picking, setPicking] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyMsg, setNearbyMsg] = useState("");
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [pickerTab, setPickerTab] = useState("nearby");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const profile = state.profile || {};
  const player = profile.user || { name: "Alex", handicap: 14.2, avgScore: 88.4, lastRoundScore: 85 };
  const course = profile.currentCourse;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const openCoursePicker = async () => {
    setPicking(true); setPickerTab("nearby"); setNearby([]); setSearchResults([]);
    setNearbyBusy(true); setNearbyMsg(""); setSearchQuery("");
    try {
      const pos = await currentPosition();
      let courses = [];
      for (const mi of [25, 50, 100]) {
        courses = await searchCourses({ lat: pos.lat, lng: pos.lon, radiusMi: mi, limit: 50 });
        if (courses.length >= 20) break;
      }
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 3958.8; const uLat = toRad(pos.lat), uLon = toRad(pos.lon);
      courses.sort((a, b) => {
        const aLat = toRad(a.lat ?? a.latitude ?? 0), aLon = toRad(a.lng ?? a.longitude ?? 0);
        const bLat = toRad(b.lat ?? b.latitude ?? 0), bLon = toRad(b.lng ?? b.longitude ?? 0);
        const dA = Math.sin((aLat-uLat)/2)**2 + Math.cos(uLat)*Math.cos(aLat)*Math.sin((aLon-uLon)/2)**2;
        const dB = Math.sin((bLat-uLat)/2)**2 + Math.cos(uLat)*Math.cos(bLat)*Math.sin((bLon-uLon)/2)**2;
        return 2*R*Math.asin(Math.sqrt(dA)) - 2*R*Math.asin(Math.sqrt(dB));
      });
      const favIds = new Set(UK_FAVORITES.map((f) => f.id));
      setNearby([...UK_FAVORITES, ...courses.filter((c) => !favIds.has(c.id))]);
      if (!courses.length) setNearbyMsg("No courses near you — try searching or pick from UK favourites.");
    } catch { setNearbyMsg("Couldn't read GPS. Try searching instead."); }
    setNearbyBusy(false);
  };

  const pickCourse = async (c) => {
    setLoadingCourse(true);
    const lat = c.lat ?? c.latitude ?? null, lng = c.lng ?? c.longitude ?? null;
    const cached = state.courseCache?.[c.id];
    let holes, tees, greens, fairways, teeBoxes, hazards;
    if (cached) ({ holes, tees, greens, fairways, teeBoxes, hazards } = cached);
    else {
      try {
        const [h, t, geometry] = await Promise.all([fetchCourseHoles(c.id), fetchCourseTees(c.id), fetchCourseGeometry({ lat, lng })]);
        holes = h; tees = t; greens = geometry.greens; fairways = geometry.fairways; teeBoxes = geometry.teeBoxes; hazards = geometry.hazards;
        update(cacheCourseData, c.id, { holes, tees, greens, fairways, teeBoxes, hazards, lat, lng });
      } catch { holes = []; tees = []; greens = []; fairways = []; teeBoxes = []; hazards = []; }
    }
    const fullCourse = { id: c.id, name: c.name, city: c.city, state: c.state, lat, lng, holes, tees, greens, fairways, teeBoxes, hazards };
    update(setCurrentCourse, fullCourse); update(setProfile, "currentCourseId", c.id);
    setLoadingCourse(false); setPicking(false);
  };

  const updatePlayer = (field, value) => update(setProfile, "user", { ...(profile.user || {}), [field]: value });

  if (showProfile) return <ProfileModal user={player} onUpdate={updatePlayer} onSave={() => setShowProfile(false)} />;
  if (picking) return <CoursePicker tab={pickerTab} setTab={setPickerTab} nearby={nearby} nearbyBusy={nearbyBusy} nearbyMsg={nearbyMsg} query={searchQuery} setQuery={setSearchQuery} onSelect={(c) => pickCourse(c)} onClose={() => setPicking(false)} loadingCourse={loadingCourse} />;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "#0F2419" }}>
      {/* HERO */}
      <div style={{ position: "relative", height: 280, background: "linear-gradient(160deg, #2d6e4a 0%, #0F2419 100%)", overflow: "hidden" }}>
        {/* Course photo substitute (placeholder gradient) */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.4,
          background: "radial-gradient(ellipse at 50% 70%, rgba(45,110,74,0.7), transparent 70%)" }} />
        {/* Top scrim */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54,
          background: "linear-gradient(180deg, #0F2419 0%, transparent 100%)" }} />

        {/* Top bar: greeting + profile button */}
        <div style={{ position: "absolute", top: 66, left: 20, right: 20, zIndex: 2, display: "flex", justifyContent: "space-between", itemsAlign: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
              {greeting()}, {player.name || "Alex"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff",
              textShadow: "0 2px 8px rgba(0,0,0,0.5)", marginTop: 4, maxWidth: 220 }}>
              {course?.name || "Cypress Point GC"}
            </div>
          </div>
          <button onClick={() => setShowProfile(true)}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2" />
              <path d="M4 21v-1a6 6 0 0116 0v1" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Bottom scrim */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
          background: "linear-gradient(0deg, #0F2419 0%, transparent 100%)" }} />
      </div>

      {/* MY CARD — overlaps hero by -28px, gold border, dark gradient */}
      <div style={{ margin: "-28px 20px 0",
        background: "linear-gradient(160deg, #1B3B26, #12281B)",
        border: "1px solid rgba(201,169,78,0.25)",
        borderRadius: 20, padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar */}
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1B3B26", fontWeight: 700, fontSize: 20 }}>
            {(player.name || "Y")[0].toUpperCase()}
          </div>
          {/* Name + Handicap label */}
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 16 }}>You</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              Handicap Index
            </div>
          </div>
          {/* GAUGE */}
          <HandicapGauge value={player.handicap ?? 14.2} size={58} maxVal={54} />
        </div>
        {/* Stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <StatTile label="Avg Score" value={player.avgScore ?? "—"} />
          <StatTile label="Last Round" value={player.lastRoundScore ?? "—"} />
        </div>
      </div>

      {/* PLAYERS */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 16 }}>Players</div>
          <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 12, fontWeight: 600 }}>1 of 1 added</div>
        </div>
        <PlayerRow
          name={player.name || "You"}
          handicap={player.handicap}
          initials={(player.name || "Y")[0].toUpperCase()}
        />
      </div>

      {/* START ROUND CTA */}
      <div style={{ padding: "0 20px", marginTop: 18 }}>
        <button onClick={() => onOpenTab("game")}
          style={{ width: "100%", background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            border: "none", borderRadius: 999, padding: "16px 0",
            color: "#1B3B26", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
          Start Round
        </button>
      </div>

      {!course && (
        <div style={{ padding: "16px 20px 0" }}>
          <button onClick={openCoursePicker}
            style={{ width: "100%", background: "rgba(201,169,78,0.1)",
              border: "1px dashed rgba(201,169,78,0.3)",
              borderRadius: 14, padding: 12, color: "#C9A94E", fontWeight: 700,
              fontSize: 14, cursor: "pointer", textAlign: "center" }}>
            + Pick a Course
          </button>
        </div>
      )}
    </div>
  );
}

// HANDICAP GAUGE: proper ring with value in center
function HandicapGauge({ value, size, maxVal = 54 }) {
  const r = (size - 8) / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / maxVal));
  const dash = C * frac;
  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(201,169,78,0.2)" strokeWidth="4" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="#C9A94E" strokeWidth="4"
          strokeDasharray={`${dash} ${C - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        color: "#F5F1E6", fontWeight: 800, fontSize: 16 }}>
        {typeof value === "number" ? value.toFixed(1) : value}
      </div>
    </div>
  );
}

// STAT TILE: big number with label below
function StatTile({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: "#F5F1E6", fontWeight: 800, fontSize: 22 }}>{value}</div>
      <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600, marginTop: 1 }}>{label}</div>
    </div>
  );
}

// PLAYER ROW
function PlayerRow({ name, handicap, initials, onExpand }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
      border: "1px solid rgba(201,169,78,0.2)", borderRadius: 16,
      padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(160deg, #DDBB63, #B8933B)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#1B3B26", fontWeight: 700, fontSize: 15 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 14.5 }}>{name}</div>
        <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>
          HCP {handicap ?? "—"}
        </div>
      </div>
      <button onClick={onExpand}
        style={{ width: 22, height: 22, borderRadius: "50%",
          background: "rgba(201,169,78,0.2)", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: onExpand ? "pointer" : "default" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M9 6L15 12L9 18" stroke="#C9A94E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

// PROFILE MODAL
function ProfileModal({ user, onUpdate, onSave }) {
  const [name, setName] = useState(user.name || "Alex");
  const [email, setEmail] = useState(user.email || "");
  const [emailOptIn, setEmailOptIn] = useState(user.emailOptIn ?? true);
  const [units, setUnits] = useState(user.units || "yards");
  const [hcap, setHcap] = useState(user.handicap ?? 14.2);

  const save = () => {
    if (onUpdate) {
      onUpdate("name", name); onUpdate("email", email);
      onUpdate("emailOptIn", emailOptIn); onUpdate("units", units);
      onUpdate("handicap", hcap);
      onUpdate("avgScore", user.avgScore ?? 88.4);
      onUpdate("lastRoundScore", user.lastRoundScore);
    }
    onSave();
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 40, background: "#0F2419" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <button onClick={save}
          style={{ background: "none", border: "none", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6L9 12L15 18" stroke="#C9A94E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ color: "#F5F1E6", fontWeight: 800, fontSize: 17 }}>Profile</div>
        <button onClick={save}
          style={{ background: "none", border: "none", color: "#C9A94E",
            fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Save
        </button>
      </div>

      <div style={{ padding: "20px 20px 10px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1B3B26", fontWeight: 700, fontSize: 22, flexShrink: 0 }}>
            {(name || "Y")[0].toUpperCase()}
          </div>
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ flex: 1, background: "rgba(245,241,230,0.06)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 10,
              color: "#F5F1E6", padding: "10px 12px", fontSize: 15, fontWeight: 700, outline: "none" }}
            placeholder="Your name" />
        </div>

        {/* Email card */}
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201,169,78,0.2)", borderRadius: 20, padding: 16 }}>
          <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Email Scorecards</div>
          <input value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", background: "rgba(245,241,230,0.06)",
              border: "1px solid rgba(201,169,78,0.15)", borderRadius: 10,
              color: "#F5F1E6", padding: "10px 12px", fontSize: 13.5, outline: "none", boxSizing: "border-box" }}
            placeholder="you@email.com" />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, cursor: "pointer" }}>
            <div onClick={() => setEmailOptIn(!emailOptIn)}
              style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                background: emailOptIn ? "linear-gradient(160deg, #DDBB63, #B8933B)" : "transparent",
                border: "1.3px solid", borderColor: emailOptIn ? "#B8933B" : "rgba(245,241,230,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              {emailOptIn && <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 12L10 18L20 6" stroke="#1B3B26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>}
            </div>
            <div style={{ color: "rgba(245,241,230,0.85)", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
              Email me my scorecard after each round
            </div>
          </label>
        </div>

        {/* Distance Units */}
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201,169,78,0.2)", borderRadius: 20, padding: 16 }}>
          <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Distance Units</div>
          <div style={{ display: "flex", gap: 4, background: "rgba(245,241,230,0.06)", padding: 4, borderRadius: 999 }}>
            {["yards", "meters"].map(u => (
              <button key={u} onClick={() => setUnits(u)}
                style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
                  background: units === u ? "linear-gradient(160deg, #DDBB63, #B8933B)" : "transparent",
                  color: units === u ? "#1B3B26" : "rgba(245,241,230,0.7)",
                  fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Handicap Index */}
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201,169,78,0.2)", borderRadius: 20, padding: 16 }}>
          <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>
            Manually update your handicap
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setHcap(Number((hcap - 0.1).toFixed(1)))}
              style={{ width: 40, height: 40, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: "#C9A94E", fontSize: 22, cursor: "pointer", fontWeight: 300 }}>
              −
            </button>
            <div style={{ flex: 1, textAlign: "center", color: "#F5F1E6",
              fontWeight: 800, fontSize: 26 }}>
              {typeof hcap === "number" ? hcap.toFixed(1) : hcap}
            </div>
            <button onClick={() => setHcap(Number((hcap + 0.1).toFixed(1)))}
              style={{ width: 40, height: 40, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: "#C9A94E", fontSize: 22, cursor: "pointer", fontWeight: 700 }}>
              +
            </button>
          </div>
        </div>

        {/* Bottom Save */}
        <button onClick={save}
          style={{ width: "100%", background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            border: "none", borderRadius: 999, padding: "15px 0",
            color: "#1B3B26", fontWeight: 800, fontSize: 15, cursor: "pointer", marginTop: 10 }}>
          Save
        </button>
      </div>
    </div>
  );
}

// COURSE PICKER
function CoursePicker({ tab, setTab, nearby, nearbyBusy, nearbyMsg, query, setQuery, onSelect, onClose, loadingCourse }) {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "#0F2419" }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#C9A94E",
              fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Close
          </button>
          <div style={{ flex: 1, textAlign: "center", color: "#F5F1E6", fontWeight: 800, fontSize: 17 }}>
            Pick a course
          </div>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button onClick={() => setTab("nearby")}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
              background: tab === "nearby" ? "#C9A94E" : "rgba(245,241,230,0.08)",
              color: tab === "nearby" ? "#1B3B26" : "rgba(245,241,230,0.7)",
              fontWeight: 700, fontSize: 13 }}>
            Nearby
          </button>
          <button onClick={() => setTab("search")}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
              background: tab === "search" ? "#C9A94E" : "rgba(245,241,230,0.08)",
              color: tab === "search" ? "#1B3B26" : "rgba(245,241,230,0.7)",
              fontWeight: 700, fontSize: 13 }}>
            Search
          </button>
        </div>
      </div>
      {tab === "search" && (
        <div style={{ padding: "12px 20px" }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            style={{ width: "100%", background: "rgba(245,241,230,0.06)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 10,
              color: "#F5F1E6", padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            placeholder="Search course name..." />
        </div>
      )}
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {nearbyBusy && <div style={{ color: "rgba(245,241,230,0.7)", textAlign: "center", padding: 20 }}>Finding courses near you...</div>}
        {!nearbyBusy && nearbyMsg && tab === "nearby" && <div style={{ color: "rgba(245,241,230,0.7)", textAlign: "center", padding: 20 }}>{nearbyMsg}</div>}
        {loadingCourse && <div style={{ color: "#C9A94E", textAlign: "center", padding: 20, fontWeight: 700 }}>Loading course...</div>}
        {nearby.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)}
            style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 14,
              padding: 14, cursor: "pointer", textAlign: "left", color: "#F5F1E6", width: "100%" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "rgba(245,241,230,0.55)", marginTop: 2 }}>{(c.city || "")}{(c.city && c.state) ? ", " : ""}{c.state || ""}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
