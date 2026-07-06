import { useEffect, useState } from "react";
import * as store from "./lib/store.js";
import { nextHeroImage } from "./lib/heroRotation.js";
import Home from "./screens/Home.jsx";
import Round from "./screens/Round.jsx";
import Games from "./screens/Games.jsx";
import Scorecard from "./screens/Scorecard.jsx";
import Bag from "./screens/Bag.jsx";

const TABS = [
  { id: "home", label: "Home", glyph: "⛳" },
  { id: "round", label: "Round", glyph: "🎯" },
  { id: "games", label: "Games", glyph: "🪙" },
  { id: "scorecard", label: "Card", glyph: "📋" },
  { id: "bag", label: "Bag", glyph: "🏌️" },
];

// Elements that legitimately scroll — everything else is the fixed app
// shell and must never move under a touch drag.
const SCROLLABLE_SELECTOR = ".screen, .picker-body, .course-sheet, .hscroll";

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");
  const [hero] = useState(nextHeroImage);

  useEffect(() => store.save(state), [state]);

  useEffect(() => {
    // CSS overflow:hidden alone doesn't stop iOS Safari/WKWebView's
    // touch-drag rubber-band effect — it only governs programmatic/wheel
    // scrolling. The only reliable fix is intercepting the touch itself:
    // block the drag unless it started inside a container that's meant to
    // scroll, so the fixed shell (tabbar included) truly can't be dragged
    // off-screen while .screen/.picker-body/etc keep scrolling normally.
    function blockOuterDrag(e) {
      if (!e.target.closest(SCROLLABLE_SELECTOR)) {
        e.preventDefault();
      }
    }
    document.addEventListener("touchmove", blockOuterDrag, { passive: false });
    return () => document.removeEventListener("touchmove", blockOuterDrag);
  }, []);

  const update = (fn, ...args) => setState((s) => fn(s, ...args));

  const screens = {
    home: (
      <Home
        state={state}
        hero={hero}
        update={update}
        onStartRound={(opts) => {
          update(store.startRound, opts);
          setTab("round");
        }}
      />
    ),
    round: <Round state={state} update={update} goGames={() => setTab("games")} />,
    games: <Games state={state} />,
    scorecard: <Scorecard state={state} update={update} />,
    bag: <Bag state={state} update={update} />,
  };

  return (
    <>
      <main className="screen">{screens[tab]}</main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
          >
            <span className="glyph" aria-hidden="true">{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
