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

Shot 2026-10-17 on `3111214`, the record and Turn into views (`record-*`, `study-new-*`) reshot on `3dceade` and `study-review-quizset` on `e9a761f`, from the main checkout against its own dev server (placeholder Convex URL, the dev-only E2E bypass), gallery built as an IIFE (`docs/kitchen/study/gallery/build.ts`). Files in `docs/kitchen/study/shots/`: the live routes in English and every gallery view in English and Hebrew, each at 390 / 1280 px, light and dark; gallery files are named `gallery-MOCKED-*` (real components, fictional data, stand-in Convex hooks). Measured results: `gate-live.json`, `gate-gallery.json`, `gate-gallery-he.json`.

How to read the tables. **B1 measured** comes straight from `gate.mjs` on every shot of that screen (R-02, R-03, R-25, R-26, R-32, text ≥ 13 px, one primary, R-01, R-19). **B1 read** is what was checked by looking. Unless a row says otherwise: no stats, testimonials, FAQ or invented assets (R-17 / 18 / 23 / 28 PASS); fixes in source (R-33 PASS); light and dark both shot with no break seen (R-34 PASS); design read above (R-37 PASS); sample data is fictional and every gallery file says MOCKED (R-38 PASS). **R-35** PASS for the gallery views: `docs/kitchen/study/click-through.mjs` presses every visible control in `<main>` of every view (390 / 1280, en / he), each from a fresh page, and records page errors, console errors, unhandled rejections, an error state appearing, a blank page and bad link targets: 2,440 controls, 0 failures (`click-through.json`; seen to catch each of five injected faults). PARTIAL for the live routes (signed-out states only) and for the controls inside the mini-app's iframe, which weren't pressed (UNKNOWN). **R-36**: on-screen privacy sentences ("Audio is never stored", "on this device", "walled off") match the code and its tests; not verified at the network level, so **UNKNOWN**.

### Live routes (English; signed-out states)

With the placeholder Convex URL the client stops (`[CONVEX FATAL ERROR] Couldn't parse deployment name example`), so each live route shows its signed-out or loading state inside the real shell; signed-out study screens offer Sign in. Data states are in the gallery tables.

| screen | B1 measured | verdict |
|---|---|---|
| `/study` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/study/review` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/study/new` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/study/plan` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/study/record` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/study/listen` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/settings/reminders` | R-19 only: the shell `aside` 260 ms transition (before this run) and the loading skeleton's 1400 ms shimmer (tempo.css, before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/settings/memory` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |
| `/calendar` | R-19 only: the shell `aside` 260 ms transition (before this run). 4 shots (en) | PASS (pre-existing R-19) |

