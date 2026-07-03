# My Yardage ⛳

A pocket caddie that knows *your* game. Real club distances learned from your
shots, money games that settle themselves, round stats, and plays-like
yardages — with zero data licensing costs and no backend.

## The idea

One data model feeds every feature: a round is a sequence of holes, a hole is
a sequence of shots, a shot is a club plus a GPS start and end point. Capture
that with two taps per shot and everything falls out of it:

- **Club distances** — the GPS delta between "mark shot" and "at my ball"
  becomes a tracked carry; averages build per club automatically.
- **Money games** — scores per hole drive match play, skins (with carried
  pots), and Stableford.
- **Stats** — score to par, holes played, and per-club history aggregate from
  the same shots.
- **Plays like** — raw distance adjusted for wind (Open-Meteo, free API, no
  key), elevation, and temperature.

Everything runs on-device against `localStorage`. There is no server, no
account, and no course-data licence — the golfer pins the green once and
distances follow.

## Run it

```bash
npm install
npm run dev
```

Open the printed URL on your phone (the dev server binds to your LAN) and
allow location access. GPS distances need to be tested outdoors — indoors the
accuracy gate will reject most readings as invalid.

## Stack

- Vite + React, no other runtime dependencies
- `src/lib/geo.js` — haversine distance, bearings, geolocation wrapper
- `src/lib/playslike.js` — wind/elevation/temperature adjustment with a
  15-minute weather cache and graceful offline fallback
- `src/lib/store.js` — the whole data model and games math, pure functions
  over a single state object

## Design decisions worth knowing

- Shots under 5 yds or over 400 yds are logged but excluded from averages
  (accidental taps and GPS jumps shouldn't pollute your carries).
- Removed clubs keep their shot history on a "shelf" — re-adding a club
  resumes its tracked average.
- Headwind is weighted ~2× tailwind in the plays-like model, matching how the
  ball actually behaves.
- Stableford is gross in v0; handicap allowances are the obvious next step.

## Roadmap candidates

- OSM course polygons (Overpass API) for automatic green locations and a
  vector-rendered hole view — free under ODbL with attribution
- Post-round summary screen with settlement and strokes-gained-lite
- PWA manifest + service worker for installable offline use
- Handicap allowances in games; Nassau and Wolf formats

## Push to GitHub

This repo is already initialised with a first commit. To publish it:

```bash
# with the GitHub CLI (easiest)
gh repo create my-yardage --private --source . --push

# or manually
git remote add origin https://github.com/<your-username>/my-yardage.git
git branch -M main
git push -u origin main
```
