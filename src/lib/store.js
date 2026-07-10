// One data model feeds every feature:
// round -> holes -> shots {club, start, end}
// Shots power club averages, scores power games, aggregates power stats.
// Everything lives in localStorage. No backend, no account, no cost.

const KEY = "my-yardage-v1";

const DEFAULT_BAG = [
  { id: "dr", name: "Driver", short: "Dr", manualYards: 230, shots: [] },
  { id: "3w", name: "3 wood", short: "3W", manualYards: 210, shots: [] },
  { id: "5i", name: "5 iron", short: "5i", manualYards: 180, shots: [] },
  { id: "6i", name: "6 iron", short: "6i", manualYards: 170, shots: [] },
  { id: "7i", name: "7 iron", short: "7i", manualYards: 158, shots: [] },
  { id: "8i", name: "8 iron", short: "8i", manualYards: 147, shots: [] },
  { id: "9i", name: "9 iron", short: "9i", manualYards: 136, shots: [] },
  { id: "pw", name: "Pitching wedge", short: "PW", manualYards: 120, shots: [] },
  { id: "sw", name: "Sand wedge", short: "SW", manualYards: 90, shots: [] },
];

export const CLUB_LIBRARY = [
  { id: "dr", name: "Driver", short: "Dr", manualYards: 230 },
  { id: "3w", name: "3 wood", short: "3W", manualYards: 210 },
  { id: "5w", name: "5 wood", short: "5W", manualYards: 200 },
  { id: "2i", name: "2 iron", short: "2i", manualYards: 205 },
  { id: "4h", name: "4 hybrid", short: "4H", manualYards: 195 },
  { id: "4i", name: "4 iron", short: "4i", manualYards: 188 },
  { id: "5i", name: "5 iron", short: "5i", manualYards: 180 },
  { id: "6i", name: "6 iron", short: "6i", manualYards: 170 },
  { id: "7i", name: "7 iron", short: "7i", manualYards: 158 },
  { id: "8i", name: "8 iron", short: "8i", manualYards: 147 },
  { id: "9i", name: "9 iron", short: "9i", manualYards: 136 },
  { id: "pw", name: "Pitching wedge", short: "PW", manualYards: 120 },
  { id: "gw", name: "Gap wedge", short: "GW", manualYards: 105 },
  { id: "sw", name: "Sand wedge", short: "SW", manualYards: 90 },
  { id: "lw", name: "Lob wedge", short: "LW", manualYards: 72 },
  { id: "w50", name: "50° wedge", short: "50°", manualYards: 100 },
  { id: "w52", name: "52° wedge", short: "52°", manualYards: 92 },
  { id: "w54", name: "54° wedge", short: "54°", manualYards: 85 },
  { id: "w56", name: "56° wedge", short: "56°", manualYards: 78 },
  { id: "w58", name: "58° wedge", short: "58°", manualYards: 68 },
  { id: "w60", name: "60° wedge", short: "60°", manualYards: 60 },
];

const MAX_CLUBS = 14;

/** Category label for the Bag screen's row subtitle — derived from the
 * name rather than stored on each club object, so it stays correct for
 * clubs already saved in a device's localStorage from before this field
 * existed. */
export function clubCategory(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("wood")) return "Wood";
  if (n.includes("hybrid")) return "Hybrid";
  if (n.includes("iron")) return "Iron";
  if (n.includes("wedge") || /°/.test(name || "")) return "Wedge";
  return "Club";
}

function blank() {
  return {
    bag: DEFAULT_BAG,
    rounds: [],
    activeRound: null,
    golfers: {},
    profile: { name: "You", units: { distance: "yards", wind: "mph" }, currentCourse: null, avatar: null },
    recentCourses: [],
    favoriteCourses: [],
    // Full holes/tees/greens/hazards/elevation per course, keyed by course
    // id — fetched once ever per course, never re-fetched on a later round
    // at the same place. Persists the same way as everything else in this
    // file (see the localStorage-durability caveat on load()/save()).
    courseCache: {},
  additionalPlayers: [
    { id: 'p2', name: 'Mike Chen',   handicap: 9.4 },
    { id: 'p3', name: 'Sarah Patel', handicap: 18.1 },
    { id: 'p4', name: 'James Wu',    handicap: 6.8 },
  ],
  };
}

