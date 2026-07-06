// Renders the green as a shape with front/middle/back yardages overlaid —
// a real traced boundary when OSM has one mapped for this course, a
// generic oval otherwise. Never fabricates a shape as if it were real:
// the generic oval is visually distinct (dashed outline) so it reads as
// "approximate" rather than "this is really what the green looks like."

const VIEW_W = 220;
const VIEW_H = 300;

function realGreenPath(points, here) {
  const centroid = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat / points.length, lon: acc.lon + p.lon / points.length }),
    { lat: 0, lon: 0 }
  );
  const mPerDegLat = 110574;
  const mPerDegLon = 111320 * Math.cos((centroid.lat * Math.PI) / 180);
  let local = points.map((p) => ({
    x: (p.lon - centroid.lon) * mPerDegLon,
    y: (p.lat - centroid.lat) * mPerDegLat,
  }));

  // Rotate so "front" (the edge nearest the golfer) lands at the bottom of
  // the view, matching how a rangefinder's green-view screen orients itself.
  if (here) {
    const dLat = (here.lat - centroid.lat) * mPerDegLat;
    const dLon = (here.lon - centroid.lon) * mPerDegLon;
    const bearing = Math.atan2(dLon, dLat);
    const cos = Math.cos(-bearing);
    const sin = Math.sin(-bearing);
    local = local.map(({ x, y }) => ({ x: x * cos - y * sin, y: x * sin + y * cos }));
  }

  const xs = local.map((p) => p.x);
  const ys = local.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = Math.min((VIEW_W * 0.7) / w, (VIEW_H * 0.7) / h);
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;

  // Flip Y: local "up" (away from golfer, i.e. back of green) should render
  // toward the top of the SVG, where screen-space y grows downward.
  const toSvg = (p) => {
    const x = cx + (p.x - (minX + maxX) / 2) * scale;
    const y = cy - (p.y - (minY + maxY) / 2) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  return "M " + local.map(toSvg).join(" L ") + " Z";
}

export default function GreenView({ points, here, front, middle, back, isReal }) {
  const hasPolygon = isReal && points && points.length >= 3;

  return (
    <div className="green-view">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="220" preserveAspectRatio="xMidYMid meet">
        {hasPolygon ? (
          <path
            d={realGreenPath(points, here)}
            fill="var(--pine-400)"
            stroke="var(--pine-100)"
            strokeWidth="2"
          />
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