### Study (T3, T4 and the study backlog)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| study-review-quizset | PASS, 8 shots (en/he) | a review link to a quiz or practice test says Review is for flashcards and links to the set, with Back to Study (it used to say "Nothing to review right now") | none | focal: "Open the quiz" | fixed (states audit follow-up) | PASS |
| study-review-badset | PASS, 8 shots (en/he) | a review link to a set that's gone says so, with Back to Study (it used to say "Nothing to review right now") | none | focal: the note | fixed (states audit) | PASS |
| study-hub-loading | R-19 only: the shared loading skeleton's 1400 ms shimmer (`tempo.css:465` `.tp-skeleton`, before this run; it stops under reduced motion). 8 shots (en/he) | R-27 loading: skeleton rows with a screen-reader label; the heading, More ways to study and Bring in material stay usable | none | focal: the heading | added (states audit) | PASS (pre-existing R-19) |
| study-hub-signedout | PASS, 8 shots (en/he) | R-27 signed out: "Sign in to see this page." with Sign in | none | focal: Sign in | added (states audit) | PASS |
| study-hub-offline | PASS, 8 shots (en/he) | offline notice in words with an icon; the due card still works, and its writes wait for the connection | none | focal: "12 cards due · Start review" | added (states audit) | PASS |
| study-set-loading | R-19 only: the shared loading skeleton's 1400 ms shimmer (`tempo.css:465` `.tp-skeleton`, before this run; it stops under reduced motion). 8 shots (en/he) | the h1 "Study set" stays while it loads | none | focal: the heading | fixed: the loading state had no heading | PASS (pre-existing R-19) |
| study-set-notfound | PASS, 8 shots (en/he) | R-27 gone: says what may have happened, that other sets are safe, and Back to Study | none | focal: the note | added (states audit) | PASS |
| study-new-nofrom | PASS, 8 shots (en/he) | R-27 no page picked: says how to start, with Open your pages | none | focal: the note | added (states audit) | PASS |
| study-hub | PASS, 8 shots (en/he) | R-27 empty and truncated states shot separately | none | focal: "12 cards due · Start review"; one accent primary; motif: paper cards | ok | PASS |
| study-hub-empty | PASS, 8 shots (en/he) | R-27 empty state with a way forward | none | focal: empty-state action | ok | PASS |
| study-hub-truncated | PASS, 8 shots (en/he) | past the read budget the hub says "Showing your most recent sets." in words | none | focal: the due line; the note is quiet | ok | PASS |
| study-review | PASS, 8 shots (en/he) | grade buttons named with their interval; focus moves to the grades after Show answer (checked in Chromium) | none | focal: the card being studied; motif: index card | ok | PASS |
| study-review-done | PASS, 8 shots (en/he) | R-27 done state; focus goes to the done title | none | focal: the done line | ok | PASS |
| study-review-typed | PASS, 8 shots (en/he) | labelled answer field; Enter checks, Escape clears | none | focal: the answer field; one primary Check | ok | PASS |
| study-review-typed-checked | PASS, 8 shots (en/he) | Matches / Almost / Different as icon + word; the suggested grade is a word on the button, never automatic | none | focal: the verdict; four grades two by two on a phone | fixed: grades wrapped 3 + 1 at 390 px | PASS |
| study-deck | PASS, 8 shots (en/he) | ok | none | focal: next card; Ask about this set is a ghost toggle below | ok | PASS |
| study-quiz | PASS, 8 shots (en/he) | ok | none | focal: current question card | ok | PASS |
| study-quiz-feedback | PASS, 8 shots (en/he) | feedback in words and icon, not colour alone | none | focal: the feedback | ok | PASS |
| study-test | PASS, 8 shots (en/he) | Hebrew and English sections mixed, each line in its own direction | none | focal: question card | ok | PASS |
| study-test-score | PASS, 8 shots (en/he) | ok | none | focal: the score | ok | PASS |
| study-new-preview | PASS, 8 shots (en/he) | answers are two-line fields | none | focal: the preview cards + one primary | fixed: one-line answer fields cut sentences | PASS |
| study-new-nokey | PASS, 8 shots (en/he) | R-27 no-key state, kind words | none | focal: the notice | ok | PASS |
| study-new-undo-edited | PASS, 8 shots (en/he) | Undo takes the set back in one click; when changes made since went with it the toast says so and offers Bring it back for 5:00 | none | focal: the toast | fixed: Undo used to refuse (HARD_RULES §1); the page leaves room under its last control for the toast (`ec5e045`) | PASS |
| study-set-edit | PASS, 8 shots (en/he) | Save changes is the one primary; Edit, Share and Remove step aside; focus on the heading | none | focal: the edit list | fixed: "keep keep" copy; heading ring ran across the card | PASS |
| study-set-edit-changed | PASS, 8 shots (en/he) | a newer block is named in words with Reload the newest version; nothing is overwritten | none | focal: the notice | ok | PASS |
| study-set-share | PASS, 8 shots (en/he) | every row does something real; Anki only for flashcards | glass sheet (owner override) | focal: first row (focused) | ok | PASS |
| study-set-ask | PASS, 8 shots (en/he) | quotes say where they came from; matched words in bold with a line saying so | none | focal: the quotes | ok | PASS |
| study-set-ask-empty | PASS, 8 shots (en/he) | R-27 nothing found: says so and links to the page | none | focal: the empty line | ok | PASS |
| study-set-ask-he | PASS, 4 shots (he) | pointed Hebrew matches an unpointed question; RTL | none | focal: the quotes | ok | PASS |
| study-listen | PASS, 8 shots (en/he) | Play / Back 15 s / Forward 30 s / speed as a radio group; transcript sentences are buttons | none | focal: Play, the one primary | fixed: Find it sat beside a wrapped heading at 390 px | PASS |
| study-listen-he | PASS, 4 shots (he) | a Hebrew page reads in Hebrew even with a link or a block in it | none | focal: Play | ok | PASS |
| study-listen-voice-error | PASS, 8 shots (en/he) | a voice that fails says so in words and pauses; nothing races to the end | none | focal: the note under the controls | ok | PASS |
| page-menu-turn-into | R-32 FAIL on `div.cm-content`, the notes editor's page body: `components/editor/live-preview.ts` turns its focus outline off (from before this run, notes area). 8 shots (en/he) | Turn into and Listen are menu items reachable from the keyboard | none | focal: the open page menu | note for the notes area: give the editor a focus sign | FAIL (pre-existing, notes editor) |

