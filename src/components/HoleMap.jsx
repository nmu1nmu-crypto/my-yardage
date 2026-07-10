import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * Live satellite drill-in for the current hole.
 * - ESRI World Imagery tiles (via their CDN, no VPS)
 * - Green polygon overlay from OpenStreetMap (cached in courseCache)
 * - Player's live GPS dot (via Capacitor)
 * - Yardage rings (100/150/200/250) drawn from the green centroid
 */
export default function HoleMap({ courseCache, courseId, onBack }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  // Load cached course data
  const course = courseCache?.[courseId] || null;

  useEffect(() => {
    if (!mapContainer.current || !course) return;

    // Center on the course (use first green centroid, or course location)
    let center = { lng: course.lng ?? -122.0, lat: course.lat ?? 37.0 };
    if (course.greens && course.greens.length) {
      const g = course.greens[0].points;
      center = {
        lng: g.reduce((s, p) => s + p.lon, 0) / g.length,
        lat: g.reduce((s, p) => s + p.lat, 0) / g.length,
      };
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          esri: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "Tiles © Esri",
          },
        },
        layers: [
          { id: "esri", type: "raster", source: "esri", minzoom: 0, maxzoom: 22 },
        ],
      },
      center: [center.lng, center.lat],
      zoom: 17,
      pitch: 0,
      attributionControl: false,
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.current.on("load", () => {
      if (!course.greens?.length) return;

      // Add green polygon (one combined feature to keep layers tidy)
      map.current.addSource("greens", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: course.greens.map((g, i) => ({
            type: "Feature",
            properties: { id: `g${i}` },
            geometry: {
              type: "Polygon",
              coordinates: [
                [...g.points.map((p) => [p.lon, p.lat]), [g.points[0].lon, g.points[0].lat]],
              ],
            },
          })),
        },
      });
      map.current.addLayer({
        id: "greens-fill",
        type: "fill",
        source: "greens",
        paint: { "fill-color": "#22c55e", "fill-opacity": 0.55 },
      });
      map.current.addLayer({
        id: "greens-outline",
        type: "line",
        source: "greens",
        paint: { "line-color": "#14532d", "line-width": 2 },
      });

      // Yardage rings around first green centroid (in metres, 1yd = 0.9144m)
      const [clng, clat] = map.current.getSource("greens").data.features[0]
        .geometry.coordinates[0][Math.floor(map.current.getSource("greens").data.features[0].geometry.coordinates[0].length / 2)];
      const RING_YARDS = [100, 150, 200, 250];
      const metresPerDegLat = 110574;
      const metresPerDegLon = 111320 * Math.cos((clat * Math.PI) / 180);

      RING_YARDS.forEach((yd, i) => {
        const m = yd * 0.9144;
        const pts = [];
        for (let a = 0; a <= 360; a += 10) {
          const rad = (a * Math.PI) / 180;
          pts.push([
            clng + (Math.cos(rad) * m) / metresPerDegLon,
            ```jsx
clat + (Math.sin(rad)  m) / metresPerDegLat,
          ]);
        }
        pts.push(pts[0]);
        map.current.addSource(`ring-${yd}`, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: pts } } });
        map.current.addLayer({
          id: `ring-${yd}`,
          type: "line",
          source: `ring-${yd}`,
          paint: { "line-color": i % 2 ? "#facc15" : "#ffffff", "line-width": 1.2, "line-dasharray": [4, 3] },
        });
      });

      // Fit to greens + a bit of fairway padding
      const coords = course.greens.flatMap((g) => g.points.map((p) => [p.lon, p.lat]));
      if (coords.length) map.current.fitBounds(coords, { padding: 80, maxZoom: 19, duration: 0 });

      setReady(true);
    });

    return () => {
      if (map.current) {
        try { map.current.remove(); } catch {}
        map.current = null;
      }
    };
  }, [courseId]);

  // Live player dot
  useEffect(() => {
    if (!ready  !marker.current !== false && map.current && course) {
      marker.current = new maplibregl.Marker({ color: "#2563eb", scale: 0.8 })
        .setLngLat([course.lng ?? -122.0, course.lat ?? 37.0])
        .addTo(map.current);
    }

    const id = setInterval(async () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (p) => marker.current && marker.current.setLngLat([p.coords.longitude, p.coords.latitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 }
      );
    }, 4000);

    return () => clearInterval(id);
  }, [ready]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/ Back button /}
      <button onClick={onBack} style={btnStyle}>← Back</button>

      {/ Course title /}
      <div style={titleStyle}>
        {course?.name  "Course"}
      </div>

      {/ Legend /}
      <div style={legendStyle}>
        <div><Dot c="#22c55e" /> Green</div>
        <div><Dot c="#2563eb" /> You</div>
        <div><Line c="#fff" /> 200/250 yd</div>
        <div><Line c="#facc15" /> 100/150 yd</div>
      </div>

      {/ Error banner /}
      {err && (
        <div style={{ position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)", background: "#ef4444", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 14, zIndex: 60 }}>
          {err}
        </div>
      )}

      {(!ready && !err) && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#fff", fontSize: 16 }}>
          Loading satellite view…
        </div>
      )}
    </div>
  );
}

// Tiny style helpers (kept in-file so we don't touch styles.css yet)
const btnStyle = {
  position: "absolute", top: 16, left: 16, zIndex: 10,
  background: "rgba(0,0,0,0.6)", color: "#fff", border: 0,
  borderRadius: 20, padding: "8px 18px", fontSize: 15, cursor: "pointer",
};
const titleStyle = {
  position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10,
  background: "rgba(0,0,0,0.65)", color: "#fff",
  borderRadius: 20, padding: "8px 22px", fontSize: 15, fontWeight: 600,
};
const legendStyle = {
  position: "absolute", bottom: 24, left: 16, zIndex: 10,
  background: "rgba(0,0,0,0.65)", color: "#fff",
  borderRadius: 10, padding: "10px 14px", fontSize: 13, lineHeight: 1.7,
};
function Dot({ c }) { return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: c, verticalAlign: "middle", marginRight: 6 }} />; }
function Line({ c }) { return <span style={{ display: "inline-block", width: 16, height: 2, background: c, verticalAlign: "middle", marginRight: 6 }} />; }
```
