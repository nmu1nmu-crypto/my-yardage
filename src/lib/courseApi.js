// Course lookup via OpenGolfAPI (opengolfapi.org) — free, no key, CORS-enabled.
// Coverage is strongest for US courses today; many UK/international clubs
// exist only as name+location stubs with no hole data yet. Every call here
// must fail soft — course lookup is an optional enhancement, never a
// requirement to start a round (the app must still work fully offline).

const BASE = "https://api.opengolfapi.org/v1";
export const ATTRIBUTION = "Course data: OpenGolfAPI (opengolfapi.org), ODbL";

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenGolfAPI ${res.status}`);
  return res.json();
}

/** Search by name, or by {lat, lng, radiusMi} for a "near me" list. */
export async function searchCourses({ q, lat, lng, radiusMi = 25, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (lat != null && lng != null) {
    params.set("lat", lat);
    params.set("lng", lng);
    params.set("radius_mi", radiusMi);
  }
  params.set("limit", limit);
  try {
    const data = await getJson(`${BASE}/courses/search?${params}`);
    return data.courses ?? [];
  } catch {
    return [];
  }
}

/** Hole-by-hole par/stroke-index/yardages for a course, or [] if unmapped. */
export async function fetchCourseHoles(courseId) {
  try {
    const data = await getJson(`${BASE}/courses/${courseId}/holes`);
    return (data.holes ?? []).map((h) => ({
      number: h.number,
      par: h.par ?? 4,
      strokeIndex: h.handicap_index ?? null,
      yardages: h.yardages ?? null,
    }));
  } catch {
    return [];
  }
}
