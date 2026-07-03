import { matchStatus, skins, stableford } from "../lib/store.js";

export default function Games({ state }) {
  const round = state.activeRound ?? state.rounds[0];

  if (!round) {
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <strong>No games yet</strong>
        <p className="muted">Start a round with a couple of mates and the money sorts itself out here.</p>
      </div>
    );
  }

  const [you, opponent] = round.players;
  const match = matchStatus(round);
  const { won, carrying } = skins(round);
  const played = round.holes.filter((h) =>
    round.players.every((p) => h.strokes[p] != null)
  );

  return (
    <>
      <div className="row" style={{ margin: "8px 0 12px" }}>
        <strong style={{ fontSize: 18 }}>Games</strong>
        <span className="muted small">
          {state.activeRound ? `Thru ${played.length}` : "Last round"}
        </span>
      </div>

      {opponent && (
        <div className="card gold">
          <div className="row">
            <strong style={{ fontSize: 13, color: "var(--gold-600)" }}>
              ⚔ Match play vs {opponent}
            </strong>
            <span className="pill gold">
              {match === 0
                ? "All square"
                : match > 0
                  ? `You're ${match} up`
                  : `${match * -1} down`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            {[...round.holes]
              .sort((a, b) => a.number - b.number)
              .map((h) => {
                const a = h.strokes[you];
                const b = h.strokes[opponent];
                if (a == null || b == null) return null;
                const r = a < b ? "W" : b < a ? "L" : "½";
                const bg =
                  r === "W" ? "var(--pine-400)" : r === "L" ? "#F5C4B3" : "#F1EFE8";
                const fg =
                  r === "W" ? "var(--pine-900)" : r === "L" ? "#712B13" : "#5F5E5A";
                return (
                  <div key={h.number} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: 26,
                        borderRadius: 6,
                        background: bg,
                        color: fg,
                        fontSize: 12,
                        fontWeight: 600,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {r}
                    </div>
                    <div className="small" style={{ color: "var(--gold-600)", marginTop: 2 }}>
                      {h.number}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {round.players.length >= 2 && (
        <div className="card gold">
          <div className="row">
            <strong style={{ fontSize: 13, color: "var(--gold-600)" }}>
              🪙 Skins · £1 a hole
            </strong>
            {carrying > 0 && (
              <span className="pill gold num">£{carrying} carries</span>
            )}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            {round.players.map((p) => (
              <span key={p} style={{ fontSize: 13, color: "var(--gold-600)" }}>
                {p} <strong className="num">£{won[p]}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="row">
          <strong style={{ fontSize: 13 }}>📊 Stableford (gross)</strong>
          <span className="muted small">2 pts per par</span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {round.players.map((p) => (
            <div key={p}>
              <p className="num" style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "var(--pine-800)" }}>
                {stableford(round, p)} pts
              </p>
              <p className="muted small" style={{ margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
