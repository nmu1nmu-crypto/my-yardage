import { useState } from "react";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees } from "../lib/courseApi.js";
import { fetchCourseGeometry } from "../lib/greenApi.js";
import { setProfile, setCurrentCourse, cacheCourseData, setUserGreen, clearUserGreen, setHandicapIndex, removeGolfer } from "../lib/store.js";

const UK_FAVORITES = [
  { id: "woolston-manor", name: "Woolston Manor Golf & Country Club", city: "Warrington", state: "UK", lat: 53.4080, lng: -2.5460 },
];

export default function Home({ state, update, onOpenTab }) {
  const [showProfile, setShowProfile] = useState(false);
  const [picking, setPicking] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyMsg, setNearbyMsg] = useState("");
  const [query, setQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [pickerTab, setPickerTab] = useState("nearby");

  const profile = state.profile || {};
  const player = profile.user || { name: "You", handicap: 14 };
  const course = profile.currentCourse;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const startRound = async () => {
    if (!course) { openCoursePicker(); return; }
    update(setCurrentCourse, course);
    onOpenTab("game");
  };

  const openCoursePicker = async () => {
    setPicking(true);
    setPickerTab("nearby");
    setNearby([]);
    setNearbyBusy(true);
    try {
      const pos = await currentPosition();
      let courses = [];
      for (const mi of [25, 50, 100]) {
        courses = await searchCourses({ lat: pos.lat, lng: pos.lon, radiusMi: mi, limit: 50 });
        if (courses.length >= 20) break;
      }
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 3958.8;
      const uLat = toRad(pos.lat), uLon = toRad(pos.lon);
      courses.sort((a, b) => {
        const aLat = toRad(a.lat ?? a.latitude ?? 0), aLon = toRad(a.lng ?? a.longitude ?? 0);
        const bLat = toRad(b.lat ?? b.latitude ?? 0), bLon = toRad(b.lng ?? b.longitude ?? 0);
        const dA = Math.sin((aLat-uLat)/2)**2 + Math.cos(uLat)*Math.cos(aLat)*Math.sin((aLon-uLon)/2)**2;
        const dB = Math.sin((bLat-uLat)/2)**2 + Math.cos(uLat)*Math.cos(bLat)*Math.sin((bLon-uLon)/2)**2;
        return 2*R*Math.asin(Math.sqrt(dA)) - 2*R*Math.asin(Math.sqrt(dB));
      });
      const favIds = new Set(UK_FAVORITES.map((f) => f.id));
      const merged = [...UK_FAVORITES, ...courses.filter((c) => !favIds.has(c.id))];
      setNearby(merged);
      if (!courses.length) setNearbyMsg("No courses near you. Try searching or pick from UK favourites.");
    } catch {
      setNearbyMsg("Couldn't read GPS. Try searching instead.");
    }
    setNearbyBusy(false);
  };

  const pickCourse = async (c) => {
    setLoadingCourse(true);
    const lat = c.lat ?? c.latitude ?? null;
    const lng = c.lng ?? c.longitude ?? null;
    const cached = state.courseCache?.[c.id];
    let holes, tees, greens, fairways, teeBoxes, hazards;
    if (cached) {
      ({ holes, tees, greens, fairways, teeBoxes, hazards } = cached);
    } else {
      try {
        const [h, t, geometry] = await Promise.all([
          fetchCourseHoles(c.id),
          fetchCourseTees(c.id),
          fetchCourseGeometry({ lat, lng }),
        ]);
        holes = h; tees = t;
        greens = geometry.greens; fairways = geometry.fairways;
        teeBoxes = geometry.teeBoxes; hazards = geometry.hazards;
        update(cacheCourseData, c.id, { holes, tees, greens, fairways, teeBoxes, hazards, lat, lng });
      } catch {
        holes = []; tees = []; greens = []; fairways = []; teeBoxes = []; hazards = [];
      }
    }
    const fullCourse = { id: c.id, name: c.name, city: c.city, state: c.state, lat, lng, holes, tees, greens, fairways, teeBoxes, hazards };
    update(setCurrentCourse, fullCourse);
    update(setProfile, "currentCourseId", c.id);
    setLoadingCourse(false);
    setPicking(false);
  };

  const updatePlayer = (field, value) => {
    update(setProfile, "user", { ...(profile.user || {}), [field]: value });
  };

  if (showProfile) {
    return <ProfileModal user={player} onUpdate={updatePlayer} onSave={() => setShowProfile(false)} />;
  }

  if (picking) {
    return <CoursePicker tab={pickerTab} setTab={setPickerTab}
      nearby={nearby} nearbyBusy={nearbyBusy} nearbyMsg={nearbyMsg}
      query={query} setQuery={setQuery} searchBusy={searchBusy}
      searchResults={[]} onSelect={(c) => pickCourse(c)}
      onClose={() => setPicking(false)} loadingCourse={loadingCourse} />;
  }

  const lastRound = state.recentRounds?.[0]?.totalScore ?? null;
  const avgScore = state.profile?.user?.avgScore ?? null;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 280,
        background: "linear-gradient(180deg, #1B3B26 0%, #0F2419 100%)",
        overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54,
          background: "#0F2419" }} />
        <div style={{ position: "absolute", top: 66, left: 20, right: 20, zIndex: 2 }}>
          <div style={{ fontSize: 13, color: "rgba(245,241,230,0.85)", marginBottom: 4 }}>
            {greeting()}, {player.name || "Golfer"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
            {course?.name || "No course selected"}
          </div>
        </div>
        <button onClick={() => setShowProfile(true)}
          style={{ position: "absolute", top: 66, right: 20, width: 40, height: 40,
            borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2"/>
            <path d="M4 21v-1a6 6 0 0112 0v1" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
          background: "linear-gradient(180deg, transparent, #0F2419)" }} />
      </div>

      {/* My card - overlaps hero */}
      <div style={{ margin: "-28px 20px 0",
        background: "linear-gradient(160deg, #1B3B26, #12281B)",
        border: "1px solid rgba(201, 169, 78, 0.25)",
        borderRadius: 20, padding: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1B3B26", fontWeight: 700, fontSize: 18 }}>
            {(player.name || "Y")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 16 }}>
              {player.name || "You"}
            </div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              Handicap Index
            </div>
          </div>
          <div style={{ width: 58, height: 58, borderRadius: "50%", flexShrink: 0,
            background: "conic-gradient(#C9A94E 0deg, #C9A94E " + (player.handicap || 0) * 10 + "deg, rgba(201,169,78,0.2) " + (player.handicap || 0) * 10 + "deg, rgba(201,169,78,0.2) 360deg)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%",
              background: "#12281B", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#C9A94E", fontWeight: 800, fontSize: 14 }}>
              {player.handicap ?? "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
          <StatTile label="Avg Score" value={avgScore ?? "—"} />
          <StatTile label="Last Round" value={lastRound ?? "—"} />
        </div>
      </div>

      {/* Start round */}
      <div style={{ padding: "0 20px", marginTop: 18 }}>
        <button onClick={startRound}
          style={{ width: "100%", background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            border: "none", borderRadius: 999, padding: "16px 0",
            color: "#1B3B26", fontWeight: 800, fontSize: 16, cursor: "pointer",
            boxShadow: "0 8px 20px rgba(201,169,78,0.25)" }}>
          {course ? "Start Round" : "Pick a Course"}
        </button>
      </div>

      {/* Players */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 16 }}>Players</div>
          <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 12, fontWeight: 600 }}>
            1 added
          </div>
        </div>
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201, 169, 78, 0.2)", borderRadius: 16,
          padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: "rgba(201,169,78,0.2)", color: "#C9A94E",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 15 }}>
            {(player.name || "Y")[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 14.5 }}>
              {player.name || "You"}
            </div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>
              HCP {player.handicap ?? "—"}
            </div>
          </div>
        </div>
      </div>

      {/* No-course prompt */}
      {!course && (
        <div style={{ padding: "16px 20px 0" }}>
          <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 13,
            textAlign: "center", lineHeight: 1.5 }}>
            Pick a course to see greens, yardages, and start a round.
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ background: "rgba(201,169,78,0.08)",
      border: "1px solid rgba(201,169,78,0.15)",
      borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ color: "#C9A94E", fontWeight: 800, fontSize: 20 }}>{value}</div>
      <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 10.5, fontWeight: 600,
        marginTop: 1 }}>{label}</div>
    </div>
  );
}

