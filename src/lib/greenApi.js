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

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

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

/** Green + hazard polygons OSM has mapped within radiusM of a course's
 * centre. Returns { greens: [{id, points}], hazards: [{id, points, kind}] }
 * — kind is "bunker" or "water". Empty arrays if the course isn't mapped
 * or a request fails/times out.
 *
 * Water is fetched as a separate request from green+bunker: a coastal
 * course's bay/inlet can make that one query expensive enough to time
 * out, and it must never be able to take the greens down with it. */
export async function fetchCourseGeometry({ lat, lng, radiusM = 2500 }) {
  if (lat == null || lng == null) return { greens: [], hazards: [] };

  const [greenBunkerEls, waterEls] = await Promise.all([
    overpassFetch(
      `[out:json][timeout:20];(way["golf"="green"](around:${radiusM},${lat},${lng});way["golf"="bunker"](around:${radiusM},${lat},${lng}););out geom;`
    ),
    overpassFetch(`[out:json][timeout:15];way["natural"="water"](around:${radiusM},${lat},${lng});out geom;`),
  ]);

  const greens = greenBunkerEls
    .filter((el) => el.tags?.golf === "green")
    .filter((el) => !EXCLUDE_NAME_RE.test(el.tags?.name ?? ""))
    .map((el) => ({
      id: el.id,
      points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })),
    }));

  const bunkers = greenBunkerEls
    .filter((el) => el.tags?.golf === "bunker")
    .map((el) => ({ id: el.id, kind: "bunker", points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }));

  const water = waterEls
    .map((el) => ({ id: el.id, kind: "water", points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })) }))
    .filter((h) => spanMetres(h.points) <= MAX_HAZARD_SPAN_M);

  return { greens, hazards: [...bunkers, ...water] };
}