/** Merges saved state onto blank()'s defaults so fields added in later
 * versions (e.g. recentCourses, favoriteCourses) always exist, even for a
 * device whose localStorage predates that field — never a hole app crash on
 * upgrade. */
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    return { ...blank(), ...parsed, profile: { ...blank().profile, ...parsed.profile } };
  } catch {
    return blank();
  }
}

export function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// ---- profile & backup -----------------------------------------------------
// No accounts, no login — this is just "who is the primary golfer" so their
// name/handicap don't need retyping every round, same idea as the bag.

/** Merges any subset of {name, email, emailScorecardOnFinish, units}.
 * Renaming carries the handicap forward under the new name (best effort —
 * old rounds keep whatever name was typed at the time, unchanged). `units`
 * merges shallowly with the existing units so setting one (e.g. distance)
 * doesn't clobber the other (e.g. wind). */
function renameKey(obj, oldKey, newKey) {
  if (!obj || !(oldKey in obj)) return obj;
  const { [oldKey]: value, ...rest } = obj;
  return { ...rest, [newKey]: value };
}

export function setProfile(state, updates) {
  const oldName = state.profile?.name;
  const name = updates.name ?? oldName;
  const golfers = { ...state.golfers };
  if (oldName && name && oldName !== name && golfers[oldName] && !golfers[name]) {
    golfers[name] = golfers[oldName];
  }
  const units = { ...state.profile?.units, ...updates.units };

  // A round already in progress freezes the golfer's name at every hole's
  // strokes and the handicap map — rename those too, or the Scorecard/Games
  // screens keep showing the old name for the rest of that round. Finished
  // rounds are left untouched; they're a record of who played, as it was.
  let activeRound = state.activeRound;
  if (activeRound && oldName && name && oldName !== name && activeRound.players.includes(oldName)) {
    activeRound = {
      ...activeRound,
      players: activeRound.players.map((p) => (p === oldName ? name : p)),
      handicaps: renameKey(activeRound.handicaps, oldName, name),
      holes: activeRound.holes.map((h) => ({ ...h, strokes: renameKey(h.strokes, oldName, name) })),
    };
  }

  return { ...state, profile: { ...state.profile, ...updates, name, units }, golfers, activeRound };
}

/** Sets a manual default Handicap Index for a player, from the profile
 * sheet — used until (and overwritten once) finishRound has 3+ qualifying
 * rounds to calculate a real one, at which point the calculated value takes
 * over automatically. */
export function setHandicapIndex(state, name, handicapIndex) {
  return {
    ...state,
    golfers: { ...state.golfers, [name]: { ...(state.golfers[name] || {}), handicapIndex } },
  };
}

/** Forgets a saved player's remembered handicap — for trimming the
 * "previously played with" list, not anything to do with round history. */
export function removeGolfer(state, name) {
  const golfers = { ...state.golfers };
  delete golfers[name];
  return { ...state, golfers };
}

export function setAvatar(state, dataUri) {
  return { ...state, profile: { ...state.profile, avatar: dataUri } };
}

const MAX_RECENT_COURSES = 8;

/** Sets the course shown on Home ("last course shown, default when the
 * golfer selects a different one") and records it in recent history.
 * course: { id, name, city, state } — pass null to clear (no course linked). */
export function setCurrentCourse(state, course) {
  if (!course) return { ...state, profile: { ...state.profile, currentCourse: null } };
  const recentCourses = [
    course,
    ...state.recentCourses.filter((c) => c.id !== course.id),
  ].slice(0, MAX_RECENT_COURSES);
  return { ...state, profile: { ...state.profile, currentCourse: course }, recentCourses };
}

/** course: { id, name, city, state } — toggled by id, full object kept so the
 * Favourites tab can render without a second lookup. */
export function toggleFavoriteCourse(state, course) {
  const has = state.favoriteCourses.some((c) => c.id === course.id);
  const favoriteCourses = has
    ? state.favoriteCourses.filter((c) => c.id !== course.id)
    : [...state.favoriteCourses, course];
  return { ...state, favoriteCourses };
}

