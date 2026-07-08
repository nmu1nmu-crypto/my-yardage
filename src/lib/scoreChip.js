// Score chip visual language shared by the Game screen's live scorecard and
// the Scorecard screen's round-history mini scorecards — shape carries the
// meaning (circle vs rounded square, single vs double ring), not color
// alone, so it still reads correctly for colorblind users.
export function scoreChipClass(strokes, par) {
  if (strokes == null || par == null) return "";
  const diff = strokes - par;
  if (diff <= -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 1) return "bogey";
  if (diff >= 2) return "double";
  return "";
}

export function toParLabel(strokes, par) {
  if (strokes == null || par == null) return "";
  const diff = strokes - par;
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// Tapping a score cycles it through par-2 … par+3 (wrapping) — a shown-but-
// uncommitted hole displays its par, and the first tap commits par-1 (i.e.
// the cycle order starts one below par so a single tap can go either way
// without needing a long-press).
const CYCLE_OFFSETS = [-2, -1, 0, 1, 2, 3];

export function cycleScore(strokes, par) {
  const current = strokes ?? par;
  const offset = current - par;
  const idx = CYCLE_OFFSETS.indexOf(offset);
  const nextOffset = CYCLE_OFFSETS[(idx + 1) % CYCLE_OFFSETS.length];
  return par + nextOffset;
}
