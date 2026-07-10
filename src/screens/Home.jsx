import { useState } from "react";
import { currentPosition } from "../lib/geo.js";
import { searchCourses, fetchCourseHoles, fetchCourseTees } from "../lib/courseApi.js";
import { fetchCourseGeometry } from "../lib/greenApi.js";
import { setProfile, setCurrentCourse, cacheCourseData } from "../lib/store.js";
import { TOKENS, NAV_H } from "../App.jsx";

const UK_FAVORITES = [
  { id: "woolston-manor", name: "Woolston Manor Golf & Country Club", city: "Warrington", state: "UK", lat: 53.4080, lng: -2.5460 },
];

/* Design tokens for this file (local aliases of TOKENS) */
const CARD_GRAD = TOKENS.cardGrad;
const CARD_BORD = TOKENS.cardBorder;
const GOLD = TOKENS.gold;
const GOLD_GRAD = TOKENS.goldGrad;
const CREAM = TOKENS.textCream;
const MUTED = TOKENS.textMuted;
const MUTED_STRONG = TOKENS.textMutedStrong;
const CORAL = TOKENS.coral;
const CORAL_DEL = TOKENS.coralDelete;
const BG = TOKENS.bg;

/* Safe area: push content below home-indicator by the tab bar height */
const SAFE_BOT = NAV_H + 4;

export default function Home({ state, update, onOpenTab }) {
  const [showProfile, setShowProfile] = useState(false);
  const [picking, setPicking] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyMsg, setNearbyMsg] = useState("");
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [pickerTab, setPickerTab] = useState("nearby");

  const profile = state.profile || {};
  const player  = profile.user || { name: "Alex", handicap: 14.2, avgScore: 88.4, lastRoundScore: 85, units: "yards", emailOptIn: true };
  const course  = profile.currentCourse;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const openCoursePicker = async () => {
    setPicking(true); setPickerTab("nearby"); setNearby([]); setNearbyMsg("");
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
      const favIds = new Set(UK_FAVORITES.map(f => f.id));
      setNearby([...UK_FAVORITES, ...courses.filter(c => !favIds.has(c.id))]);
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
    update(setCurrentCourse, { id: c.id, name: c.name, city: c.city, state: c.state, lat, lng, holes, tees, greens, fairways, teeBoxes, hazards });
    update(setProfile, { currentCourseId: c.id });
    setLoadingCourse(false); setPicking(false);
  };

  const updatePlayer = (field, value) => update(setProfile, "user", { ...(profile.user || {}), [field]: value });

  if (showProfile) return <ProfileModal user={player} onUpdate={updatePlayer} onSave={() => setShowProfile(false)} />;
  if (picking)     return <CoursePicker tab={pickerTab} setTab={setPickerTab} nearby={nearby} nearbyBusy={nearbyBusy} nearbyMsg={nearbyMsg} onSelect={pickCourse} onClose={() => setPicking(false)} loadingCourse={loadingCourse} />;

  const initials = (s => s ? s[0].toUpperCase() : "Y")(player.name);

  return (
    <div style={{ width: "100%", boxSizing: "border-box", paddingBottom: SAFE_BOT }}>
      {/* HERO */}
      <div style={{ position: "relative", height: 280,
        background: "linear-gradient(160deg, #1B3B26 0%, #0F2419 100%)",
        overflow: "hidden" }}>
        {/* Top scrim (for status bar) */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54,
          background: "linear-gradient(180deg, #0F2419 0%, rgba(15,36,25,0) 100%)", zIndex: 2 }} />
        {/* Hero content */}
        <div style={{ position: "absolute", top: 66, left: 20, right: 70, zIndex: 2 }}>
          <div style={{ fontSize: 13, color: MUTED_STRONG, fontWeight: 500 }}>{greeting()}, {player.name}</div>
          <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: "#ffffff",
            textShadow: "0 2px 8px rgba(0,0,0,0.6)", lineHeight: 1.2, maxWidth: 260,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {course?.name || "Cypress Point GC"}
          </div>
        </div>
        {/* Profile button (40x40) */}
        <button onClick={() => setShowProfile(true)}
          style={{ position: "absolute", top: 66, right: 20, zIndex: 2,
            width: 40, height: 40, borderRadius: "50%", border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2" />
            <path d="M4 21v-1a6 6 0 0116 0v1" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {/* Bottom scrim — blends card into hero */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
          background: "linear-gradient(0deg, #0F2419 0%, transparent 100%)" }} />
      </div>

      {/* MY CARD — overlaps hero by -28px */}
      <div style={{
        margin: "-28px 20px 0", padding: 16,
        background: CARD_GRAD,
        border: "1px solid " + CARD_BORD,
        borderRadius: 20,
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        boxSizing: "border-box", width: "calc(100% - 40px)",
      }}>
        {/* Row: avatar + name/label + gauge */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar initials={initials} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: CREAM, fontWeight: 700, fontSize: 16 }}>You</div>
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 600, marginTop: 1 }}>Handicap Index</div>
          </div>
          <HandicapGauge value={player.handicap ?? 14.2} size={58} maxVal={30} />
        </div>

        {/* Stat tiles */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <StatTile label="Avg Score"  value={player.avgScore ?? "—"} />
          <StatTile label="Last Round" value={player.lastRoundScore ?? "—"} />
        </div>
      </div>

      {/* PLAYERS — matches design: "Players" header + "3 of 3 added" */}
      <div style={{ padding: "20px 20px 0", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: CREAM, fontWeight: 700, fontSize: 16 }}>Players</div>
          <div style={{ color: MUTED, fontSize: 12, fontWeight: 600 }}>3 of 3 added</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(state.additionalPlayers || [
            { id: "p2", name: "Mike Chen",   handicap: 9.4  },
            { id: "p3", name: "Sarah Patel", handicap: 18.1 },
            { id: "p4", name: "James Wu",    handicap: 6.8  },
          ]).map((p) => (
            <PlayerRow
              key={p.id}
              name={p.name}
              handicap={p.handicap}
              initials={p.name[0].toUpperCase()}
            />
          ))}
        </div>
      </div>

      {/* START ROUND CTA — full-bleed gold with 20px side padding */}
      <div style={{ padding: "0 20px", marginTop: 18, boxSizing: "border-box" }}>
        <button onClick={() => onOpenTab("game")}
          style={{
            width: "100%", boxSizing: "border-box",
            background: GOLD_GRAD,
            border: "none", borderRadius: 999,
            padding: "16px 0",
            color: "#1B3B26",
            fontWeight: 800, fontSize: 16,
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(201,169,78,0.25)",
          }}>
          {course ? "Start Round" : "Start Round"}
        </button>
      </div>

      {!course && (
        <div style={{ padding: "16px 20px 0", boxSizing: "border-box" }}>
          <button onClick={openCoursePicker}
            style={{ width: "100%", background: "rgba(201,169,78,0.1)",
              border: "1px dashed " + GOLD,
              borderRadius: 14, padding: 12, color: GOLD, fontWeight: 700,
              fontSize: 14, cursor: "pointer", textAlign: "center" }}>
            + Pick a Course
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function Avatar({ initials, size = 40 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: GOLD_GRAD,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#1B3B26", fontWeight: 700, fontSize: size === 52 ? 20 : size * 0.375,
    }}>{initials}</div>
  );
}