/** Caches everything fetched for a course (holes, tees, greens, hazards,
 * elevation) keyed by courseId, so picking the same course again — this
 * round or any future one — never re-fetches it. */
export function cacheCourseData(state, courseId, data) {
  return { ...state, courseCache: { ...state.courseCache, [courseId]: data } };
}

export function exportData(state) {
  return JSON.stringify(state, null, 2);
}

/** Parses and lightly validates a backup file's contents. Throws on
 * anything that doesn't look like this app's data, so callers can show an
 * error instead of silently loading garbage. */
export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.rounds) || !Array.isArray(parsed.bag)) {
    throw new Error("That file doesn't look like a My Yardage backup.");
  }
  return { ...blank(), ...parsed, profile: { ...blank().profile, ...parsed.profile } };
}

export function replaceState(_state, newState) {
  return newState;
}

// ---- bag ----------------------------------------------------------------

export function clubAverage(club) {
  if (!club.shots.length) return { yards: club.manualYards, tracked: 0 };
  const yards = Math.round(
    club.shots.reduce((s, y) => s + y, 0) / club.shots.length
  );
  return { yards, tracked: club.shots.length };
}

export function addClub(state, libClub) {
  if (state.bag.length >= MAX_CLUBS) return state;
  if (state.bag.some((c) => c.id === libClub.id)) return state;
  // Re-adding a club someone removed earlier resumes its history if we kept it.
  const shelved = (state.shelf || []).find((c) => c.id === libClub.id);
  const club = shelved || { ...libClub, shots: [] };
  return {
    ...state,
    bag: [...state.bag, club].sort(
      (a, b) => clubAverage(b).yards - clubAverage(a).yards
    ),
    shelf: (state.shelf || []).filter((c) => c.id !== libClub.id),
  };
}

export function removeClub(state, id) {
  const club = state.bag.find((c) => c.id === id);
  if (!club) return state;
  return {
    ...state,
    bag: state.bag.filter((c) => c.id !== id),
    shelf: [...(state.shelf || []), club], // keep history — golfers rotate clubs back in
  };
}

export function setManualYards(state, id, yards) {
  return {
    ...state,
    bag: state.bag
      .map((c) => (c.id === id ? { ...c, manualYards: yards, shots: [] } : c))
      .sort((a, b) => clubAverage(b).yards - clubAverage(a).yards),
  };
}

// ---- handicap math -------------------------------------------------------
// WHS Course Handicap: how many strokes a player's Handicap Index is worth
// on this specific course/tee. Needs the tee's Course Rating and Slope —
// without those, net scoring can't be done correctly, so callers should
// treat a null result as "show gross only," never guess.
export function courseHandicapFrom(handicapIndex, slope, rating, par) {
  if (handicapIndex == null || slope == null || rating == null || par == null) return null;
  return Math.round(handicapIndex * (slope / 113) + (rating - par));
}

// Standard stroke-index allocation, extended past 18 (each full 18 strokes
// adds one stroke to every hole) and to plus-handicappers (negative course
// handicap gives strokes back to the course, starting from the easiest
// hole — stroke index 18 — instead of the hardest).
export function strokesReceived(courseHandicap, strokeIndex) {
  if (courseHandicap == null || strokeIndex == null) return 0;
  if (courseHandicap >= 0) {
    const base = Math.floor(courseHandicap / 18);
    const remainder = courseHandicap % 18;
    return base + (strokeIndex <= remainder ? 1 : 0);
  }
  const magnitude = Math.abs(courseHandicap);
  const base = Math.floor(magnitude / 18);
  const remainder = magnitude % 18;
  const easiestFirst = 19 - strokeIndex; // SI 18 (easiest) ranks 1st for reduction
  return -(base + (easiestFirst <= remainder ? 1 : 0));
}

// ---- rounds and shots ---------------------------------------------------

const MAX_PLAYERS = 4;

