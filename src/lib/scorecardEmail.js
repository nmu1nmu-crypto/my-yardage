// Plain-text scorecard formatting for mailto: links. mailto has no
// attachment support and is safest kept compact, so these produce readable
// plain text rather than trying to reproduce the visual scorecard.
import { strokesReceived, roundStats } from "./store.js";

export function buildMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${to || ""}?${params.toString()}`;
}

function nineLine(round, holeNums, player) {
  const byNum = Object.fromEntries(round.holes.map((h) => [h.number, h]));
  const ch = round.handicaps?.[player]?.courseHandicap;
  const scores = holeNums.map((n) => byNum[n]?.strokes?.[player] ?? "-");
  const gross = holeNums.reduce((s, n) => s + (byNum[n]?.strokes?.[player] ?? 0), 0);
  const par = holeNums.reduce((s, n) => s + (byNum[n]?.par ?? 0), 0);
  let line = `  ${scores.join(" ")}  (par ${par}, gross ${gross})`;
  if (ch != null) {
    const net = holeNums.reduce((s, n) => {
      const st = byNum[n]?.strokes?.[player];
      return st != null ? s + (st - strokesReceived(ch, byNum[n]?.strokeIndex)) : s;
    }, 0);
    line += `, net ${net}`;
  }
  return line;
}

/** Full hole-by-hole text for one just-finished round. */
export function formatRoundText(round) {
  const front = Array.from({ length: 9 }, (_, i) => i + 1);
  const back = Array.from({ length: 9 }, (_, i) => i + 10);
  const lines = [
    "My Yardage — Scorecard",
    round.course,
    new Date(round.startedAt).toLocaleDateString(),
    "",
  ];
  for (const p of round.players) {
    const ch = round.handicaps?.[p]?.courseHandicap;
    lines.push(`${p}${ch != null ? ` (HCP ${ch})` : ""}`);
    lines.push(`Front 9: ${nineLine(round, front, p)}`);
    lines.push(`Back 9:  ${nineLine(round, back, p)}`);
    lines.push("");
  }
  lines.push("Sent from My Yardage");
  return lines.join("\n");
}

/** Compact one-line-per-round summary across a golfer's whole history —
 * kept short deliberately so it stays well within mailto body limits no
 * matter how many rounds have been played. */
export function formatAllRoundsText(rounds, player) {
  const lines = ["My Yardage — All scorecards", ""];
  if (!rounds.length) {
    lines.push("No finished rounds yet.");
  }
  for (const r of rounds) {
    const s = roundStats(r);
    const date = new Date(r.startedAt).toLocaleDateString();
    const toPar = s.holesPlayed ? `${s.toPar >= 0 ? "+" : ""}${s.toPar}` : "-";
    const score = s.holesPlayed ? s.strokes : "-";
    lines.push(`${date} · ${r.course} · ${r.players.join(", ")} · ${score} (${toPar})`);
  }
  lines.push("", "Sent from My Yardage");
  return lines.join("\n");
}