### Calendar and plan (T8, S9, re-plan)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| plan-offline | PASS, 8 shots (en/he) | offline notice in words: the plan can be tried, adding it needs a connection; Add these sessions and Undo send nothing and say why | none | focal: the notice, then the form | added (states audit) | PASS |
| plan-signedout | PASS, 8 shots (en/he) | the form and the preview work signed out; "Sign in to add these sessions to your calendar." with Sign in | none | focal: the form | added (states audit) | PASS |
| calendar-month | PASS, 8 shots (en/he) | dots + "n items" in words; today and the chosen day not by colour alone | none | focal: today | ok | PASS |
| calendar-week | R-01 flagged on `ul.tp-sched__body` (`repeating-linear-gradient`): it draws the 1 px hour rules; purpose written in plan.css (Block 2). 8 shots (en/he) | overlaps named in words; the grid opens at the week's first item; focus never hides under the day names | R-01 purpose: hour rules | focal: the overlap notice + items | fixed earlier: phone day columns 140 px | PASS (R-01 purpose stated) |
| calendar-mover | R-01 flagged on `ul.tp-sched__body` (`repeating-linear-gradient`): it draws the 1 px hour rules; purpose written in plan.css (Block 2). 8 shots (en/he) | mover heading takes focus; moves say what they do | R-01 purpose | focal: "Move Review: mitosis" | ok | PASS (R-01 purpose stated) |
| plan-preview | PASS, 8 shots (en/he) | R-27 empty line before input, error line for a past date (unit tests) | none | focal: the plan card; one primary | ok | PASS |
| plan-short | PASS, 8 shots (en/he) | three ways out shown; one that can't help says why | none | focal: the short notice | fixed: wide gaps in "Use 135 minutes a day" | PASS |
| plan-scheduler | R-01 flagged on `ul.tp-sched__body` (`repeating-linear-gradient`): it draws the 1 px hour rules; purpose written in plan.css (Block 2). 8 shots (en/he) | sessions in the week grid; opens at the first session | R-01 purpose | focal: sessions | fixed: the grid opened at 07:00 with 17:00 sessions out of view | PASS (R-01 purpose stated) |
| plan-guided | PASS, 8 shots (en/he) | GuidedPlanCard: steps as task rows, kind and status in words + icon | none | focal: the card; one primary Accept | fixed: the step time was under 13 px | PASS |
| plan-guided-edit | PASS, 8 shots (en/he) | rename, length, move with buttons or Alt+arrows, remove; focus stays on the step | none | focal: the edit list | ok | PASS |
| plan-guided-accepted | PASS, 8 shots (en/he) | 5:00 Undo outside the live region (read once); To do / Doing / Done | none | focal: the note and Undo | ok | PASS |
| plan-undo-edited | PASS, 8 shots (en/he) | Undo takes the plan back in one click; done sessions that went with it are named, with Bring it back | R-01 purpose (the week grid below) | focal: the note | fixed: the page leaves room under its last control for the toast (`ec5e045`) | PASS |
| plan-replan-notice | R-01 flagged on `ul.tp-sched__body` (`repeating-linear-gradient`): it draws the 1 px hour rules; purpose written in plan.css (Block 2). 8 shots (en/he) | "n sessions were missed or now overlap" without guilt words; secondary Re-plan the rest | R-01 purpose (the week grid below) | focal: the notice | ok | PASS (R-01 purpose stated) |
| plan-replan-preview | PASS, 8 shots (en/he) | what moves where ("Moves from … to …"), what doesn't fit, three ways out | none | focal: the new times; one primary | fixed: "From … to …" read as a span of time | PASS |

### Record (T8 S7)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| record-signedout | PASS, 8 shots (en/he) | R-27 signed out: "Sign in to see this page." with Sign in (it used to end on the generic error page) | none | focal: Sign in | fixed (states audit) | PASS |
| record-checking | PASS, 8 shots (en/he) | while live words are being looked up, a line says so; Type or paste notes works meanwhile | none | focal: "Type or paste notes" | fixed: it looked like live words were off, with no reason | PASS |
| record-offline | PASS, 8 shots (en/he) | offline notice: "Your notes stay here, and saving waits until you're back"; Save waits and goes by itself; the screen stays if sign-in blinks | none | focal: the review card | added (states audit) | PASS |
| record-consent | PASS, 8 shots (en/he) | consent box gates the mic; Start disabled until ticked, with the reason in words | none | focal: "Before you start" | ok | PASS |
| record-typing | PASS, 8 shots (en/he) | no-key path: typed notes, pins | none | focal: notes box; one primary "Stop and review" | fixed: the pin placeholder was cut at 390 px | PASS |
| record-review | PASS, 8 shots (en/he) | proposed rows with Accept / Edit / Reject, source line quoted | none | focal: suggested tasks | ok | PASS |
| record-undo-edited | PASS, 8 shots (en/he) | Undo takes the page and its tasks back; the toast names what went with them and offers Bring it back | none | focal: the toast | fixed: Undo used to refuse (HARD_RULES §1); the page leaves room under its last control for the toast (`ec5e045`) | PASS |

