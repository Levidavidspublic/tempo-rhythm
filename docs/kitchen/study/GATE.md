# Anti-slop Delivery Gate — kitchen study run

Gate source: `antislop.md` → "Delivery Gate (Mandatory)" in github.com/miqdadbadjuber/anti-slop (MIT, cloned 2026-10-16). Tempo's own record of owner overrides is `docs/design/v3/anti-slop/delivery-gate.md` §2 (glass on floating chrome, parchment ground, Source Sans 3, accent change, patterns only); this run keeps them and adds none.

## Design Read (declared before building)

- Direction: `docs/design/v3/DESIGN.md` (warm editorial calm). Study screens are pages on parchment with paper cards, serif titles and one accent action per screen.
- Dials: **ENERGY 2** (calm, never game-like), **RHYTHM 2** (a clear focal card, quieter lists below), **MOTION 1** (one ≤ 250 ms transition per interaction, none under reduced motion).
- Identity motif: the paper index card. A flashcard, a quiz question and a test question are each one paper card with a serif prompt, a hairline and plain-word actions. No points, badges, confetti, streaks or levels.
- Focal point per screen: the next thing to do ("12 cards due · Start review", the card being studied, the current question, the score).

## Block 1 (Hard Gate): measured per screenshot

`docs/kitchen/study/shoot.mjs` runs `gate.mjs` on every shot and writes `gate-live.json` / `gate-gallery.json` next to the images: em dashes (R-02), horizontal overflow (R-03), text contrast against the nearest opaque background (R-25), unnamed controls and links without a target (R-26), a visible focus ring on the first 12 Tab stops (R-32), text under 13 px, more than one primary button, decorative gradients (R-01), motion over 250 ms (R-19). The other Block 1 items (R-17, R-18, R-23, R-24, R-27, R-28, R-33–R-38) are checked by reading each screen and are recorded per screen below.

## Per-screen results

Filled in as each screen is ticked.
