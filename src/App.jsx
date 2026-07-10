import { useEffect, useState } from "react";
import * as store from "./lib/store.js";
import Home from "./screens/Home.jsx";
import Game from "./screens/Game.jsx";
import Scorecard from "./screens/Scorecard.jsx";
import Bag from "./screens/Bag.jsx";

const TABS = [
  { id: "home",      label: "Home",      iconKey: "home" },
  { id: "game",      label: "Game",      iconKey: "game" },
  { id: "scorecard", label: "Scorecard", iconKey: "scorecard" },
  { id: "bag",       label: "Bag",       iconKey: "bag" },
];

const BG = "#0F2419";
const NAV_BG = "rgba(15,36,25,0.94)";
const NAV_BORDER = "rgba(201,169,78,0.25)";
const gold = "#C9A94E";
const muted = "rgba(245,241,230,0.55)";
const cream = "#F5F1E6";

function Icon({ k, active }) {
  const c = active ? gold : muted;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {k === "home" && <><path d="M4 11L12 4L20 11" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 9.5V20H18V9.5" stroke={c} strokeWidth="2" strokeLinejoin="round"/></>}
      {k === "game" && <><path d="M6 21V4" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M6 4H15L12 8L15 12H6" stroke={c} strokeWidth="2" strokeLinejoin="round"/></>}
      {k === "scorecard" && <><rect x="4" y="3" width="16" height="18" rx="2" stroke={c} strokeWidth="2"/><path d="M7.5 8H16.5M7.5 12H16.5M7.5 16H13" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></>}
      {k === "bag" && <><path d="M9 3H12L13 6" stroke={c} strokeWidth="2" strokeLinecap="round"/><rect x="6" y="6" width="12" height="14" rx="3" fill={active ? gold : "none"} fillOpacity={active ? "0.25" : "0"} stroke={c} strokeWidth="2"/></>}
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");
  useEffect(() => store.save(state), [state]);
  const update = (fn, ...args) => setState((s) => fn(s, ...args));

  const screens = {
    home:      <Home state={state} update={update} />,
    game:      <Game state={state} update={update} />,
    scorecard: <Scorecard state={state} update={update} />,
    bag:       <Bag state={state} update={update} />,
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: BG, color: cream, fontFamily: "-apple-system,'SF Pro',system-ui,sans-serif", overflow: "hidden" }}>
      <main style={{ flex: 1, overflow: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        {screens[tab]}
      </main>
      <nav style={{ flexShrink: 0, height: 64, display: "flex", alignItems: "center", justifyContent: "space-around", background: NAV_BG, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderTop: "1px solid " + NAV_BORDER }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 8px", color: active ? gold : muted }}>
              <Icon k={t.iconKey} active={active} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 600, color: active ? gold : muted }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
