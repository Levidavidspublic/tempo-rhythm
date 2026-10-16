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

Shot 2026-10-16 from worktree `wt/evidence` against its own dev server (port 3104, placeholder Convex URL, E2E auth bypass). Files in `docs/kitchen/study/shots/`: 32 live shots (8 routes × 390/1280 × light/dark, English) and 248 gallery shots (31 views × en/he × 390/1280 × light/dark, named `gallery-MOCKED-*`: real components, fictional data, stand-in Convex hooks). Measured results: `gate-live.json`, `gate-gallery.json`.

How to read the table. **B1 measured**: the `gate.mjs` checks on every shot of that screen (R-02, R-03, R-25, R-26, R-32, text ≥ 13 px, one primary, R-01, R-19). **B1 read**: the items checked by looking: R-17 stats, R-18 testimonials, R-23 invented assets, R-24 dead nav, R-27 states, R-28 FAQ, R-33 source-only fixes, R-34 both themes, R-35 run and clicked, R-36 claims, R-37 design read, R-38 fabricated content. Unless a row says otherwise they are: no stats, testimonials, FAQ or invented assets (R-17/18/23/28 PASS); fixes in source (R-33 PASS); light and dark both shot with no break seen (R-34 PASS); design read above (R-37 PASS); sample data is fictional and every file says MOCKED (R-38 PASS). **R-35** is PARTIAL everywhere: each screen was run and the scripted clicks below were made, but a full click-through of every control was not recorded. **R-36**: privacy sentences on screen ("Audio is never stored", "Nothing is uploaded", "runs walled off") match the code comments and specs; they were not verified at the network level, so **UNKNOWN**.

### Live routes (English; signed-out states)