### Ingest, memory, reminders, share, mini-app (T9, T10)

| screen | B1 measured | B1 read | B2 purpose | B3 liveliness | B4 | verdict |
|---|---|---|---|---|---|---|
| memory-loading | R-19 only: the shared loading skeleton's 1400 ms shimmer (`tempo.css:465` `.tp-skeleton`, before this run; it stops under reduced motion). 8 shots (en/he) | R-27 loading under the heading; Import stays usable | none | focal: the heading | added (states audit) | PASS (pre-existing R-19) |
| memory-error | PASS, 8 shots (en/he) | R-27 error: "Nothing was forgotten", with Retry | none | focal: Retry | added (states audit) | PASS |
| ingest-paste | PASS, 8 shots (en/he) | ok; Esc and the Tab loop stay in the sheet | glass on the sheet (owner override, floating chrome) | focal: the text box; one primary | ok | PASS |
| ingest-photo-unsupported | PASS, 8 shots (en/he) | R-27 unsupported state with a way out | glass sheet | focal: the notice | fixed earlier: the button drops below the words on a phone | PASS |
| ingest-done | PASS, 8 shots (en/he) | R-27 done state; Open the page, or turn it into something to study | glass sheet | focal: "Open the page" | ok | PASS |
| memory-list | PASS, 8 shots (en/he) | imported vs own source in words | none | focal: the list; motif: serif headings | ok | PASS |
| memory-edit | PASS, 8 shots (en/he) | edit in place with Save / Cancel; edit and forget Undos no longer cancel each other | none | focal: the edited memory | ok | PASS |
| memory-empty | PASS, 8 shots (en/he) | R-27 empty state with import and add | none | focal: empty-state words | ok | PASS |
| reminders | PASS, 8 shots (en/he) | "Not connected yet" badge with icon and words; no Connect button that does nothing | none | focal: channel list | ok | PASS |
| share-sheet | PASS, 8 shots (en/he) | every row does something real (share, copy, two downloads) | glass sheet | focal: first row (focused) | ok | PASS |
| miniapp-approve | PASS, 8 shots (en/he) | asks before running; R-36 "walled off" matches the sandbox + CSP code, not network-verified (UNKNOWN) | none | focal: "Run this widget" | ok | PASS |
| miniapp-stopped | PASS, 8 shots (en/he) | stopped state explains what happened; Run it again runs the same approved code, or asks first | none | focal: the note | fixed: the stopped card had no way out | PASS |

### Keyboard walk and reduced motion

`docs/kitchen/study/a11y-walk.mjs` opens every gallery view (66, including the loading, signed-out, error and offline views added by the states audit) at 390 and 1280 px, in English and Hebrew (the two `-he` views in Hebrew only), light theme: 260 runs, 2,404 Tab stops (rerun on `e9a761f`). Each run's findings are in `a11y-walk.json`.

- **Keyboard walk.** Tab until focus comes back round, or 200 presses. (i) **Unreached**: a visible, enabled control Tab never reaches. A radio group or a roving-tabindex group (the month grid's days, Segmented) counts as reached when its Tab stop is reached and an arrow key from that stop is seen to move within the group (44 groups checked so); controls behind an open modal or in a closed panel don't count. (ii) **No focus sign**: outline, box-shadow and border compared focused and blurred, on the stop, its two parents and its siblings (the blurred styles are read once Tab has moved on); the stop's own outline doesn't count when the boxes around it clip off more than half of it. (iii) **Hidden focus**: after the browser scrolled to it, the stop (or the label it stands for) is not visible, is off screen or clipped, shows under 90% of itself although it would fit (text fields aside: the browser brings their caret into view, not the whole box), or is entirely covered. (iv) **Trap**: focus stays put for 3 presses (10 for date, time and media fields, which have parts inside) or loops without coming back, outside an aria-modal dialog.
- **Reduced motion.** A `reducedMotion: "reduce"` context, the view's scripted steps, then every element and `::before` / `::after` whose transition or animation still lasts over 10 ms (with a property or name that isn't `none`), any script animation still running, and any `behavior: "smooth"` scroll call.
- Each check was seen to fire on faults injected into a copy of the gallery (an outline removed, buttons set to `tabindex="-1"`, Tab swallowed, a button pushed off screen, an inline 300 ms transition and a script animation, a clipping box, a smooth scroll).

