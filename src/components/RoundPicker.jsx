// Shared by Scorecard and Games: lets the golfer flip between the round in
// progress and any finished round to review it. Past rounds are read-only —
// store functions only ever mutate state.activeRound.
export default function RoundPicker({ state, selectedId, onSelect }) {
  const items = [
    ...(state.activeRound ? [{ id: "current", label: "Current", round: state.activeRound }] : []),
    ...state.rounds.map((r) => ({
      id: r.id,
      label: new Date(r.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      round: r,
    })),
  ];

  if (items.length <= 1) return null;

  return (
    <div className="chips hscroll" style={{ marginBottom: 10, overflowX: "auto", flexWrap: "nowrap" }}>
      {items.map((it) => (
        <button
          key={it.id}
          className={`chip ${selectedId === it.id ? "on" : ""}`}
          style={{ flexShrink: 0 }}
          onClick={() => onSelect(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Resolve the actual round object for a picker's selectedId, defaulting to
 * the active round (or most recent finished one) when nothing's picked yet. */
export function resolveRound(state, selectedId) {
  if (selectedId === "current") return state.activeRound;
  if (selectedId != null) return state.rounds.find((r) => r.id === selectedId) ?? null;
  return state.activeRound ?? state.rounds[0] ?? null;
}