// courseHoles (optional): [{ number, par, strokeIndex, yardages }] from a
// selected course lookup. When absent, holes are created lazily with par 4
// as each hole is reached — unchanged from the original behaviour.
//
// handicapIndexes (optional): { player: handicapIndexNumber }. teeRatingSlope
// (optional): { rating, slope } for the tee the round is played from. Both
// are needed to compute each player's Course Handicap; when either is
// missing that player's handicap is left null and net scoring is simply
// not shown for them — never a guessed or default value.
export function startRound(state, {
  course = "New round",
  courseId = null,
  courseLat = null,
  courseLng = null,
  courseHoles = null,
  courseGreens = [],
  courseFairways = [],
  courseTeeBoxes = [],
  courseHazards = [],
  players = ["You"],
  handicapIndexes = {},
  teeRatingSlope = null,
} = {}) {
  const activePlayers = players.slice(0, MAX_PLAYERS);
  const par = courseHoles ? courseHoles.reduce((s, h) => s + (h.par ?? 4), 0) : null;

  const handicaps = Object.fromEntries(
    activePlayers.map((p) => {
      const index = handicapIndexes[p] ?? null;
      const courseHandicap = teeRatingSlope
        ? courseHandicapFrom(index, teeRatingSlope.slope, teeRatingSlope.rating, par)
        : null;
      return [p, { index, courseHandicap }];
    })
  );

  const round = {
    id: Date.now(),
    course,
    courseId,
    courseLat,
    courseLng,
    // Green/fairway/tee/hazard boundary polygons, fetched once here and
    // never re-fetched during play — Round.jsx reads these locally, no
    // network. teeBoxes are OSM golf=tee polygons (where you tee off from),
    // distinct from teeRatingSlope below (the OpenGolfAPI tee SET's rating).
    greens: courseGreens,
    fairways: courseFairways,
    teeBoxes: courseTeeBoxes,
    hazards: courseHazards,
    players: activePlayers,
    handicaps,
    teeRatingSlope, // kept explicitly (not just baked into courseHandicap) so a
    // finished round can still be used later to calculate a Handicap Index
    startedAt: new Date().toISOString(),
    // { number, par, strokeIndex, yardages, strokes: {player: n}, shots: [{clubId, yards}] }
    holes: courseHoles
      ? courseHoles.map((h) => ({
          number: h.number,
          par: h.par ?? 4,
          strokeIndex: h.strokeIndex ?? null,
          yardages: h.yardages ?? null,
          strokes: {},
          shots: [],
        }))
      : [],
    currentHole: 1,
    pendingShot: null, // { clubId, start:{lat,lon}, at }
  };

  const golfers = { ...state.golfers };
  for (const p of activePlayers) {
    if (handicapIndexes[p] != null) golfers[p] = { handicapIndex: handicapIndexes[p] };
  }

  return { ...state, activeRound: round, golfers };
}

export function markShotStart(state, clubId, position) {
  const r = state.activeRound;
  if (!r) return state;
  return {
    ...state,
    activeRound: { ...r, pendingShot: { clubId, start: position, at: Date.now() } },
  };
}

export function markShotEnd(state, position, yardsBetweenFn) {
  const r = state.activeRound;
  if (!r || !r.pendingShot) return state;
  const yards = yardsBetweenFn(r.pendingShot.start, position);
  const clubId = r.pendingShot.clubId;

  // Sanity gate: ignore sub-5-yard "shots" (accidental taps) and >400 (GPS jumps)
  const valid = yards >= 5 && yards <= 400;

  const holes = [...r.holes];
  let hole = holes.find((h) => h.number === r.currentHole);
  if (!hole) {
    hole = { number: r.currentHole, par: 4, strokes: {}, shots: [] };
    holes.push(hole);
  }
  hole.shots = [...hole.shots, { clubId, yards, valid }];

  const bag = valid
    ? state.bag.map((c) =>
        c.id === clubId ? { ...c, shots: [...c.shots, yards] } : c
      )
    : state.bag;

  return {
    ...state,
    bag,
    activeRound: { ...r, holes, pendingShot: null, lastLogged: { clubId, yards, valid } },
  };
}

