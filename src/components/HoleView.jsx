// Renders the hole as it plays from wherever the golfer is standing right
// now — fairway, tee (if not already played past), every hazard, and the
// green — with front/middle/back and hazard-carry yardages marked directly
// on the shapes, the way a real golf GPS rangefinder does. Auto-zooms:
// projection is centred on the golfer's live position, rotated so the
// direction of play points up, so the view naturally tightens to "what's
// left to play" as the golfer walks — anything behind the golfer falls
// outside the frame and is clipped by the SVG viewport, no explicit
// polygon-clipping math needed.
//
// Falls back to a plain dashed oval (no fairway/hazards) when this course
// isn't mapped on OSM — never fabricates a shape as if it were real.

const VIEW_W = 260;
const VIEW_H = 360;
const MPER_DEG_LAT = 110574;
// Golfer sits near the bottom of the frame, green fills the rest above —
// matches how rangefinder apps frame "you are here, green up top."
const GOLFER_ANCHOR_Y = VIEW_H * 0.82;

function buildProjector(here, greenCentroid) {
  const mPerDegLon = 111320 * Math.cos((here.lat * Math.PI) / 180);
  const dLat = (greenCentroid.lat - here.lat) * MPER_DEG_LAT;
  const dLon = (greenCentroid.lon - here.lon) * mPerDegLon;
  const bearing = Math.atan2(dLon, dLat);
  const cos = Math.cos(-bearing);
  const sin = Math.sin(-bearing);
  return (points) =>
    points.map((p) => {
      const x = (p.lon - here.lon) * mPerDegLon;
      const y = (p.lat - here.lat) * MPER_DEG_LAT;
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    });
}

