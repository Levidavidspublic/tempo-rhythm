# T3 Study layer — build spec (kitchen/tempo-study)

Written by the lead before fanning out builders. Builders follow it; anything it doesn't settle is the builder's call, written in the report as EXTRAPOLATED.

## What exists already (contract commit)

- **Page codec** (`packages/utils/src/blocks.ts`): three new block types, `flashcards`, `quiz`, `test`, inside the one `tempoBlockSchema` union. Their schemas are internal to `blocks.ts` (its public surface is pinned by a test); `packages/utils/src/study-blocks.ts` reads them back and exports the schemas and types (`FlashcardsData`, `QuizData`, `TestData`, `BagrutQuestion`, `STUDY_BLOCK_TYPES`, …), re-exported from `@tempo/utils`.
  - Every free-text field is 1–500 characters; lists are at most 100 (cards, quiz questions), tests are at most 10 sections × 20 questions; item ids match `^[A-Za-z0-9_-]{1,32}$` and are unique inside their block.
  - `test` questions are plugins: `mcq` (choices + answerId), `short` (accepted answers), `bagrut` (a stem + parts labelled א/ב/ג or a/b/c, each with points, optional model answer and rubric). A section may carry `pick` = "answer N of these".
- **SM-2** (`packages/core/srs/sm2.ts`): `newCardState`, `reviewCard(state, grade, now)`, `nextEase`, `isDue`, `previewIntervals`, `GRADE_FOR_BUTTON` (again 1, hard 3, good 4, easy 5), `DAY_MS`. Pure, tested.
- **Minimal page cards**: `apps/web/components/study/study-block.ts` (`StudyBlock`, `isStudyBlock`, `studyItemCount`, `studyBlockSummary`), `editor-widget.ts` (CodeMirror DOM card) and `StudyBlockView.tsx` (read view). The editor and read view call them with one line each.
- `packages/ui/src/blocks/block-spec.ts` maps study blocks to the calm "unsupported" card for now. **Known red test:** `catalog.test.ts` "every block type the codec knows has a component". The UI builder fixes it by giving each study type a real catalog component (see Builder C).

`packages/core/srs/*` is plain TypeScript with no `package.json` (a new one is a hot file for scope-guard). Import it by relative path: from `convex/` as `../packages/core/srs/sm2`, from `packages/ui/src/study/` as `../../../core/srs/sm2`, from `apps/web/...` as a relative path to the repo root.

## Rules every builder follows

- Read `AGENTS.md`, `docs/HARD_RULES.md`, `docs/design/v3/DESIGN.md` §2–13 and `docs/design/v3/components.md` §2.2 and §2.10 before writing UI.
- No new dependencies, and no edits to any `package.json`, `bun.lock`, `tsconfig*.json`, `next.config.*`, `biome.json` or files named `route.ts`.
- Never edit or delete an existing test to get green. Extending a pinned list for a new feature is allowed only where this spec says so, and must keep the test's invariant.
- Copy rules: warm, direct, never shaming. No "failed", "overdue", "must", "streak", no points-as-pressure, no Arcade, levels or leaderboards. No emoji. Hebrew strings in a neutral plural.
- UI: only `tp-*` classes and `--tp-*` tokens; logical properties; 13 px minimum text; one primary (accent) button per screen; colour never alone (a word or an icon too); 44 px touch targets on touch; flip a card by **button**, never hover; motion ≤ 250 ms on transform/opacity, none under reduced motion.
- User text takes `dir="auto"`; numbers take `.tp-num`.
- Every AI-made change is a preview with Accept / Edit / Reject and a 5-minute Undo (HARD_RULES §1, §6.2).
- Tests: `bun:test` (+ `@testing-library/react` with happy-dom as the existing `tests/unit/*.test.tsx` do). Run `bun run lint`, `bun run typecheck` and `bun run test` before you report.
- Commit in your worktree with Conventional Commit messages. Backend commits start with `convex-arch:`. End each commit message with the two trailer lines the lead gives you.
- Report back in at most 300 words: what you built (files), test command + its last 3 lines of output, anything UNKNOWN / EXTRAPOLATED, anything you couldn't do.

## Builder A — core logic (`packages/core/srs/**` only)

