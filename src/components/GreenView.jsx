// Renders the green complex — green shape plus nearby bunkers/water —
// with front/middle/back yardages overlaid. A real traced boundary when
// OSM has one mapped for this course, a generic oval otherwise. Never
// fabricates a shape as if it were real: the generic oval is visually
// distinct (dashed outline) so it reads as "approximate" rather than
// "this is really what the green looks like." Hazards only ever render
// alongside a real green (there's nothing meaningful to place them
// relative to in the generic/manual-marking case).

const VIEW_W = 240;
const VIEW_H = 320;

const HAZARD_STYLE = {
  bunker: { fill: "#e3cd94", stroke: "#a8874a" },
  water: { fill: "var(--sky-400)", stroke: "var(--sky-700)" },
};

/** Projects lat/lon points onto a local, rotated (front-of-green-at-
 * bottom) plane centred on the green's centroid — the single shared
 * transform every polygon (green + hazards) must use so they stay
 * spatially consistent with each other. */
function buildProjector(greenPoints, here) {
  const centroid = greenPoints.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat / greenPoints.length, lon: acc.lon + p.lon / greenPoints.length }),
    { lat: 0, lon: 0 }
  );
  const mPerDegLat = 110574;
  const mPerDegLon = 111320 * Math.cos((centroid.lat * Math.PI) / 180);

  let cos = 1;
  let sin = 0;
  if (here) {
    const dLat = (here.lat - centroid.lat) * mPerDegLat;
    const dLon = (here.lon - centroid.lon) * mPerDegLon;
    const bearing = Math.atan2(dLon, dLat);
    cos = Math.cos(-bearing);
    sin = Math.sin(-bearing);
  }

  return (points) =>
    points.map((p) => {
      const x = (p.lon - centroid.lon) * mPerDegLon;
      const y = (p.lat - centroid.lat) * mPerDegLat;
      return { x: x * cos - y * sin, y: x * sin + y * cos };
    });
}

function pathFromLocal(local, toSvg) {
  return "M " + local.map(toSvg).join(" L ") + " Z";
}

export default function GreenView({ points, hazards, here, front, middle, back, isReal }) {
  const hasPolygon = isReal && points && points.length >= 3;

  let greenPath = null;
  let hazardPaths = [];

  if (hasPolygon) {
    const project = buildProjector(points, here);
    const localGreen = project(points);
    const localHazards = (hazards ?? []).map((h) => ({ kind: h.kind, local: project(h.points) }));

    // Bounding box across green + every hazard, so a bunker or pond just
    // off the green's edge doesn't get cropped out of the view.
    const allLocal = [localGreen, ...localHazards.map((h) => h.local)].flat();
    const xs = allLocal.map((p) => p.x);
    const ys = allLocal.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX || 1;
    const h = maxY - minY || 1;
    const scale = Math.min((VIEW_W * 0.75) / w, (VIEW_H * 0.75) / h);
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;

    // Flip Y: local "up" (away from golfer, i.e. back of green) should
    // render toward the top of the SVG, where screen-space y grows down.
    const toSvg = (p) => {
      const x = cx + (p.x - (minX + maxX) / 2) * scale;
      const y = cy - (p.y - (minY + maxY) / 2) * scale;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    };

    greenPath = pathFromLocal(localGreen, toSvg);
    hazardPaths = localHazards.map((h) => ({ kind: h.kind, d: pathFromLocal(h.local, toSvg) }));
  }

  return (
    <div className="green-view">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="240" preserveAspectRatio="xMidYMid meet">
        {hasPolygon ? (
          <>
            {hazardPaths.map((h, i) => (
              <path key={i} d={h.d} fill={HAZARD_STYLE[h.kind].fill} stroke={HAZARD_STYLE[h.kind].stroke} strokeWidth="1.5" />
            ))}
            <path d={greenPath} fill="var(--pine-400)" stroke="var(--pine-100)" strokeWidth="2" />
          </>
        ) : (
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            rx={VIEW_W * 0.32}
            ry={VIEW_H * 0.32}
            fill="var(--pine-600)"
            stroke="var(--pine-200)"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        )}
        {/* Golfer marker, always at the bottom — front is always "toward you" */}
        <circle cx={VIEW_W / 2} cy={VIEW_H - 14} r="6" fill="var(--gold-500)" />
      </svg>

      <div className="green-view-label back">
        <span className="lbl">Back</span>
        <span className="val num">{back ?? "—"}</span>
      </div>
      <div className="green-view-label middle">
        <span className="lbl">Middle</span>
        <span className="val num">{middle ?? "—"}</span>
      </div>
      <div className="green-view-label front">
        <span className="lbl">Front</span>
        <span className="val num">{front ?? "—"}</span>
      </div>

      {!hasPolygon && (
        <p className="muted small" style={{ textAlign: "center", marginTop: 6 }}>
          Approximate shape — this course's green isn't mapped yet.
        </p>
      )}
    </div>
  );
}
