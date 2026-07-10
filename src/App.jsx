import { useEffect, useState } from "react";
import * as store from "./lib/store.js";
import { nextHeroImage } from "./lib/heroRotation.js";
import Home from "./screens/Home.jsx";
import Round from "./screens/Round.jsx";
import Games from "./screens/Games.jsx";
import Scorecard from "./screens/Scorecard.jsx";
import Bag from "./screens/Bag.jsx";
import HoleMap from "./components/HoleMap.jsx";

const TABS = [
  { id: "home",    label: "Home",    glyph: "\u26f3" },
  { id: "map",     label: "Map",     glyph: "\ud83d\uddfa\ufe0f" },
  { id: "round",   label: "Round",   glyph: "\ud83c\udfaf" },
  { id: "games",   label: "Games",   glyph: "\ud83e\ude99" },
  { id: "scorecard", label: "Card",  glyph: "\ud83d\udccb" },
  { id: "bag",     label: "Bag",     glyph: "\ud83c\udfcc\ufe0f" },
];

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");
  const [hero] = useState(nextHeroImage);
  useEffect(() => store.save(state), [state]);
  const update = (fn, ...args) => setState((s) => fn(s, ...args));
  const screens = {
    home: <Home state={state} hero={hero} update={update} onStartRound={(opts) => { update(store.startRound, opts); setTab("round"); }} />,
    map: <HoleMap courseCache={state.courseCache} courseId={state.profile?.currentCourse?.id} />,
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
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}>
            <span className="glyph" aria-hidden="true">{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
