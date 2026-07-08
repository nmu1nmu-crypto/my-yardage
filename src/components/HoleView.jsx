// Renders the hole as it plays from wherever the golfer is standing right
// now — fairway, tee (if not already played past), every hazard, and the
// green — with a pin flag marking the aim point and a dashed line down to
// the golfer, the way a real golf GPS rangefinder's top-down graphic looks.
// Auto-zooms: projection is centred on the golfer's live position, rotated
// so the direction of play points up, so the view naturally tightens to
// "what's left to play" as the golfer walks — anything behind the golfer
// falls outside the frame and is clipped by the SVG viewport, no explicit
// polygon-clipping math needed.
//
// Distance numbers live in the Game screen's own readout pills, not on this
// graphic — this stays a clean illustration, real shapes only, no labels.
//
// Falls back to a plain dashed oval (no fairway/hazards) when this course
// isn't mapped on OSM — never fabricates a shape as if it were real.

const VIEW_W = 220;
const VIEW_H = 260;
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

function centroid(local) {
  return {
    x: local.reduce((s, p) => s + p.x, 0) / local.length,
    y: local.reduce((s, p) => s + p.y, 0) / local.length,
  };
}

const HAZARD_FILL = { bunker: "#e3cd94", water: "#6bb7d4" };
const HAZARD_STROKE = { bunker: "#a8874a", water: "#3a7d95" };

export default function HoleView({ greenPoints, fairwayPoints, teePoints, hazards, here, isReal }) {
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
      .map((h) => ({ kind: h.kind, local: project(h.points) }))
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
    const pin = centroid(localGreen);

    scene = {
      greenPath: pathFrom(localGreen),
      fairwayPath: localFairway ? pathFrom(localFairway) : null,
      teePath: localTee ? pathFrom(localTee) : null,
      hazardShapes: aheadHazards.map((h) => ({ kind: h.kind, d: pathFrom(h.local) })),
      golferAnchor: toSvg({ x: 0, y: 0 }),
      pinAnchor: toSvg(pin),
    };
  }

  return (
    <div className="hole-view">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="220" preserveAspectRatio="xMidYMid meet">
        {scene ? (
          <>
            {scene.fairwayPath && <path d={scene.fairwayPath} fill="#3d9960" opacity="0.9" />}
            {scene.hazardShapes.map((h, i) => (
              <path key={i} d={h.d} fill={HAZARD_FILL[h.kind]} stroke={HAZARD_STROKE[h.kind]} strokeWidth="1.5" />
            ))}
            {scene.teePath && <path d={scene.teePath} fill="#8a8266" />}
            <path d={scene.greenPath} fill="#1f6349" stroke="#c9a94e" strokeWidth="2" />

            <line
              x1={scene.pinAnchor.split(",")[0]}
              y1={scene.pinAnchor.split(",")[1]}
              x2={scene.golferAnchor.split(",")[0]}
              y2={scene.golferAnchor.split(",")[1]}
              stroke="rgba(245,241,230,0.5)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <g transform={`translate(${scene.pinAnchor})`}>
              <line x1="0" y1="0" x2="0" y2="-18" stroke="var(--ink)" strokeWidth="1.5" />
              <path d="M 0 -18 L 10 -14 L 0 -10 Z" fill="var(--gold)" />
            </g>
            <g transform={`translate(${scene.golferAnchor})`}>
              <circle r="6" fill="var(--gold)" stroke="var(--paper)" strokeWidth="2" />
            </g>
          </>
        ) : (
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            rx={VIEW_W * 0.3}
            ry={VIEW_H * 0.28}
            fill="#1f6349"
            stroke="#c9a94e"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
      </svg>
    </div>
  );
}