| check | before (runs / distinct) | after (runs / distinct) |
|---|---|---|
| (i) unreached | 0 / 0 | 0 / 0 |
| (ii) no focus sign | 8 / 6 | 4 / 2 |
| (iii) hidden focus | 14 / 14 | 0 / 0 |
| (iv) trap | 0 / 0 | 0 / 0 |
| reduced motion | 0 / 0 | 0 / 0 |

Distinct means view + element; an English and a Hebrew name count separately.

Fixed. The week grid at 390 px: an item that Tab scrolled in flush with the region's bottom edge showed 49% of its ring (calendar-week, calendar-mover); the region now keeps `space-2` scroll padding on every side, not only under the day names (`plan.css`, `e72e923`). Items at the region's far side stayed 51–78% shown after Tab, because Chromium doesn't scroll a partly shown item sideways (calendar-week, calendar-mover, plan-scheduler, plan-replan-notice, and plan-undo-kept, now plan-undo-edited); a focused item now calls `scrollIntoView({ block: "nearest", inline: "nearest" })`, with no glide (`WeekGrid.tsx`, `895d703`). The Undo toast, once it offered Bring it back, covered the focused control at the end of three pages (study-new-undo-edited, plan-undo-edited, record-undo-edited: hidden focus in 10 runs, light and dark). Those controls were the page's last, so no scroll padding could lift them. `useToastRoom` now measures the open toast, and the page's bottom padding grows to at least that room, never less than its own (`ec5e045`). Gallery only: calendar-month held a fixed chosen day, so its arrow keys had nothing to move to; it now keeps the day in state as CalendarViews does (`c8d2b1a`).

Left, outside this run:
- page-menu-turn-into: the notes editor's page body has no focus sign (`apps/web/components/editor/live-preview.ts:739`, `"&.cm-focused": { outline: "none" }`), the same R-32 item as above. 4 runs, en and he.
- Under the half-clipped bar, so not counted: the month grid clips about 30% of an edge day's ring (`apps/web/app/tempo.css:898`, `.tp-month__grid { overflow: hidden }`), and at 390 px the ingest sheet's title field shows 55% of its ring when Tab scrolls it to the sheet body's bottom edge (`apps/web/app/tempo.css:1428`, `.tp-sheet__body` has no scroll padding). Both are shared tempo.css components.

Reduced motion finds nothing because `globals.css:543` and `tempo.css:480` already cut every duration to 0.01 ms under `prefers-reduced-motion: reduce`, and the run's one smooth scroll (the week grid gliding to another week, `WeekGrid.tsx:238`) checks the media query itself; the gallery never changes week, so the walk didn't exercise that one. Dark theme: the same walk with `THEME=dark` (`a11y-walk-dark.json`, rerun on `e9a761f`): 260 runs, unreached 0, no focus sign 4 (the same notes-editor stop), hidden focus 0, traps 0, reduced motion 0. Not covered: the app shell (the gallery has none, so its sticky top bar can't cover a stop here), screen readers.

Notes.

1. The gallery is built as an IIFE: as a classic script its top-level CodeMirror `getSelection` replaced `window.getSelection` and React's select events threw on the plan views. That was the gallery-only page error the first evidence run recorded; it is gone, and the app (Turbopack) was never affected.
2. Hebrew: every gallery view was shot with `?lang=he` and `dir="rtl"`. The Hebrew copy is machine-written and was not proofread by a native speaker: **UNKNOWN**.
3. Not checked: live data states (no real Convex deployment, by design: no keys), screen readers, real phones, real speech voices. **UNKNOWN**.

Summary: 556 shots. Gallery, 66 views: 58 PASS, 4 PASS with the R-01 hour-rule purpose written down, 3 PASS apart from the shared loading skeleton's R-19 (pre-existing), 1 FAIL (page-menu-turn-into; pre-existing, outside this run). Live, 9 routes: PASS apart from R-19 on the shell `aside` (and the settings skeleton), both pre-existing.
