// "Plays like" = raw distance adjusted for wind and elevation.
// Weather comes from Open-Meteo (free, no key). If offline, we fall back
// to raw distance and say so — never invent conditions.

const CACHE_MS = 15 * 60 * 1000; // one weather fetch per quarter hour is plenty
let cache = null;

export async function fetchWeather({ lat, lon }) {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,wind_direction_10m&wind_speed_unit=mph`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather unavailable");
  const json = await res.json();
  const data = {
    tempC: json.current.temperature_2m,
    windMph: json.current.wind_speed_10m,
    windFromDeg: json.current.wind_direction_10m, // direction wind comes FROM
  };
  cache = { at: Date.now(), data };
  return data;
}

/**
 * Adjust a raw yardage for conditions.
 * Rules of thumb used by caddies (approximate by design — this is a
 * club-selection aid, not ballistics):
 *  - headwind: +1% of distance per 1 mph; tailwind: -0.5% per 1 mph
 *    (headwind hurts roughly twice as much as tailwind helps)
 *  - elevation: 1 yard per yard of rise/fall (a 15 ft uphill shot plays ~5 yds longer)
 *  - temperature: ±1 yard per 10°C from 20°C baseline on a mid-iron
 */
export function playsLike({ yards, shotBearingDeg, weather, elevationDeltaFt = 0 }) {
  if (!weather) {
    return { adjusted: yards, parts: [], note: "No weather — raw yardage" };
  }
  const parts = [];

  // Wind component along the shot line. windFromDeg is where wind comes FROM,
  // so wind TOWARD = windFromDeg + 180. Headwind when wind blows against shot bearing.
  const windTowardDeg = (weather.windFromDeg + 180) % 360;
  const angle = ((windTowardDeg - shotBearingDeg + 540) % 360) - 180; // -180..180
  const along = Math.cos((angle * Math.PI) / 180) * weather.windMph;
  // along > 0 means wind pushes the ball forward (tailwind)
  const windAdj =
    along >= 0 ? -(yards * 0.005 * along) : yards * 0.01 * -along;
  if (Math.abs(windAdj) >= 1) {
    parts.push({
      label: along >= 0 ? "tailwind" : "headwind",
      yards: Math.round(windAdj),
      detail: `${Math.round(weather.windMph)} mph`,
    });
  }

  const elevAdj = elevationDeltaFt / 3; // 3 ft ≈ 1 yard of play
  if (Math.abs(elevAdj) >= 1) {
    parts.push({
      label: elevationDeltaFt > 0 ? "uphill" : "downhill",
      yards: Math.round(elevAdj),
      detail: `${Math.abs(Math.round(elevationDeltaFt))} ft`,
    });
  }

  const tempAdj = -((weather.tempC - 20) / 10);
  if (Math.abs(tempAdj) >= 1) {
    parts.push({ label: weather.tempC < 20 ? "cold" : "warm", yards: Math.round(tempAdj), detail: `${Math.round(weather.tempC)}°C` });
  }

  const adjusted = Math.round(yards + parts.reduce((s, p) => s + p.yards, 0));
  return { adjusted, parts, note: null };
}
