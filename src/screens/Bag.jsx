export default function Bag({ state, update }) {
  const bag = state.bag || [];
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ padding: "66px 20px 16px", borderBottom: "1px solid rgba(201,169,78,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ width: 36 }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#F5F1E6", fontSize: 17, fontWeight: 800 }}>My Bag</div>
            <div style={{ color: "rgba(245,241,230,0.55)", fontSize: 12, fontWeight: 600 }}>
              {bag.length} clubs
            </div>
          </div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{ color: "#C9A94E", fontSize: 22, fontWeight: 800, marginBottom: 12 }}>Coming soon</div>
        <div style={{ color: "rgba(245,241,230,0.7)", fontSize: 14, lineHeight: 1.5 }}>
          Club list with yardage steppers, progress bars, and Manage Clubs - next update.
        </div>
      </div>
    </div>
  );
}
