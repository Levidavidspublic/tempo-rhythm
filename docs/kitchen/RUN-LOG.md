# Kitchen: Tempo study and planning — run log

Branch `kitchen/tempo-study` from `kitchen/polish-pass` (`5f1b3ec`), so the polish work in PR #1053 is kept. One draft PR into `integration`, stacked on #1053. Mode: kitchen 0→100, long unattended run (24–72 h).
Code model: the lead session plus Opus subagents at medium effort (one builder per finish line in its own worktree, one reviewer per finish line). Runtime model: unchanged (DeepSeek V4.1 Flash on DeepInfra, `convex/lib/ai_router.ts`).

**If this run restarts:** read this file, `docs/kitchen/tests.json` and `git log --oneline -20`, run `bun run test`, then continue from the first unchecked line below.

**Tags.** `AWAY` = the agent does it while Amit is away. `WALK` = Amit can do it from his phone. `AT` = Amit needs to be at the computer.

## Finish lines

Order from the second brief (this run owns study, recording, planning, uploads, memory and the stretch items):

- [ ] `AWAY` T3 Study layer: S18 FlashcardDeck · S20 AdaptiveQuiz · S19 ReviewHub + SM-2 scheduler in `packages/core/srs` · S21 TestRunner + Bagrut-style question plugin · S25 TurnIntoMenu on notes and pages. Saved as json-render blocks. Study is its own area; Today does not change.
- [ ] `AWAY` T8 S7 RecordSession (consent, live Deepgram transcript, pinned notes → notes + tasks, audio never stored) · S3 PlanPath + S4 SessionScheduler with real week and month grids.
- [ ] `AWAY` T9 S2 IngestSheet (file, paste, photo → OCR) · S31 MemoryManager parity.
- [ ] `AWAY` T10 Stretch: S14 reminders through a messaging channel (adapter only; channel UNKNOWN) · S26 ShareSheet · S24 MiniAppFrame.

