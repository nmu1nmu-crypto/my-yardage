import { useState } from "react";

const MASTER_CLUBS = [
  { id: "d",    name: "Driver",         category: "Wood",     yards: 240, hasYards: true },
  { id: "3w",   name: "3 Wood",         category: "Wood",     yards: 215, hasYards: true },
  { id: "5w",   name: "5 Wood",         category: "Wood",     yards: 200, hasYards: true },
  { id: "hy",   name: "Hybrid",         category: "Hybrid",   yards: 190, hasYards: true },
  { id: "4i",   name: "4 Iron",         category: "Iron",     yards: 180, hasYards: true },
  { id: "5i",   name: "5 Iron",         category: "Iron",     yards: 170, hasYards: true },
  { id: "6i",   name: "6 Iron",         category: "Iron",     yards: 160, hasYards: true },
  { id: "7i",   name: "7 Iron",         category: "Iron",     yards: 150, hasYards: true },
  { id: "8i",   name: "8 Iron",         category: "Iron",     yards: 140, hasYards: true },
  { id: "9i",   name: "9 Iron",         category: "Iron",     yards: 130, hasYards: true },
  { id: "pw",   name: "Pitching Wedge", category: "Wedge",    yards: 115, hasYards: true },
  { id: "gw",   name: "Gap Wedge",      category: "Wedge",    yards: 100, hasYards: true },
  { id: "sw",   name: "Sand Wedge",     category: "Wedge",    yards: 85,  hasYards: true },
  { id: "2i",   name: "2 Iron",         category: "Iron",     yards: 200, hasYards: true },
  { id: "3i",   name: "3 Iron",         category: "Iron",     yards: 190, hasYards: true },
  { id: "7w",   name: "7 Wood",         category: "Wood",     yards: 210, hasYards: true },
  { id: "h3",   name: "Hybrid 3",       category: "Hybrid",   yards: 195, hasYards: true },
  { id: "54",   name: "54° Wedge",      category: "Wedge",    yards: 95,  hasYards: true },
  { id: "56",   name: "56° Wedge",      category: "Wedge",    yards: 90,  hasYards: true },
  { id: "60",   name: "60° Wedge",      category: "Wedge",    yards: 80,  hasYards: true },
  { id: "chip", name: "Chipper",        category: "Wedge",    yards: 35,  hasYards: true },
  { id: "put",  name: "Putter",         category: "Putter",   yards: null, hasYards: false },
];

const DEFAULT_BAG_IDS = ["d","3w","5w","hy","4i","5i","6i","7i","8i","9i","pw","gw","sw"];

