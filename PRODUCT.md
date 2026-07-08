# Product

## Register

product

## Users

Recreational golfers playing a round with friends on their phone, one-handed, outdoors, in bright sunlight, often gripping a cart or bag with the other hand. They open the app three times a hole: to see distance to the pin, to log a score, and occasionally to check the group's bets. Between rounds they check yesterday's card or tweak their bag.

## Product Purpose

My Yardage is a golf companion app: live GPS distance-to-pin, per-club carry tracking, and group scorecard/handicap management, all on-device with no account. Success is a golfer trusting the numbers enough to pull a club from them, and a scorecard that's faster to fill in than paper.

## Brand Personality

Premium, confident, understated — a private-club aesthetic (dark forest green + gold), not a loud sports-app HUD. Data-forward: numbers are the product and get visual priority over decoration.

## Anti-references

Not a bright, gamified sports-tracker (no neon greens, no badge/confetti UI, no cluttered HUD overlays). Not a generic Material/iOS-default form-heavy admin screen. Not the previous iteration's teal/orange theme.

## Design Principles

- Numbers are the product — every screen's primary metric (distance, score, handicap) gets the largest, boldest treatment on the screen.
- Gold marks "what matters now" — the active tab, the primary CTA, the current hole's column, the recommended club. Reserve it; don't let it become wallpaper.
- One clear read per glance — a golfer checks this mid-swing-routine outdoors; every screen needs a single obvious focal number, not a wall of equally-weighted stats.
- Real geometry over decoration — when real course polygon data exists (green/fairway/tee/hazard from OSM), render it; never fall back to a generic illustration if real shape data is available.
- Never fabricate data — course imagery, geometry, and stats fail soft (omit or placeholder-label) rather than guess.

## Accessibility & Inclusion

Outdoor/bright-sunlight legibility is the binding constraint: body text and score digits must clear WCAG AA (4.5:1) against the dark forest background even accounting for glare — err toward the cream/gold end of the palette over muted grays. Score-chip shapes (circle/square/ring count) must carry meaning independent of color for colorblind users, matching the design handoff's shape-coded convention (not color alone).
