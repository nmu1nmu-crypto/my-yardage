export default function Game({ state, update }) {
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(160deg, #1B3B26, #0F2419)",
            border: "1.3px solid rgba(201,169,78,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ position: "relative", width: 27, height: 27, borderRadius: "50%",
              background: "radial-gradient(circle at 32% 30%, #fff, #E4E4DE)" }}>
              <span style={{ position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                color: "#123822", fontSize: 9, fontWeight: 700,
                fontFamily: "Space Grotesk, system-ui, sans-serif" }}>MY</span>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>Game</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              {state.profile?.currentCourse?.name || "No course"}
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>

      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ color: "#C9A94E", fontSize: 40, marginBottom: 8 }}>Coming soon</div>
        <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 14, lineHeight: 1.5 }}>
          Distance to pin, club recommendation, and live scorecard - building this next.
        </div>
      </div>
    </div>
  );
}