With the placeholder Convex URL the client stops (`[CONVEX FATAL ERROR] Couldn't parse deployment name example`), so every live route shows its signed-out or loading state inside the real shell. The data states are covered by the gallery rows below.

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| `/study` | PASS except R-19 (pre-existing: shell `aside`, 260 ms transition) | R-27 signed-out state only; it has no Sign in button (Memory's has one) | none used | focal: lock + "Sign in to see this page" | note: add a Sign in link to the study signed-out state | PASS (pre-existing R-19) |
| `/study/review` | same R-19 | as above | none | same | same note | PASS (pre-existing R-19) |
| `/study/new` | same R-19 | as above | none | same | same note | PASS (pre-existing R-19) |
| `/study/plan` | R-32 FAIL fixed (date field: Chromium puts focus on the picker button and the field lost its ring; `plan.css` now rings on `:focus-within`); now PASS except R-19 | form renders signed-out; R-27 the plan preview's empty line is shown | none | focal: the form, one primary "Add these sessions" | ok | PASS (pre-existing R-19) |
| `/study/record` | PASS except R-19 | R-27 off state (no key) with "Type or paste notes" as the primary | none | focal: "Before you start" card | ok | PASS (pre-existing R-19) |
| `/settings/reminders` | PASS except R-19: shell `aside` 260 ms and the loading skeleton `.tp-skeleton` shimmer 1400 ms (tempo.css design-system loader, pre-existing) | R-27 loading state (never resolves without Convex) | none | focal: the "Reminders stay in Tempo for now" notice | ok | PASS (pre-existing R-19) |
| `/settings/memory` | PASS except R-19 | R-27 signed-out with Sign in | none | focal: Sign in | ok | PASS (pre-existing R-19) |
| `/calendar` | R-32 FAIL fixed (same date field rule, `.cal-screen`); now PASS except R-19 | R-27 add-event form + empty day | none | focal: "Add event" primary | ok | PASS (pre-existing R-19) |

### Study gallery views (T3)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| study-hub | PASS (8/8) | R-27 empty state shot separately | none | focal: "12 cards due · Start review"; one accent primary; motif: paper cards | ok | PASS |
| study-hub-empty | PASS | R-27 empty state with a way forward | none | focal: empty-state action | ok | PASS |
| study-review | PASS | ok | none | focal: the card being studied; motif: index card | ok | PASS |
| study-review-done | PASS | R-27 done state | none | focal: the score line | ok | PASS |
| study-deck | PASS | ok | none | focal: next card | ok | PASS |
| study-quiz | PASS | ok | none | focal: current question card | ok | PASS |
| study-quiz-feedback | PASS | feedback in words and icon, not colour alone | none | focal: the feedback | ok | PASS |
| study-test | PASS | Hebrew and English sections mixed, each line in its own direction | none | focal: question card | ok | PASS |
| study-test-score | PASS | ok | none | focal: the score | ok | PASS |
| study-new-preview | PASS | ok | none | focal: the preview cards + one primary | ok | PASS |
| study-new-nokey | PASS | R-27 no-key state, kind words | none | focal: the notice | ok | PASS |
| page-menu-turn-into | R-32 FAIL: `div.cm-content` (the CodeMirror page body). `components/editor/live-preview.ts` sets `"&.cm-focused": { outline: "none" }` (line 739, from before this run), so the editor shows only a caret. Pre-existing, not fixed here | menu items named; Turn into works from the keyboard | none | focal: the open page menu | note for the notes area: give the editor a focus sign | FAIL (pre-existing R-32, notes editor) |

### Calendar and plan (T8)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| calendar-month | PASS | dots + "n items" in words; today and chosen day not by colour alone | none | focal: today | ok | PASS |
| calendar-week | R-01 flagged: `ul.tp-sched__body` uses `repeating-linear-gradient`. Block 2 purpose written (plan.css): it draws the 1 px hour rules, not decoration | overlaps named in words | R-01 purpose: hour rules | focal: the overlap notice + items; fixed solid edge vs flexible dashed edge is the motif | fixed: at 390 px two overlapping items were ~46 px wide and the Hebrew time range lost its first digit; phone days are now 140 px wide. Titles of 1-hour items still clip under two time lines (the mover names them) | PASS (R-01 purpose stated) |
| calendar-mover | R-01 as above | mover heading takes focus; moves say what they do | R-01 purpose | focal: "Move Review: mitosis" | ok | PASS (R-01 purpose stated) |
| plan-preview | PASS | R-27 empty line before input, error line for a past date (unit tests) | none | focal: "Your plan" totals; one primary | gallery-only page error, see note 1 | PASS |
| plan-short | PASS | three ways out shown | none | focal: the short notice | fixed: a way that can't be offered ("A later date" when no date in 180 days fits) was a bare heading; now says so in words (en + he), unit test added | PASS |
| plan-scheduler | R-01 as above | ok | R-01 purpose | focal: sessions in the week grid | note: the grid opens at 07:00, so 17:00 sessions sit below the fold inside the grid's own scroll | PASS (R-01 purpose stated) |

### Record (T8 S7)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| record-consent | PASS | consent box gates the mic; "Start recording" disabled until ticked, with the reason in words | none | focal: "Before you start" | ok | PASS |
| record-typing | PASS | no-key path: typed notes, pin added | none | focal: notes box; one primary "Stop and review" | pin note placeholder is cut at 390 px ("What was this about? (op") | PASS |
| record-review | PASS | proposed rows with Accept / Edit / Reject, source line quoted | none | focal: suggested tasks | ok | PASS |

### Ingest, memory, reminders, share, mini-app (T9, T10)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| ingest-paste | PASS | ok | glass on the sheet (owner override, floating chrome) | focal: the text box; one primary | ok | PASS |
| ingest-photo-unsupported | PASS | R-27 unsupported state with a way out | glass sheet | focal: the notice | fixed: at 390 px the notice squeezed its words into a narrow column beside "Paste text instead"; the button now drops below (t10.css) | PASS |
| ingest-done | PASS | R-27 done state; focus moves to "Open the page" | glass sheet | focal: "Open the page" | ok | PASS |
| memory-list | PASS | imported vs own source in words | none | focal: the list; motif: serif headings | ok | PASS |
| memory-edit | PASS | edit in place with Save / Cancel | none | focal: the edited memory | ok | PASS |
| memory-empty | PASS | R-27 empty state with import and add | none | focal: empty-state words | ok | PASS |
| reminders | PASS | "Not connected yet" badge with icon and words; no Connect button that does nothing | none | focal: channel list | ok | PASS |
| share-sheet | PASS | every row does something real (share, copy, two downloads) | glass sheet | focal: first row (focused) | Copy link icon sits lower than the other rows' icons (minor) | PASS |
| miniapp-approve | PASS | asks before running; R-36 "walled off" claim matches the sandbox + CSP code, not network-verified (UNKNOWN) | none | focal: "Run this widget" | ok | PASS |
| miniapp-stopped | PASS | stopped state explains what happened | none | focal: the note | ok | PASS |

Notes.
1. Gallery-only page error on the plan views: `TypeError … reading 'nodeType'` in `getSelection`. In the Bun bundle CodeMirror's top-level `getSelection` collides with React DOM's own, and React's select event on the date and number fields calls the wrong one. The live `/study/plan` shows no such error (its only error is the placeholder Convex URL). Not an app bug; recorded so nobody chases it.
2. Hebrew shots: every gallery view was shot with `?lang=he` and `dir="rtl"`; no overflow (R-03 PASS on all 124). Hebrew copy was not proofread by a native speaker: **UNKNOWN**.
3. Not checked: live data states (no real Convex deployment, by design: no keys), screen readers, real phones, `prefers-reduced-motion` runs. **UNKNOWN**.

Summary: 39 screens. Gallery, 31 views: 30 PASS (3 of them with the R-01 hour-rule purpose written down) and 1 FAIL that is pre-existing and outside this run (page-menu-turn-into, R-32 on the notes editor). Live, 8 routes: PASS apart from R-19 on the shell `aside` (and the settings skeleton), both pre-existing. Fixed in this run's code: R-32 on date / time / number fields (plan, calendar), the empty "A later date" way out, the phone week-grid lanes, the ingest notice at 390 px.
