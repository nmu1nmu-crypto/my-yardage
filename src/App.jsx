import { useEffect, useState } from "react";
import * as store from "./lib/store.js";
import Home from "./screens/Home.jsx";
import Round from "./screens/Round.jsx";
import Games from "./screens/Games.jsx";
import Bag from "./screens/Bag.jsx";

const TABS = [
  { id: "home", label: "Home", glyph: "⛳" },
  { id: "round", label: "Round", glyph: "🎯" },
  { id: "games", label: "Games", glyph: "🪙" },
  { id: "bag", label: "Bag", glyph: "🏌️" },
];

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");

  useEffect(() => store.save(state), [state]);

  const update = (fn, ...args) => setState((s) => fn(s, ...args));

  const screens = {
    home: (
      <Home
        state={state}
        onStartRound={(opts) => {
          update(store.startRound, opts);
          setTab("round");
        }}
      />
    ),
    round: <Round state={state} update={update} goGames={() => setTab("games")} />,
    games: <Games state={state} />,
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