export function setHoleScore(state, player, strokes, par) {
  return setScoreForHole(state, state.activeRound?.currentHole, player, strokes, par);
}

/** Same as setHoleScore but targets any hole number — used by the full
 * scorecard grid, where a player may enter or correct a score for a hole
 * other than the one currently in progress. */
export function setScoreForHole(state, holeNumber, player, strokes, par) {
  const r = state.activeRound;
  if (!r) return state;
  const holes = [...r.holes];
  let hole = holes.find((h) => h.number === holeNumber);
  if (!hole) {
    hole = { number: holeNumber, par: par ?? 4, strokes: {}, shots: [] };
    holes.push(hole);
  }
  if (par) hole.par = par;
  hole.strokes = { ...hole.strokes, [player]: strokes };
  return { ...state, activeRound: { ...r, holes } };
}

export function nextHole(state) {
  const r = state.activeRound;
  if (!r) return state;
  return {
    ...state,
    activeRound: { ...r, currentHole: Math.min(r.currentHole + 1, 18), pendingShot: null },
  };
}

/** Direct hole navigation for the Game screen's prev/next chevrons —
 * clamped to 1-18. Unlike nextHole (called when actually finishing a hole
 * during play, which also retires that hole's auto-detected green/fairway/
 * tee so they're never suggested again), this only moves which hole's
 * scorecard column/GPS target is in view — going back to correct an
 * earlier score doesn't un-retire anything. */
export function setCurrentHole(state, number) {
  const r = state.activeRound;
  if (!r) return state;
  return {
    ...state,
    activeRound: { ...r, currentHole: Math.min(18, Math.max(1, number)), pendingShot: null },
  };
}

export function finishRound(state) {
  const r = state.activeRound;
  if (!r) return state;
  const rounds = [{ ...r, finishedAt: new Date().toISOString() }, ...state.rounds];

  // A newly-finished round can bring a player over the 3-round threshold for
  // a calculated index, or shift an existing one — refresh anyone in this
  // round who now qualifies. Deliberately conservative: below the threshold
  // we leave state.golfers untouched rather than overwrite a real index the
  // golfer typed in from their home club with a thin, noisy estimate.
  const golfers = { ...state.golfers };
  for (const p of r.players) {
    const calc = calculatedHandicapIndex(rounds, p);
    if (calc != null && calc.roundsUsed >= 3) {
      golfers[p] = { ...(golfers[p] || {}), handicapIndex: calc.index };
    }
  }

  return { ...state, rounds, activeRound: null, golfers };
}

// ---- games math ---------------------------------------------------------

/** Match play state between the first two players: +n = player one up. */
export function matchStatus(round) {
  const [p1, p2] = round.players;
  if (!p2) return null;
  let diff = 0;
  for (const h of round.holes) {
    const a = h.strokes[p1];
    const b = h.strokes[p2];
    if (a == null || b == null) continue;
    if (a < b) diff += 1;
    else if (b < a) diff -= 1;
  }
  return diff;
}

/** Skins with carries: £stake per hole, ties roll the pot forward. */
export function skins(round, stake = 1) {
  const won = Object.fromEntries(round.players.map((p) => [p, 0]));
  let pot = 0;
  for (const h of [...round.holes].sort((a, b) => a.number - b.number)) {
    const entries = round.players
      .map((p) => [p, h.strokes[p]])
      .filter(([, s]) => s != null);
    if (entries.length < round.players.length) continue;
    pot += stake;
    const best = Math.min(...entries.map(([, s]) => s));
    const winners = entries.filter(([, s]) => s === best);
    if (winners.length === 1) {
      won[winners[0][0]] += pot;
      pot = 0;
    }
    // tie: pot carries
  }
  return { won, carrying: pot };
}

/** Stableford points for one player, full handicap ignored for v0 (gross). */
export function stableford(round, player) {
  let pts = 0;
  for (const h of round.holes) {
    const s = h.strokes[player];
    if (s == null) continue;
    pts += Math.max(0, 2 + (h.par - s));
  }
  return pts;
}

// ---- stats --------------------------------------------------------------