function nearestVertex(local) {
  let best = local[0];
  let bestD = Infinity;
  for (const p of local) {
    const d = Math.hypot(p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// Front/back-of-green anchors pick by y (distance along the direction of
// play) rather than raw straight-line distance from the golfer — a wide or
// angled green can have its Euclidean-farthest vertex sitting off to one
// side with a smaller y than the golfer's own position, which would place
// the "back" label behind the golfer, off the frame the view was scaled to.
function frontVertex(local) {
  return local.reduce((best, p) => (p.y < best.y ? p : best), local[0]);
}

function backVertex(local) {
  return local.reduce((best, p) => (p.y > best.y ? p : best), local[0]);
}

function centroid(local) {
  return {
    x: local.reduce((s, p) => s + p.x, 0) / local.length,
    y: local.reduce((s, p) => s + p.y, 0) / local.length,
  };
}

const HAZARD_FILL = { bunker: "#e3cd94", water: "var(--sky-400)" };
const HAZARD_STROKE = { bunker: "#a8874a", water: "var(--sky-700)" };

export default function HoleView({
  greenPoints,
  fairwayPoints,
  teePoints,
  hazards,
  here,
  isReal,
  front,
  middle,
  back,
}) {
  const hasHole = isReal && greenPoints && greenPoints.length >= 3 && here;
  let scene = null;

  if (hasHole) {
    const greenCentroidLatLon = greenPoints.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat / greenPoints.length, lon: acc.lon + p.lon / greenPoints.length }),
      { lat: 0, lon: 0 }
    );
    const project = buildProjector(here, greenCentroidLatLon);
    const localGreen = project(greenPoints);
    const localFairway = fairwayPoints ? project(fairwayPoints) : null;
    const localTee = teePoints ? project(teePoints) : null;
    // Only hazards genuinely still ahead of the golfer — one already played
    // past shouldn't force the view to zoom out to include it, and (since
    // the frame's scale is fit to what's ahead) drawing a behind-the-golfer
    // hazard at that same scale would just place it off-canvas anyway.
    const aheadHazards = (hazards ?? [])
      .map((h) => ({ kind: h.kind, local: project(h.points), label: h.label }))
      .filter((h) => h.local.some((p) => p.y >= -10));

    const framePoints = [{ x: 0, y: 0 }, ...localGreen, ...aheadHazards.flatMap((h) => h.local)];
    const xs = framePoints.map((p) => p.x);
    const ys = framePoints.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs) || 1;
    const h = Math.max(...ys) - Math.min(...ys) || 1;
    const scale = Math.min((VIEW_W * 0.72) / w, (VIEW_H * 0.72) / h);
    const cx = VIEW_W / 2;

    // Anchored on the golfer (always at local (0,0)), not the frame's
    // centre — so "here" reliably lands at GOLFER_ANCHOR_Y regardless of
    // how far above it the green sits.
    const toSvg = (p) => `${(cx + p.x * scale).toFixed(1)},${(GOLFER_ANCHOR_Y - p.y * scale).toFixed(1)}`;
    const pathFrom = (local) => "M " + local.map(toSvg).join(" L ") + " Z";

    // Pill anchors get clamped inside the frame — a wide or angled green's
    // extreme vertex can land just past the golfer's own axis (still a
    // valid point on a real polygon), which without clamping would place a
    // distance label off-canvas. The shape itself is drawn with the
    // unclamped toSvg above; only the small text labels need this.
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const anchorSvg = (p) => {
      const x = clamp(cx + p.x * scale, 18, VIEW_W - 18);
      const y = clamp(GOLFER_ANCHOR_Y - p.y * scale, 13, VIEW_H - 13);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    scene = {
      greenPath: pathFrom(localGreen),
      fairwayPath: localFairway ? pathFrom(localFairway) : null,
      teePath: localTee ? pathFrom(localTee) : null,
      hazardShapes: aheadHazards.map((h) => ({
        kind: h.kind,
        d: pathFrom(h.local),
        label: h.label,
        // Anchor on the nearest point that's actually ahead — the polygon
        // can still dip behind the golfer at the edges even though the
        // hazard as a whole qualifies as "ahead".
        anchor: anchorSvg(nearestVertex(h.local.filter((p) => p.y >= -10))),
      })),
      golferAnchor: toSvg({ x: 0, y: 0 }),
      frontAnchor: anchorSvg(frontVertex(localGreen)),
      backAnchor: anchorSvg(backVertex(localGreen)),
      middleAnchor: anchorSvg(centroid(localGreen)),
    };
  }

  return (
    <div className="hole-view">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="280" preserveAspectRatio="xMidYMid meet">
        {scene ? (
          <>
            {scene.fairwayPath && <path d={scene.fairwayPath} fill="#3d9960" opacity="0.9" />}
            {scene.hazardShapes.map((h, i) => (
              <path key={i} d={h.d} fill={HAZARD_FILL[h.kind]} stroke={HAZARD_STROKE[h.kind]} strokeWidth="1.5" />
            ))}
            {scene.teePath && <path d={scene.teePath} fill="#8a8266" />}
            <path d={scene.greenPath} fill="var(--pine-400)" stroke="var(--pine-100)" strokeWidth="2" />

            {scene.hazardShapes.map((h, i) => (
              <g key={`lbl-${i}`} transform={`translate(${h.anchor})`}>
                <circle r="13" fill="rgba(4,8,6,0.72)" stroke={HAZARD_STROKE[h.kind]} strokeWidth="1" />
                <text textAnchor="middle" dy="3.5" fontSize="9" fontWeight="700" fill="var(--ink)">
                  {h.label}
                </text>
              </g>
            ))}

            <g transform={`translate(${scene.backAnchor})`}>
              <rect x="-16" y="-9" width="32" height="18" rx="9" fill="rgba(4,8,6,0.72)" />
              <text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="700" fill="var(--ink)">{back}</text>
            </g>
            <g transform={`translate(${scene.middleAnchor})`}>
              <rect x="-16" y="-9" width="32" height="18" rx="9" fill="var(--gold-500)" />
              <text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="700" fill="var(--gold-900)">{middle}</text>
            </g>
            <g transform={`translate(${scene.frontAnchor})`}>
              <rect x="-16" y="-9" width="32" height="18" rx="9" fill="rgba(4,8,6,0.72)" />
              <text textAnchor="middle" dy="3.5" fontSize="10" fontWeight="700" fill="var(--ink)">{front}</text>
            </g>

            <g transform={`translate(${scene.golferAnchor})`}>
              <circle r="7" fill="var(--gold-500)" stroke="var(--paper)" strokeWidth="2" />
            </g>
          </>
        ) : (
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            rx={VIEW_W * 0.3}
            ry={VIEW_H * 0.28}
            fill="var(--pine-600)"
            stroke="var(--pine-200)"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
      </svg>

      {!scene && (
        <>
          <div className="hole-view-label back">
            <span className="lbl">Back</span>
            <span className="val num">{back ?? "—"}</span>
          </div>
          <div className="hole-view-label middle">
            <span className="lbl">Middle</span>
            <span className="val num">{middle ?? "—"}</span>
          </div>
          <div className="hole-view-label front">
            <span className="lbl">Front</span>
            <span className="val num">{front ?? "—"}</span>
          </div>
          <p className="muted small" style={{ textAlign: "center", marginTop: 6 }}>
            Approximate shape — this course's green isn't mapped yet.
          </p>
        </>
      )}
    </div>
  );
}