function ProfileModal({ user, onUpdate, onSave }) {
  const [name, setName] = useState(user.name || "");
  const [email, setEmail] = useState(user.email || "");
  const [hcap, setHcap] = useState(user.handicap ?? 14);
  const [units, setUnits] = useState(user.units || "yards");

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "66px 20px 16px" }}>
        <button onClick={onSave}
          style={{ background: "none", border: "none", color: "#C9A94E",
            fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Back
        </button>
        <div style={{ color: "#F5F1E6", fontWeight: 800, fontSize: 17 }}>Profile</div>
        <button onClick={onSave}
          style={{ background: "none", border: "none", color: "#C9A94E",
            fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Save
        </button>
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
          border: "1px solid rgba(201,169,78,0.2)", borderRadius: 20, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%",
              background: "linear-gradient(160deg, #DDBB63, #B8933B)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#1B3B26", fontWeight: 700, fontSize: 20 }}>
              {(name || "Y")[0].toUpperCase()}
            </div>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ flex: 1, background: "rgba(245,241,230,0.08)",
                border: "1px solid rgba(201,169,78,0.2)", borderRadius: 10,
                color: "#F5F1E6", padding: "10px 12px", fontSize: 15,
                fontWeight: 700, outline: "none" }}
              placeholder="Your name" />
          </div>
          <input value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", background: "rgba(245,241,230,0.08)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 10,
              color: "#F5F1E6", padding: "10px 12px", fontSize: 14,
              fontWeight: 600, outline: "none", boxSizing: "border-box" }}
            placeholder="you@email.com" />
        </div>

        <Card title="Distance Units">
          <div style={{ display: "flex", gap: 4, background: "rgba(245,241,230,0.06)",
            padding: 4, borderRadius: 999 }}>
            {["yards", "meters"].map(u => (
              <button key={u} onClick={() => setUnits(u)}
                style={{ flex: 1, padding: "8px 0", border: "none",
                  borderRadius: 999, cursor: "pointer",
                  background: units === u ? "linear-gradient(160deg, #DDBB63, #B8933B)" : "transparent",
                  color: units === u ? "#1B3B26" : "rgba(245,241,230,0.7)",
                  fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>
                {u}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Handicap Index">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setHcap(Math.max(0, hcap - 1))}
              style={{ width: 38, height: 38, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: "#C9A94E", fontSize: 20, cursor: "pointer" }}>
              -
            </button>
            <div style={{ flex: 1, textAlign: "center", color: "#C9A94E",
              fontWeight: 800, fontSize: 22 }}>{typeof hcap === "number" ? hcap.toFixed(1) : hcap}</div>
            <button onClick={() => setHcap(hcap + 1)}
              style={{ width: 38, height: 38, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: "#C9A94E", fontSize: 20, cursor: "pointer" }}>
              +
            </button>
          </div>
        </Card>

        <button onClick={onSave}
          style={{ width: "100%", background: "linear-gradient(160deg, #DDBB63, #B8933B)",
            border: "none", borderRadius: 999, padding: "15px 0",
            color: "#1B3B26", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Save
        </button>
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
      border: "1px solid rgba(201,169,78,0.2)", borderRadius: 20, padding: 16 }}>
      <div style={{ color: "#F5F1E6", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function CoursePicker({ tab, setTab, nearby, nearbyBusy, nearbyMsg, query, setQuery, searchBusy, searchResults, onSelect, onClose, loadingCourse }) {
  const [searchQuery, setSearchQuery] = useState("");
  const showList = tab === "nearby" ? nearby : searchResults;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "#0F2419" }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={onClose}
            style={{ background: "none", border: "none", color: "#C9A94E",
              fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Close
          </button>
          <div style={{ flex: 1, textAlign: "center", color: "#F5F1E6",
            fontWeight: 800, fontSize: 17 }}>Pick a course</div>
          <div style={{ width: 60 }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          <button onClick={() => setTab("nearby")}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999,
              background: tab === "nearby" ? "#C9A94E" : "rgba(245,241,230,0.08)",
              color: tab === "nearby" ? "#1B3B26" : "rgba(245,241,230,0.7)",
              fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Nearby
          </button>
          <button onClick={() => setTab("search")}
            style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999,
              background: tab === "search" ? "#C9A94E" : "rgba(245,241,230,0.08)",
              color: tab === "search" ? "#1B3B26" : "rgba(245,241,230,0.7)",
              fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Search
          </button>
        </div>
      </div>

      {tab === "search" && (
        <div style={{ padding: "12px 20px" }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", background: "rgba(245,241,230,0.08)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 10,
              color: "#F5F1E6", padding: "10px 12px", fontSize: 14, outline: "none",
              boxSizing: "border-box" }}
            placeholder="Search course name..." />
        </div>
      )}

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {nearbyBusy && (
          <div style={{ color: "rgba(245,241,230,0.7)", textAlign: "center", padding: 20 }}>
            Finding courses near you...
          </div>
        )}
        {!nearbyBusy && nearbyMsg && tab === "nearby" && (
          <div style={{ color: "rgba(245,241,230,0.7)", textAlign: "center", padding: 20 }}>{nearbyMsg}</div>
        )}
        {loadingCourse && (
          <div style={{ color: "#C9A94E", textAlign: "center", padding: 20, fontWeight: 700 }}>
            Loading course...
          </div>
        )}
        {showList.map((c) => (
          <button key={c.id} onClick={() => onSelect(c)}
            style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 14,
              padding: 14, cursor: "pointer", textAlign: "left", color: "#F5F1E6", width: "100%" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "#F5F1E6" }}>{c.name}</div>
            <div style={{ fontSize: 12, color: "rgba(245,241,230,0.55)", marginTop: 2, fontWeight: 600 }}>
              {c.city || c.state || ""}{(c.city && c.state) ? ", " : ""}{c.state || ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
