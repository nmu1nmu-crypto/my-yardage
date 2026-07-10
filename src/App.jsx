import { useEffect, useState } from "react";
import * as store from "./lib/store.js";
import Home from "./screens/Home.jsx";
import Game from "./screens/Game.jsx";
import Scorecard from "./screens/Scorecard.jsx";
import Bag from "./screens/Bag.jsx";

const TABS = [
  { id: "home",      label: "Home",      glyph: "home" },
  { id: "game",      label: "Game",      glyph: "game" },
  { id: "scorecard", label: "Scorecard", glyph: "scorecard" },
  { id: "bag",       label: "Bag",       glyph: "bag" },
];

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");

  useEffect(() => store.save(state), [state]);
  const update = (fn, ...args) => setState((s) => fn(s, ...args));

  const screens = {
    home:      <Home state={state} update={update} onOpenTab={setTab} />,
    game:      <Game state={state} update={update} />,
    scorecard: <Scorecard state={state} update={update} />,
    bag:       <Bag state={state} update={update} />,
  };

  return (
    <div style={{ position: "fixed", inset: 0, height: "100vh", display: "flex", flexDirection: "column",
      background: "#0F2419", color: "#F5F1E6", overflow: "hidden" }}>
      <main style={{ flex: 1, overflow: "auto", overflowX: "hidden" }}>{screens[tab]}</main>
      <nav style={{ flexShrink: 0, display: "flex", alignItems: "center",
        justifyContent: "space-around", padding: "10px 8px 26px",
        background: "rgba(15, 36, 25, 0.92)", backdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(201, 169, 78, 0.25)" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "4px 8px" }}>
            <TabIcon name={t.glyph} active={tab === t.id} />
            <span style={{ fontSize: 10.5, fontWeight: tab === t.id ? 700 : 600,
              color: tab === t.id ? "#C9A94E" : "rgba(245,241,230,0.55)" }}>
              {t.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function TabIcon({ name, active }) {
  const col = active ? "#C9A94E" : "rgba(245,241,230,0.55)";
  const paths = {
    home:     <><path d="M4 11L12 4L20 11" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 9.5V20H18V9.5" fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round"/></>,
    game:     <><path d="M6 21V4" stroke={col} strokeWidth="2" strokeLinecap="round"/><path d="M6 4H15L12 8L15 12H6" fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round"/></>,
    scorecard:<><rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke={col} strokeWidth="2"/><path d="M7.5 8H16.5M7.5 12H16.5M7.5 16H13" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    bag:      <><path d="M9 3H12L13 6" stroke={col} strokeWidth="2" strokeLinecap="round"/><rect x="6" y="6" width="12" height="14" rx="3" fill={active ? "#C9A94E" : "transparent"} fillOpacity={active ? 0.25 : 0} stroke={col} strokeWidth="2"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24">{paths[name]}</svg>;
}
