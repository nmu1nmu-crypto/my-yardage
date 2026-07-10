import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// After 10s without a map "load" event, give up and show an error to the user
// instead of showing the loading spinner forever.
const LOAD_TIMEOUT_MS = 10_000;

export default function HoleMap({ courseCache, courseId }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const course = courseCache?.[courseId] || null;

  useEffect(() => {
    // Case A: no course selected (Map tab opened without picking a course first)
    if (!course) {
      setError("No course selected");
      setLoading(false); return;
    }
    // Case B: course selected but no cached greens (courseApi returned nothing AND OSM had nothing)
    if (!course.greens || course.greens.length === 0) {
      setError(`"${course.name}" has no green boundaries. OpenGolfAPI doesn't cover most UK clubs well. Try adding greens manually later.`);
      setLoading(false); return;
    }

    // Case C: we have greens, attempt to render MapLibre
    setError(null); setLoading(true);
    const pts = course.greens[0].points;
    const lng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;

    if (!mapContainer.current || map.current) return;

    // Timeout so we don't show loading forever if MapLibre fails to init
    const timeout = setTimeout(() => {
      if (!ready) {
        setError("Map engine failed to load (iOS WebGL issue). The course is cached locally but MapLibre couldn't render it on this device.");
        setLoading(false);
        if (map.current) { try { map.current.remove(); } catch {} map.current = null; }
      }
    }, LOAD_TIMEOUT_MS);

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            esri: {
              type: "raster",
              tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
              tileSize: 256,
            },
          },
          layers: [{ id: "esri", type: "raster", source: "esri", minzoom: 0, maxzoom: 22 }],
        },
        center: [lng, lat],
        zoom: 16,
        pitch: 0,
        attributionControl: false,
      });

      map.current.on("load", () => {
        clearTimeout(timeout);
        // Green polygons
        map.current.addSource("greens", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: course.greens.map((g, i) => ({
              type: "Feature", properties: { id: i },
              geometry: { type: "Polygon",
                coordinates: [[...g.points.map((p) => [p.lon, p.lat]), [g.points[0].lon, g.points[0].lat]]] },
            })),
          },
        });
        map.current.addLayer({ id: "g-fill", type: "fill", source: "greens", paint: { "fill-color": "#22c55e", "fill-opacity": 0.5 } });
        map.current.addLayer({ id: "g-line", type: "line", source: "greens", paint: { "line-color": "#14532d", "line-width": 2 } });

        // Yardage rings
        const mPerLat = 110574, mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
        [100, 200, 250].forEach((y, i) => {
          const m = y * 0.9144; const ring = [];
          for (let a = 0; a < 360; a += 10) {
            const r = (a * Math.PI) / 180;
            ring.push([lng + (Math.cos(r) * m) / mPerLon, lat + (Math.sin(r) * m) / mPerLat]);
          }
          ring.push(ring[0]);
          map.current.addSource("r" + y, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: ring } } });
          map.current.addLayer({ id: "r" + y, type: "line", source: "r" + y,
            paint: { "line-color": i ? "#fff" : "#facc15", "line-width": 1.5, "line-dasharray": [5, 3] } });
        });

        const coords = course.greens.flatMap((g) => g.points.map((p) => [p.lon, p.lat]));
        if (coords.length) {
          const bounds = new maplibregl.LngLatBounds();
          coords.forEach((c) => bounds.extend(c));
          map.current.fitBounds(bounds, { padding: 80, maxZoom: 19 });
        }
        setReady(true); setLoading(false);
      });

      map.current.on("error", (e) => {
        console.warn("MapLibre error:", e.error);
        clearTimeout(timeout);
        if (!ready) {
          setError("Map failed to render: " + (e.error?.message || "unknown error"));
          setLoading(false);
        }
      });
    } catch (err) {
      clearTimeout(timeout);
      if (!ready) { setError("Map init crashed: " + err.message); setLoading(false); }
    }

    return () => { clearTimeout(timeout); if (map.current) { try { map.current.remove(); } catch {} map.current = null; } };
  }, [courseId]);

  // Loading screen (before timeout/error kicks in)
  if (loading && !error) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", background: "rgba(0,0,0,0.8)", padding: "20px 32px", borderRadius: 12, textAlign: "center" }}>
          Loading satellite view...
          <br/><span style={{ fontSize: 12, opacity: 0.7 }}>{course?.name || ""}</span>
        </div>
      </div>
    );
  }

  // Error screen (no course / no greens / MapLibre timeout or failure)
  if (error && !ready) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ color: "#fff", background: "#1a0a0a", border: "1px solid #ef4444", borderRadius: 12, padding: "24px 28px", textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: "#ef4444" }}>Map Unavailable</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#fca5a5" }}>{error}</div>
        </div>
      </div>
    );
  }

  // Map view (only when ready)
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
        <button onClick={() => location.reload()} style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: 0, borderRadius: 20, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>Home</button>
      </div>
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 20, padding: "8px 18px", fontSize: 14, fontWeight: 600, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>{course?.name || "Course"} - Sat</div>
      <div style={{ position: "absolute", bottom: 20, left: 16, zIndex: 10, background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 12, lineHeight: 1.7 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", marginRight: 5 }} />Green<br/>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb", verticalAlign: "middle", marginRight: 5 }} />You<br/>
        100 / 200 / 250 yd rings
      </div>
    </div>
  );
}
