import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function HoleMap({ courseCache, courseId }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [ready, setReady] = useState(false);
  const course = courseCache?.[courseId] || null;

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!course || !course.greens?.length) return;
    const pts = course.greens[0].points;
    const lng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
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
        zoom: 17,
        pitch: 0,
        attributionControl: false,
      });
      map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      map.current.on("load", () => {
        map.current.addSource("greens", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: course.greens.map((g, i) => ({
              type: "Feature",
              properties: { id: i },
              geometry: {
                type: "Polygon",coordinates: [[...g.points.map((p) => [p.lon, p.lat]), [g.points[0].lon, g.points[0].lat]]],
              },
            })),
          },
        });
        map.current.addLayer({ id: "g-fill", type: "fill", source: "greens", paint: { "fill-color": "#22c55e", "fill-opacity": 0.5 } });
        map.current.addLayer({ id: "g-line", type: "line", source: "greens", paint: { "line-color": "#14532d", "line-width": 2 } });

        const mPerLat = 110574;
        const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
        [100, 200, 250].forEach((y, i) => {
          const m = y * 0.9144;
          const ring = [];
          for (let a = 0; a < 360; a += 10) {
            const r = (a * Math.PI) / 180;
            ring.push([lng + (Math.cos(r) * m) / mPerLon, lat + (Math.sin(r) * m) / mPerLat]);
          }
          ring.push(ring[0]);
          map.current.addSource("r" + y, { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: ring } } });
          map.current.addLayer({ id: "r" + y, type: "line", source: "r" + y, paint: { "line-color": i ? "#fff" : "#facc15", "line-width": 1.5, "line-dasharray": [5, 3] } });
        });

        const coords = course.greens.flatMap((g) => g.points.map((p) => [p.lon, p.lat]));
        if (coords.length) {
          const bounds = new maplibregl.LngLatBounds();
          coords.forEach((c) => bounds.extend(c));
          map.current.fitBounds(bounds, { padding: 80, maxZoom: 19 });
        }
        setReady(true);
      });
    } catch (e) {
      console.warn("Map init failed:", e);
    }
    return () => { if (map.current) { try { map.current.remove(); } catch {} map.current = null; } };
  }, [courseId]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (!marker.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
      marker.current = new maplibregl.Marker({ element: el }).addTo(map.current);
    }
    const id = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (p) => marker.current.setLngLat([p.coords.longitude, p.coords.latitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
      );
    }, 4000);
    return () => clearInterval(id);
  }, [ready]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}>
        <button onClick={() => location.reload()} style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: 0, borderRadius: 20, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>Home</button>
      </div>
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 20, padding: "8px 18px", fontSize: 14, fontWeight: 600 }}>
        {course?.name || "Course"} - Sat
      </div>
      <div style={{ position: "absolute", bottom: 20, left: 16, zIndex: 10, background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 12, lineHeight: 1.7 }}>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", marginRight: 5 }} />Green<br/>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb", verticalAlign: "middle", marginRight: 5 }} />You<br/>
        100 / 200 / 250 yd rings
      </div>
      {!ready && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#fff", background: "rgba(0,0,0,0.7)", padding: "16px 28px", borderRadius: 12 }}>
          Loading satellite view...
        </div>
      )}
    </div>
  );
}