function HandicapGauge({ value, size, maxVal = 54 }) {
  const strokeW = 4;
  const r = (size - strokeW - 4) / 2;
  const C = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, value / maxVal));
  const dash = C * frac;

  return (
    <div style={{ width: size, height: size, position: "relative", flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(201,169,78,0.2)" strokeWidth={strokeW} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={GOLD} strokeWidth={strokeW}
          strokeDasharray={`${dash} ${C - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        color: CREAM, fontWeight: 800, fontSize: 16 }}>
        {typeof value === "number" ? value.toFixed(1) : value}
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: CREAM, fontWeight: 800, fontSize: 22 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function PlayerRow({ name, handicap, initials }) {
  return (
    <div style={{
      background: CARD_GRAD,
      border: "1px solid " + CARD_BORD,
      borderRadius: 16,
      padding: "12px", boxSizing: "border-box",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <Avatar initials={initials} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: CREAM, fontWeight: 700, fontSize: 14.5,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 600, marginTop: 1 }}>
          HCP {typeof handicap === "number" ? handicap.toFixed(1) : handicap}
        </div>
      </div>
      <div style={{ width: 22, height: 22, flexShrink: 0,
        borderRadius: "50%",
        background: "rgba(201,169,78,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M9 6L15 12L9 18" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ---------- Profile Modal ----------

function ProfileModal({ user, onUpdate, onSave }) {
  const [name, setName] = useState(user.name || "Alex");
  const [email, setEmail] = useState(user.email || "");
  const [emailOptIn, setEmailOptIn] = useState(user.emailOptIn ?? true);
  const [units, setUnits] = useState(user.units || "yards");
  const [hcap, setHcap] = useState(user.handicap ?? 14.2);

  const save = () => {
    onUpdate("name", name); onUpdate("email", email);
    onUpdate("emailOptIn", emailOptIn); onUpdate("units", units);
    onUpdate("handicap", hcap);
    onSave();
  };

  return (
    <div style={{ width: "100%", boxSizing: "border-box", paddingBottom: SAFE_BOT }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "66px 20px 16px",
        borderBottom: "1px solid " + CARD_BORD }}>
        <button onClick={save} style={{ background: "none", border: "none", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M15 6L9 12L15 18" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div style={{ color: CREAM, fontWeight: 800, fontSize: 17 }}>Profile</div>
        <button onClick={save} style={{ background: "none", border: "none", color: GOLD, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Save</button>
      </div>

      <div style={{ padding: "20px 20px 10px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Avatar + name input */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar initials={(name || "Y")[0].toUpperCase()} size={56} />
          <input value={name} onChange={e => setName(e.target.value)}
            style={{ flex: 1, background: "rgba(245,241,230,0.06)",
              border: "1px solid " + CARD_BORD, borderRadius: 10,
              color: CREAM, padding: "10px 12px", fontSize: 15, fontWeight: 700, outline: "none",
              minWidth: 0 }} placeholder="Your name" />
        </div>

        {/* Email card */}
        <CardBox title="Email Scorecards">
          <input value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box",
              background: "rgba(245,241,230,0.06)",
              border: "1px solid rgba(201,169,78,0.15)", borderRadius: 10,
              color: CREAM, padding: "10px 12px", fontSize: 13.5, outline: "none" }}
            placeholder="you@email.com" />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, cursor: "pointer" }}>
            <div onClick={() => setEmailOptIn(!emailOptIn)}
              style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                background: emailOptIn ? GOLD_GRAD : "transparent",
                border: "1.3px solid " + (emailOptIn ? "#B8933B" : "rgba(245,241,230,0.4)"),
                display: "flex", alignItems: "center", justifyContent: "center" }}>
              {emailOptIn && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12L10 18L20 6" stroke="#1B3B26" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div style={{ color: MUTED_STRONG, fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
              Email me my scorecard after each round
            </div>
          </label>
        </CardBox>

        {/* Distance Units */}
        <CardBox title="Distance Units">
          <div style={{ display: "flex", gap: 4, background: "rgba(245,241,230,0.06)", padding: 4, borderRadius: 999 }}>
            {["yards", "meters"].map(u => (
              <button key={u} onClick={() => setUnits(u)}
                style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
                  background: units === u ? GOLD_GRAD : "transparent",
                  color: units === u ? "#1B3B26" : MUTED,
                  fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>
                {u}
              </button>
            ))}
          </div>
        </CardBox>

        {/* Handicap Index */}
        <CardBox title="Handicap Index" subtitle="Manually update your handicap">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setHcap(Math.max(0, Number((hcap - 0.1).toFixed(1))))}
              style={{ width: 40, height: 40, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: GOLD, fontSize: 22, cursor: "pointer", fontWeight: 300 }}>−</button>
            <div style={{ flex: 1, textAlign: "center", color: CREAM,
              fontWeight: 800, fontSize: 26 }}>
              {typeof hcap === "number" ? hcap.toFixed(1) : hcap}
            </div>
            <button onClick={() => setHcap(Number((hcap + 0.1).toFixed(1)))}
              style={{ width: 40, height: 40, borderRadius: "50%",
                background: "rgba(201,169,78,0.2)", border: "none",
                color: GOLD, fontSize: 22, cursor: "pointer", fontWeight: 700 }}>+</button>
          </div>
        </CardBox>

        <button onClick={save}
          style={{ width: "100%", boxSizing: "border-box",
            background: GOLD_GRAD, border: "none", borderRadius: 999,
            padding: "15px 0", color: "#1B3B26", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          Save
        </button>
      </div>
    </div>
  );
}

function CardBox({ title, subtitle, children }) {
  return (
    <div style={{ background: CARD_GRAD, border: "1px solid " + CARD_BORD,
      borderRadius: 20, padding: 16, boxSizing: "border-box" }}>
      <div style={{ color: CREAM, fontWeight: 700, fontSize: 15, marginBottom: subtitle ? 10 : 0 }}>{title}</div>
      {subtitle && <div style={{ color: MUTED, fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

// ---------- Course Picker ----------

function CoursePicker({ tab, setTab, nearby, nearbyBusy, nearbyMsg, onSelect, onClose, loadingCourse }) {
  return (
    <div style={{ width: "100%", boxSizing: "border-box", paddingBottom: SAFE_BOT }}>
      <div style={{ padding: "66px 20px 12px", borderBottom: "1px solid " + CARD_BORD }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", color: GOLD, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Close</button>
          <div style={{ flex: 1, textAlign: "center", color: CREAM, fontWeight: 800, fontSize: 17 }}>Pick a course</div>
          <div style={{ width: 50 }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
          {["nearby", "search"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer",
                background: tab === t ? GOLD : "rgba(245,241,230,0.08)",
                color: tab === t ? "#1B3B26" : MUTED,
                fontWeight: 700, fontSize: 13, textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {nearbyBusy && <div style={{ color: MUTED_STRONG, textAlign: "center", padding: 20 }}>Finding courses near you…</div>}
        {!nearbyBusy && nearbyMsg && tab === "nearby" && <div style={{ color: MUTED_STRONG, textAlign: "center", padding: 20 }}>{nearbyMsg}</div>}
        {loadingCourse && <div style={{ color: GOLD, textAlign: "center", padding: 20, fontWeight: 700 }}>Loading course…</div>}
        {nearby.map(c => (
          <button key={c.id} onClick={() => onSelect(c)}
            style={{ background: CARD_GRAD, border: "1px solid " + CARD_BORD, borderRadius: 14,
              padding: 14, cursor: "pointer", textAlign: "left", color: CREAM, width: "100%",
              boxSizing: "border-box" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{c.city ?? c.state ?? ""}{(c.city && c.state) ? ", " : ""}{c.state ?? ""}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
