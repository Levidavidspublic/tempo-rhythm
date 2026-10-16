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

T3 Builder D (study web screens + gallery), T8 Builder G (plan backend + week/month grids + `/study/plan`) and Builder F (RecordSession), each in its own worktree. Next: screenshots + Delivery Gate per screen, then T10.

## Log

| time (UTC) | commit | finish line | result | proof |
|---|---|---|---|---|
| 2026-10-16 21:20 | `5f1b3ec` | setup | Branch `kitchen/tempo-study` cut from `kitchen/polish-pass`. Bun 1.3.9, `bun install --frozen-lockfile` OK (2000 packages). Code map done by a read-only subagent | — |
| 2026-10-16 21:24 | — | setup | Issue #1080 and draft PR #1081 (stacked on #1053); PR activity watched | https://github.com/Levidavidspublic/tempo-rhythm/pull/1081 |
| 2026-10-16 21:50 | `a3fde65` | T3 | Contract: flashcards / quiz / test blocks in the one page codec, SM-2 in `packages/core/srs`, quiet page cards, build spec `docs/kitchen/study/T3-SPEC.md`. `bun test packages`: 755 pass, 1 fail (the catalog agreement test, fixed by Builder C) | `packages/core/srs/sm2.test.ts`, `packages/utils/src/study-blocks.test.ts` |
| 2026-10-16 22:05 | `51f8dd6` | evidence | `docs/kitchen/study/shoot.mjs` + `gate.mjs`: screenshots plus the measurable Delivery Gate checks per shot. Trial on `/sign-in` and `/today`: sign-in PASS; Today (not this run's) shows a 260 ms animation | `/tmp` trial, not committed |
| 2026-10-16 22:10 | `1bc9e51`→cherry-picked | T8 | Builder E: `packages/core/plan` (planBack, calendar math, week layout, conflicts, month counts). 34 tests | `bun test packages/core/plan` |
| 2026-10-16 22:20 | `3ed0990` | T3 | Builder B: study tables + functions (`convex-arch:`). 26 tests | `bun test convex/study.test.ts` |
| 2026-10-16 22:25 | `5501fc5` | T3 | Builder A: review queue, adaptive quiz, question plugins + scoring with the pick rule, outline reader, ids. 115 tests | `bun test packages/core` |
| 2026-10-16 22:35 | `e8dd0f7` | T3 | Reviewer on the study backend: 4 findings (double tap, undo order, source-line injection, 200-row state cap), all fixed with tests (30 pass) | `bun test convex/study.test.ts` |
| 2026-10-16 22:45 | `36638ed` | T3 | Builder C: study blocks draw as their own catalog cards (the red catalog test is green, list extended, invariant kept); FlashcardDeck, FlashcardReview, AdaptiveQuiz, TestRunner, ScoreCard; adapters to the core engine and scorer | `bun test packages/ui/src/study` (63 pass) |
| 2026-10-16 22:55 | `c0e199b` | T9 | Builder H IngestSheet (27 tests) and Builder I MemoryManager parity (`memory.update`, search, edit with Undo) merged. Full suite: 2670 pass, 0 fail; lint, typecheck, scans OK; pushed | `bun run test` |

## Decisions

- **Two briefs merged (Amit, 2026-10-16).** The first brief asked for `kitchen/study-kit` (chat, study and voice kit). The second brief, sent mid-run, asked for `kitchen/tempo-study` (study and planning) "plus what you're doing right now". The newer brief wins where they differ: branch `kitchen/tempo-study`, its issue title, its order (T3 → T8 → T9 → T10) and its file ownership. The first brief's other lines (T1, T2, T4–T7) are kept as backlog and are only built where the parallel run hasn't claimed them.
- **`@openuidev/react-headless` is not added.** Its `package.json` (0.18.1) has `zustand` as a required peer dependency. HARD_RULES §2 forbids Zustand ("never add as a dependency"), and `scan:forbidden-tech` lists it. HARD_RULES wins over the brief. Chat cards stay on `@openuidev/react-lang` 1.0.1 (MIT, already in `apps/web` from #964) with Tempo's own Zod component library.
- **Ticket type `component`, no hot files.** The ticket's scope leaves out `convex/`, so the `convex-arch:` commits stay red in scope-guard until Amit adds the `convex-arch` label (rules d/h). Scope-guard fails hot files even with the label (`package.json`, `bun.lock`, `tsconfig*.json`, `next.config.*`, `route.ts`), so this run adds none. That is why `packages/core/srs` is plain TypeScript imported by relative path, not a new workspace package with its own `package.json`. EXTRAPOLATED.

- **Study blocks join the fixed json-render catalog.** `packages/ui/src/blocks/catalog.test.ts` asserts that every block type the codec knows draws as its own catalog component, never as a fallback. Builder C extends the catalog with `FlashcardsBlock`, `QuizBlock` and `TestBlock` and extends that test's pinned lists to match, keeping the invariant. This is the one place an existing test's expected list grows; no assertion is removed or loosened.
- **Study schemas live inside `blocks.ts`, unexported.** Two pinned tests require the codec module to import only zod and to keep its exact export list. `study-blocks.ts` reads the schemas back off `tempoBlockSchema.options`, as `catalog.ts` already does for the id schema.
- **Routes.** Everything new sits under `/study` (hub, review, sets, new, plan, record, ingest), so Today and the other areas don't change. EXTRAPOLATED.
- **No PDF, Word or OCR library.** Each is a new dependency (a hot file). IngestSheet reads text files and paste, and uses the browser's own text detector for photos where it exists. EXTRAPOLATED; see Needs Amit.

## Needs Amit

- `AT` Add the `convex-arch` label to the PR once the `convex-arch:` commits look right. Until then scope-guard is red on purpose.
- `AT` Approve (or not) libraries for IngestSheet: an OCR library for photos (for example `tesseract.js`, Apache-2.0, which downloads language data at run time) and PDF / Word readers. Until then photos work only where the browser has a built-in text detector.

## UNKNOWN

- Live provider round trips: there is no `DEEPINFRA_API_KEY` or `DEEPGRAM_API_KEY` in this sandbox (names checked, no values read).

## Notes for doc sync

- `factory/SLOTS.md` → Secrets does not list `DEEPINFRA_API_KEY` or `DEEPGRAM_API_KEY`, but `convex/lib/ai_router.ts` and `convex/voice.ts` read them.
- HARD_RULES §6.1 still says Mistral; the code and PRD §7 use DeepSeek V4.1 Flash on DeepInfra.
- SLOTS.md says there is no `packages/core`; the brief and AGENTS.md put the SM-2 scheduler there. This run creates `packages/core/srs/` as plain files (no workspace package).

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
