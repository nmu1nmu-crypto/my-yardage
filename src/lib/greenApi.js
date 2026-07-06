// Real green boundary geometry via OpenStreetMap's Overpass API — free, no
// key, ODbL-licensed. OpenGolfAPI's own green/tee coordinate fields are
// unpopulated for every course tested (Pebble Beach, Augusta, Pinehurst,
// TPC Sawgrass all return null), so this is a separate lookup purely for
// green shape/position. Coverage varies by course — well-mapped public
// courses tend to have it, smaller private clubs often don't — so every
// call here must fail soft, same rule as courseApi.js: an empty result
// means "not available," never a guess.

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Practice/chipping/putting greens aren't a hole's actual target and would
// otherwise get auto-selected as if they were.
const EXCLUDE_NAME_RE = /practice|chip|putt|nursery/i;

/** All green polygons OSM has mapped within radiusM of a course's centre.
 * Returns [{ id, points: [{lat, lon}] }] — empty if the course isn't
 * mapped, the request fails, or it times out. */
export async function fetchCourseGreens({ lat, lng, radiusM = 2000 }) {
  if (lat == null || lng == null) return [];
  const query = `[out:json][timeout:15];way["golf"="green"](around:${radiusM},${lat},${lng});out geom;`;
  try {
    const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.elements ?? [])
      .filter((el) => (el.geometry ?? []).length >= 3)
      .filter((el) => !EXCLUDE_NAME_RE.test(el.tags?.name ?? ""))
      .map((el) => ({
        id: el.id,
        points: el.geometry.map((p) => ({ lat: p.lat, lon: p.lon })),
      }));
  } catch {
    return [];
  }
}