export default function Bag({ state, update }) {
  const storedBag = state.bag || null;
  const bagIds = storedBag || DEFAULT_BAG_IDS;
  const [showManager, setShowManager] = useState(false);
  const [toggles, setToggles] = useState(() =>
    new Set(bagIds)
  );

  const clubs = MASTER_CLUBS.filter(c => toggles.has(c.id));
  const maxYards = Math.max(30, ...clubs.map(c => c.yards || 0));

  const updateYardage = (id, delta) => {
    // Persist to state.bag map { id: yards }
    const next = { ...(state.bagYardages || {}) };
    const current = next[id] ?? MASTER_CLUBS.find(c => c.id === id)?.yards;
    const newVal = Math.max(30, (current || 0) + delta);
    next[id] = newVal;
    update(s => ({ ...s, bagYardages: next }));
  };

  const toggleClub = (id) => {
    const next = new Set(toggles);
    if (next.has(id)) next.delete(id); else next.add(id);
    setToggles(next);
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: showManager ? 40 : 100, background: "#0F2419" }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {showManager ? (
            <button onClick={() => setShowManager(false)}
              style={{ background: "none", border: "none", color: "#C9A94E",
                fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              ← Back
            </button>
          ) : <LogoMark />}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>
              {toggles.size > 14 && toggles.size + "/14"} {showManager ? "Manage Clubs" : "My Bag"}
            </div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              {showManager ? "Toggle clubs on or off" : "Tap a yardage to adjust"}
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {toggles.size > 14 && (
          <div style={{ background: "rgba(224,90,78,0.15)", border: "1px solid #E05A4E",
            borderRadius: 12, padding: 10, color: "#E05A4E", fontSize: 13,
            fontWeight: 700, textAlign: "center" }}>
            {toggles.size} / 14 clubs — over the limit
          </div>
        )}

        {showManager ? (
          <>
            <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
              Toggle a club on to add it to your bag, off to remove it.
            </div>
            {MASTER_CLUBS.map(c => {
              const on = toggles.has(c.id);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12,
                  background: "linear-gradient(160deg, #1B3B26, #12281B)",
                  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "11px 14px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#F5F1E6", fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 11, fontWeight: 600, marginTop: 1 }}>{c.category}</div>
                  </div>
                  <button onClick={() => toggleClub(c.id)}
                    style={{ width: 44, height: 26, borderRadius: 999, border: "none",
                      padding: 3, cursor: "pointer", flexShrink: 0, display: "flex",
                      alignItems: "center", boxSizing: "border-box",
                      background: on ? "#C9A94E" : "rgba(255,255,255,0.2)",
                      justifyContent: on ? "flex-end" : "flex-start" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                  </button>
                </div>
              );
            })}
          </>
        ) : (
          <>
            {clubs.map(c => {
              const yards = state?.bagYardages?.[c.id] ?? c.yards;
              const pct = c.hasYards ? Math.round((yards / maxYards) * 100) : 0;
              return (
                <div key={c.id} style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
                  border: "1px solid rgba(201,169,78,0.2)", borderRadius: 16, padding: "11px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#F5F1E6", fontSize: 14.5, fontWeight: 700,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.name}
                      </div>
                      <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 11,
                        fontWeight: 600, marginTop: 1 }}>{c.category}</div>
                    </div>
                    {c.hasYards && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(255,255,255,0.05)", borderRadius: 999, padding: 4 }}>
                        <button onClick={() => updateYardage(c.id, -5)}
                          style={{ width: 24, height: 24, borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)", border: "none",
                            color: "#F5F1E6", fontSize: 15, fontWeight: 700,
                            cursor: "pointer", padding: 0 }}>−</button>
                        <div style={{ width: 44, textAlign: "center", color: "#C9A94E",
                          fontSize: 13.5, fontWeight: 800 }}>{yards}</div>
                        <button onClick={() => updateYardage(c.id, 5)}
                          style={{ width: 24, height: 24, borderRadius: "50%",
                            background: "rgba(255,255,255,0.08)", border: "none",
                            color: "#F5F1E6", fontSize: 15, fontWeight: 700,
                            cursor: "pointer", padding: 0 }}>+</button>
                      </div>
                    )}
                    {!c.hasYards && (
                      <div style={{ width: 96, textAlign: "center",
                        color: "rgba(255,255,255,0.3)", fontSize: 12, fontWeight: 600 }}>— yds —</div>
                    )}
                  </div>
                  {c.hasYards && (
                    <div style={{ marginTop: 9, height: 5, borderRadius: 999,
                      background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 999,
                        background: "linear-gradient(90deg, #16A34A, #4ADE80)",
                        width: pct + "%" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {!showManager && (
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "10px 20px",
          background: "rgba(255,255,255,0.04)", borderTop: "1px solid rgba(255,255,255,0.08)",
          position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 5 }}>
          <button onClick={() => setShowManager(true)}
            style={{ background: "linear-gradient(160deg, #DDBB63, #B8933B)",
              border: "none", borderRadius: 999, padding: "9px 16px", cursor: "pointer" }}>
            <span style={{ color: "#1B3B26", fontSize: 13, fontWeight: 800 }}>Update Clubs</span>
          </button>
        </div>
      )}
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