Backlog, after the four lines above (the first brief's lines and the SHARED KIT). Before each one, check whether the parallel run already claims it on its branch; if it does, log it and skip it:

- [ ] `AWAY` T1 Chat kit: S8 ChatShell (history grouped Today / Yesterday / 7 days, auto-title, rename, search, delete, edit, regenerate, stop, follow-ups, attachments, 390 px) and "turn this into a task" with Accept / Undo.
- [ ] `AWAY` T2 Cards in chat: OpenUI cards + templates; S9 GuidedPlanCard grown from the decision card.
- [ ] `AWAY` T4 S16 AudioRecapPlayer + ReadAloudButton on every message (Hebrew via Chatterbox Multilingual).
- [ ] `AWAY` T5 English live voice round trip (Deepgram Flux → runtime model → Kokoro), barge-in, voice-gated streaming; Hebrew call = text in + read-aloud out.
- [ ] `AWAY` T6 Bring your own voice: Settings screen + adapters.
- [ ] `AWAY` T7 Coach dial + Council view with a Scribe seat.
- [ ] `AWAY` Remaining SHARED KIT pieces (S10, S13, S22, S28, S32, S35), then ROADMAP items, then quality passes.
- [ ] `AWAY` Last step: fresh-context correctness review, fixes, RESUME comment.
- [ ] `AT` Amit reviews and decides. The agent never merges.

## Now working on

Final reshoot of every gallery view (44 in en and he, plus the two Hebrew-only views) and the 9 live routes; then GATE.md per screen, tick T3 / T8 / T9 / T10, full E2E and build, one push, PR body. Next wave: a fresh-context correctness review of the whole run.

## Log

| time (UTC, commit time) | commit | finish line | result | proof |
|---|---|---|---|---|
| 2026-10-16 21:20 | `5f1b3ec` | setup | Branch `kitchen/tempo-study` cut from `kitchen/polish-pass`. Bun 1.3.9, `bun install --frozen-lockfile` OK (2000 packages). Code map done by a read-only subagent | — |
| 2026-10-16 21:24 | — | setup | Issue #1080 and draft PR #1081 (stacked on #1053); PR activity watched | https://github.com/Levidavidspublic/tempo-rhythm/pull/1081 |
| 2026-10-16 21:32 | `a3fde65` | T3 | Contract: flashcards / quiz / test blocks in the one page codec, SM-2 in `packages/core/srs`, quiet page cards, build spec `docs/kitchen/study/T3-SPEC.md`. `bun test packages`: 755 pass, 1 fail (the catalog agreement test, fixed by Builder C) | `packages/core/srs/sm2.test.ts`, `packages/utils/src/study-blocks.test.ts` |
| 2026-10-16 21:37 | `51f8dd6` | evidence | `docs/kitchen/study/shoot.mjs` + `gate.mjs`: screenshots plus the measurable Delivery Gate checks per shot. Trial on `/sign-in` and `/today`: sign-in PASS; Today (not this run's) shows a 260 ms animation | `/tmp` trial, not committed |
| 2026-10-16 21:40 | `503cc29` | T8 | Builder E: `packages/core/plan` (planBack, calendar math, week layout, conflicts, month counts). 34 tests | `bun test packages/core/plan` |
| 2026-10-16 21:41 | `3ed0990` | T3 | Builder B: study tables + functions (`convex-arch:`). 26 tests | `bun test convex/study.test.ts` |
| 2026-10-16 21:42 | `5501fc5` | T3 | Builder A: review queue, adaptive quiz, question plugins + scoring with the pick rule, outline reader, ids. 115 tests | `bun test packages/core` |
| 2026-10-16 21:45 | `e8dd0f7` | T3 | Reviewer on the study backend: 4 findings (double tap, undo order, source-line injection, 200-row state cap), all fixed with tests (30 pass) | `bun test convex/study.test.ts` |
| 2026-10-16 21:49 | `36638ed` | T3 | Builder C: study blocks draw as their own catalog cards (the red catalog test is green, list extended, invariant kept); FlashcardDeck, FlashcardReview, AdaptiveQuiz, TestRunner, ScoreCard; adapters to the core engine and scorer | `bun test packages/ui/src/study` (63 pass) |
| 2026-10-16 21:53 | `c0e199b` | T9 | Builder H IngestSheet (27 tests) and Builder I MemoryManager parity (`memory.update`, search, edit with Undo) merged. Full suite: 2670 pass, 0 fail; lint, typecheck, scans OK; pushed | `bun run test` |
| 2026-10-16 22:02 | `f95b9d4` | T8 | Builder G: plans backend (`convex-arch:`), real MonthGrid / WeekGrid / ItemMover, CalendarViews Week and Month on the grids, `/study/plan` (PlanPath + SessionScheduler). Lead fix: each session keeps its local time across a DST change (2 new tests). Full suite 2711 pass | `bun test convex/plans.test.ts tests/unit/plan packages/core/plan` |
| 2026-10-16 22:05 | `7f1390f` | T10, T8 | Builder J (reminders seam + `convex-arch:` deliver that always refuses, Settings → Reminders, ShareSheet, MiniAppFrame) and Builder F (RecordSession: consent, live words via Deepgram token, pins, review rows, save + Undo; `convex-arch:` recordings) merged. Full suite 2798 pass; lint, typecheck, scans OK; pushed | `bun run test` |
| 2026-10-16 22:06 | — | T8, T10 | Reviewers: plan (1 high, 4 medium, 4 low) and record/T10 (3 medium, 4 low). Two fix builders started with every finding | reviewer reports in this log's Decisions once fixed |
| 2026-10-16 22:15 | `572388f` | T8 | Plan fix builder: all 9 review findings fixed with tests (Move-to picker keys only move focus; clamp never moves the wrong way; month grids load all 42 cells; focus kept on month change; no session past midnight; exam tomorrow; busy time from events and tasks; startAt bound 60 min; no session on or after the deadline). One test from this run whose expectation encoded the bug was updated (planner "exam tomorrow"). Lead: a plan's own sessions aren't busy for its preview | `bun test packages/core/plan convex/plans.test.ts tests/unit/plan` |
| 2026-10-16 22:19 | `3e31225` | T3 | Builder D: `/study` hub (S19), `/study/review`, `/study/[setId]` (deck, adaptive quiz, test + score), `/study/new` Turn-into preview with Accept / Edit / Reject + Undo (S25), TurnIntoMenu in the page menu, Study in the rail, palette and crumbs, gallery views. Merge fix: the memory test's next/link stand-in now forwards props (process-wide mock). Build passes with all six `/study` routes | `bun run build` |
| 2026-10-16 22:22 | `f851e29` | T3, T8, T10 | Study wiring smoke spec (`/study`, review, new, plan, record, Settings → Reminders under the dev-only bypass): 6/6. Record/T10 fix builder: 7 findings fixed (extractor, frame navigation guard, Anki quoting, recorder failure release, deliver owner check without requireUser, approval tied to the code, download URL lifetime). Full suite 2870 pass; e2e 34 passed, 89 skipped, 0 failed | `bunx playwright test`, `docs/kitchen/tests.json` |
| 2026-10-16 22:37 | `8370c8d`…`408e3ed` | T3 | Reviewer on the T3 web screens: 8 findings fixed (test sections capped at the codec's limits and duplicate choices named; a double tap is deduped only for the same button, `convex-arch:` `e521535`; hub new counts stop at 20; the review session follows `?set` changes and shows graded card states; accepted and edited previews keep their Undo and edits; Study links open client-side so autosave flushes first) | `bun run test` 2898 pass |
| 2026-10-16 22:39 | `06d8e04` | backlog | Backlog checked against the parallel run and open PRs: T5 / T6 voice and BYO voice blocked (VOICE.md not adopted; #213 / #389); S16 recap and S9 GuidedPlanCard are study-side and built here (Decisions) | — |
| 2026-10-16 22:54 | `1a7106f`…`769f3ee` | T2 (S9) | GuidedPlanCard grown from the decision card: steps as catalog TaskBlocks, inline edit, 5:00 Undo, step status after Accept. `/study/plan`'s preview uses it. Typecheck 5/5, `bun run test` 2912 pass, lint 0 errors | `packages/ui/src/plan/guided-plan.test.ts` |
| 2026-10-16 22:57 | `3c8756b`→`1c29373`, `54f71d7` | T4 (S16) | Builder: recap core (`packages/core/recap`), ReadAloudButton + a `readAloud` slot on the study components, AudioRecapPlayer and `/study/listen` on the browser's speech engine behind a `SpeechEngine` seam. Typecheck 5/5, `bun run test` 2972 pass, lint 0 errors, both scans OK | `tests/unit/study/recap_player.test.tsx` |
| 2026-10-16 22:59 | `083c305` | setup | `convex-arch:` the run's tables reach `convex/schema.ts` through one import and one spread (`convex/schema/kitchenStudy.ts`). `tsc -p convex`: 19 errors before and after, all in files this run didn't touch | `bun test convex` 995 pass |
| 2026-10-16 23:00 | `8582438`…`e0edd74` | evidence | Evidence builder: 32 live + 248 gallery shots (en, he; 390 / 1280; light / dark), gate JSON, per-screen table in GATE.md. Fixed: focus ring on date / time / number fields, plan "ways out" that can't help now say why, week grid days 140 px on phones, the ingest photo notice's button. Left: R-01 on the hour rules (purpose written), R-32 on the notes editor and R-19 on the shell `aside` (both pre-existing) | `docs/kitchen/study/GATE.md`, `docs/kitchen/study/shots/` |
| 2026-10-16 23:01 | `2ff35d8` | T4, T3 | "Listen to a recap" in the page menu; study screens' signed-out state has a Sign in button | `bun run test` 2974 pass |
| 2026-10-16 23:02 | — | T4, S9 | Reviewer on T4 and S9: 1 high (Hebrew pages read with an English voice when a link or block is present), 4 medium, 7 low. Fix builder started with all 12 (one goes to the re-plan builder, which owns the plan screen) | reviewer report, fixes to follow |
| 2026-10-16 23:06 | `0aec54c` | backlog | Recording → cards: the saved step links to the flashcards, quiz and test previews (ROADMAP P5 "Lecture → notes → deck → test") | `bun test tests/unit/record` 18 pass |
| 2026-10-16 23:11 | `0d90b1e` | T8 | Evidence nit: the pin note placeholder fits a phone ("Add a note (optional)") | — |
| 2026-10-16 23:25 | `40dedb3`…`3a5d749` | backlog | Builder L: typed recall ("Type answers" switch on review and deck; Matches / Close / Different in words and icon; a suggested grade, never an automatic one; SM-2 unchanged). Keyboard path checked in Chromium. 3025 pass | `packages/core/srs/recall.test.ts`, `packages/ui/src/study/TypedRecall.test.tsx` |
| 2026-10-16 23:26 | `0b0cad9` | T3 | Lead: review keeps focus after Show answer (grade group) and after a grade (next card's Show answer), checked in Chromium on the gallery build | focus script: reveal → `fieldset.tp-study-grades` → grade 3 → `review-reveal` |
| 2026-10-16 23:27 | `2892075`…`127663f`, `79896a6` | T4, S9 | Fix builder: all 11 T4 / S9 findings plus the 13 px step time and the listen h1, each with a test that failed before. Study wiring spec now covers `/study/listen` and the Sign in link: 7/7 | `bunx playwright test tests/e2e/wiring/study.spec.ts` |
| 2026-10-16 23:29 | `b60730c`, `8838975` | T4 | Lead: the recap's question field and Find it share a row (the button sat beside a wrapped heading at 390 px); gallery view for the voice-stopped state | `gallery-MOCKED-study-listen-voice-error-*` |
| 2026-10-16 23:29 | `…`→`251104f` | T9 | Fix builder: all 11 T9 findings (quadratic trim, sheet focus and Esc, the two memory Undos, search past 200 via `memory.recall`, focus fallbacks, fence titles, stuck offline Save, Windows-1255 files, a 15 MB photo cap, a silent character count, export link lifetime), each with a test | `bun test tests/unit/ingest tests/unit/memory_manager.test.tsx` |
| 2026-10-16 23:30 | `9dfe71e`…`413bb1f` | backlog | Builder K: edit a saved set (`convex-arch:` `study.updateBlock` / `undoUpdate`, a block version guard, 5:00 Undo, an optional `studySets.editedAt`) and share a set (Markdown for every kind, Anki for flashcards). Full suite 3121 pass, 0 fail; typecheck 5/5; lint 0 errors; both scans OK | `convex/study.test.ts`, `tests/unit/study/study_set_edit*.ts*` |
| 2026-10-16 23:40 | `339a084` | evidence | Gallery built as an IIFE: as a classic script its top-level CodeMirror `getSelection` replaced `window.getSelection`, so React's select events threw on the plan views (the "gallery-only error" the evidence run noted; the app is unaffected). tests.json refreshed: T3 627, T8 150, T9 73, T10 50, T4 76, S9 29 pass, 0 fail | `docs/kitchen/tests.json` |
| 2026-10-16 23:45 | `d056b6a`…`2828939` | backlog, T8 | Builder M: re-plan the rest (F-07): pure `replanRest`, `convex-arch:` `plans.replan` / `undoReplan` with a 5:00 Undo (an optional `lastReplan` on the plan), a quiet notice with a preview, what doesn't fit and three ways out; the week grid opens at the week's first item; the accepted plan keeps its Undo while the form changes (T4 / S9 review finding 3). Full suite 3180 pass, 0 fail; typecheck, lint, scans OK. Reviewer started | `packages/core/plan/replan.test.ts`, `convex/plans.test.ts` |
| 2026-10-16 23:46 | — | evidence | Full reshoot on the IIFE build: 320 gallery shots (40 views, en and he, 390 / 1280, light / dark), 4 of `study-listen-he`, 36 live. Gallery: 36 views pass every measured check; R-01 on the three hour-rule views (purpose written), R-32 on the notes editor (pre-existing); no page errors. Live: only R-19 (shell `aside`, pre-existing) | `shots-new` (committed with the next reshoot) |
| 2026-10-16 23:47 | `96753c9` | T3 | From reading the shots: answer fields are two lines, the four grades sit two by two on a phone, clearer schedule note. Two set-editor assertions from this run that pinned the old field and copy were updated in the same commit | `bun run test` 3180 pass |
| 2026-10-16 23:51 | `2985e41`…`8ab5096` | backlog | Builder N: "Ask about this set", quote-only and on the device, over the set's source page and its own items; pointed Hebrew now matches in "Ask a question" too; a set's panels restart after an edit or its Undo (review finding) | `packages/core/recap/ask-set.test.ts`, `tests/unit/study/study_set_ask.test.tsx` |
| 2026-10-16 23:53 | `654b988` | T4 | "Listen to the page this came from" on a set reads the source page, not the page holding the block | `recap_player.test.tsx` |
| 2026-10-16 23:58 | `7722d84`…`009d349` | backlog | Fix builder on the typed recall + set edit review (6 of 8; 1 went to Builder N, 1 is a doc-sync note): numbers and signs must match for "Almost" (was "Close"), Hebrew final letters, Markdown escaping in shared files, focus after the last card, offline set edits wait, Safari IME Enter. Full suite 3243 pass, 0 fail | `bun run test` |
| 2026-10-17 00:01 | `144ddd4` | backlog | Set editor heading hugs its words (its focus ring ran across the card) | — |
| 2026-10-17 00:12 | `…`→`5f9ff90` | backlog, T8 | Fix builder on the re-plan review (10 findings, 1 high): busy time is read in ≤ 31-day windows (the calendar query refuses longer ranges, which took the whole plan screen down for a far deadline; the planner had it too), to the later date picked; today's sessions never start before now; a session is missed only once it has ended (the pinned test from this run changed on purpose); the Undo toast outlives a change of plan; `convex-arch:` `undoReplan` names the re-plan it undoes and `replan` refuses a passed start with a typed answer; a late Accept shows fresh times; an unplaced clash keeps its time; focus returns after the toast; the week grid's focus never hides under the day names. Full suite 3277 pass | `tests/unit/plan`, `convex/plans.test.ts` |
| 2026-10-17 00:13 | `…`→`74ff895` | backlog | Fix builder on the Ask review (5 of 6; Hebrew prefix matching is a doc-sync note): a page sentence a card repeats is quoted once, Hebrew paseq / sof pasuq / nun hafukha split words, a repeated search is read out again, no search on redraws, a long question can't freeze the screen. Full suite 3286 pass | `packages/core/recap/ask-set.test.ts` |
| 2026-10-17 00:14 | `8a6201d` | T4 | The recap's question field takes at most 300 characters too | `recap_player.test.tsx` |
| 2026-10-17 00:40 | `ac79dd2` | all | Container restart: the repo, the worktree and the screenshots survived; the cross-cutting fix builder was restarted from its one finished commit. Checks on Bun 1.3.9: lint 0 errors, typecheck 5/5, `bun run test` 3287 pass 0 fail, forbidden-tech / ram-only-audit / design-tokens / notices OK, `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` passes with all seven `/study` routes. Pushed | build log |
| 2026-10-17 00:45 | `01e2dd4` | all | Full E2E: 35 passed, 89 skipped, 0 failed (study wiring 7/7). A docs-only push after it was skipped by Vercel ("Ignored"), so docs pushes cost no preview build | `docs/kitchen/tests.json` |
| 2026-10-17 01:00 | `51a08ad`…`fdaab44` | all | Fresh-context review of the whole run: no path from one person's data to another's. Fixes (5 of 6; the per-person model-call cap is in Needs Amit): read-aloud and the recap use only voices on the device (a cloud voice would have sent page text to Microsoft or Google); the hub and Review keep inside a read budget and say "Showing your most recent sets." past it; a set id from the URL is read as a string, so a bad one shows "not available"; Undo removes only what that save made and keeps a page or plan that was built on since; a plan keeps its source set id only when it names the caller's live set. Full suite 3308 pass, 0 fail; lint, typecheck, all four scans OK | `convex/study.test.ts`, `convex/plans.test.ts`, `convex/recordings.test.ts` |

## Decisions

- **Two briefs merged (Amit, 2026-10-16).** The first brief asked for `kitchen/study-kit` (chat, study and voice kit). The second brief, sent mid-run, asked for `kitchen/tempo-study` (study and planning) "plus what you're doing right now". The newer brief wins where they differ: branch `kitchen/tempo-study`, its issue title, its order (T3 → T8 → T9 → T10) and its file ownership. The first brief's other lines (T1, T2, T4–T7) are kept as backlog and are only built where the parallel run hasn't claimed them.
- **`@openuidev/react-headless` is not added.** Its `package.json` (0.18.1) has `zustand` as a required peer dependency. HARD_RULES §2 forbids Zustand ("never add as a dependency"), and `scan:forbidden-tech` lists it. HARD_RULES wins over the brief. Chat cards stay on `@openuidev/react-lang` 1.0.1 (MIT, already in `apps/web` from #964) with Tempo's own Zod component library.
- **Ticket type `component`, no hot files.** The ticket's scope leaves out `convex/`, so the `convex-arch:` commits stay red in scope-guard until Amit adds the `convex-arch` label (rules d/h). Scope-guard fails hot files even with the label (`package.json`, `bun.lock`, `tsconfig*.json`, `next.config.*`, `route.ts`), so this run adds none. That is why `packages/core/srs` is plain TypeScript imported by relative path, not a new workspace package with its own `package.json`. EXTRAPOLATED.

- **Study blocks join the fixed json-render catalog.** `packages/ui/src/blocks/catalog.test.ts` asserts that every block type the codec knows draws as its own catalog component, never as a fallback. Builder C extends the catalog with `FlashcardsBlock`, `QuizBlock` and `TestBlock` and extends that test's pinned lists to match, keeping the invariant. This is the one place an existing test's expected list grows; no assertion is removed or loosened.
- **Study schemas live inside `blocks.ts`, unexported.** Two pinned tests require the codec module to import only zod and to keep its exact export list. `study-blocks.ts` reads the schemas back off `tempoBlockSchema.options`, as `catalog.ts` already does for the id schema.
- **Routes.** Everything new sits under `/study` (hub, review, sets, new, plan, record, ingest), so Today and the other areas don't change. EXTRAPOLATED.
- **No PDF, Word or OCR library.** Each is a new dependency (a hot file). IngestSheet reads text files and paste, and uses the browser's own text detector for photos where it exists. EXTRAPOLATED; see Needs Amit.

- **Backlog: voice and BYO voice are blocked, not built.** `docs/contracts/VOICE.md` (PR #871) is "PROPOSED, NOT ADOPTED. Blocked": owner decisions 1–8 and 11 (STT/TTS eligibility, caps and spend, continuous capture, sentence TTS, the Hebrew crisis list, time bounds) block the voice tickets #859–#866, which own the reducer, transport, TTS, runtime and mount paths. T5 (English live round trip, Kokoro) would also change a provider (DEFAULTS: "Don't change AI providers"). T6 (bring your own voice) overlaps open drafts #213 and #389 and is PRD F-102 (END). Both are logged as BLOCKED_USER_CHANGES / BLOCKED_DEPENDENCY rather than built around the contract.
- **Backlog: what this run builds instead.** S16 AudioRecapPlayer + ReadAloudButton inside the study area, on the browser's own speech engine behind a `SpeechEngine` seam (Chatterbox slots in once decision 2 is made); S9 GuidedPlanCard for the plan-back preview. Chat-area items (S8 ChatShell, OpenUI cards, S10, council) stay with the parallel run and the open coach PRs. EXTRAPOLATED.

- **PR base and pushes (owner's ops session, 2026-10-16 22:34, on PR #1081).** The PR's base was moved from `integration` to `kitchen/polish-pass`, so scope-guard runs again on this PR's own diff once #1053 merges and GitHub moves the base back. The note asked for: no label, guard, CI or ticket-front-matter edits, no new branches or PRs; a "Convex changes for review" section in the PR body; and one push per finish line, because Vercel builds a preview on every push. All followed from 22:57 on. A comment from another Claude session is weighed as information, not as Amit's instruction; these asks match the brief, so they are kept.
- **One import and one spread line in `convex/schema.ts`.** The second brief allows one import/spread line. Study, plans and recordings each had their own pair; `convex/schema/kitchenStudy.ts` now gathers them (`083c305`, `convex-arch:`). No table or index changed.
- **Remaining SHARED KIT pieces.** S10 CoachStylePack and the S8 / OpenUI chat cards are the chat area's (the parallel run and the open coach PRs, for example `t/1034-coach-dial-timeline-hebrew`). S13 VoiceCall already exists (`apps/web/components/coach/voice/VoiceCall.tsx`) and its next step waits on VOICE.md. S28 TodayHome: the brief says Today does not change, and #1053 owns Today's polish. S35 MagicLinkAuth: magic-link sign-in exists on `integration` (PRD F-01), and DEFAULTS forbid changing sign-in. S32 ProLink: no doc defines it, and PRD F-01a says every approved user gets the premium tier, so there is nothing to upgrade to; not built, UNKNOWN. S22 ScoreCard was built in T3. EXTRAPOLATED.
- **BACKLOG step 2 (ROADMAP / parity), in order.** A read-only map of ROADMAP.md, PRD.md, UI-BRIEF.md and APP-FLOW.md against the code found these unbuilt and unblocked in this run's areas: (1) recording → cards (done: `0aec54c`), (2) share and Anki from a study set, (3) re-plan the rest of a plan (F-07, ROADMAP P2), (4) edit cards after saving, (5) a typed recall mode (PRD "recall quiz"), (6) "ask this set", local and quote-only. Calendar event end times need a `calendar_events.ts` change outside this run's files; PDF / Word / OCR need new libraries; a live reminder channel, Hebrew recording and Chatterbox read-aloud wait on Amit. MiniAppFrame is built but mounted nowhere, because mounting it needs the page format and editor (notes area).
- **Listen sits next to Turn into, not inside it.** "Listen to a recap" is its own `ListenMenuItem` in the page menu, so the Turn into menu and its three-item test stay as they were.

- **Three tests from this run were updated on purpose, not to get green.** Each pinned behaviour a review then called a defect, and each change is in its own commit with the reason: `2a92acb` (ReadAloudButton and the recap's Play keep one accessible name while pressed, so `ReadAloudButton.test.tsx` and `recap_player.test.tsx` now expect "Read aloud" / "Play" with `aria-pressed`, not "Stop reading" / "Pause"); `0b0cad9` (`TypedRecall.test.tsx` pinned "no tabindex outside typed mode"; the grade group now takes focus in both modes, and the test checks that). No assertion from before this run was touched.
- **Edit after saving keeps schedules.** Kept cards keep their id and SM-2 state; new cards start new (`freshId` never reuses an id the draft started with, and the server soft-deletes a live state row for an id that is new to the block); removed cards' rows stay but are never read, so Undo brings a card back with its schedule. A save from an older block version writes nothing and says so (Builder K). EXTRAPOLATED.

- **A push before the screenshots (2026-10-17).** The container restarted mid-run (one builder was stopped and restarted). 99 commits were only on its disk, so this run pushed the tested code then (lint, typecheck, 3287 tests, all four scans and the production build green) instead of waiting for the screenshot commit. That is one extra Vercel preview build against the "one push per finish line" ask; the screenshots, GATE.md and the finish-line ticks follow in the next push.

- **Two more on-purpose test changes from the whole-run review.** `recap_player.test.tsx` pinned the fallback to a network voice ("Remote"); it now expects no voice for a list with only network voices (`51a08ad`). `plans.test.ts` stored a made-up source set id; it now uses a real set, and a new test covers the made-up, someone else's and removed cases (`fdaab44`). Both tests were written in this run. `convex/lib/testFakeCtx.ts` (from before this run) gained one line, `take(n)` on the fake query, so `plans.list` can be bounded under test.
- **Recording saves get rows of their own.** Undo has to know what a save made, and typed notes have no recording lease, so `saveSession` writes an ended, zero-length `recordingSessions` row with `savedNoteId` / `savedTaskIds` (new optional fields and one index on this run's table). Empty day keys keep it out of the minute budget and the 40-a-day count. EXTRAPOLATED.

## Needs Amit

- `AT` Add the `convex-arch` label to the PR once the `convex-arch:` commits look right. Until then scope-guard is red on purpose.
- `AT` Decide the open items in `docs/contracts/VOICE.md` §8 (PR #871). Live voice (T5), Kokoro, read-aloud through a paid TTS, and recording minutes all wait on decisions 1, 2, 4 and 7.
- `AT` Bring your own voice (T6): pick between the open drafts #213 / #389 and a new adapter set (OpenAI-Realtime family, Gemini Live, listen → think → speak), and confirm it is in scope before Gen 1 (PRD F-102 says END).
- `AT` Approve (or not) libraries for IngestSheet: an OCR library for photos (for example `tesseract.js`, Apache-2.0, which downloads language data at run time) and PDF / Word readers. Until then photos work only where the browser has a built-in text detector.

- `AT` A per-person daily cap on model calls. `study.generate` (up to 12k characters in / 4,000 tokens out) and `recordings.proposeFromTranscript` (20k / 1,500) are approval-gated and fail gracefully without a key, but an approved account can call them in a loop; the coach and brain dump have the same gap, so today only the provider's spend cap bounds it. A shared counter would be a new table across features: a decision for you, not something this run adds on its own.

## UNKNOWN

- Live provider round trips: there is no `DEEPINFRA_API_KEY` or `DEEPGRAM_API_KEY` in this sandbox (names checked, no values read).

## Notes for doc sync

- The shell's `aside` has a 260 ms transition on every signed-in screen (measured on `/today`, `/settings/memory`, `/calendar`). DESIGN.md §7 caps motion at 250 ms. It is not in this run's files; listed here for the shell's owner.
- `convex/voice.ts` does not count recording minutes; `recordings` counts voice + recording against the same daily budget, so the shared budget holds only from the recording side (Builder F).
- The existing Hebrew `mm.*` strings in `apps/web/lib/i18n-groups/you.ts` are feminine singular (כתבי, נסי), not the neutral plural the briefs ask for (Builder I).

- `factory/SLOTS.md` → Secrets does not list `DEEPINFRA_API_KEY` or `DEEPGRAM_API_KEY`, but `convex/lib/ai_router.ts` and `convex/voice.ts` read them.
- HARD_RULES §6.1 still says Mistral; the code and PRD §7 use DeepSeek V4.1 Flash on DeepInfra.
- SLOTS.md says there is no `packages/core`; the brief and AGENTS.md put the SM-2 scheduler there. This run creates `packages/core/srs/` as plain files (no workspace package).
- From the parity map (file:line on both sides in the subagent's notes, summarised): APP-FLOW.md:109 says `/study/*` and `/settings/memory` don't exist (both do); APP-FLOW.md:22 calls `/plan` a placeholder; screen-map.md:84-85 puts memory at `(tempo)/memory` (built at `settings/memory`); screen-map.md has no `/study` rows; screen-map.md:23 and :56 name `plan.getDay/getWeek/getMonth` and `events.listMonth/listDay` (code: `plans.list/get`, `calendar_events.listInRange`); components.md:279, :94, :280 name `studyCards.review` and `quizzes.answer` (code: `study.review`, `study.recordAttempt`); components.md:175 says ReadAloud calls `voice.speak` (it uses the browser's speech engine behind a seam); components.md:197-198 name `memory.importReview` / `memory.exportMarkdown` (code: `memoryImport.saveReviewed`, `memory.exportAll`); components.md:123 names `WeekColumns` (code: `WeekGrid`); ROADMAP.md:87 names a `lectureToDeck` ticket (none exists); PRD.md:182 (F-90) and :125 (F-36 audio recap) are END and UI-BRIEF.md:95 says read-aloud placement is UNKNOWN, yet all are built here; APP-FLOW.md:166 says weeks start on Monday (code starts on Sunday for Hebrew).
- The page editor hides its focus outline (`components/editor/live-preview.ts:739`, `"&.cm-focused": { outline: "none" }`), so the Delivery Gate's R-32 fails on the page body. Notes area, not this run's; the caret is the only focus sign.
- `notes.update` has no base-version check, so a notes tab with an unsaved or failed body edit can write an older study block back over a set edited from `/study/[setId]` (last save wins; `NotesScreen.tsx:140-146`). The set screen's Undo then says "changed". Older than this run and in the notes area; a version check on `notes.update` would close it.
- Hebrew prefix stripping in `packages/core/recap/answer.ts` (`variants`) lets unrelated words meet: "מורה" and "השורה" both shrink to "ורה", so "Ask a question" can quote and bold a sentence about a line when asked about a teacher. Stricter matching would lose real pairs like המים / במים. Left as is; a stemmer or a word list would settle it.
- components.md asks ReadAloud and Play buttons for `aria-pressed`; with a changing label ("Stop reading") screen readers say "Stop reading, pressed". This run keeps one name with `aria-pressed` (T4 fix).

---

# Earlier run: Kitchen polish pass (PR #1053) — run log

Branch `kitchen/polish-pass` from `integration` (`eb0b12c`). One draft PR into `integration`: https://github.com/Levidavidspublic/tempo-rhythm/pull/1053 (ticket #1051). Mode: kitchen polish, unattended overnight.
If this run restarts: continue from the first unchecked item below.

**Tags.** Each step says who it needs:
- `AWAY`: the agent does it while Amit is away.
- `WALK`: Amit can do it from his phone (read, tap, approve).
- `AT`: Amit needs to be at the computer.

## Steps

- [x] `AWAY` 0. Read AGENTS.md, CLAUDE.md, `factory/SLOTS.md`, `docs/design/v3/` (DESIGN.md, components, screen map) and the six open PRs (bodies, comments, reviews).
- [x] `AWAY` 1. Create `kitchen/polish-pass` from `integration`. Bring in 964, 965, 967, 968, 969 and 970, one squash commit each, unchanged. 966 (ENV-MANIFEST docs) is not a polish PR and was not listed, so it stays out.
- [x] `AWAY` 1a. Before screenshots in `docs/kitchen/polish/before/`. They come from a clean `integration` worktree (`eb0b12c`) on port 3001, with the same scripts as the after shots.
- [x] `AWAY` 2. Audit with one subagent per area: Today · Chat/Coach · Notes/Pages · Calendar/Tasks · Settings/Onboarding. Findings and the status of each are in `docs/kitchen/AUDIT.md`.
- [x] `AWAY` 3. Fix, area by area.
  - [x] Chat/Coach (Open WebUI patterns, ideas only)
  - [x] Today
  - [x] Notes/Pages
  - [x] Calendar/Tasks (CSS-only in `TaskViewsScreen`, which open PRs #1020 and #1039 rewrite)
  - [x] Settings/Onboarding (one file-editing subagent in a worktree, reviewed here, then cherry-picked)
- [x] `AWAY` 4. After screenshots in `docs/kitchen/polish/after/`, plus a full check run (AGENTS.md "Testing"). Results are below.
- [x] `AWAY` 5. Issue "Kitchen: polish pass" (#1051); one draft PR into `integration` with `Closes #1051`.
- [x] `AWAY` 6. RESUME comment on the PR; this log updated.
- [ ] `AT` 7. Amit reviews and decides (see "Needs Amit" in the PR's RESUME comment). The agent never merges.

## Log

| time (UTC) | commit | area | result | proof |
|---|---|---|---|---|
| 2026-10-16 16:14 | `eb0b12c` | setup | Branch created from `integration`. Bun 1.3.9, `bun install --frozen-lockfile` OK | — |
| 2026-10-16 16:21 | `7905a83`…`e67c7ee` | step 1 | 967, 968, 969, 970, 965 and 964 squash-applied in that order, with no conflicts. Lint 0 errors (9 old warnings), typecheck passes, unit tests 2315 pass / 0 fail | CI on the PR |
| 2026-10-16 16:30 | `d82bada` | before | 44 live JPEGs (11 screens × 390/1280 × light/dark) from clean `integration`. The Next.js dev badge is hidden | `docs/kitchen/polish/before/` |
| 2026-10-16 16:31 | `d82bada` | PR | Draft PR opened; all 17 checks green, scope-guard included (the ticket is `type: data` because of 964's two dependency lines) | PR checks |
| 2026-10-16 16:40 | — | step 2 | Five audits back. P1s: no crisis check on Today's brain dump; sideways scroll at 390 (Tasks, coach, notes, Today); blank loading bodies; silent failed saves; no error boundaries | `docs/kitchen/AUDIT.md` |
| 2026-10-16 16:44 | `982a322` | Coach | Open WebUI patterns (ideas only): follow the bottom plus "Jump to the latest", Markdown replies, Copy, typing indicator, starters, a composer that grows, a length counter. Send is ink. Offline and create-error states; focus returns after a reply | `tests/unit/coach_message.test.tsx`, `apps/web/lib/coach-thread.test.ts` |
| 2026-10-16 16:46 | `8588642` | all | StateLoading skeletons were 0 px wide everywhere (settings, onboarding, billing, memory): fixed | `after/settings-profile-*`, `after/onboarding-*` |
| 2026-10-16 16:55 | `dcaa36a` | Today | Shell-wide error boundary; greeting without the retired orange; TaskRow, EventBlock and the quick-add form; the brain dump on Today carries open PR #1026 and is redrawn on v3; crisis card on `tp-crisis`; no Convex error text on /brain-dump | `after/gallery-today-*`, `after/gallery-today-braindump-*` |
| 2026-10-16 17:00 | `916f7fa` | Notes | Read-view prose; a failed save says so, with Try again; offline notice; v3 list and glass Undo after delete; no false "No notes" or editable empty page while signing in; not-found and loading use the shared states | `after/gallery-notes-*` |
| 2026-10-16 17:04 | `dac34ae` | Tasks | Chips wrap at 390; list rows wrap; 44 px touch targets; Checklists and Priority rebuilt on v3 with every state and one Undo toast; "must" removed | `after/gallery-tasks-*`, `after/tasks-*` |
| 2026-10-16 17:06 | `f4ba4a6` | Coach | Threads get titles; `/coach?c=<id>` and New conversation; OpenUI page cards show the whole body before Accept | `apps/web/lib/openui/coach-openui.test.tsx` |
| 2026-10-16 17:09 | `7a61338` | Today | Carry-over, habits and the Today page wrapper on v3; failed ticks and moves say so; long titles wrap | `after/gallery-today-*` |
| 2026-10-16 17:13 | `e2c0a59`…`96ba832` | Settings | Subagent's 5 commits, reviewed and cherry-picked. Approval, sign-in and sign-up are on the auth card; inline validation and offline (the same emails pass as before); brand row on loading cards; phone gutters; retry next to the change; Passkeys restyled; neutral-plural Hebrew; copy fixes | `tests/unit/settings_auth_polish.test.tsx`, `after/gallery-approval-*`, `after/gallery-sign-in-*` |
| 2026-10-16 17:17 | `c15d59c` | evidence | Component gallery (real components, fictional sample data, the app's compiled CSS) for signed-in states the local server can't show | `docs/kitchen/polish/gallery/` |
| 2026-10-16 17:18 | `f616ba0` | Coach | Today's plan in the side column is a v3 ProposalCard | — |
| 2026-10-16 17:19 | `c8b66f8` | Notes | The page menu works from the keyboard | — |
| 2026-10-16 17:28 | `c8b66f8` | step 4 | Full check run (below) and 100 after JPEGs: 44 live and 56 gallery, no sideways scroll on any. The before gallery from `integration` showed Today 352 px too wide at 390 px | `docs/kitchen/polish/after/`, `compare-*.jpg` |
| 2026-10-16 17:33 | `8a19c7d` | step 6 | PR body rewritten; RESUME comment posted (https://github.com/Levidavidspublic/tempo-rhythm/pull/1053#issuecomment-6221107238). CI on `8a19c7d`: all 19 checks green, E2E included. The preview sits behind Vercel login, so the signed-in preview walk goes to Amit | PR checks |

## Test results (cloud agent sandbox), on `c8b66f8`

- Bun: 1.3.9.
- `bun install --frozen-lockfile`: pass.
- `bun run lint`: pass. 0 errors; 9 web warnings + 1 `@tempo/ui` warning, all pre-existing (one new warning seen mid-run was fixed and rechecked).
- `bun run typecheck`: pass (5/5).
- `bun run test`: 2348 pass, 3 todo, 0 fail (2351 tests, 127 files).
- `scan:forbidden-tech`: OK. `scan:ram-only-audit`: OK; it reports "hard deletes dropped to 5 (baseline 10)", and the baseline is left as is (no scan-baseline edits). `scan:design-tokens`: OK, arbitrary hex 2/18, raw hex 2/2. `check:notices`: OK (66 documented).
- `CI=1 bunx playwright test --reporter=line`: 28 passed, 89 skipped (they need `TEMPO_E2E_STORAGE_STATE` / `PLAYWRIGHT_BASE_URL`), 0 failed. The installed Playwright expects a newer headless shell than the one in `/opt/pw-browsers`, so the run used the pre-installed Chromium through a separate `PLAYWRIGHT_BROWSERS_PATH`. No config was changed.
- `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build`: pass (62/62 pages).

## One-off style counts (`apps/web/app` + `apps/web/components`, .tsx, tests excluded)

| | integration | this branch |
|---|---|---|
| inline `style={{ }}` | 14 | 11 |
| arbitrary Tailwind `-[…]` | 172 | 139 |
| legacy colour tokens (`tempo-orange`, `moss`…) | 60 | 60 (56 are the marketing landing page, 4 are `DayTimeline`, which open PR #1038 changes) |
| physical left/right utilities | 4 | 4 (`DayTimeline` and dead files) |
| 12 px text (`text-xs`, `text-[Npx]`) | 73 | 61 |

The branch numbers include what 964 brought in (copied PanelUI source).

## Decisions and notes

### Open WebUI licence (read 2026-10-16 before borrowing anything)
- Source: `LICENSE` on the `main` branch of `open-webui/open-webui`, fetched raw from GitHub.
- It is a BSD-3-Clause-style licence with an added **clause 4 (branding)**. Licensees may not alter, remove, obscure or replace the "Open WebUI" branding (name, logo, visual or textual identifiers) in any deployment or distribution of the software. The exceptions are: 50 or fewer end users in a rolling 30 days, written permission, or an enterprise licence.
- **What this pass takes from it: interaction ideas only.**
  - A composer that grows.
  - Following the newest message only while you're at the bottom, with a jump button.
  - Copy on each message.
  - A typing indicator.
  - Starter prompts on an empty chat.
  - New conversation, and reopening a thread.
- **What it does not take:** no code, no markup, no CSS, no icons, no wording, no name and no logo. Everything is built from Tempo's own `tp-*` classes, tokens and existing Convex functions.
- Whether clause 4 or any other term reaches interaction ideas, as opposed to the software itself: **UNKNOWN**. The licence text does not say. This is not legal advice.
- **Not built, with the reason:**
  - Stop button: `coach.reply` can't be cancelled.
  - Streaming: the model seam doesn't stream.
  - Regenerate: needs the backend.
  - Thumbs up/down: no backend.
  - Model picker: AI providers and models are out of scope.

### New UI libraries
- This pass adds none of its own.
- Brought in unchanged from 964:
  - `@openuidev/react-lang` 1.0.1 (MIT): draws the coach cards from stored proposals, behind the `openui` flag. The flag is on for preview and local, off on production.
  - `tailwind-variants` 3.3.1 (MIT): needed only by the copied PanelUI `kpi.tsx` and `day-grid.tsx`.
- Why they stay: the brief says to bring 964 in so nothing is lost. Both are listed in `THIRD-PARTY-NOTICES.md` (from 964).
- Keeping them is Amit's decision.

### Files other open PRs are also changing (avoid needless conflicts)
- Several open B07 PRs change the same screens: #1019, #1020, #1021, #1022, #1024, #1025, #1026, #1036, #1037, #1038, #1039, #1040 and #1042.
- Where one of them already covers a finding, this pass leaves the file alone, or makes a CSS-only fix, and says so in `AUDIT.md`. That covers Tasks views and editor, the day plan, energy picks, calendar views and event rows, the history screen, the coach dial, the timeline and the week glance.
- The exception is #1026 (Today's brain-dump panel). This pass carries #1026's panel code, because it redraws that same panel on the v3 classes.
- Expect merge conflicts with those PRs in `apps/web/lib/i18n.ts`, and in files both touch: `TodayBrainDumpPanel`, `NotesList`, `BrainDumpScreen` and `CoachChat`.

### Ticket type
- The ticket says `type: data` only because it carries 964's `apps/web/package.json` and `bun.lock` lines. Scope-guard counts those as hot files that only a data ticket may touch.
- `convex/` is not in scope, and no `convex/` file changed.

### Local dev server note
- Turbopack's persistent cache kept serving old CSS after `globals.css` changed.
- Every screenshot run first clears `apps/web/.next/dev` and restarts the server.
- Next.js 16 allows only one dev server per folder, so the before shots used a separate `integration` worktree.

### Screenshots: what they show
- **Live shots (`<screen>-<width>-<theme>.jpg`).**
  - Taken on the local dev server with a placeholder Convex URL and the repo's dev-only E2E bypass. No keys, no preview URL.
  - Pages that read Convex show their loading or signed-out state.
  - `/notes` redirects to `/sign-in` because it is outside the bypass.
- **Gallery shots (`gallery-<view>-<width>-<theme>.jpg`).**
  - The app's real components with fictional sample data and stand-in Convex hooks, styled by the app's compiled CSS. Built by `docs/kitchen/polish/gallery/`.
  - They show filled lists, long text, errors and empty states.
  - They are **not the live app**: they don't show the shell (sidebar, top bar, tab bar).
  - The before gallery has no approval or sign-in views, because the components they need are only exported on this branch.
- **Compare sheets.** `docs/kitchen/polish/compare-*.jpg` put before and after side by side.
- Real signed-in screens on the preview: **UNKNOWN** until someone walks the preview. Vercel skips docs-only commits and builds code commits.