1. `queue.ts`: build a review queue from `{key, state | null}` items (due first, oldest due first; then new cards up to `newLimit`, default 20) and a session reducer: current card, `answer(button)`; "again" puts the card back near the end of this session (at most twice per card), progress counts (`done`, `left`, `again`).
2. `adaptive.ts`: adaptive quiz over `QuizQuestion`s with difficulty 1–3. Start at 1 (or 2 if no level-1 questions). Two right in a row at a level → move up; a miss → move down. Never repeat a question; when a level runs out, take the nearest level. Ends after `maxQuestions` (default all) or when none are left. `quizResult` → correct, total, per-difficulty counts, the missed question ids. Fixed mode = questions in order.
3. `grading.ts` + `plugins.ts`: a question-plugin registry `{ mcq, short, bagrut }`, each with `maxPoints(q)` and `grade(q, response)`. `short` normalises (trim, case, whitespace, punctuation, Hebrew niqqud U+0591–U+05C7) and compares with `accepted`. `bagrut` parts are self-marked: the response carries the points the student gave each part (0..points, clamped). `scoreTest(test, responses)` → per-section counted question ids, points, max, total, `percent` scaled to 100, `passed` against `passMark` (default 55 for `style: "bagrut"`, none for standard). `pick` rule: the first N questions the student answered, in paper order, count (Bagrut practice); unanswered questions fill the count as 0 when fewer than N were answered.
4. `extract.ts`: deterministic "outline reader" that turns page markdown into codec-valid data without a model: definitions (`Term: meaning`, `Term — meaning`, `**Term** meaning`), headings with bullet lists, numbered lists. `outlineToFlashcards`, `outlineToQuiz` (distractors = other cards' answers, seeded shuffle), `outlineToTest` (mcq + short sections). Return `null` when there are fewer than 2 usable items. Strip JSON fences and HTML. Every output must pass the codec schema (test it with `flashcardsDataSchema.safeParse` etc.).
5. `ids.ts`: `newBlockId(now, random)` producing `blk_` + a 26-character ULID (same grammar as the codec), and `itemIds(prefix, n)`.
6. `index.ts` re-exporting the public functions. Tests for every module (`*.test.ts` next to it), including golden fixtures for the extractor in English and Hebrew.

## Builder B — backend (`convex/**`, commits prefixed `convex-arch:`)

Tables in **`convex/schema/study.ts`** (export `studyTables`), spread into `convex/schema.ts` with one import line and one spread line. Follow the repo's lifecycle conventions: `userId: v.id("users")`, `createdAt`, `updatedAt`, `deletedAt?`, a `by_userId` index.

- `studySets`: `userId`, `noteId` (the page holding the block), `blockId`, `kind` (`flashcards` | `quiz` | `test`), `title`, `itemCount`, `sourceNoteId?`, `createdByTempo` (boolean: the page was made by `createFromPreview`), `lastStudiedAt?`, timestamps. Indexes: `by_userId`, `by_userId_updated` (`userId`, `deletedAt`, `updatedAt`), `by_note_block` (`noteId`, `blockId`).
- `studyCardStates`: `userId`, `setId`, `cardId`, `ease`, `intervalDays`, `repetitions`, `lapses`, `dueAt`, `lastReviewedAt?`, timestamps. Indexes: `by_userId`, `by_user_due` (`userId`, `deletedAt`, `dueAt`), `by_set_card` (`setId`, `cardId`).
- `studyReviews`: `userId`, `setId`, `cardId`, `button`, `reviewedAt`, `prev` (the state before, or null for a new card), timestamps. Indexes: `by_userId`, `by_user_reviewed` (`userId`, `reviewedAt`).
- `studyAttempts`: `userId`, `setId`, `kind` (`quiz` | `test`), `score`, `maxScore`, `percent`, `passed?`, `answers` (array of `{ itemId, correct?, points?, maxPoints? }`; never the student's free text), `startedAt`, `finishedAt`, timestamps. Indexes: `by_userId`, `by_set` (`setId`, `deletedAt`, `startedAt`).

Enrol every new table in account soft deletion (`convex/lib/accountDeletion.ts` `USER_OWNED_TABLES` + a fixture in `convex/lib/accountDeletion.test.ts`; that test is designed to be extended for new owned tables). `studySets` carries `noteId`, so it is a page-child table: add it to `NOTE_CHILD_TABLES` in `convex/lib/pagePrivacy.ts` and read it only through the page guard the other note-child tables use (a deleted account or page makes its sets unreachable). Read the existing tests first; extend them, don't loosen them.

Functions in **`convex/study.ts`** (helpers in `convex/lib/study.ts`), every one owner-checked:

- Queries: `hub({ dayStartMs })` → `{ dueCount, newCount, reviewedToday, sets: [{ setId, noteId, kind, title, itemCount, dueCount, newCount, lastStudiedAt?, lastAttempt? }] }`; `getSet({ setId })` → `{ set, note: { id, title }, block: { id, type, data }, states: { [cardId]: { dueAt, intervalDays, ease, repetitions, lapses } }, attempts: last 5 }` or `null` (set deleted, page deleted, or the block is gone or no longer valid); `reviewQueue({ setId?, newLimit? })` → `{ cards: [{ setId, setTitle, cardId, front, back, hint?, state | null }] }` (due first, then new); `listForNote({ noteId })`.
  - The block's content is read from the page body with `parseTempoBlocks` (the page is the source of truth); states are joined by `cardId`.
- Mutations: `createFromPreview({ kind, title, data, sourceNoteId? })` (validate `data` with the kind's codec schema; create a new page through `createNoteForUser` in `convex/notes.ts` with body `Made from [[source title]]` (when there is a source) + a blank line + the fence; register the set; return `{ noteId, setId, undoUntil }`); `undoCreate({ setId })` within 5 minutes (`UNDO_WINDOW_MS` in `convex/lib/softDelete.ts`): soft-delete the set and, if `createdByTempo`, its page; `registerBlock({ noteId, blockId })` (idempotent; returns the set id for a valid study block already in a page); `review({ setId, cardId, button })` (SM-2 from `packages/core/srs/sm2.ts`; upsert the state; log the review with `prev`; return `{ reviewId, state, undoUntil }`); `undoReview({ reviewId })` within 5 minutes; `recordAttempt({ setId, kind, score, maxScore, answers, startedAt })`; `removeSet` / `restoreSet` (soft delete; the page is untouched).
- Action: `generate({ noteId, kind })` → `{ status: "ready", data }` or `{ status: "unavailable", reason: "no_key" | "too_short" | "busy" | "failed" }`. Call `requireApprovedForAi` first (`convex/lib/aiGate.ts`), then `callLLM` from `convex/lib/ai_router.ts` (tier `balanced`, JSON mode). Read the page through an internal query with the owner check. Validate the model's JSON with the codec schema; never save (the UI shows a preview and calls `createFromPreview` on Accept). A missing `DEEPINFRA_API_KEY` returns `no_key`, never an exception. No other provider, no model change.
- Update `convex/_generated/api.d.ts` by hand the way codegen would (an import line and a `fullApi` entry per new module, alphabetical). Never run `convex dev`, `convex deploy`, `convex codegen` or any `convex:*` script.
- Tests in `convex/study.test.ts` (happy path + an error case per mutation, owner isolation, undo windows, a deleted page hides its sets). Use the repo's fake-context helpers or `convex-test` as the existing tests do.

## Builder C — UI package (`packages/ui/src/study/**`, plus the base catalog)

1. Extend the fixed block catalog (`packages/ui/src/blocks/catalog.ts`, `block-spec.ts`) with one display component per study type: `FlashcardsBlock`, `QuizBlock`, `TestBlock`. Props are rendering fields only (title, counts, the first few fronts or prompts, origin), never ids. `tempoBlockToSpec` draws study blocks with them instead of the unsupported card. Extend `catalog.test.ts`'s pinned lists (`BLOCK_COMPONENT_TYPES`, the codec-agreement test) to include the new types, keeping every invariant (each codec type draws as its own component and never as a fallback; no ids in props; the gate rejects anything else). No new actions or events.
2. `packages/ui/src/study/` (export it from `packages/ui/src/index.ts`): presentational React components, no Convex, no fetch, all text from a `labels` prop (the web app passes i18n strings):
   - `FlashcardDeck` (S18): browse mode, flip by button (`aria-pressed`), previous / next, "3 of 12", keyboard (Space or Enter flips, arrows move; arrows swap in RTL), shuffle.
   - `FlashcardReview` (S19's session view): one card at a time, Show answer, then four buttons Again / Hard / Good / Easy each with its interval ("Good · 6 days", from `previewIntervals`), progress, an Undo for the last grade, the end state.
   - `AdaptiveQuiz` (S20): drives `packages/core/srs/adaptive.ts`; a radio group, Check, feedback with an icon and "Right." / "Not quite. The answer is: …", the explanation, Next; ends in `ScoreCard`.
   - `TestRunner` (S21): sections and instructions, an optional timer (pausable; shows time left in words + `.tp-num`; at zero it asks to submit, never auto-fails), the question-plugin renderers (`mcq`, `short`, `bagrut` with self-marking against the model answer and rubric after submit), a submit confirm that lists unanswered questions, and `ScoreCard`.
   - `ScoreCard` (S22): score, percent, pass/below pass mark in words, per-section breakdown, "Review the ones you missed", "Try again".
   - Tests with `@testing-library/react` for each component (keyboard paths, RTL arrow swap, timer, pick rule, labels never empty).

## Builder D — web (after A–C merge)

Routes (`apps/web/app/(tempo)/study/…`), components (`apps/web/components/study/**`), copy (`apps/web/lib/i18n-groups/study.ts` + one spread line in `apps/web/lib/i18n.ts`), nav (one entry in `Sidebar.tsx` LIBRARY, the command palette and `CRUMBS`). Screens: S19 ReviewHub at `/study`, a session at `/study/review`, a set at `/study/[setId]` (deck / quiz / test), S25 TurnIntoMenu in the page menu (`PageEditorView.tsx`) and a preview at `/study/new?from=<noteId>&kind=<kind>` (outline reader first, "Ask the coach" when the model is available, Accept / Edit / Reject, Undo 5:00). Every screen: loading, empty, error, offline, 390 px, light and dark, English and Hebrew. Today does not change.
