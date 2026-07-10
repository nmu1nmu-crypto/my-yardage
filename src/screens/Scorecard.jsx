export default function Scorecard({ state, update }) {
  const history = state.recentRounds || [];
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 36 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>Scorecard</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              {history.length} rounds played
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div style={{ padding: "30px 20px", textAlign: "center" }}>
        {history.length === 0 ? (
          <>
            <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 14, marginBottom: 8 }}>
              No rounds yet.
            </div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 13 }}>
              Complete a round on the Game tab to see it here.
            </div>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {history.map((r, i) => {
              const date = r.date ? new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
              return (
                <div key={i} style={{ background: "linear-gradient(160deg, #1B3B26, #12281B)",
                  border: "1px solid rgba(201,169,78,0.2)", borderRadius: 16, padding: 14,
                  display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>{date}</div>
                    <div style={{ color: "#F5F1E6", fontSize: 15, fontWeight: 700 }}>{r.course || "Course"}</div>
                    <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 11, fontWeight: 600 }}>HCP {r.handicap ?? "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#C9A94E", fontSize: 30, fontWeight: 800 }}>{r.totalScore ?? "—"}</div>
                    <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>{r.toPar ?? "—"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
