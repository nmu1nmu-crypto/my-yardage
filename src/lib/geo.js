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
