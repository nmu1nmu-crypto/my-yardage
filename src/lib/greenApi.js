// Real green + hazard boundary geometry via OpenStreetMap's Overpass API —
// free, no key, ODbL-licensed. OpenGolfAPI's own green/tee coordinate
// fields are unpopulated for every course tested (Pebble Beach, Augusta,
// Pinehurst, TPC Sawgrass all return null), so this is a separate lookup
// purely for shape/position. Coverage varies by course — well-mapped
// public courses tend to have it, smaller private clubs often don't — so
// every call here must fail soft, same rule as courseApi.js: an empty
// result means "not available," never a guess.
//
// Called once, when a course is selected (see Home.jsx's pickCourse) —
// not from the Round screen. The shared public Overpass instance rate-
// limits aggressively (confirmed: a handful of requests in quick
// succession gets a 406), so this must never be called repeatedly during
// play. Results are baked into the round object and persisted like
// everything else, so Round.jsx makes zero network calls for this.

import { polygonCentroid } from "./geo.js";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
const ELEVATION_BATCH_SIZE = 100; // Open-Meteo's per-request coordinate limit

// Practice/chipping/putting greens aren't a hole's actual target and would
// otherwise get auto-selected as if they were.
const EXCLUDE_NAME_RE = /practice|chip|putt|nursery/i;

// A real hazard pond/bunker is tens of metres across at most. Coastal
// courses (Pebble Beach included) sit next to bays/inlets mapped as
// natural=water polygons that can be kilometres across — those aren't a
// "hazard near the green," they're the ocean, and fetching/rendering
// their full boundary is both wrong and (confirmed live) slow enough to
// time out the whole request. Filtered client-side since Overpass QL
// has no cheap way to filter by a way's physical size server-side.
const MAX_HAZARD_SPAN_M = 400;

function toRad(d) {
  return (d * Math.PI) / 180;
}

function spanMetres(points) {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const mPerDegLat = 110574;
  const mPerDegLon = 111320 * Math.cos(toRad(midLat));
  const dLat = (Math.max(...lats) - Math.min(...lats)) * mPerDegLat;
  const dLon = (Math.max(...lons) - Math.min(...lons)) * mPerDegLon;
  return Math.max(dLat, dLon);
}

async function overpassFetch(query) {
  try {
    const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements ?? []).filter((el) => (el.geometry ?? []).length >= 3);
  } catch {
    return [];
  }
}

async function fetchElevationBatch(points) {
  if (!points.length) return points.map(() => null);
  const lat = points.map((p) => p.lat).join(",");
  const lon = points.map((p) => p.lon).join(",");
  try {
    const res = await fetch(`${ELEVATION_URL}?latitude=${lat}&longitude=${lon}`);
    if (!res.ok) return points.map(() => null);
    const data = await res.json();
    return data.elevation ?? points.map(() => null);
  } catch {
    return points.map(() => null);
  }
}

/** Real terrain elevation (metres, Copernicus DEM ~90m resolution) for each
 * point — same free, no-key provider (Open-Meteo) already used for
 * weather. Chunked into batches of 100 (its per-request limit). Fails
 * soft per point: null means "unknown," never a guessed value. */
async function fetchElevations(points) {
  const results = [];
  for (let i = 0; i < points.length; i += ELEVATION_BATCH_SIZE) {
    const batch = points.slice(i, i + ELEVATION_BATCH_SIZE);
    results.push(...(await fetchElevationBatch(batch)));
  }
  return results;
}

/** Green/fairway/tee/hazard polygons OSM has mapped within radiusM of a
 * course's centre, plus real terrain elevation per green. Returns
 * { greens: [{id, points, elevationM}], fairways: [{id, points}],
 *   teeBoxes: [{id, points}], hazards: [{id, points, kind}] } — kind is
 * "bunker" or "water", elevationM is null if the elevation lookup failed.
 * Empty arrays if the course isn't mapped or a request fails/times out.
 *
 * Water is fetched as a separate request from the rest: a coastal course's
 * bay/inlet can make that one query expensive enough to time out, and it
 * must never be able to take the greens/fairways/tees down with it.
 * Fairways and tees are small, golf-specific features (unlike natural=water,
 * nothing else gets tagged golf=fairway), so they're safe to bundle with
 * green/bunker in one request. */
export async function fetchCourseGeometry({ lat, lng, radiusM = 2500 }) {
  if (lat == null || lng == null) return { greens: [], fairways: [], teeBoxes: [], hazards: [] };

  const [courseEls, waterEls] = await Promise.all([
    overpassFetch(
      `[out:json][timeout:20];(way["golf"="green"](around:${radiusM},${lat},${lng});way["golf"="bunker"](around:${radiusM},${lat},${lng});way["golf"="fairway"](around:${radiusM},${lat},${lng});way["golf"="tee"](around:${radiusM},${lat},${lng}););out geom;`
    ),
    overpassFetch(`[out:json][timeout:15];way["natural"="water"](around:${radiusM},${lat},${lng});out geom;`),
  ]);

  const rawGreens = courseEls
    .filter((el) => el.tags?.golf === "green")
    .filter((el) => !EXCLUDE_NAME_RE.test(el.tags?.name ?? ""))
    .map((el) => ({
      id: el.id,
      points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })),
    }));

  // Real terrain elevation per green, for the "plays like" elevation
  // adjustment — one batched request for every green on the course.
  const elevations = await fetchElevations(rawGreens.map((g) => polygonCentroid(g.points)));
  const greens = rawGreens.map((g, i) => ({ ...g, elevationM: elevations[i] ?? null }));

  const fairways = courseEls
    .filter((el) => el.tags?.golf === "fairway")
    .map((el) => ({ id: el.id, points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }));

  const teeBoxes = courseEls
    .filter((el) => el.tags?.golf === "tee")
    .map((el) => ({ id: el.id, points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }));

  const bunkers = courseEls
    .filter((el) => el.tags?.golf === "bunker")
    .map((el) => ({ id: el.id, kind: "bunker", points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }));

  const water = waterEls
    .map((el) => ({ id: el.id, kind: "water", points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }))
    .filter((h) => spanMetres(h.points) <= MAX_HAZARD_SPAN_M);

  return { greens, fairways, teeBoxes, hazards: [...bunkers, ...water] };
}
