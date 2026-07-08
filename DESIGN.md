# Design

## Theme

Dark. A single dark-forest surface throughout (Home, Game, Scorecard, Bag) with a gold accent — private-club premium, not a bright sports HUD. One local exception: the Scorecard grid itself sits on a distinct emerald-green panel so it visually "pops" as its own card within the page, and the Scorecard/round-history *tab* screen reuses the round-history card list on the same dark forest page background as everything else.

## Color

OKLCH-equivalent hex tokens (kept as hex to match the handoff spec exactly):

```
--paper:        #0F2419   /* page background, near-black forest green */
--card-grad-1:  #1B3B26   /* card gradient start */
--card-grad-2:  #12281B   /* card gradient end */
--card-border:  rgba(201,169,78,0.28)  /* gold, 0.2–0.35 range */
--gold:         #C9A94E   /* primary accent — CTAs, active states, positive */
--gold-grad-1:  #DDBB63   /* gold button gradient start */
--gold-grad-2:  #B8933B   /* gold button gradient end */
--gold-ink:     #1B3B26   /* text color on gold buttons */
--ink:          #F5F1E6   /* primary text, cream */
--muted-35:     rgba(245,241,230,0.35)
--muted-55:     rgba(245,241,230,0.55)
--coral:        #D97757   /* negative / over-par / delete accents */
--coral-delete: #E05A4E   /* delete "x" buttons specifically */
--emerald-panel-1: #1F6349  /* scorecard panel gradient start */
--emerald-panel-2: #143D2C  /* scorecard panel gradient end */
--emerald-header:  #123822  /* scorecard header-row background */
--emerald-row:     #17472F  /* scorecard sticky player-row background */
--lime:            #C6F135  /* scorecard-only avatar-initial / accent */
```

Contrast check: `--ink` (#F5F1E6) on `--paper` (#0F2419) ≈ 14.8:1 — comfortably clears AA even before accounting for sunlight glare. `--muted-55` on `--paper` ≈ 7.6:1, `--muted-35` ≈ 4.6:1 — keep `--muted-35` for large/bold text only (13px+ semibold captions), never body copy.

## Typography

- UI: iOS system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- Numerals: existing `--font-num` (Spline Sans Mono / tabular-nums) — kept, since digits (yardages, scores) are the product and benefit from tabular alignment; the handoff doesn't override this.
- Wordmark only: **Space Grotesk**, weight 700 — used solely inside the logo mark's "MY" lettering, nowhere else in the UI.

## Radii & Shadows

- Cards: 16–22px.
- Pills/buttons: 999px (full round).
- Small chips: 6–10px.
- Card shadow: `0 12px 30px rgba(0,0,0,0.32)`.
- Gold-bordered panel glow (Recommended Club, Last Shot): `0 8px 20px rgba(201,169,78,0.15)` in addition to the card shadow.

## Layout

- Device canvas: 402×874 (iPhone-class), safe-area-aware top/bottom via `env(safe-area-inset-*)` — unchanged from the existing app shell (`#root` fixed, `.screen` scrolls internally, `.tabbar` pinned).
- Hero panel: 280px, full-bleed, overlapped by the "My card" panel at -28px.

## Components

- **Gauge ring**: 58×58 circular SVG progress ring, gold stroke, for handicap index.
- **Score chip**: circle (birdie, gold ring) / double-ring circle (eagle) / rounded square (bogey, coral ring) / double-ring rounded square (double-bogey-or-worse) / plain number no shape (par). Shape carries meaning, not color alone.
- **Segmented control**: two-pill row, active segment filled gold, e.g. Yards/Meters, Front 9/Back 9.
- **Stepper**: −/value/+ pill, used for handicap (0.1 increments) and club yardage (5yd increments, floor 30).
- **Logo mark**: 36×36 dark rounded-square badge (`#1B3B26`→`#0F2419` gradient, 1.3px gold border), white golf ball, gold crossed-clubs icon behind "MY" wordmark.

## Motion

Reduced-motion media query already exists globally (`* { transition:none; animation:none }` under `prefers-reduced-motion: reduce`) — keep it. New interactive motion (accordion expand/collapse, chevron rotation, add-club panel slide) should use short (150–220ms) ease-out-quart transitions on transform/opacity only.
