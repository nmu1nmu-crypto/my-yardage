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

function Root() {
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
    <div style={rootStyle}>
      <main style={mainStyle}>{screens[tab]}</main>
      <nav style={navStyle}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabButton(tab === t.id)}>
            <TabIcon name={t.glyph} active={tab === t.id} />
            <span style={tabLabel(tab === t.id)}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// Design tokens (from spec)
export const TOKENS = {
  bg: "#0F2419",
  cardGrad: "linear-gradient(160deg, #1B3B26, #12281B)",
  cardBorder: "rgba(201,169,78,0.25)",
  gold: "#C9A94E",
  goldGrad: "linear-gradient(160deg, #DDBB63, #B8933B)",
  textCream: "#F5F1E6",
  textMuted: "rgba(245,241,230,0.55)",
  textMutedStrong: "rgba(245,241,230,0.85)",
  coral: "#D97757",
  coralDelete: "#E05A4E",
  scorecardBg: "linear-gradient(160deg, #1F6349, #143D2C)",
  scorecardHeaderBg: "#123822",
  scorecardAccent: "#C6F135",
};

// Layout tokens
const rootStyle = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  background: TOKENS.bg,
  color: TOKENS.textCream,
  fontFamily: "-apple-system, 'SF Pro', system-ui, sans-serif",
  overflow: "hidden",            // KEY: no horizontal scroll at root
};

const mainStyle = {
  flex: 1,
  overflow: "auto",
  overflowX: "hidden",            // KEY: no left-right scroll
  WebkitOverflowScrolling: "touch",
};

const NAV_H = 64;   // exact height of the tab bar
const navStyle = {
  flexShrink: 0,
  height: NAV_H,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  background: "rgba(15,36,25,0.94)",
  backdropFilter: "blur(16px)",
  borderTop: "1px solid " + TOKENS.cardBorder,
};

function tabButton(active) {
  return {
    background: "none", border: "none", cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 4, padding: "4px 8px",
  };
}
function tabLabel(active) {
  return {
    fontSize: 10.5,
    fontWeight: active ? 700 : 600,
    color: active ? TOKENS.gold : TOKENS.textMuted,
  };
}

function TabIcon({ name, active }) {
  const col = active ? TOKENS.gold : TOKENS.textMuted;
  const paths = {
    home:      <><path d="M4 11L12 4L20 11" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 9.5V20H18V9.5" fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round"/></>,
    game:      <><path d="M6 21V4" stroke={col} strokeWidth="2" strokeLinecap="round"/><path d="M6 4H15L12 8L15 12H6" fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round"/></>,
    scorecard: <><rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke={col} strokeWidth="2"/><path d="M7.5 8H16.5M7.5 12H16.5M7.5 16H13" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    bag:       <><path d="M9 3H12L13 6" stroke={col} strokeWidth="2" strokeLinecap="round"/><rect x="6" y="6" width="12" height="14" rx="3" fill={active ? TOKENS.gold : "transparent"} fillOpacity={active ? 0.25 : 0} stroke={col} strokeWidth="2"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default Root;
