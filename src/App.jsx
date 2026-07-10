```jsx
import { useEffect, useState } from "react";
import  as store from "./lib/store.js";
import { nextHeroImage } from "./lib/heroRotation.js";
import Home from "./screens/Home.jsx";
import Round from "./screens/Round.jsx";
import Games from "./screens/Games.jsx";
import Scorecard from "./screens/Scorecard.jsx";
import Bag from "./screens/Bag.jsx";
import HoleMap from "./components/HoleMap.jsx";

const TABS = [
  { id: "home", label: "Home", glyph: "" },
  { id: "round", label: "Round", glyph: "🎯" },
  { id: "games", label: "Games", glyph: "🪙" },
  { id: "scorecard", label: "Card", glyph: "📋" },
  { id: "bag", label: "Bag", glyph: "🏌️" },
];

export default function App() {
  const [state, setState] = useState(store.load);
  const [tab, setTab] = useState("home");
  const [hero] = useState(nextHeroImage);

  // NEW — when mapMode is "on", the full-screen HoleMap takes over
  const [mapMode, setMapMode] = useState(false);

  useEffect(() => store.save(state), [state]);
  const update = (fn, ...args) => setState((s) => fn(s, ...args));

  const screens = {
    home: (
      <Home
        state={state}
        hero={hero}
        update={update}
        onOpenMap={() => setMapMode(true)}
        onStartRound={(opts) => {
          update(store.startRound, opts);
          setTab("round");
        }}
      />
    ),
    round: <Round state={state} update={update} goGames={() => setTab("games")} onOpenMap={() => setMapMode(true)} />,
    games: <Games state={state} />,
    scorecard: <Scorecard state={state} update={update} />,
    bag: <Bag state={state} update={update} />,
  };

  return (
    <>
      <main className="screen">{screens[tab]}</main>

      {/ Full-screen satellite drill-in overlays everything /}
      {mapMode && (
        <HoleMap
          courseCache={state.courseCache}
          courseId={state.profile?.currentCourse?.id}
          onBack={() => setMapMode(false)}
        />
      )}

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
```

Scroll to the bottom and click the green "Commit changes" button.

---

Step 3 — Done! Build ships automatically

Once both files are committed, GitHub Actions triggers automatically (your workflow from earlier). In 3 minutes you'll see it succeed, and the new build uploads to TestFlight.

You can watch it here (open Safari):

```
https://github.com/nmu1nmu-crypto/my-yardage/actions
```