export function roundStats(round) {
  const you = round.players[0];
  let strokes = 0;
  let par = 0;
  let holesPlayed = 0;
  for (const h of round.holes) {
    if (h.strokes[you] == null) continue;
    strokes += h.strokes[you];
    par += h.par;
    holesPlayed += 1;
  }
  return { strokes, toPar: strokes - par, holesPlayed };
}

// ---- handicap index (calculated) ------------------------------------------
// This is an estimate for personal tracking, modelled on the World Handicap
// System — it is not an official/certified handicap, which only a
// recognised golf association or licensed software can issue.

/** WHS Score Differential for one completed round: (Adjusted Gross Score −
 * Course Rating) × 113 / Slope. Requires the round to have real course
 * rating/slope, a computed course handicap for the player, and all 18 holes
 * scored — otherwise returns null (never estimated from partial data). */
export function scoreDifferential(round, player) {
  const trs = round.teeRatingSlope;
  if (!trs || trs.rating == null || trs.slope == null) return null;
  const courseHandicap = round.handicaps?.[player]?.courseHandicap;
  if (courseHandicap == null) return null;
  if (round.holes.length < 18) return null;

  let adjustedGross = 0;
  for (const h of round.holes) {
    const gross = h.strokes?.[player];
    if (gross == null) return null; // incomplete round — can't use it
    const strokes = strokesReceived(courseHandicap, h.strokeIndex);
    const netDoubleBogeyCap = h.par + 2 + Math.max(0, strokes);
    adjustedGross += Math.min(gross, netDoubleBogeyCap);
  }
  return Math.round(((adjustedGross - trs.rating) * 113 / trs.slope) * 10) / 10;
}

// Official WHS table: for N differentials available (most recent 20 count),
// how many of the best (lowest) to average, and the adjustment applied.
const WHS_REVISION_TABLE = [
  null,
  { n: 1, adj: -2.0 }, { n: 1, adj: -2.0 }, { n: 1, adj: -1.0 }, { n: 1, adj: -1.0 },
  { n: 1, adj: 0 }, { n: 2, adj: -1.0 }, { n: 2, adj: 0 }, { n: 2, adj: 0 },
  { n: 3, adj: -1.0 }, { n: 3, adj: -1.0 }, { n: 3, adj: 0 }, { n: 4, adj: -1.0 },
  { n: 4, adj: -1.0 }, { n: 4, adj: 0 }, { n: 5, adj: -1.0 }, { n: 5, adj: 0 },
  { n: 6, adj: 0 }, { n: 6, adj: 0 }, { n: 7, adj: 0 }, { n: 8, adj: 0 },
];

/** Calculated Handicap Index from a player's finished rounds (most-recent-
 * first, as state.rounds already is). Returns null if no round qualifies
 * (needs 18 holes scored + linked course rating/slope), otherwise
 * { index, roundsUsed } where roundsUsed is how many differentials fed in —
 * callers can use that to show a "provisional, only N rounds" caveat. */
export function calculatedHandicapIndex(rounds, player) {
  const diffs = rounds
    .filter((r) => r.players.includes(player))
    .slice(0, 20)
    .map((r) => scoreDifferential(r, player))
    .filter((d) => d != null)
    .sort((a, b) => a - b);

  if (!diffs.length) return null;
  const entry = WHS_REVISION_TABLE[Math.min(diffs.length, 20)];
  const used = diffs.slice(0, entry.n);
  const avg = used.reduce((a, b) => a + b, 0) / used.length;
  return { index: Math.round((avg + entry.adj) * 10) / 10, roundsUsed: diffs.length };
}


/* ---- Option C: user-tapped green polygons ----
 * Shape: { courseId: [{lat,lon}, ...] }.
 * Same shape as OSM greens, so HoleMap draws them with no extra code. */

export function setUserGreen(state, courseId, points) {
  const polygons = { ...(state.userGreenPolygons || {}) };
  polygons[courseId] = points;
  return { ...state, userGreenPolygons: polygons };
}

export function clearUserGreen(state, courseId) {
  const polygons = { ...(state.userGreenPolygons || {}) };
  delete polygons[courseId];
  return { ...state, userGreenPolygons: polygons };
}
