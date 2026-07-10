import { useState } from "react";
export default function Scorecard({ state }) {
  const history = state.recentRounds || [];
  const [expandedId, setExpandedId] = useState(null);

  const toggle = id => setExpandedId(prev => prev === id ? null : id);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60, background: "#0F2419" }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>Scorecard</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              {history.length} rounds played
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div style={{ padding: "14px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        {history.length === 0 ? (
          <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 14, textAlign: "center", padding: 30 }}>
            No rounds yet. Complete a round on the Game tab.
          </div>
        ) : history.map((r, idx) => {
          const isOpen = expandedId === idx;
          const date = r.date ? new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
          return (
            <div key={idx} style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
              border: "1px solid rgba(201,169,78,0.2)", borderRadius: 16, overflow: "hidden" }}>
              <button onClick={() => toggle(idx)}
                style={{ width: "100%", padding: "12px 14px", background: "none", border: "none",
                  cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", color: "inherit" }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>{date}</div>
                  <div style={{ color: "#F5F1E6", fontSize: 15, fontWeight: 700 }}>{r.course || "Round"}</div>
                  <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>HCP {r.handicap ?? "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#C9A94E", fontSize: 30, fontWeight: 800 }}>{r.totalScore ?? "—"}</div>
                  <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>{r.toPar ?? "—"}</div>
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 14px 14px" }}>
                  <NineGrid label="Front 9" offset={0} scores={r.scores} holes={r.holes} />
                  <NineGrid label="Back 9" offset={9} scores={r.scores} holes={r.holes} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NineGrid({ label, offset, scores, holes }) {
  const playerScores = (scores?.[0] || []).slice(offset, offset + 9);
  const pars = (holes || []).slice(offset, offset + 9).map(h => h?.par || 4);
  const total = playerScores.reduce((s, v, i) => s + (v ?? pars[i]), 0);
  const parTotal = pars.reduce((s, p) => s + p, 0);
  const delta = total - parTotal;

  return (
    <div style={{ background: "linear-gradient(160deg, #1F6349, #143D2C)",
      borderRadius: 12, padding: 10, marginTop: 8 }}>
      <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        {label} · {total} ({delta === 0 ? "E" : delta > 0 ? "+" + delta : delta})
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 3 }}>
        {playerScores.map((s, i) => {
          const p = pars[i];
          let chip = { color: "#F5F1E6", fontWeight: 700, fontSize: 11 };
          let bg = "rgba(245,241,230,0.08)";
          if (s != null) {
            if (s === p - 1) { bg = "rgba(201,169,78,0.4)"; chip.color = "#C9A94E"; }
            else if (s === p + 1) { bg = "rgba(217,119,87,0.4)"; chip.color = "#D97757"; }
          }
          return (
            <div key={i} style={{ background: bg, borderRadius: 6, padding: "4px 6px", textAlign: "center" }}>
              <div style={{ color: "rgba(245,241,230,0.5)", fontSize: 8, fontWeight: 600 }}>{p}</div>
              <div style={{ ...chip }}>{s ?? "—"}</div>
            </div>
          );
        })}
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
      <div style={{ position: "relative", width: 27, height: 27, borderRadius: "50%", background: "radial-gradient(circle, #fff, #E4E4DE)" }}>
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#123822", fontSize: 9, fontWeight: 700, fontFamily: "Space Grotesk, system-ui, sans-serif" }}>MY</span>
      </div>
    </div>
  );
}
