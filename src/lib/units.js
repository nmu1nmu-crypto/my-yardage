// All distance/wind math stays in yards and mph internally everywhere in the
// app (GPS math, plays-like model, historical rounds, course API data) — the
// only thing that changes with a user's unit preference is how numbers are
// *displayed*. That keeps every calculation and every stored round
// consistent regardless of what the golfer has picked.

const YARDS_PER_METRE = 1.09361;
const MPH_PER_KPH = 0.621371;

export function distanceUnit(state) {
  return state.profile?.units?.distance || "yards";
}

export function windUnit(state) {
  return state.profile?.units?.wind || "mph";
}

/** Yards in, a display number in the golfer's preferred unit out. */
export function convertDistance(yards, unit) {
  if (yards == null) return null;
  return unit === "meters" ? Math.round(yards / YARDS_PER_METRE) : Math.round(yards);
}

export function distanceLabel(unit) {
  return unit === "meters" ? "m" : "yds";
}

/** The reverse of convertDistance — a display-unit number in, yards out.
 * Needed anywhere a golfer edits a distance (e.g. bag club yardage) so what
 * they type in their preferred unit is stored correctly in yards. */
export function toYards(value, unit) {
  if (value == null) return null;
  return unit === "meters" ? Math.round(value * YARDS_PER_METRE) : Math.round(value);
}

export function formatDistance(yards, unit) {
  const v = convertDistance(yards, unit);
  return v == null ? "—" : `${v} ${distanceLabel(unit)}`;
}

/** mph in, a display number in the golfer's preferred unit out. */
export function convertWind(mph, unit) {
  if (mph == null) return null;
  return unit === "kph" ? Math.round(mph / MPH_PER_KPH) : Math.round(mph);
}

export function windLabel(unit) {
  return unit === "kph" ? "kph" : "mph";
}

export function formatWind(mph, unit) {
  const v = convertWind(mph, unit);
  return v == null ? "—" : `${v} ${windLabel(unit)}`;
}
