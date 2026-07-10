import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const LOAD_TIMEOUT_MS = 10000;
const MIN_GREEN_PTS = 4;

export default function HoleMap({
  courseCache, courseId,
  userGreenForCourse, onSaveUserGreen, onClearUserGreen, onClose,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [marking, setMarking] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  const course = courseCache?.[courseId] || null;
  const hasGreens = userGreenForCourse
    ? (userGreenForCourse.length >= MIN_GREEN_PTS)
    : (course?.greens?.length > 0 && course.greens[0].points.length >= MIN_GREEN_PTS);

  const effectivePoints = userGreenForCourse
    ? userGreenForCourse
    : (course?.greens?.[0]?.points || []);

  // --- 1. Satellite view ALWAYS works (Option A) ---
  useEffect(() => {
    if (!mapContainer.current) return;
    // Remove old map
    if (map.current) { try { map.current.remove(); } catch {} map.current = null; marker.current = null; }

    let centerLng = -2.546, centerLat = 53.408;
    if (hasGreens) {
      const pts = effectivePoints;
      centerLng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
      centerLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    } else if (course?.lng != null) { centerLng = course.lng; centerLat = course.lat; }

    const timeout = setTimeout(() => {
      if (!ready) { setError("Map engine failed to load after 10s."); setReady(false); }
    }, LOAD_TIMEOUT_MS);

    const newMap = new maplibregl.Map({
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
        layers: [{ id: "esri", type: "raster", source: "esri", minzoom: 0, maxzoom: 23 }],
      },
      center: [centerLng, centerLat],
      zoom: 16,
      attributionControl: false,
    });

    newMap.on("load", () => {
      clearTimeout(timeout);
      setReady(true);
      setError(null);

      // GPS dot
      if (!marker.current) {
        const el = document.createElement("div");
        el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);";
        marker.current = new maplibregl.Marker({ element: el }).addTo(newMap);
      }
    });

    newMap.on("error", (e) => {
      clearTimeout(timeout);
      if (!ready) { setError("Map failed: " + (e.error?.message || "unknown")); setReady(false); }
    });

    map.current = newMap;
    return () => { clearTimeout(timeout); if (map.current) { try { map.current.remove(); } catch {} map.current = null; } };
    // eslint-disable-next-line
  }, [courseId]);

  // --- 2. Draw greens + yardage rings when ready (Option C user green OR OSM) ---
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;

    // Clean previous layers
    ["g-fill", "g-line", "r100", "r200", "r250"].forEach(l => { try { if (m.getLayer(l)) m.removeLayer(l); } catch {} });
    ["greens-src", "r100-src", "r200-src", "r250-src"].forEach(s => { try { if (m.getSource(s)) m.removeSource(s); } catch {} });

    if (hasGreens && effectivePoints.length >= MIN_GREEN_PTS) {
      const pts = effectivePoints;
      const lng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const coords = [...pts.map(p => [p.lon, p.lat]), [pts[0].lon, pts[0].lat]];

      m.addSource("greens-src", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] } } });
      m.addLayer({ id: "g-fill", type: "fill", source: "greens-src", paint: { "fill-color": "#22c55e", "fill-opacity": 0.5 } });
      m.addLayer({ id: "g-line", type: "line", source: "greens-src", paint: { "line-color": "#14532d", "line-width": 2 } });

      // yardage rings
      const mPerLat = 110574, mPerLon = 111320 * Math.cos(lat * Math.PI / 180);
      [100, 200, 250].forEach((y, i) => {
        const m = y * 0.9144; const ring = [];
        for (let a = 0; a < 360; a += 10) {
          const r = a * Math.PI / 180;
          ring.push([lng + Math.cos(r) * m / mPerLon, lat + Math.sin(r) * m / mPerLat]);
        }
        ring.push(ring[0]);
        m.addSource("r" + y + "-src", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: ring } } });
        m.addLayer({ id: "r" + y, type: "line", source: "r" + y + "-src", paint: { "line-color": i === 0 ? "#facc15" : "#fff", "line-width": 1.5, "line-dasharray": [5, 3] } });
      });

      const bounds = new maplibregl.LngLatBounds();
      pts.forEach(p => bounds.extend([p.lon, p.lat]));
      m.fitBounds(bounds, { padding: 80, maxZoom: 18 });
      setShowBanner(false);
    } else {
      setShowBanner(true);
    }
    // eslint-disable-next-line
  }, [ready, hasGreens, courseId]);

  // --- 3. Marking mode (Option C) ---
  const draftRef = useRef([]);

  useEffect(() => {
    if (!marking || !map.current) {
      // Detach click handler when not marking
      if (map.current && map.current._m) {
        map.current.off("click", map.current._m);
        map.current._m = null;
      }
      return;
    }
    const m = map.current;

    const handler = (e) => {
      draftRef.current = [...draftRef.current, { lat: e.lngLat.lat, lon: e.lngLat.lng }];
      setDraftCount(draftRef.current.length);
      // redraw draft
      redrawDraft(m, draftRef.current);
    };

    m.on("click", handler);
    m._m = handler;
    m.getCanvas().style.cursor = "crosshair";

    return () => { m.off("click", handler); m._m = null; m.getCanvas().style.cursor = ""; };
  }, [marking, ready]);

  function redrawDraft(m, pts) {
    ["draft-line", "draft-dots"].forEach(l => { try { if (m.getLayer(l)) m.removeLayer(l); } catch {} });
    ["draft-line-src", "draft-dots-src"].forEach(s => { try { if (m.getSource(s)) m.removeSource(s); } catch {} });

    if (pts.length >= 2) {
      const coords = pts.map(p => [p.lon, p.lat]);
      const lineCoords = pts.length >= 3 ? [...coords, coords[0]] : coords;
      const geom = pts.length >= 3
        ? { type: "Polygon", coordinates: [[...lineCoords, lineCoords[0]]] }
        : { type: "LineString", coordinates: lineCoords };
      m.addSource("draft-line-src", { type: "geojson", data: { type: "Feature", geometry: geom } });
      m.addLayer({ id: "draft-line", type: "line", source: "draft-line-src", paint: { "line-color": "#fde047", "line-width": 3, "line-dasharray": [6, 4] } });
      if (pts.length >= 3) {
        m.addSource("draft-fill-src", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } } });
        m.addLayer({ id: "draft-fill", type: "fill", source: "draft-fill-src", paint: { "fill-color": "#fde047", "fill-opacity": 0.3 } });
      }
      m.addSource("draft-dots-src", { type: "geojson", data: { type: "FeatureCollection", features: pts.map((p, i) => ({ type: "Feature", properties: { i }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) } });
      m.addLayer({ id: "draft-dots", type: "circle", source: "draft-dots-src", paint: { "circle-radius": 5, "circle-color": "#fff", "circle-stroke-color": "#fde047", "circle-stroke-width": 2 } });
    }
  }

  const startMarking = () => {
    if (onClearUserGreen) onClearUserGreen(courseId);
    setMarking(true);
    setDraftCount(0);
    draftRef.current = [];
  };

  const saveMarked = () => {
    if (draftRef.current.length < MIN_GREEN_PTS || !onSaveUserGreen) return;
    onSaveUserGreen(courseId, draftRef.current);
    setMarking(false);
    setDraftCount(0);
    draftRef.current = [];
    // Force re-render to show the new green
    setReady(false);
    setTimeout(() => setReady(true), 200);
  };

  const undoLast = () => {
    const next = draftRef.current.slice(0, -1);
    draftRef.current = next;
    setDraftCount(next.length);
    if (map.current) redrawDraft(map.current, next);
  };

  const cancelMarking = () => {
    setMarking(false);
    setDraftCount(0);
    draftRef.current = [];
    if (map.current) {
      ["draft-line", "draft-dots", "draft-fill"].forEach(l => { try { if (map.current.getLayer(l)) map.current.removeLayer(l); } catch {} });
      ["draft-line-src", "draft-dots-src", "draft-fill-src"].forEach(s => { try { if (map.current.getSource(s)) map.current.removeSource(s); } catch {} });
    }
    setShowBanner(true);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Header with close button */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
        <button onClick={onClose || (() => location.reload())} style={{ background: "rgba(0,0,0,0.7)", color: "#fff", border: 0, borderRadius: 20, padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>&larr; Home</button>
      </div>

      {/* Title */}
      <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 20, padding: "8px 18px", fontSize: 14, fontWeight: 600 }}>
        {course?.name || "Course"}
      </div>

      {/* Loading overlay */}
      {!ready && !error && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 30, background: "rgba(0,0,0,0.85)", color: "#fff", padding: "16px 28px", borderRadius: 12, textAlign: "center" }}>
          Loading satellite view...
          <br/><span style={{ fontSize: 12, opacity: 0.7 }}>{course?.name || ""}</span>
        </div>
      )}

      {/* Error overlay */}
      {error && !ready && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 30, background: "#1a0a0a", border: "1px solid #ef4444", color: "#fff", padding: "16px 26px", borderRadius: 12, textAlign: "center" }}>
          <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Map Unavailable</div>
          <div style={{ color: "#fca5a5", fontSize: 14, lineHeight: 1.6 }}>{error}</div>
        </div>
      )}

      {/* Legend when greens visible */}
      {ready && hasGreens && !marking && (
        <div style={{ position: "absolute", bottom: 20, left: 16, zIndex: 20, background: "rgba(0,0,0,0.75)", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 12, lineHeight: 1.7 }}>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#22c55e", verticalAlign: "middle", marginRight: 5 }} />Green
          <br/>
          <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#2563eb", verticalAlign: "middle", marginRight: 5 }} />You
          <br/>
          100/200/250 yd rings
        </div>
      )}

      {/* "Tap to mark" banner when no greens */}
      {ready && !hasGreens && !marking && !error && showBanner && (
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 20, background: "rgba(0,0,0,0.85)", border: "1px solid #facc15", color: "#fff", borderRadius: 12, padding: 16, fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}>No green polygon for <strong>{course?.name || "this course"}</strong></div>
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 12 }}>
            Walk to the green, then tap the button below and draw the outline. Your polygon saves forever.
          </div>
          <button onClick={startMarking} style={{ background: "#facc15", color: "#000", border: 0, borderRadius: 16, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>
            Tap to mark green
          </button>
        </div>
      )}

      {/* Marking UI */}
      {marking && ready && (
        <div style={{ position: "absolute", bottom: 20, left: 16, right: 16, zIndex: 20, background: "rgba(0,0,0,0.9)", border: "1px solid #facc15", color: "#fff", borderRadius: 12, padding: 16, fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}>Tapped <strong>{draftCount}</strong> points (need at least {MIN_GREEN_PTS})</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={undoLast} style={{ flex: 1, minWidth: 80, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 16, padding: "10px 14px", fontSize: 14, cursor: "pointer" }} disabled={draftCount === 0}>Undo</button>
            <button onClick={saveMarked} style={{ flex: 2, minWidth: 120, background: "#facc15", color: "#000", border: 0, borderRadius: 16, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }} disabled={draftCount < MIN_GREEN_PTS}>Save ({draftCount})</button>
            <button onClick={cancelMarking} style={{ flex: 1, minWidth: 80, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 16, padding: "10px 14px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
