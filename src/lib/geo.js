// All distance math is on-device. No API, no cost, works offline.
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

const R = 6371000; // earth radius, metres
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

/** Great-circle distance between two {lat, lon} points, in metres. */
export function haversineMetres(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const metresToYards = (m) => m * 1.09361;

export function yardsBetween(a, b) {
  return Math.round(metresToYards(haversineMetres(a, b)));
}

/** Initial bearing from a to b in degrees (0 = north). Used for wind vs shot direction. */
export function bearingDegrees(a, b) {
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Current GPS fix as {lat, lon, altitude}. altitude is metres above sea level,
 * null when the device can't supply it (common indoors or on older hardware) —
 * callers must treat it as optional. Uses the native plugin inside the
 * iOS/Android app shell (reliable permission flow); falls back to the browser
 * API for the web/PWA build. */
export async function currentPosition() {
  const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 };

  if (Capacitor.isNativePlatform()) {
    const pos = await Geolocation.getCurrentPosition(opts);
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, altitude: pos.coords.altitude };
  }

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation isn't available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          altitude: pos.coords.altitude,
        }),
      (err) => reject(err),
      opts
    );
  });
}

/** Elevation change from a to b, in feet. Positive = b is higher (uphill). */
export function elevationDeltaFeet(a, b) {
  if (a?.altitude == null || b?.altitude == null) return 0;
  return (b.altitude - a.altitude) * 3.28084;
}

/** Continuously reports GPS fixes as {lat, lon, altitude} to onUpdate, for
 * live "however far away you are right now" distances — not a single
 * snapshot. Returns a function that stops watching; callers must call it
 * on unmount/cleanup. Same native/browser split as currentPosition(). */
export async function watchPosition(onUpdate) {
  const opts = { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 };

  if (Capacitor.isNativePlatform()) {
    const id = await Geolocation.watchPosition(opts, (pos, err) => {
      if (err || !pos) return;
      onUpdate({ lat: pos.coords.latitude, lon: pos.coords.longitude, altitude: pos.coords.altitude });
    });
    return () => Geolocation.clearWatch({ id });
  }

  if (!("geolocation" in navigator)) return () => {};
  const id = navigator.geolocation.watchPosition(
    (pos) =>
      onUpdate({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        altitude: pos.coords.altitude,
      }),
    () => {},
    opts
  );
  return () => navigator.geolocation.clearWatch(id);
}

// ---- green polygon geometry ------------------------------------------
// A green's real boundary (when we have one, from OSM) is a handful of
// lat/lon points a few metres to tens of metres apart — far too small a
// span for great-circle math to matter. These project onto a local flat
// plane (equirectangular, centred on whichever point is passed as origin)
// so ordinary 2D segment/distance math applies; error over these
// distances is sub-metre, well under a yardage display's precision.
function toLocalXY(p, origin) {
  const mPerDegLat = 110574;
  const mPerDegLon = 111320 * Math.cos(toRad(origin.lat));
  return { x: (p.lon - origin.lon) * mPerDegLon, y: (p.lat - origin.lat) * mPerDegLat };
}

/** Simple average-of-vertices centroid — good enough for a green's small,
 * roughly-convex footprint (a proper area-weighted centroid buys nothing
 * meaningful at this scale). */
export function polygonCentroid(points) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lon = points.reduce((s, p) => s + p.lon, 0) / points.length;
  return { lat, lon };
}

function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * abx, y: a.y + t * aby };
}

/** Distance in yards from `here` to the nearest point on the green's
 * boundary — the "front" edge as approached from wherever the golfer is
 * standing right now, not a fixed marked point. */
export function closestEdgeYards(here, points) {
  const local = points.map((p) => toLocalXY(p, here));
  let best = Infinity;
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = local[(i + 1) % local.length];
    const c = closestPointOnSegment({ x: 0, y: 0 }, a, b);
    const d = Math.hypot(c.x, c.y);
    if (d < best) best = d;
  }
  return Math.round(metresToYards(best));
}

/** Distance in yards from `here` to the farthest boundary vertex —
 * approximates the green's back edge (accurate as long as the boundary is
 * traced with a reasonable number of points, which OSM golf greens
 * typically are). */
export function farthestVertexYards(here, points) {
  let best = 0;
  for (const p of points) {
    const d = haversineMetres(here, p);
    if (d > best) best = d;
  }
  return Math.round(metresToYards(best));
}

// ---- hole matching --------------------------------------------------
// OSM has no reliable "this fairway/green/tee belongs to hole 7" tag
// (route=golf relations exist in the schema but are essentially never
// populated — confirmed empty even at Pebble Beach). So a hole's fairway
// and tee are found the same way the green itself is: geometrically,
// by proximity. A real fairway polygon runs from tee to green and
// typically touches or nearly touches both, so "nearest fairway whose
// boundary comes close to the green's boundary" is a solid heuristic —
// and likewise for "nearest tee close to that fairway's boundary."

/** Closest distance in metres between any point of polygon A and any point
 * of polygon B. O(n*m) — fine at these sizes (tens of points each),
 * called once per hole change, not per GPS tick. */
function minDistanceBetweenPolygonsM(pointsA, pointsB) {
  let best = Infinity;
  for (const a of pointsA) {
    for (const b of pointsB) {
      const d = haversineMetres(a, b);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Nearest not-yet-used fairway whose boundary comes within maxDistM of the
 * green's boundary — null if nothing qualifies (never guessed). */
export function findConnectedFairway(green, fairways, usedIds, maxDistM = 60) {
  let best = null;
  let bestDist = Infinity;
  for (const f of fairways) {
    if (usedIds.has(f.id)) continue;
    const d = minDistanceBetweenPolygonsM(green.points, f.points);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return bestDist <= maxDistM ? best : null;
}

/** Nearest not-yet-used tee box whose boundary comes within maxDistM of the
 * fairway's boundary — null if nothing qualifies. */
export function findConnectedTee(fairway, teeBoxes, usedIds, maxDistM = 60) {
  let best = null;
  let bestDist = Infinity;
  for (const t of teeBoxes) {
    if (usedIds.has(t.id)) continue;
    const d = minDistanceBetweenPolygonsM(fairway.points, t.points);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return bestDist <= maxDistM ? best : null;
}
