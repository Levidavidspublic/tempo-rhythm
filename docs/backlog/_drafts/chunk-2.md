# Tempo Flow — Backlog v2 · Chunk 2 (MVP planning surface · Stage B)

Drafted 1 Nov 2026 by a drafting sub-agent. IDs `TFV2-0065 … TFV2-0148` (84 tickets).
Authority: `docs/backlog/TICKET-STANDARD.md` (v2) and `docs/backlog/REWRITE-PLAN-v2.md` §4–§7.
Order: backend first, then shared components, then screens. Every ticket carries the full
template in `docs/backlog/_drafts/TEMPLATE.md` order. EN and HE copy is quoted for every visible
string a ticket owns; screens additionally point to their source HTML (`docs/design/v3/screens/web/*.html`)
as the authoritative full string table (`window.TP_STRINGS`), which the implementer copies exactly.

Conflict rule: a ticket touching an OPEN conflict (§4) marks that value `UNKNOWN` and names "Amit".
Chunk-2 conflicts that apply: **#6** accept-reject vs auto-apply, **#10** week start (Sunday/Monday),
**#11** nag delivery channel beyond in-app, **#13** where the user's IANA time zone is stored.

---

### TFV2-0065 — Tasks: soft delete, carry-over, move-to-today (`convex/tasks.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** APP-FLOW §5 items 3–4; BACKEND-SCHEMA §3 (`tasks soft delete + carry-over #530`); PRD F-05.
- **GOAL:** Open tasks can be soft-deleted, carried over to a later day, and moved onto Today, all with a 5-minute Undo.
- **SCOPE:** `convex/tasks.ts` · `convex/tasks.test.ts` (test; create if absent).
- **MUTATES:** `tasks` rows (`deletedAt`, `scheduledAt`/carry-over date, `status`); `activity` rows for Undo.
- **STEPS:** 1) Graphify code-map check of `convex/tasks.ts` (a `softDelete` helper exists in `convex/lib/softDelete.ts` — verify and reuse); 2) add `tasks.softDelete({ taskId })` (sets `deletedAt`, returns `{ ok: true }`); 3) add `tasks.carryOver({ taskId, date })` (sets the target local date, keeps status open); 4) add `tasks.moveToToday({ taskId, date })` (target = the caller's Today local date); 5) both mutations write an `activity` row and accept a 5-minute `undoId`; 6) write the tests; 7) run DONE.
- **DONE:** `bun run test convex/tasks.test.ts` → all cases pass, including every error case below.
- **EVIDENCE:** terminal output of DONE (pass count) + the `tasks.test.ts` file listing every Given/When/Then.
- **DO NOT:** change `convex/schema.ts`; touch any other module; delete a task hard (must be soft); invent a new table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Mutations on `convex/tasks.ts`, owner-scoped (`requireUser`): `softDelete({taskId})`, `carryOver({taskId, date})`, `moveToToday({taskId, date})`. All return `{ taskId, undone: boolean }`. Auth: only the row's `userId`; reject missing/foreign/deleted task with typed `ConvexError("task_not_found")`. Errors (tested): missing args → `invalid_args`; task owned by another user → `forbidden`; already `deletedAt` → `already_deleted`; `date` not a valid `YYYY-MM-DD` → `invalid_date`. Limits: `date` parsed strictly (`YYYY-MM-DD`), carry-over date within ±1 year of today. No UI strings in this ticket (errors surface as codes; the screen renders copy).
- **TESTS:** Given an open task owned by U / When `softDelete` / Then `deletedAt` set and list excludes it. Given a deleted task / When `carryOver` / Then `already_deleted`. Given `date:"2026-13-40"` / When any mutation / Then `invalid_date`. Given task owned by V / When U calls / Then `forbidden`. Given `moveToToday` / When success / Then activity row exists and `undo` restores the prior status/date.
- **NUMBERS:** mutation round-trip p95 latency — UNKNOWN (Amit answers) · no N+1 on the happy path (code review) · every error path returns a typed error, never throws raw (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0066 — Calendar events: `endsAtMs` + edit + soft delete (`convex/calendar_events.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** #1341
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** APP-FLOW §5 item 7; BACKEND-SCHEMA §3 (`calendarEvents.endsAtMs?` additive); PRD F-07.
- **GOAL:** Calendar events carry an optional end time, can be edited, and are soft-deleted (never hard).
- **SCOPE:** `convex/calendar_events.ts` · `convex/calendar_events.test.ts` (test; create if absent).
- **MUTATES:** `calendarEvents.endsAtMs` (additive read/write); event `title`/`startAtMs`/`endsAtMs` on edit; `deletedAt` on delete.
- **STEPS:** 1) Graphify code-map of `convex/calendar_events.ts` (endsAtMs may already be on the row — verify against `convex/schema.ts`, which you may NOT edit); 2) add `calendar_events.update({ eventId, title?, startAtMs?, endsAtMs? })`; 3) add `calendar_events.delete({ eventId })` (soft); 4) extend the return validator for the optional `endsAtMs`; 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/calendar_events.test.ts` → all pass, incl. the end-before-start rejection.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** edit `convex/schema.ts`; hard-delete; allow `endsAtMs <= startAtMs`; touch any other module.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped mutations: `update({eventId, title?, startAtMs?, endsAtMs?})`, `delete({eventId})`; queries already list by month/day. Returns `{ eventId }`. Auth: `requireUser`, row owner only. Errors: `event_not_found`, `forbidden`, `end_before_start` (when `endsAtMs <= startAtMs`), `invalid_time` (non-integer ms). Limits: duration ≥ 5 min and ≤ 24 h; a future event's `endsAtMs` may be cleared (`null`) to restore an all-day event. The `endsAtMs` column is additive; if the schema validator must change, that change rides on the chunk-1 architecture ticket — do not touch `convex/schema.ts` here (see OPEN).
- **TESTS:** Given an event / When `update({title})` / Then only title changes. Given `endsAtMs <= startAtMs` / When `update` / Then `end_before_start`. Given missing id / When any / Then `event_not_found`. Given other user's event / When call / Then `forbidden`. Given `delete` / When list / Then event absent but row keeps `deletedAt`.
- **NUMBERS:** p95 mutation latency — UNKNOWN (Amit answers) · duration bounds 5 min–24 h enforced in the validator (code review) · no N+1 on month/day list (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** `endsAtMs` schema-column ownership (this ticket vs the chunk-1 architecture ticket) — UNKNOWN, Amit answers.

### TFV2-0067 — Habit check-ins by local day + Undo (`convex/habitCheckIns.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** APP-FLOW §5 item 4; BACKEND-SCHEMA §3 (`habitCheckIns`); PRD F-10.
- **GOAL:** A habit can be checked in and un-checked for the caller's local calendar day, with one row per habit per day.
- **SCOPE:** `convex/habitCheckIns.ts` · `convex/habitCheckIns.test.ts` (extend if present).
- **MUTATES:** `habitCheckIns` rows (check-in / soft-delete undo); `habits` cache fields recomputed.
- **STEPS:** 1) Graphify code-map of `convex/habitCheckIns.ts`; 2) ensure `habits.log({ habitId, localDate })` upserts exactly one row per habit per `localDate` (Convex mutation is transactional); 3) ensure undo = soft delete (`deletedAt`) and recompute the habit cache; 4) reject future local dates beyond today and dates > 7 days past (configurable); 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/habitCheckIns.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add a streak counter to any query result; touch `convex/schema.ts`; log in UTC instead of the passed `localDate`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `habits.log({ habitId, localDate })` and `habits.undo({ habitId, localDate })`, owner-scoped. Returns `{ habitId, localDate, checked }`. Auth: habit owner only. Errors: `habit_not_found`, `forbidden`, `future_date`, `out_of_range` (outside ±7-day window). Limits: `localDate` is `YYYY-MM-DD`, computed in the browser (server has no user time zone — conflict #13); uniqueness enforced inside the mutation. Never surface a streak number (F-10).
- **TESTS:** Given no row / When `log` / Then one row with `source`. Given an existing check-in / When `log` again / Then idempotent (still one row). Given `localDate` tomorrow / When `log` / Then `future_date`. Given `undo` / When `log` list / Then row soft-deleted and habit cache recomputed. Given other user's habit / When call / Then `forbidden`.
- **NUMBERS:** p95 mutation latency — UNKNOWN (Amit answers) · one upsert, one cache recompute, no fan-out (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** time-zone source — UNKNOWN, Amit answers (conflict #13).

### TFV2-0068 — Habits: 6-week detail grid + summary + cache recompute (`convex/habits.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0067 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0067.
- **WHY:** APP-FLOW §5 item 4 (`/habits/[id]` 6-week grid); PRD F-10; screen `web/habit-detail.html`.
- **GOAL:** The habit detail screen can read a 6-week day grid and a summary, with the habit cache recomputed on every check-in.
- **SCOPE:** `convex/habits.ts` · `convex/habits.test.ts` (create if absent).
- **MUTATES:** `habits` cache fields (recomputed read); no new tables.
- **STEPS:** 1) Graphify code-map of `convex/habits.ts` and `convex/lib/habitStreak.ts` / `habitCheckInStreak.ts`; 2) add `habits.listDays({ habitId, localDate })` returning 42 days (6 weeks ending today, Monday-first per code; see OPEN #10); 3) add `habits.summary({ habitId })` returning `{ totalLogged, daysThisWeek, lastLoggedAt }` with **no streak counter**; 4) recompute cache in `habits.log`/`undo`; 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/habits.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** return a streak number anywhere; touch `convex/schema.ts`; add a new table.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Queries (read-only): `listDays({habitId, localDate}) -> { days: {localDate, checked}[] }`, `summary({habitId}) -> { totalLogged, daysThisWeek, lastLoggedAt }`. Auth: owner only. Errors: `habit_not_found`, `forbidden`. Limits: grid is exactly 42 days; `localDate` defaults to today in the caller's zone. The streak libs (`lib/habitStreak.ts`, `lib/habitCheckInStreak.ts`) may already compute totals — reuse them, never expose the streak to the UI.
- **TESTS:** Given 3 check-ins in the last 6 weeks / When `listDays` / Then 42 days, 3 `checked`. Given none / When `summary` / Then `{0,0,null}` and no streak field. Given a check-in today / When `summary` / Then `daysThisWeek` increments and `lastLoggedAt` = today. Given other user / When any / Then `forbidden`.
- **NUMBERS:** query has no N+1 and returns ≤42 rows (code review) · p95 latency — UNKNOWN (Amit answers).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start (Sunday/Monday) — UNKNOWN, Amit answers (conflict #10).

### TFV2-0069 — Goals backend (`convex/goals.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** #457
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** PRD F-08 (structured tags/projects); BACKEND-SCHEMA §3 (`goals`); screen `web/goals.html`, `web/goal-detail.html`, `web/goals-progress.html`.
- **GOAL:** Goals can be created, listed, opened, linked to projects/tasks, and read back as progress.
- **SCOPE:** `convex/goals.ts` · `convex/goals.test.ts` (create if absent).
- **MUTATES:** `goals` rows; `projects`/`tasks` goal links (read).
- **STEPS:** 1) Graphify code-map of `convex/goals.ts`; 2) add `goals.create({ title })`, `goals.update({ goalId, title? })`, `goals.list()`, `goals.get({ goalId })`; 3) add `goals.progressByGoal()` and `goals.stepsByWeek({ goalId })` for the progress screen; 4) add `goals.nextStep({ goalId })` returning one suggested next action or `null`; 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/goals.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** touch `convex/schema.ts`; auto-create projects/tasks from goals; add a model call.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped: `create({title})`, `update({goalId, title?})`, `list()`, `get({goalId})`, `progressByGoal()`, `stepsByWeek({goalId})`, `nextStep({goalId})`. Titles are user text (`dir="auto"` at render). Errors: `goal_not_found`, `forbidden`, `empty_title`. Limits: title 1–200 chars; `nextStep` returns the earliest open task linked to the goal, else `null` (no model call).
- **TESTS:** Given none / When `list` / Then `[]`. Given empty title / When `create` / Then `empty_title`. Given a goal with 2 linked tasks / When `progressByGoal` / Then counts reflect open vs done. Given no open tasks / When `nextStep` / Then `null`. Given other user / When `get` / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · no N+1 in `progressByGoal` (code review) · title 1–200 chars (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0070 — Day plans (`convex/dayPlans.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** APP-FLOW §5 item 1; BACKEND-SCHEMA §3 (`dayPlans` #531); screen `web/today.html`, `web/plan.html`.
- **GOAL:** One day plan per user per local day stores intention, top 3 tasks, energy, and a draft/committed status.
- **SCOPE:** `convex/dayPlans.ts` · `convex/dayPlans.test.ts` (extend if present).
- **MUTATES:** `dayPlans` rows (upsert); no new tables.
- **STEPS:** 1) Graphify code-map of `convex/dayPlans.ts`; 2) ensure `getByDate({ localDate })` returns the row or `null`; 3) ensure `upsert({ localDate, intention?, topTaskIds?, energy?, status? })` enforces one row per `localDate`; 4) add `commit({ localDate })` (draft → committed, sets `committedAt`); 5) add `setEnergy({ localDate, energy })` and `setIntention({ localDate, intention })`; 6) write tests; 7) run DONE.
- **DONE:** `bun run test convex/dayPlans.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** touch `convex/schema.ts`; allow two rows per `localDate`; mix energy words (quiet/steady/push only).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped: `getByDate({localDate})`, `upsert({localDate, intention?, topTaskIds?, energy?, status?})`, `commit({localDate})`, `setEnergy({localDate, energy})`, `setIntention({localDate, intention})`. `energy` ∈ `"quiet"|"steady"|"push"`; `status` ∈ `"draft"|"committed"`; `topTaskIds` length ≤ 3. Errors: `invalid_energy`, `too_many_top_tasks`, `invalid_date`. Uniqueness (one row per `localDate`) enforced inside the mutation.
- **TESTS:** Given none / When `getByDate` / Then `null`. Given `upsert` twice same day / Then one row updated, not two. Given `energy:"turbo"` / When `upsert` / Then `invalid_energy`. Given 4 top tasks / When `upsert` / Then `too_many_top_tasks`. Given `commit` / When `getByDate` / Then `status="committed"` and `committedAt` set.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · `topTaskIds` ≤ 3 enforced (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0071 — Time blocks (`convex/timeBlocks.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0070 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0070.
- **WHY:** APP-FLOW §5 item 2; BACKEND-SCHEMA §3 (`timeBlocks`); PRD F-07.
- **GOAL:** Planned slots on one local day can be listed, created, edited, marked done/skipped, and soft-deleted.
- **SCOPE:** `convex/timeBlocks.ts` · `convex/timeBlocks.test.ts` (create if absent).
- **MUTATES:** `timeBlocks` rows; `taskId`/`habitId` links (read).
- **STEPS:** 1) Graphify code-map of `convex/timeBlocks.ts`; 2) add `listForDay({ localDate })` ordered by `startMinute`; 3) add `create({ localDate, title, startMinute, durationMinutes, kind, taskId?, habitId? })`; 4) add `update({ timeBlockId, ... })`, `delete({ timeBlockId })` (soft), `setDone({ timeBlockId, status })`; 5) validate `startMinute` 0–1439, `durationMinutes` 5–720; 6) write tests; 7) run DONE.
- **DONE:** `bun run test convex/timeBlocks.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** touch `convex/schema.ts`; allow overlap checking that isn't required; hard-delete.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `create` returns `{ timeBlockId }`; `kind` ∈ `focus|task|habit|break|other`; `status` ∈ `planned|done|skipped`. Errors: `invalid_minute`, `invalid_duration`, `time_block_not_found`, `forbidden`. Limits: `startMinute` 0–1439 (half-hour slots), `durationMinutes` 5–720; `skipped` is neutral (never failure copy).
- **TESTS:** Given create at 08:00 for 25 min / When `listForDay` / Then ordered first. Given `startMinute:1500` / When create / Then `invalid_minute`. Given `durationMinutes:1` / When create / Then `invalid_duration`. Given `setDone("skipped")` / When list / Then status `skipped` and no failure wording. Given other user / When any / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · list sorted by `startMinute` (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** timeline start (06:00 vs wake time) — UNKNOWN, Amit answers.

### TFV2-0072 — Focus blocks (`convex/focusBlocks.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0071 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0071.
- **WHY:** APP-FLOW §5 item 5; BACKEND-SCHEMA §3 (`focusSessions` #534); screen `web/today.html` Next up timer.
- **GOAL:** Focus sessions start, pause/resume locally, and complete as logged rows that survive reload.
- **SCOPE:** `convex/focusBlocks.ts` · `convex/focusBlocks.test.ts` (extend if present).
- **MUTATES:** `focusBlocks` rows; optional `timeBlockId`/`taskId` links.
- **STEPS:** 1) Graphify code-map of `convex/focusBlocks.ts`; 2) add `start({ taskId, minutes })` returning `{ sessionId }`; 3) add `complete({ sessionId, minutes })` writing a row with `durationMinutes` and `completedAt`; 4) keep pause/resume as local timer state (no server row); 5) add `listForDay({ localDate })`; 6) write tests; 7) run DONE.
- **DONE:** `bun run test convex/focusBlocks.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** persist pause/resume as rows; touch `convex/schema.ts`; round minutes dishonestly.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped: `start({taskId, minutes}) -> {sessionId}`, `complete({sessionId, minutes}) -> {sessionId}`, `listForDay({localDate})`. `minutes` ∈ 1–180. Errors: `session_not_found`, `forbidden`, `invalid_minutes`. Pause/resume is browser-local; only `complete` persists.
- **TESTS:** Given start 25 min / When complete / Then row with `durationMinutes:25` and `completedAt`. Given unknown session / When complete / Then `session_not_found`. Given `minutes:0` / When start / Then `invalid_minutes`. Given list after reload / When `listForDay` / Then the completed session is present (persisted). Given other user / When any / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · `minutes` 1–180 (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0073 — Brain-dump inbox (`convex/brain_dump.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** PRD F-09; APP-FLOW §5 item 6; BACKEND-SCHEMA §3 (`inboxItems` #535); screen `web/brain-dump.html`.
- **GOAL:** Brain-dump raw text is captured and held as a draft before any sorting.
- **SCOPE:** `convex/brain_dump.ts` · `convex/lib/brainDumpInput.ts` · `convex/brain_dump.test.ts`.
- **MUTATES:** brain-dump draft (inbox item) rows; no task/note/event until apply.
- **STEPS:** 1) Graphify code-map of `convex/brain_dump.ts` and `convex/lib/brainDumpInput.ts`; 2) add `saveDraft({ rawText })` (idempotent single draft per user); 3) add `getDraft()` returning `{ rawText, updatedAt } | null`; 4) add `clearDraft()`; 5) sanitize input (trim, length cap) via `brainDumpInput`; 6) write tests; 7) run DONE.
- **DONE:** `bun run test convex/brain_dump.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** parse into tasks here (that is TFV2-0074); persist raw messages anywhere else (RAM-only rule); touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped: `saveDraft({rawText})`, `getDraft()`, `clearDraft()`. Raw text is user text. Errors: `too_long` (over 20,000 chars). Limits: 0–20,000 chars; one draft per user; the draft is never auto-sorted. Copy surfaced by the screen, not here.
- **TESTS:** Given save "a;b;c" / When `getDraft` / Then returns it. Given save twice / When `getDraft` / Then only the latest (single draft). Given 30,000 chars / When save / Then `too_long`. Given clear / When getDraft / Then `null`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · 20,000-char cap (code review) · input sanitised before persist (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0074 — Brain-dump prioritize → proposal (`convex/lib/brainDumpParse.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0073, TFV2-0065 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0073 and TFV2-0065.
- **WHY:** PRD F-09 (brain dump → ordered plan → add to Today); APP-FLOW §5 item 6 and §6 (proposal); BACKEND-SCHEMA §4.3 (`proposals` table).
- **GOAL:** Raw brain-dump text becomes an ordered proposal of rows, each accepted/edited/rejected, and only accepted rows are applied to Today.
- **SCOPE:** `convex/lib/brainDumpParse.ts` · `convex/brain_dump.ts` (apply mutations) · `convex/brain_dump.test.ts`.
- **MUTATES:** proposal rows; `tasks`/`calendarEvents`/`notes` only on apply.
- **STEPS:** 1) Graphify code-map of `brainDumpParse.ts` (a rule-based local split already exists — reuse it as the fallback); 2) add `prioritize({ draftId })` returning `{ rows: {sourceLine,title,durationMin,reason,kind}[] }`; 3) add `apply({ draftId, acceptedRowIds })` that creates tasks/events and soft-deletes the accepted inbox lines; 4) on parse failure, return the rule-based split (no model call required — conflict #6: model-written vs rule-based is UNKNOWN); 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/brain_dump.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** write to Today before `apply`; call a paid model; invent a proposal shape not in `proposals` rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped: `prioritize({draftId}) -> {rows[]}`, `apply({draftId, acceptedRowIds}) -> {createdTaskIds, createdEventIds}`. Each row carries `sourceLine` (user's own words), `reason` (short, specific). Errors: `draft_not_found`, `empty_draft`, `no_rows_accepted`. Limits: ≤ 20 rows per proposal; `durationMin` default 15. Nothing is written until `apply`; `apply` is undoable for 5 minutes via `activity`.
- **TESTS:** Given "call bank; slides; email Dana" / When `prioritize` / Then ≤3 rows, each with a reason. Given empty draft / When prioritize / Then `empty_draft`. Given accept 2 rows / When `apply` / Then exactly 2 tasks created, others untouched. Given apply with no accepted rows / Then `no_rows_accepted`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · ≤20 proposal rows (code review) · `apply` idempotent per row (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** model-written vs rule-based proposal, and auto-apply threshold — UNKNOWN, Amit answers (conflict #6).

### TFV2-0075 — Journal + daily note backend (`convex/journal.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** #446
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** #446 (Journal + Daily note backend); PRD F-05/F-06; screen `web/journal.html`, `web/daily-note.html`.
- **GOAL:** Journal entries and daily-note pages can be listed, created, read, and soft-deleted for the caller's local day.
- **SCOPE:** `convex/journal.ts` · `convex/journal.test.ts` (both new).
- **MUTATES:** journal/daily entries (backed by `notes` rows of `pageType:"journal"`/`"daily"`); `deletedAt` for soft delete.
- **STEPS:** 1) Graphify code-map of `convex/notes.ts` and `notes_period.ts` (journal may be partially wired via page period — verify); 2) add `journal.list()`, `journal.get({ date })`, `journal.saveEntry({ date, body })`, `journal.promptForToday({ date })`; 3) daily note uses `notes` with `pageType:"daily"` and `date`, soft-delete via the existing `notes` path; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/journal.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add a new table if `notes` with `pageType` already serves journal; touch `convex/schema.ts`; invent prompts (return the fixed prompt text defined in the screen copy).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `journal.list() -> {date, body, updatedAt}[]`; `saveEntry({date, body})`; `promptForToday({date}) -> string` returns fixed copy (EN: "One line about today, or answer the question." / HE: "שורה אחת על היום, או תשובה לשאלה."). Errors: `invalid_date`, `entry_too_long` (>20,000 chars). Storage: `notes` rows with `pageType:"journal"` (12 Oct contracts are the newest authority — conflict #7).
- **TESTS:** Given no entry today / When `get` / Then `null`. Given save / When list / Then one entry. Given 30,000 chars / When save / Then `entry_too_long`. Given soft delete / When list / Then absent but row keeps `deletedAt`. Given other user / When get / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · 20,000-char cap (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** journal storage authority (notes vs a journalEntries table) — UNKNOWN, Amit answers (conflict #7).

### TFV2-0076 — Routines backend (`convex/routines.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0075 · **Folds-in:** #447
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0075.
- **WHY:** #447 (Routines backend); screen `web/routines.html`, `web/routine-detail.html`.
- **GOAL:** Routines (ordered step lists) can be listed, opened, run step by step, and soft-deleted.
- **SCOPE:** `convex/routines.ts` · `convex/routines.test.ts` (both new).
- **MUTATES:** routine definitions and a run cursor (or a note page of `pageType:"routine"`); `deletedAt` on delete.
- **STEPS:** 1) Graphify code-map of `convex/notes.ts` (routines are step lists — verify whether they reuse notes); 2) add `routines.list()`, `routines.get({ routineId })`, `routines.create({ title, steps[] })`, `routines.startRun({ routineId })`, `routines.completeStep({ runId, stepIndex })`, `routines.suggestNow({ localDate })`; 3) write tests; 4) run DONE.
- **DONE:** `bun run test convex/routines.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add a model call to `suggestNow` (return the time-based suggestion); touch `convex/schema.ts`; invent a steps schema different from a string array.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `steps` is `string[]` (user text, `dir="auto"`), ≤ 20 steps, each ≤ 200 chars. Errors: `routine_not_found`, `forbidden`, `too_many_steps`, `step_out_of_range`. `suggestNow` returns the routine whose window matches the local hour, else `null`. Runs keep a cursor; completing a step advances it.
- **TESTS:** Given create with 3 steps / When list / Then one routine. Given 21 steps / When create / Then `too_many_steps`. Given startRun / When completeStep(0) / Then cursor advanced. Given completeStep(99) / When call / Then `step_out_of_range`. Given other user / When get / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · ≤20 steps, ≤200 chars each (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** routine storage authority — UNKNOWN, Amit answers (conflict #7).

### TFV2-0077 — Nags + nag phrase (`convex/nags.ts`, `convex/lib/nagPhrase.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0068 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0065 and TFV2-0068.
- **WHY:** PRD F-60, F-61; APP-FLOW §6 (nag flow); screen `web/nags.html`, `web/task-sheet.html`, `web/habit-detail.html`.
- **GOAL:** A nag can be created, given phrases in the user's own words, switched on only with an accepted phrase, and answered (now / snooze / not today).
- **SCOPE:** `convex/nags.ts` · `convex/lib/nagPhrase.ts` · `convex/nags.test.ts` (create if absent).
- **MUTATES:** `nags` rows (enabled, phrases, answers); dosing-data answer log (never a streak).
- **STEPS:** 1) Graphify code-map of `convex/nags.ts` and `convex/lib/nagPhrase.ts`; 2) add `nags.create({ targetId, targetType })`, `nags.addPhrase({ nagId, text, origin, sourceRef? })`, `nags.setEnabled({ nagId, enabled })`, `nags.respond({ nagId, answer, phraseId })`; 3) enforce: `enabled` may not be true with zero accepted phrases, and emoji are rejected; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/nags.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add stock copy or emoji; surface a streak; touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `phrase.origin ∈ "user"|"derived"`; a `derived` phrase requires `sourceRef`. `answer ∈ "now"|"snooze"|"notToday"`. Errors: `nag_not_found`, `forbidden`, `enable_without_phrase`, `emoji_rejected`, `empty_phrase`. Copy: answers are logged as dosing data; "Not today" is never failure (partial credit). EN: now "Do it now" / HE: "לעשות עכשיו"; EN: snooze "Snooze" / HE: "לדחות"; EN: not today "Not today" / HE: "לא היום".
- **TESTS:** Given enable with no phrase / When `setEnabled(true)` / Then `enable_without_phrase`. Given phrase "do it 👊" / When addPhrase / Then `emoji_rejected`. Given `respond("notToday")` / When log / Then answer stored with no failure/streak wording. Given derived phrase without sourceRef / When addPhrase / Then `missing_source`. Given other user / When any / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · phrase ≤ 200 chars (code review) · emoji/stock copy rejected by `nagPhrase` (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** delivery channel beyond in-app — UNKNOWN, Amit answers (conflict #11).

### TFV2-0078 — Notifications (`convex/notifications.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** screen `web/notifications.html`; BACKEND-SCHEMA §5.3 (`notifications`).
- **GOAL:** In-app notifications can be listed, marked read singly and in bulk.
- **SCOPE:** `convex/notifications.ts` · `convex/notifications.test.ts` (create if absent).
- **MUTATES:** `notifications` rows (readAt).
- **STEPS:** 1) Graphify code-map of `convex/notifications.ts`; 2) add `list()`, `markRead({ notificationId })`, `markAllRead()`; 3) ensure list is newest-first and capped; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/notifications.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add push/email delivery (conflict #11); touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `list() -> {id, kind, title, body, createdAt, readAt}[]`, `markRead`, `markAllRead`. Errors: `notification_not_found`, `forbidden`. Limits: return the latest 100.
- **TESTS:** Given 3 notifications / When list / Then newest-first. Given markRead / When list / Then `readAt` set. Given markAllRead / When list / Then all read. Given other user / When markRead / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · ≤100 rows returned (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (in-app only).

### TFV2-0079 — Analytics (`convex/analytics.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** screen `web/insights.html` (`insights.tasksByWeekday`, `insights.focusMinutesByWeek`); BACKEND-SCHEMA §5.4.
- **GOAL:** Aggregated, non-identifying analytics feed the insights charts without inventing metrics.
- **SCOPE:** `convex/analytics.ts` · `convex/analytics.test.ts` (extend if present).
- **MUTATES:** none (read-only aggregates).
- **STEPS:** 1) Graphify code-map of `convex/analytics.ts`; 2) add `tasksByWeekday({ localDate })` and `focusMinutesByWeek({ localDate })`; 3) ensure aggregates are computed over soft-delete-aware rows; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/analytics.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** invent a metric the data does not support; expose raw rows; touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped read queries. `tasksByWeekday` returns `{weekday, doneCount}[]` (Mon–Sun per conflict #10); `focusMinutesByWeek` returns `{week, minutes}[]` for the trailing 12 weeks. Errors: `invalid_date`. Empty input returns empty arrays, never synthesized values.
- **TESTS:** Given 2 done tasks Monday, 1 Tuesday / When `tasksByWeekday` / Then correct counts. Given a soft-deleted task / When aggregate / Then excluded. Given no data / When both / Then empty arrays. Given other user / When query / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · soft-delete-aware aggregation (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).

### TFV2-0080 — Insights (`convex/insights.ts`, `convex/lib/insights_summary.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0079 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0079.
- **WHY:** screen `web/insights.html` (`insights.getPatterns`); PRD F-55 (observations, later).
- **GOAL:** Pattern observations are surfaced as plain sentences, each deletable, never as judgement.
- **SCOPE:** `convex/insights.ts` · `convex/lib/insights_summary.ts` · `convex/insights.test.ts`.
- **MUTATES:** insight observation rows (delete only).
- **STEPS:** 1) Graphify code-map of `convex/insights.ts` and `lib/insights_summary.ts`; 2) add `getPatterns({ localDate })` returning `{text, source, createdAt}[]`; 3) add `dismiss({ insightId })`; 4) write the summary into one required sentence per pattern; 5) write tests; 6) run DONE.
- **DONE:** `bun run test convex/insights.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** write shaming copy; auto-generate patterns from a model here; touch `convex/schema.ts`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `getPatterns -> {id, text, createdAt}[]`; `dismiss({insightId})`. Patterns are descriptive ("gym slips after late nights"), never prescriptive or shaming. Errors: `insight_not_found`, `forbidden`. Empty data → empty list, with the empty-state copy rendered by the screen.
- **TESTS:** Given 2 observations / When getPatterns / Then 2 sentences. Given dismiss / When getPatterns / Then absent. Given other user / When dismiss / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · one sentence per pattern (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0081 — Activity (`convex/activity.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** screen `web/activity.html` (`activity.listRecent`); PRD F-22 (5-min Undo of coach actions).
- **GOAL:** A 7-day activity feed lists changes by the user and the coach, each coach change undoable for 5 minutes.
- **SCOPE:** `convex/activity.ts` · `convex/activity.test.ts` (extend if present).
- **MUTATES:** activity rows (read) + undo of coach changes.
- **STEPS:** 1) Graphify code-map of `convex/activity.ts`; 2) add `listRecent({ limit })` newest-first; 3) add `undo({ activityId })` valid only within 5 minutes and only for coach-originated changes; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/activity.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** undo user's own actions via this feed; touch `convex/schema.ts`; drop the 5-minute window.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped. `listRecent({limit=50}) -> {id, actor:"you"|"coach", text, createdAt, undone}[]`; `undo({activityId})`. Errors: `activity_not_found`, `forbidden`, `undo_window_expired`, `not_undoable`. Limits: window = 5 minutes from `createdAt`; coach-origin only.
- **TESTS:** Given a coach change 1 min old / When undo / Then restored. Given a coach change 6 min old / When undo / Then `undo_window_expired`. Given a user change / When undo / Then `not_undoable`. Given other user / When list / Then `forbidden`.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · 5-minute window enforced server-side (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0082 — Streaks (`convex/streaks.ts`)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0067 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0067.
- **WHY:** BACKEND-SCHEMA §5.4 (`streaks.ts`); PRD F-10 (no streak counter as pressure).
- **GOAL:** Habit streaks are computed internally for insights only and are never surfaced as a pressure counter.
- **SCOPE:** `convex/streaks.ts` · `convex/streaks.test.ts` (create if absent).
- **MUTATES:** none (derived read).
- **STEPS:** 1) Graphify code-map of `convex/streaks.ts` and `convex/lib/habitStreak.ts`; 2) ensure `streaks.getForHabit({ habitId })` is internal-only and returns a plain number for insights aggregation; 3) ensure NO UI query in chunk B exposes it; 4) write tests; 5) run DONE.
- **DONE:** `bun run test convex/streaks.test.ts` → all pass.
- **EVIDENCE:** DONE output + test file listing.
- **DO NOT:** add a streak field to `habits.list` / `habits.summary` / `habits.listDays` or any block; render a counter anywhere.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Owner-scoped internal read: `getForHabit({habitId}) -> number`. Missed day = broken streak (no ring). Errors: `habit_not_found`, `forbidden`. The number feeds `analytics` only; the UI never receives it.
- **TESTS:** Given check-ins 3 consecutive days / When getForHabit / Then 3. Given a missed day / When getForHabit / Then reset to current run length. Given other user / When call / Then `forbidden`. Given the habit screens' queries / When inspect return shapes / Then no `streak` field present.
- **NUMBERS:** p95 latency — UNKNOWN (Amit answers) · no `streak` key in any UI-facing query (code review).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0083 — Component: EventBlock
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0066 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0066.
- **WHY:** components.md §2.2; PRD F-07, F-10; used in `web/today.html`, `web/daily-note.html`.
- **GOAL:** An event renders as a fixed (solid edge) or flexible (dashed) block with time, title, meta and place.
- **SCOPE:** `packages/ui/src/blocks/EventBlock.tsx` · `packages/ui/src/blocks/EventBlock.test.tsx` · `packages/ui/src/index.ts` (export).
- **MUTATES:** none (read-only render).
- **STEPS:** 1) Graphify code-map of `packages/ui/src/blocks`; 2) implement per SPEC; 3) add the export; 4) write tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → EventBlock cases pass; Playwright asserts both states at 390 and 1280, EN and HE.
- **EVIDENCE:** test output + the two Playwright screenshots (390/1280, EN/HE).
- **DO NOT:** edit `convex/`; set colours inline; render JSON; exceed 250 ms motion.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-block-event` / `.tp-event[data-kind]`; `data-component="EventBlock"`; shadcn `card`. Props `{ event: {id, title, start, end, place?, kind:"fixed"|"flex"} }`. Layout: `__time` (`--tp-mono`, `.tp-num`), `__title`, `__meta`, `__place`. `kind="fixed"` → solid `--tp-accent` left edge + label "Fixed"; `kind="flex"` → dashed edge + "Flexible". States: default, `[data-kind]`. Copy: EN Fixed/Flexible "Fixed"·"Flexible" / HE "קבוע"·"גמיש". RTL: time stays `.tp-num`/`.tp-mono` (isolated), edge flips to the inline-start. Keyboard/SR: the block is a `<article>`; time is a visible label. Breakpoints: full width under 390, inline card at 1280. Motion: none (no animation).
- **TESTS:** Given fixed event / When render / Then solid edge + "Fixed" and time in mono. Given flex / When render / Then dashed edge + "Flexible". Playwright: at 390 and 1280, assert the two `[data-kind]` states and EN/HE labels via `?lang=`.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms transform/opacity only (components.md) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0084 — Component: HabitBlock
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0067 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0067.
- **WHY:** components.md §2.2; PRD F-10 (no streak counter); used in `web/daily-note.html`, `web/today.html`.
- **GOAL:** A habit renders as a card with a log toggle and a 7-day dot ring; no streak counter.
- **SCOPE:** `packages/ui/src/blocks/HabitBlock.tsx` · `packages/ui/src/blocks/HabitBlock.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none (render + `habits.log` call).
- **STEPS:** 1) Graphify code-map; 2) implement per SPEC; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → HabitBlock cases pass; Playwright asserts log/undo and dot states at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** draw a streak counter; touch `convex/`; label a missed day as failure.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-block-habit` / `.tp-habit[data-logged]` / `.tp-habit-days` / `.tp-habit-day[data-done][data-today]`; `data-component="HabitBlock"`; shadcn `card + toggle`. Props `{ habit: {id, name, when, last7:boolean[], loggedToday} }`. Events: `habit-log` → `habits.log({habitId, localDate})`. States: default, `data-logged` (today), each day `data-done`/`data-today`. Each day has sr text EN "logged"/"not logged" / HE "תועד"/"לא תועד". Copy: EN "Log today" / HE "לתעד היום"; EN "Logged today" / HE "תועד היום". RTL: dots flow inline-start. Keyboard: toggle is a `<button role="switch" aria-checked>`. Breakpoints: full width 390, card 1280. Motion: dot fill ≤250 ms opacity.
- **TESTS:** Given last7 with today logged / When render / Then today dot `data-done data-today` and 7 dots, no number. Given click toggle / When `habits.log` / Then `data-logged` toggles optimistically. Playwright asserts dot states + no streak number at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0085 — Component: NagBlock
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0077 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0077.
- **WHY:** components.md §2.2; PRD F-60; used in `web/daily-note.html`, `web/today.html`.
- **GOAL:** A nag renders the user's own phrase with three answers; no icon, no emoji, no stock copy.
- **SCOPE:** `packages/ui/src/blocks/NagBlock.tsx` · `packages/ui/src/blocks/NagBlock.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none (render + `nags.respond` call).
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → NagBlock cases pass; Playwright asserts the three answers at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** add an icon or emoji; use stock copy; touch `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-block-nag` / `.tp-nag[data-status]`; `data-component="NagBlock"`; shadcn `card (+ alert-dialog)`. Props `{ nag: {id, phrase, about, at} }`. Events: `data-choice="now|snooze|nottoday"` → `nags.respond`. States: default, `data-status` after answer. Copy (user's own words only) plus answers: EN "Do it now"/"Snooze"/"Not today" / HE "לעשות עכשיו"/"לדחות"/"לא היום". Phrase uses `dir="auto"`. RTL: actions mirror. Keyboard: three `<button>`s. Breakpoints: 390/1280. Motion: status change ≤250 ms.
- **TESTS:** Given a nag with a phrase / When render / Then phrase shown verbatim and no icon/emoji. Given click "now" / When `nags.respond` / Then `data-status` set. Playwright: three answers, phrase text, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** delivery channel — UNKNOWN, Amit answers (conflict #11).

### TFV2-0086 — Component: PageLayout
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; used by every non-document screen in chunk B.
- **GOAL:** A page container with narrow/wide widths inside the app main area.
- **SCOPE:** `packages/ui/src/layout/PageLayout.tsx` · `packages/ui/src/layout/PageLayout.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → PageLayout cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** set colours/type here (screens add layout only); touch `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-page` (`--wide`, `--narrow`); `data-component="PageLayout"`; props `{ width:"wide"|"narrow", children }`. Layout: max-width via `--tp-*` spacing, centered, gap `--tp-space-6`. States: none. No visible copy. Breakpoints: narrow ~68ch, wide fills `--tp-app__main`. Motion: none.
- **TESTS:** Given width narrow / When render / Then max-width 68ch. Given wide / When render / Then fills main. (No Playwright needed — layout primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0087 — Component: Surface
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; solid paper panel for chunk B screens.
- **GOAL:** A solid paper panel used as the background for cards and lists.
- **SCOPE:** `packages/ui/src/layout/Surface.tsx` · `packages/ui/src/layout/Surface.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Surface cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** make it glass (glass is floating chrome only); set type sizes.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-surface`; `data-component="Surface"`; shadcn `card`; props `{ children }`. Uses `--tp-surface`, `--tp-border`, `--tp-radius-*`. States: none. Motion: none.
- **TESTS:** Given children / When render / Then background `--tp-surface` and border. (Layout primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0088 — Component: PageHeader
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; one H1 per screen.
- **GOAL:** A screen header with one H1 title, subtitle and action slot.
- **SCOPE:** `packages/ui/src/layout/PageHeader.tsx` · `packages/ui/src/layout/PageHeader.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → PageHeader cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** render more than one H1; hide the subtitle on mobile.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-pagehead`, `__text`, `__title`, `__sub`, `__actions`; `data-component="PageHeader"`; props `{ title, subtitle?, actions? }`. `__title` is the sole `<h1>`. States: none. RTL: title/user text `dir="auto"`. Breakpoints: actions wrap under the title at 390, inline-end at 1280. Motion: none.
- **TESTS:** Given title+subtitle / When render / Then one `<h1>` + subtitle. Given actions / When render / Then present. (No Playwright — primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0089 — Component: Toolbar
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; search + filter + sort on list screens.
- **GOAL:** A toolbar row hosting search, filter and sort controls.
- **SCOPE:** `packages/ui/src/layout/Toolbar.tsx` · `packages/ui/src/layout/Toolbar.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Toolbar cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** hardcode a control type (accept children).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-toolbar`, `__grow`, `__end`; `data-component="Toolbar"`; props `{ children }`. `__grow` expands the search input; `__end` holds sort/filter. Breakpoints: wraps to two rows at 390, one row at 1280. Motion: none.
- **TESTS:** Given children / When render / Then `__grow` and `__end` regions present. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0090 — Component: Section
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; grouped sections with a count.
- **GOAL:** A titled section with an optional item count.
- **SCOPE:** `packages/ui/src/layout/Section.tsx` · `packages/ui/src/layout/Section.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Section cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** invent a heading level (accept `as`).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-section`, `__head`, `__title`, `__count`; `data-component="Section"`; props `{ title, count?, children, as? }`. `__count` uses `.tp-num`. States: none. Motion: none.
- **TESTS:** Given title + count 3 / When render / Then title + "3" in `.tp-num`. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · count isolated via `.tp-num` (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0091 — Component: CardGrid
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; auto-fill card layout.
- **GOAL:** An auto-filling grid of cards, small or default.
- **SCOPE:** `packages/ui/src/layout/CardGrid.tsx` · `packages/ui/src/layout/CardGrid.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → CardGrid cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** fix a column count (auto-fill).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-cards` (`--sm`); `data-component="CardGrid"`; props `{ size?, children }`. CSS `grid-template-columns: repeat(auto-fill, minmax(…, 1fr))`. States: none. Motion: none.
- **TESTS:** Given 4 cards / When render at 390 vs 1280 / Then 1 column vs multiple. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0092 — Component: Notice
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; icon + words, never colour alone.
- **GOAL:** An alert with tone, icon, title, body and optional action; never colour-only.
- **SCOPE:** `packages/ui/src/layout/Notice.tsx` · `packages/ui/src/layout/Notice.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Notice cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** rely on colour alone (always icon + word).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-notice[data-tone]`, `__icon`, `__text`, `__title`, `__action`; `data-component="Notice"`; shadcn `alert`; props `{ tone:"info"|"caution"|"success"|"error", title?, body?, action? }`. Each tone pairs an icon with a word (never colour only). States: per `data-tone`. Copy is supplied by the screen. Motion: none.
- **TESTS:** Given tone error / When render / Then icon + word present, not colour alone. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · icon ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0093 — Component: Badge
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.1; labels like "Built-in" / "Your plan".
- **GOAL:** A small tone badge with label and optional icon.
- **SCOPE:** `packages/ui/src/layout/Badge.tsx` · `packages/ui/src/layout/Badge.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Badge cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** use colour alone (label always present).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-badge[data-tone]`; `data-component="Badge"`; shadcn `badge`; props `{ label, icon?, tone? }`. Word always present. RTL: label `dir="auto"`. Motion: none.
- **TESTS:** Given label "Built-in" / When render / Then label present. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0094 — Component: PageHead
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0088 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0088.
- **WHY:** components.md §2.3; wraps page title + meta for daily/weekly/project/note.
- **GOAL:** A variant head wrapping the page title and meta for four page kinds.
- **SCOPE:** `packages/ui/src/layout/PageHead.tsx` · `packages/ui/src/layout/PageHead.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → PageHead cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** set the title font size (PageTitle owns it); add a second H1.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-page-head[data-variant]`; `data-component="PageHead"`; props `{ variant:"daily"|"weekly"|"project"|"note", title, meta? }`. Wraps `.tp-page-title` + `.tp-page-meta`. States: per variant. Motion: none.
- **TESTS:** Given variant daily / When render / Then `data-variant="daily"` + one title. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0095 — Component: WeekStrip
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.3; weekly page head; used in `web/weekly-page.html`.
- **GOAL:** A 7-day toggle strip selects one day and shows its open count.
- **SCOPE:** `packages/ui/src/layout/WeekStrip.tsx` · `packages/ui/src/layout/WeekStrip.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → WeekStrip cases pass; Playwright asserts selection at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** hardcode Sunday-first (see OPEN); navigate away (emit `select-day`).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-week-strip`, `__day[aria-pressed][aria-current="date"]`, `__dow`, `__n`, `__count`; `data-component="WeekStrip"`; shadcn `toggle-group`; props `{ days: {localDate, dow, n, count}[] }`. Event: `select-day` → `pages.getDaily({date})`. Day names EN Mon–Sun / HE שני–ראשון. RTL: days flow right-to-left. Keyboard: radiogroup arrows (Stage 1 `segKeys`). Breakpoints: scrolls inside itself on phone, static at 1280. Motion: none.
- **TESTS:** Given 7 days / When render / Then 7 `__day` with counts in `.tp-num`. Given select Tuesday / When click / Then `aria-pressed` + `aria-current="date"`. Playwright: selection + count at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start (Sunday/Monday) — UNKNOWN, Amit answers (conflict #10).

### TFV2-0096 — Component: ProjectStatus
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0093 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0093.
- **WHY:** components.md §2.3; used in `web/projects.html`, `web/project-detail.html`.
- **GOAL:** A badge showing a project's idea/active/paused/done status with icon and word.
- **SCOPE:** `packages/ui/src/layout/ProjectStatus.tsx` · `packages/ui/src/layout/ProjectStatus.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → ProjectStatus cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** use colour alone; invent statuses beyond the four.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-status[data-status]`; `data-component="ProjectStatus"`; shadcn `badge`; props `{ status:"idea"|"active"|"paused"|"done", label }`. Icon + word. Copy: EN idea/active/paused/done "Idea"·"Active"·"Paused"·"Done" / HE "רעיון"·"פעיל"·"מושהה"·"הושלם". RTL: label `dir="auto"`. Motion: none.
- **TESTS:** Given status active / When render / Then icon + "Active". (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0097 — Component: ListRow
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.4; used by tasks, habits, routines, goals, projects, activity, notifications lists.
- **GOAL:** A 56px-min list row with icon, title, meta and end slot, link or button.
- **SCOPE:** `packages/ui/src/lists/ListRow.tsx` · `packages/ui/src/lists/ListRow.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → ListRow cases pass; Playwright asserts focus + 56px at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** go below 56px tall; omit an accessible name for icon-only rows.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-list`, `.tp-list-row`, `__icon`, `__body`, `__title`, `__meta`, `__end`; `data-component="ListRow"`; props `{ icon, title, meta?, href?, onClick? }`. Height ≥56px. RTL: icon inline-start, end slot inline-end. Keyboard: focusable (`<a>`/`<button>`), visible focus ring. Breakpoints: same at 390/1280. Motion: none.
- **TESTS:** Given a row / When render / Then height ≥56px and title present. Given href / When render / Then `<a>` with aria-label if icon-only. Playwright: focus ring + height at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · row ≥56px (components.md) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0098 — Component: Segmented / Filter
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.4; used by plan, tasks, goals, projects, insights, activity.
- **GOAL:** A single-choice segmented control (radiogroup) with dot + word marks.
- **SCOPE:** `packages/ui/src/lists/Segmented.tsx` · `packages/ui/src/lists/Segmented.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Segmented cases pass; Playwright asserts arrow-key selection in RTL and LTR at 390/1280.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** allow multiple selection; omit `role=radio`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-segmented` (`--block`), `.tp-seg__opt[role=radio]`; `data-component="Segmented"`; shadcn `toggle-group`; props `{ options:{label,value}[], value, onChange }`. Dot + word mark the choice. Keyboard: radiogroup arrows, swapped in RTL (`segKeys`). Breakpoints: full width (`--block`) at 390, inline at 1280. Motion: none.
- **TESTS:** Given options / When render / Then radiogroup with `aria-checked` on value. Given ArrowRight in RTL / When keypress / Then moves opposite visually. Playwright: arrow selection LTR + RTL at 390/1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0099 — Component: SearchInput
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0098 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0098.
- **WHY:** components.md §2.4; used by tasks, search, command, notes, templates.
- **GOAL:** A labelled search input (label always present, visible or sr-only).
- **SCOPE:** `packages/ui/src/forms/SearchInput.tsx` · `packages/ui/src/forms/SearchInput.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → SearchInput cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** omit the label; break the clear affordance.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-search`, `__box`, `__icon`, `.tp-label`, `.tp-input`; `data-component="SearchInput"`; shadcn `input`; props `{ label, placeholder, value, onChange }`. Label always present (visible or `.tp-sr-only`). Placeholder EN "Search…" / HE "חיפוש…" (caller may override). RTL: input `dir="auto"`, icon flips. Keyboard: standard input + Escape clears. Breakpoints: 390/1280. Motion: none.
- **TESTS:** Given a query / When render / Then label present and input bound. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0100 — Component: SortMenu
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.4; sort control on list screens.
- **GOAL:** A radio dropdown menu for sort options with arrows, Esc and focus return.
- **SCOPE:** `packages/ui/src/lists/SortMenu.tsx` · `packages/ui/src/lists/SortMenu.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → SortMenu cases pass; Playwright asserts open/choose/close at 390/1280.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** trap focus incorrectly; omit `role=menu`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-menu`, `__list.tp-glass[role=menu]`, `__label`, `__item[role=menuitemradio]`, `__check`, `[data-menu-value]`; `data-component="SortMenu"`; shadcn `dropdown-menu (radio)`; props `{ options, value, onChange }`. Event: `menu` toggles; choose → `TP.onSort(value)`. Keyboard: arrows, Enter, Esc, focus returns to trigger. Copy: EN "Sort" / HE "מיון" (label). RTL: menu mirrors. Breakpoints: 390/1280. Motion: open/close ≤250 ms opacity.
- **TESTS:** Given options / When open / Then `role=menu` + `aria-expanded`. Given choose / When Enter / Then value label updates + focus returns. Playwright: full cycle at 390/1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0101 — Component: LoadMore
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.4; pagination on list screens.
- **GOAL:** A "show more" control with a running "Showing 20 of 48" status.
- **SCOPE:** `packages/ui/src/lists/LoadMore.tsx` · `packages/ui/src/lists/LoadMore.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → LoadMore cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** auto-load on scroll (explicit button).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-load-more`, `__status`; rows `[data-row]`, hidden `[data-more][hidden]`; `data-component="LoadMore"`; shadcn `button`; props `{ shown, total, onLoadMore }`. Status copy: EN "Showing 20 of 48" / HE "מוצגות 20 מתוך 48". Counts in `.tp-num`. States: default, `__status` updates. Motion: none.
- **TESTS:** Given shown 20 total 48 / When render / Then status "Showing 20 of 48" and button when `shown < total`. Given shown = total / When render / Then no button. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0102 — Component: MonthGrid
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.5; used in `web/calendar.html`, `web/plan.html`.
- **GOAL:** A month grid with dots, day number, item count, and day selection.
- **SCOPE:** `packages/ui/src/calendar/MonthGrid.tsx` · `packages/ui/src/calendar/MonthGrid.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → MonthGrid cases pass; Playwright asserts selection + count at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** render the count text visually under 768 (sr-only); hardcode Sunday-first.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-month`, `__head`, `__title`, `__grid`, `__dow`, `__day[data-outside][aria-current][aria-pressed]`, `__n`, `__dots`, `__count`; `data-component="MonthGrid"`; shadcn `calendar`; props `{ days, monthTitle, onSelectDay }`. `__count` is "N items" EN "N items" / HE "N פריטים" (sr-only under 768). Day dots via Dot. Keyboard: arrow grid, Home/End. Breakpoints: count text sr-only at 390, visible at 1280. Motion: none.
- **TESTS:** Given a day with 3 items / When render / Then 3 dots + count. Given select / When click / Then `aria-pressed` + `onSelectDay`. Playwright: select + count at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).

### TFV2-0103 — Component: Dot
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.5; decorative shapes for fixed/flex/done/habit.
- **GOAL:** A decorative dot with four kinds; shapes differ (filled vs ring).
- **SCOPE:** `packages/ui/src/calendar/Dot.tsx` · `packages/ui/src/calendar/Dot.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Dot cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** use colour alone as the only signal (always paired with a word elsewhere).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-dot` (`--fixed`, `--flex`, `--done`, `--habit`); `data-component="Dot"`; props `{ kind }`. Decorative (`aria-hidden`). Motion: none.
- **TESTS:** Given each kind / When render / Then correct modifier and shape. (Primitive.)
- **NUMBERS:** none beyond token usage (decorative, not interactive).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0104 — Component: WeekColumns
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0103 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0103.
- **WHY:** components.md §2.5; used in `web/calendar.html`, `web/plan.html`.
- **GOAL:** Seven side-by-side day columns that scroll sideways inside themselves only.
- **SCOPE:** `packages/ui/src/calendar/WeekColumns.tsx` · `packages/ui/src/calendar/WeekColumns.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → WeekColumns cases pass; Playwright asserts internal scroll at 390 and static at 1280.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** scroll the whole page; fix columns wider than the container.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-week`, `__col[aria-current]`, `__head`, `__item[data-kind]`, `__time`, `__title`, `__kind`; `data-component="WeekColumns"`; props `{ days }`. `__item[data-kind]` solid fixed / dashed flex. Time `.tp-week__time` is `.tp-mono`/`.tp-num`. Breakpoints: internal horizontal scroll at 390; static fit at 1280. Motion: none.
- **TESTS:** Given 7 days / When render / Then 7 columns. Given overflow at 390 / When render / Then `overflow-x` on the week container only. Playwright: scroll container at 390 vs 1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · INP ≤200 ms / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0105 — Component: DayTimeline
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0103 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0103.
- **WHY:** components.md §2.5; half-hour slots; used in `web/calendar.html`, `web/plan.html`.
- **GOAL:** A day timeline of half-hour slots with fixed/flexible items and a now line.
- **SCOPE:** `packages/ui/src/calendar/DayTimeline.tsx` · `packages/ui/src/calendar/DayTimeline.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → DayTimeline cases pass; Playwright asserts now line + slot heights at 390/1280.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** use whole-hour-only slots (half-hour); animate the now line.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-timeline`, `__hours`, `__hour`, `__items` (`--cols`), `__item[data-kind]` (`--row`, `--span`, `--col`), `__time`, `__title`, `__now`; `data-component="DayTimeline"`; props `{ items, now }`. Rows are half-hour slots; fixed = solid + "Fixed", flex = dashed + "Flexible". Time `.tp-mono`/`.tp-num`. Breakpoints: 390/1280. Motion: none.
- **TESTS:** Given an item 08:00–08:30 / When render / Then `--span` correct. Given now / When render / Then `__now` positioned. Playwright: slot span + now at 390/1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · INP ≤200 ms / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** timeline start (06:00 vs wake time) — UNKNOWN, Amit answers.

### TFV2-0106 — Component: Kanban
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.6; used in `web/project-kanban.html`.
- **GOAL:** A multi-column kanban board that snap-scrolls on phone.
- **SCOPE:** `packages/ui/src/kanban/Kanban.tsx` · `packages/ui/src/kanban/Kanban.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Kanban cases pass; Playwright asserts snap-scroll at 390 and columns at 1280.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** require drag (cards have move buttons); exceed the page with columns.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-kanban`, `__col`, `__head`, `__name`, `__count`, `__list`, `__empty`; `data-component="Kanban"`; shadcn `card`; props `{ columns: {id,name,count,cards[]}[] }`. Column names EN "To do"·"Doing"·"Done" / HE "לעשות"·"בעבודה"·"הושלם" (caller may override). `__empty` per column. Breakpoints: snap-scroll horizontally at 390; static grid at 1280. Motion: none.
- **TESTS:** Given 3 columns / When render / Then 3 `__col` with name + count. Given empty column / When render / Then `__empty` shows. Playwright: snap-scroll at 390, grid at 1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0107 — Component: KanbanCard
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0106 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0106.
- **WHY:** components.md §2.6; move buttons on every card.
- **GOAL:** A kanban card with title, meta and prev/next move buttons; edges disabled.
- **SCOPE:** `packages/ui/src/kanban/KanbanCard.tsx` · `packages/ui/src/kanban/KanbanCard.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → KanbanCard cases pass; Playwright asserts move buttons + disabled edges at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** rely on drag; miss `aria-label` on move buttons.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-kanban-card`, `__title`, `__meta`, `__move`; `data-component="KanbanCard"`; shadcn `card + button`; props `{ card, canPrev, canNext, onMove }`. Event `kanban-move` + `data-dir="prev|next"` → `tasks.moveColumn`. Move buttons on every card; edge buttons disabled; icons `.tp-icon--flip`/`.tp-icon--back`. Copy (aria): EN "Move left"/"Move right" / HE "הזזה שמאלה"/"הזזה ימינה". Breakpoints: 390/1280. Motion: none.
- **TESTS:** Given a middle card / When render / Then both move buttons enabled. Given first column / When render / Then prev disabled. Given move / When click next / Then `onMove("next")`. Playwright: disabled edges + move at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0108 — Component: BarChart
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.7; used in `web/insights.html`, `web/goals-progress.html`.
- **GOAL:** A bar chart where every bar has a number and a label.
- **SCOPE:** `packages/ui/src/charts/BarChart.tsx` · `packages/ui/src/charts/BarChart.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → BarChart cases pass; Playwright asserts bars + labels at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** omit a label or number per bar; colour-only bars.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-chart` (figure), `__title`, `__bars`, `__bar[data-highlight]` (`--pct`), `__value`, `__track`, `__fill`, `__label`; `data-component="BarChart"`; shadcn `chart`; props `{ title, bars:{label,value,pct}[] }`. Every bar has a number and a label. Requires a ChartSummary sibling (figcaption). RTL: labels flip, values stay `.tp-num`. Breakpoints: 390/1280. Motion: none.
- **TESTS:** Given bars / When render / Then each has `--pct`, value and label. Given highlight / When render / Then `data-highlight`. Playwright: bars + labels at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · values isolated via `.tp-num` (components.md) · INP ≤200 ms (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0109 — Component: LineChart
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.7; used in `web/insights.html`, `web/goals-progress.html`.
- **GOAL:** An SVG line chart with labelled points and an accessible summary.
- **SCOPE:** `packages/ui/src/charts/LineChart.tsx` · `packages/ui/src/charts/LineChart.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → LineChart cases pass; Playwright asserts points at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** skip `role="img"` + `aria-labelledby`; use an external chart lib.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `svg.tp-chart__svg` with `__axis`, `__grid`, `__line`, `__point`, `<text>`; `data-component="LineChart"`; shadcn `chart`; props `{ points:{label,value}[], summaryId }`. Points labelled in the SVG; svg has `role="img"` + `aria-labelledby` the summary. Breakpoints: 390/1280 (viewBox scales). Motion: none.
- **TESTS:** Given points / When render / Then each point has a `<text>` label and `aria-labelledby`. Playwright: points at 390/1280.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · INP ≤200 ms (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0110 — Component: ChartSummary
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.7; required figcaption for every chart.
- **GOAL:** A one-sentence summary of a chart, required as its figcaption.
- **SCOPE:** `packages/ui/src/charts/ChartSummary.tsx` · `packages/ui/src/charts/ChartSummary.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → ChartSummary cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** render a chart without a summary; write shaming copy.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-chart__summary`; `data-component="ChartSummary"`; shadcn `figcaption`; props `{ text }`. The chart in one sentence. Copy supplied by the screen. Motion: none.
- **TESTS:** Given text / When render / Then `<figcaption>` with text. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0111 — Component: Form
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.8; used by task sheet, nags, goals, journal, calendar.
- **GOAL:** A form container (width up to 68ch) with an actions slot and submit handling.
- **SCOPE:** `packages/ui/src/forms/Form.tsx` · `packages/ui/src/forms/Form.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Form cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** exceed 68ch width; suppress native validation.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-form`, `__actions`; `data-component="Form"`; shadcn `form`; props `{ onSubmit, children }`. Width up to 68ch. Motion: none.
- **TESTS:** Given children / When render / Then `<form>` with max-width 68ch. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · form width ≤68ch (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0112 — Component: Field
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.8; label + help + error with `aria-describedby`.
- **GOAL:** A form item with label, help and error text, wired to `aria-describedby`/`aria-invalid`.
- **SCOPE:** `packages/ui/src/forms/Field.tsx` · `packages/ui/src/forms/Field.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Field cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** omit `aria-describedby`; use colour alone for error.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-field`, `.tp-label`, `.tp-label__opt`, `.tp-help`, `.tp-error-text`; `data-component="Field"`; shadcn `form item`; props `{ id, label, help?, error?, children }`. `aria-describedby="x-help x-error"`, `aria-invalid="true"` on error. Copy: label + help supplied by caller. Motion: none.
- **TESTS:** Given error / When render / Then `aria-invalid` + error text linked. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0113 — Component: TextInput
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0112 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0112.
- **WHY:** components.md §2.8; emails `dir="ltr"`.
- **GOAL:** A text input; emails force LTR.
- **SCOPE:** `packages/ui/src/forms/TextInput.tsx` · `packages/ui/src/forms/TextInput.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → TextInput cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** omit `dir="ltr"` for email; break the label link.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-input`; `data-component="TextInput"`; shadcn `input`; props `{ type?, value, onChange, id, aria-* }`. `type="email"` forces `dir="ltr"`. Motion: none.
- **TESTS:** Given type email / When render / Then `dir="ltr"` and `autocomplete=email`. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0114 — Component: Textarea
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0112 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0112.
- **WHY:** components.md §2.8; user text `dir="auto"`.
- **GOAL:** A textarea with `dir="auto"` for mixed-language user text.
- **SCOPE:** `packages/ui/src/forms/Textarea.tsx` · `packages/ui/src/forms/Textarea.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Textarea cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** fix a hard direction (must be auto).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-textarea`; `data-component="Textarea"`; shadcn `textarea`; props `{ rows?, value, onChange }`. `dir="auto"`. Motion: none.
- **TESTS:** Given rows 4 / When render / Then `dir="auto"` + rows=4. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0115 — Component: Select
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0112 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0112.
- **WHY:** components.md §2.8; used by task sheet, habits, settings.
- **GOAL:** A native select with options and an icon.
- **SCOPE:** `packages/ui/src/forms/Select.tsx` · `packages/ui/src/forms/Select.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Select cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** build a custom dropdown (native select); omit the label.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-select` > `select.tp-select__input` + `.tp-select__icon`; `data-component="Select"`; shadcn `select`; props `{ options:{label,value}[], value, onChange, id }`. Motion: none.
- **TESTS:** Given options / When render / Then native `<select>` with options. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0116 — Component: Switch
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.8; visible On/Off word.
- **GOAL:** A switch with a visible "On"/"Off" word and correct `role="switch"`.
- **SCOPE:** `packages/ui/src/forms/Switch.tsx` · `packages/ui/src/forms/Switch.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Switch cases pass; Playwright asserts toggle + word at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** omit the word; use `aria-checked` incorrectly.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `button.tp-switch[role=switch][aria-checked]`, `__track`, `__thumb`, `__state`; `data-component="Switch"`; shadcn `switch`; props `{ checked, onChange }`. Visible word: EN On/Off "On"·"Off" / HE "פועל"·"כבוי". RTL: thumb origin flips (`[dir="rtl"]` rule). Breakpoints: 390/1280. Motion: thumb ≤250 ms transform.
- **TESTS:** Given checked / When render / Then `aria-checked=true` + "On". Given click / When toggle / Then `onChange(false)` + "Off". Playwright: toggle + word at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0117 — Component: Checkbox
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0112 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0112.
- **WHY:** components.md §2.8; used in forms and checklists.
- **GOAL:** A checkbox inside a labelled choice with text and hint.
- **SCOPE:** `packages/ui/src/forms/Checkbox.tsx` · `packages/ui/src/forms/Checkbox.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Checkbox cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** render a bare checkbox without a label.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `input.tp-checkbox` inside `label.tp-choice` (`__text`, `__hint`); `data-component="Checkbox"`; shadcn `checkbox`; props `{ checked, label, hint?, onChange }`. Motion: none.
- **TESTS:** Given label + hint / When render / Then checkbox inside `<label>` with text + hint. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0118 — Component: Radio
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0112 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0112.
- **WHY:** components.md §2.8; used in task sheet, energy pick.
- **GOAL:** A radio inside a labelled choice within a radiogroup.
- **SCOPE:** `packages/ui/src/forms/Radio.tsx` · `packages/ui/src/forms/Radio.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Radio cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** omit `name` (grouping).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** `input.tp-radio` inside `label.tp-choice`; `data-component="Radio"`; shadcn `radio-group`; props `{ name, value, label, checked, onChange }`. Motion: none.
- **TESTS:** Given name "energy" / When render / Then radio with matching `name`. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0119 — Component: Dial 0–10
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.8; used by Today energy and coach dial.
- **GOAL:** A 0–10 slider showing number and word (quiet/steady/push).
- **SCOPE:** `packages/ui/src/forms/Dial.tsx` · `packages/ui/src/forms/Dial.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests + Playwright; 5) run DONE.
- **DONE:** `bun run test packages/ui` → Dial cases pass; Playwright asserts number + word at 390/1280, EN/HE.
- **EVIDENCE:** test output + Playwright screenshots.
- **DO NOT:** show only a number (word required); miss `aria-valuetext`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-dial`, `__head`, `__value`, `__num [data-dial-num]`, `__of`, `__word [data-dial-word]`, `__scale` + `input.tp-slider`; `data-component="Dial"`; shadcn `slider`; props `{ value, label, onChange }`. Words: 0–3 EN "Quiet" / HE "שקט"; 4–7 EN "Steady" / HE "יציב"; 8–10 EN "Push" / HE "דחיפה". `aria-valuetext` = "N of 10, word". RTL: slider direction flips. Breakpoints: 390/1280. Motion: thumb ≤250 ms.
- **TESTS:** Given value 2 / When render / Then number 2 + word "Quiet" + `aria-valuetext`. Given value 9 / When render / Then "Push". Playwright: drag to change + word updates at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0120 — Component: StateEmpty
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.18; every screen's empty state.
- **GOAL:** An empty state with icon, title, body and a next-step action.
- **SCOPE:** `packages/ui/src/states/StateEmpty.tsx` · `packages/ui/src/states/StateEmpty.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → StateEmpty cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** write shaming empty copy (kind copy only).
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-state.tp-state--empty`, `__icon`, `__title`, `__body`, `__actions`; `data-component="StateEmpty"`; props `{ title, body, action? }`. Copy supplied by the screen (kind + next step). Motion: none.
- **TESTS:** Given title/body/action / When render / Then all present. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0121 — Component: StateLoading
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0001 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0001.
- **WHY:** components.md §2.18; skeleton rows + sr-only label.
- **GOAL:** Skeleton loading rows with a screen-reader "Loading…" label.
- **SCOPE:** `packages/ui/src/states/StateLoading.tsx` · `packages/ui/src/states/StateLoading.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → StateLoading cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** animate shimmer under reduced motion.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-state--loading[role=status]`, `.tp-skel-list`, `.tp-skel-row`, `__box`, `__lines`, `.tp-skeleton--w40/w60/w80/w100/sm/block`; `data-component="StateLoading"`; props `{ rows, label }`. `.tp-sr-only` label e.g. EN "Loading your tasks" / HE "טוען את המשימות שלך" (caller supplies). Shimmer stops with reduced motion. Motion: shimmer only, ≤250 ms opacity loop or off.
- **TESTS:** Given rows 4 / When render / Then 4 skeleton rows + sr-only label + `role="status"`. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · reduced-motion respected (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0122 — Component: StateError
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0120 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0120.
- **WHY:** components.md §2.18; "Couldn't load… your data is safe" + Retry.
- **GOAL:** An error state with a safe-reassurance line and a Retry action.
- **SCOPE:** `packages/ui/src/states/StateError.tsx` · `packages/ui/src/states/StateError.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → StateError cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** show JSON or a raw error; omit Retry.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-state.tp-state--error`; `data-component="StateError"`; shadcn `alert`; props `{ what, onRetry }`. Copy supplied by screen: EN "Couldn't load your … Your data is safe." + "Retry" / HE "לא הצלחנו לטעון… המידע שלך שמור." + "לנסות שוב". Motion: none.
- **TESTS:** Given what "tasks" / When render / Then title + body + Retry button, no JSON. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0123 — Component: StateOffline
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0092 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0092.
- **WHY:** components.md §2.18; offline banner; content stays.
- **GOAL:** An offline banner that says changes save when back, while content stays usable.
- **SCOPE:** `packages/ui/src/states/StateOffline.tsx` · `packages/ui/src/states/StateOffline.test.tsx` · `packages/ui/src/index.ts`.
- **MUTATES:** none.
- **STEPS:** 1) Graphify code-map; 2) implement; 3) export; 4) tests; 5) run DONE.
- **DONE:** `bun run test packages/ui` → StateOffline cases pass.
- **EVIDENCE:** test output.
- **DO NOT:** hide content when offline.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Class `.tp-notice[data-tone=caution].tp-offline[role=status]`; `data-component="StateOffline"`; shadcn `alert`; props `{ text }`. Copy: EN "You're offline. Changes save when you're back." / HE "אין חיבור כרגע. השינויים יישמרו כשתחזרי לרשת." Content stays. Motion: none.
- **TESTS:** Given offline / When render / Then banner `role=status` + text, and page content still rendered. (Primitive.)
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0124 — Screen: Today
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0070, TFV2-0071, TFV2-0072, TFV2-0084, TFV2-0119, TFV2-0120, TFV2-0121, TFV2-0122, TFV2-0123 · **Folds-in:** #537
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-05; APP-FLOW §5 item 1; screen `web/today.html`.
- **GOAL:** Today shows the daily page with intention, energy pick, tasks, time blocks and Next up, all five states working.
- **SCOPE:** `apps/web/app/(tempo)/today/page.tsx` · `apps/web/components/today/today-client.tsx` · `apps/web/e2e/today.spec.ts`.
- **MUTATES:** none (wires `pages.getDaily`, `tasks.nextUp`, `tasks.complete`, `tasks.skipNextUp`, `focus.start`, `energy.log`, `tasks.create`).
- **STEPS:** 1) Graphify code-map of `apps/web/app/(tempo)/today` and `components/today`; 2) wire the queries/actions per SPEC; 3) implement the five states + Undo toast; 4) copy the full string table from `web/today.html` `TP_STRINGS`; 5) write the Playwright test; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test today.spec.ts` → pass; all states asserted at 390 and 1280, EN and HE.
- **EVIDENCE:** Playwright output + the two-viewport, two-lang screenshots for each state.
- **DO NOT:** call the model on load; edit `convex/`; add a second `.tp-btn--primary`; merge energy pick with the coach dial.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/today`, layout TempoShell. Data: `dailyPage = pages.getDaily({date})`, `nextUp = tasks.nextUp({date})`, `backlinks = pages.backlinks({pageId})`. Actions: tick → `tasks.complete` (optimistic, 5-min Undo); Start → `focus.start({taskId, minutes:25})`; Not now → `tasks.skipNextUp`; Make it smaller → open CoachPanel with task attached (proposal-only); set energy → `energy.log({date, value})`; add task → `tasks.create`. States: default, empty, loading, error, offline. One primary: Next up "Start 25 minutes". Key copy EN/HE — EN "Next up"/HE "הבא בתור"; EN "How is your energy right now?"/HE "איך האנרגיה שלך עכשיו?"; energy EN Quiet·Steady·Push /HE שקט·יציב·דחיפה; empty EN "Nothing on Today yet."/HE "עוד אין כלום בהיום."; error EN "Couldn't load your day."/HE "לא הצלחנו לטעון את היום שלך."; offline EN "You're offline. Changes save when you're back."/HE "אין חיבור כרגע. השינויים יישמרו כשתחזרי לרשת."; done EN "That's the list. Rest counts."/HE "זו הרשימה. גם מנוחה נחשבת." RTL: full mirror, times `.tp-num`/`.tp-mono`, energy radio arrows swap. Breakpoints 390/768/1024/1280 (rail collapses under 768). Motion: tick strike ≤250 ms; toast ≤250 ms. Full string table = `web/today.html`.
- **TESTS:** Given a day with 3 tasks / When open / Then intention, energy, tasks, Next up show. Given empty / When open / Then empty copy + "Open brain dump". Given error / When query fails / Then safe copy + Retry. Given offline / When open / Then banner + content stays. Given tick a task / When click / Then struck + Undo toast for 5 min. Playwright: click through default/empty/error/offline and tick→undo at 390 and 1280, EN and HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · body text ≥13 px (components.md) · one `.tp-btn--primary` (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0125 — Screen: Daily note
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0075, TFV2-0124 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0075 and TFV2-0124.
- **WHY:** PRD F-05/F-06; screen `web/daily-note.html`.
- **GOAL:** The bare daily-note page offers the Daily template on first open and saves the day's sections.
- **SCOPE:** `apps/web/app/(bare)/daily-note/page.tsx` · `apps/web/components/today/daily-note-client.tsx` · `apps/web/e2e/daily-note.spec.ts`.
- **MUTATES:** none (wires `pages.getDaily`, `pages.backlinks`, journal save).
- **STEPS:** 1) Graphify code-map of the bare daily-note route; 2) wire queries; 3) implement template offer + five states; 4) copy `web/daily-note.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test daily-note.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** add a second primary; edit `convex/`; offer the template twice once accepted.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(bare)/daily-note`, layout Bare. Data: `pages.getDaily({date})`, `pages.backlinks({pageId})`. Actions: accept template → apply Daily template (fresh block ids); save sections. States: default, empty (template offer), loading, error, offline. One primary: "Use template". Key copy: EN "Use the Daily template?"/HE "להשתמש בתבנית היום?"; EN "Use template"/HE "להשתמש בתבנית"; EN "Not now"/HE "לא עכשיו"; EN "One thing that went okay today:"/HE "דבר אחד שהלך בסדר היום:"; EN "Couldn't load today's page."/HE "לא הצלחנו לטעון את הדף של היום."; EN "Saved"/HE "נשמר". RTL full mirror. Breakpoints 390/768/1024/1280. Motion: template insert ≤250 ms. Full strings = `web/daily-note.html`.
- **TESTS:** Given first open / When load / Then template offer shows. Given accept / When click / Then sections appear + no second offer. Given empty / When dismiss / Then blank editor. Given error / When fail / Then safe copy + Retry. Playwright: offer→accept→sections→save at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0126 — Screen: Brain dump (with proposal)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0073, TFV2-0074 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0073 and TFV2-0074.
- **WHY:** PRD F-09; APP-FLOW §5 item 6; screen `web/brain-dump.html`.
- **GOAL:** Brain dump captures raw text and turns it into an accept/edit/reject proposal, adding only accepted rows to Today.
- **SCOPE:** `apps/web/app/(tempo)/brain-dump/page.tsx` · `apps/web/components/brain-dump/brain-dump-client.tsx` · `apps/web/e2e/brain-dump.spec.ts`.
- **MUTATES:** none (wires `brainDumps.getDraft`, `brainDumps.saveDraft`, `brainDumps.prioritize`, `brainDumps.apply`).
- **STEPS:** 1) Graphify code-map of `components/brain-dump`; 2) wire; 3) implement default + `?view=review` (proposal) + five states; 4) copy `web/brain-dump.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test brain-dump.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** write to Today before Add; call the model without a fallback; show JSON.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/brain-dump`, layout TempoShell. Data: `brainDumps.getDraft()`. Actions: `saveDraft({rawText})` on input; "Turn this into a plan" → `prioritize`; accept/edit/reject per row; "Add to Today" → `apply` (Undo 5 min). States: default, `?view=review` (proposal), empty, loading, error, offline. One primary: "Turn this into a plan". Key copy: EN "What's on your mind?"/HE "מה יש לך בראש?"; EN "Everything. Any order. Fragments are fine."/HE "הכול. בכל סדר. גם חצאי משפטים זה בסדר."; EN "Turn this into a plan"/HE "להפוך את זה לתוכנית"; EN "Here's a plan"/HE "הנה תוכנית"; EN "Accept, edit or reject each line. Nothing is added until you tap Add."/HE "לאשר, לערוך או לדחות כל שורה. שום דבר לא נוסף עד שתלחצי על הוספה."; EN "Add to Today"/HE "להוסיף להיום"; EN "Nothing goes onto your lists until you choose."/HE "שום דבר לא נכנס לרשימות שלך עד שתבחרי."; EN "Added to Today. You can undo for 5 minutes."/HE "נוסף להיום. אפשר לבטל במשך 5 דקות."; error EN "Couldn't make a plan just now."/HE "לא הצלחנו ליצור תוכנית כרגע." RTL full mirror; rows `dir="auto"`. Breakpoints 390/768/1024/1280. Motion: proposal rows enter ≤250 ms. Full strings = `web/brain-dump.html`.
- **TESTS:** Given raw text / When type / Then draft saved. Given submit / When click / Then `?view=review` rows appear. Given reject all / When click / Then Add disabled. Given accept 2 + Add / When click / Then toast + 2 tasks on Today (Undo). Given empty / When load / Then "Start with whatever is loudest." Playwright: type→plan→accept→add→undo, and empty/error, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · body text ≥13 px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** model-written vs rule-based proposal, auto-apply threshold — UNKNOWN, Amit answers (conflict #6).

### TFV2-0127 — Screen: Plan (day / week / month)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0070, TFV2-0071, TFV2-0102, TFV2-0104, TFV2-0105, TFV2-0098 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-07; APP-FLOW §5 item 2; screen `web/plan.html`.
- **GOAL:** Plan switches day/week/month views of the same time data; elastic items reflow around fixed ones.
- **SCOPE:** `apps/web/app/(tempo)/plan/page.tsx` · `apps/web/components/today/plan-client.tsx` · `apps/web/e2e/plan.spec.ts`.
- **MUTATES:** none (wires `plan.getDay`, `plan.getWeek`, `plan.getMonth`, `timeBlocks.*`).
- **STEPS:** 1) Graphify code-map of the plan route; 2) wire; 3) implement `?view=day|week|month` + five states; 4) copy `web/plan.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test plan.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** call the model; reflow fixed events; edit `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/plan`, layout TempoShell. Data: `plan.getDay` / `getWeek` / `getMonth`. Views via Segmented (Day/Week/Month) + `?view=`. Components: MonthGrid (month), WeekColumns (week), DayTimeline (day). States: default, empty, loading, error, offline. One primary: none (read + add). Key copy: EN "Plan"/HE "תכנון"; empty EN "No plans for this day yet."/HE "עדיין אין תוכניות ליום הזה."; empty body EN "Fixed events will show here, and flexible things will settle around them."/HE "אירועים קבועים יופיעו כאן, ודברים גמישים יסתדרו סביבם."; error EN "Couldn't load the plan."/HE "לא הצלחנו לטעון את התוכנית."; month title EN "October 2026"/HE "אוקטובר 2026"; prev/next EN "Previous month"/"Next month" /HE "החודש הקודם"/"החודש הבא". RTL: calendar mirrors, weeks run right-to-left per conflict #10. Breakpoints 390/768/1024/1280. Motion: view switch ≤250 ms opacity. Full strings = `web/plan.html`.
- **TESTS:** Given day view / When load / Then DayTimeline. Given week / When switch / Then WeekColumns. Given month / When switch / Then MonthGrid. Given empty / When load / Then empty copy. Given error / When fail / Then safe copy + Retry. Playwright: switch all three views + empty/error at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).

### TFV2-0128 — Screen: Tasks list
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0097, TFV2-0098, TFV2-0099, TFV2-0100, TFV2-0101 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-05 (task blocks); screen `web/tasks.html`.
- **GOAL:** Tasks list shows all open tasks with search, filter, sort and load-more, all five states.
- **SCOPE:** `apps/web/app/(tempo)/tasks/page.tsx` · `apps/web/components/tasks/tasks-client.tsx` · `apps/web/e2e/tasks.spec.ts`.
- **MUTATES:** none (wires `tasks.list`, `tasks.listChecklists`, `tasks.complete`).
- **STEPS:** 1) Graphify code-map of `components/tasks`; 2) wire; 3) implement toolbar (SearchInput + Segmented filter + SortMenu) + ListRow + LoadMore; 4) copy `web/tasks.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test tasks.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; show JSON; filter client-side if the query supports it server-side.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/tasks`, layout TempoShell. Data: `tasks.list`, `tasks.listChecklists`. Actions: tick → `tasks.complete` (optimistic, Undo). Components: Toolbar (SearchInput, Segmented, SortMenu), ListRow, LoadMore. States: default, empty, filtered-to-nothing, loading, error, offline. One primary: none (list). Key copy: EN "Tasks"/HE "משימות"; empty EN "No tasks yet. An empty list is a good place to start."/HE "עוד אין משימות. רשימה ריקה היא מקום טוב להתחיל בו."; empty body EN "Add one from quick add, or dump everything in a brain dump and pick from there."/HE "אפשר להוסיף אחת בהוספה המהירה, או לפרוק הכול בפריקת מחשבות ולבחור משם."; error EN "Couldn't load tasks."/HE "לא הצלחנו לטעון את המשימות."; filtered-none EN "Nothing here for this filter."/HE "אין כאן כלום עם הסינון הזה."; sort EN "Sort"/HE "מיון". RTL full mirror. Breakpoints 390/768/1024/1280. Motion: tick strike ≤250 ms. Full strings = `web/tasks.html`.
- **TESTS:** Given 3 tasks / When load / Then 3 ListRows. Given search "bank" / When type / Then filtered. Given sort / When choose / Then reordered. Given empty / When load / Then empty copy. Given error / When fail / Then Retry. Playwright: search→filter→sort→tick, plus empty/error, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · row ≥56px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0129 — Screen: Task sheet
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0077, TFV2-0111, TFV2-0112, TFV2-0113, TFV2-0114, TFV2-0115, TFV2-0116, TFV2-0117, TFV2-0118 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/task-sheet.html`; PRD F-60 (nag target).
- **GOAL:** The task sheet edits a task and offers a nag, with new-task and error states.
- **SCOPE:** `apps/web/components/tasks/TaskSheet.tsx` · `apps/web/components/tasks/task-sheet-form.tsx` · `apps/web/e2e/task-sheet.spec.ts`.
- **MUTATES:** none (wires `tasks.get`, `nags.getForTarget`).
- **STEPS:** 1) Graphify code-map of `components/tasks` TaskSheet; 2) wire; 3) implement form + nag + five states + empty=new task; 4) copy `web/task-sheet.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test task-sheet.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; submit without validation; add a second primary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Component `components/tasks/TaskSheet` (`?task=<id>`), sheet (bottom under 900px) / dialog. Data: `tasks.get({id})`, `nags.getForTarget({taskId})`. Actions: edit fields, Save; "Nag me about this" → nag. States: default, empty (new task), loading, error, offline. One primary: "Save". Key copy: EN "Edit task"/HE "עריכת משימה"; EN "Couldn't load the task."/HE "לא הצלחנו לטעון את המשימה."; EN "Nag me about this"/HE "לנדנד לי על זה"; EN "Today"/HE "היום" (background group). RTL full mirror; title `dir="auto"`. Breakpoints 390/768/1024/1280 (sheet vs dialog). Motion: sheet slide ≤250 ms. Full strings = `web/task-sheet.html`.
- **TESTS:** Given an existing task / When open / Then fields prefilled. Given new task / When open empty / Then blank form. Given invalid (empty title) / When Save / Then field error + `aria-invalid`. Given Save valid / When click / Then toast. Given "Nag me" / When click / Then nag form. Playwright: open→edit→save, empty→new, error state, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0130 — Screen: Journal
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0075 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0075.
- **WHY:** #446 (Journal backend); screen `web/journal.html`.
- **GOAL:** Journal shows a daily prompt and saves one entry per day, all five states.
- **SCOPE:** `apps/web/app/(tempo)/journal/page.tsx` · `apps/web/components/journal/journal-client.tsx` · `apps/web/e2e/journal.spec.ts`.
- **MUTATES:** none (wires `journal.list`, `journal.promptForToday`, `journal.saveEntry`).
- **STEPS:** 1) Graphify code-map of `components/journal`; 2) wire; 3) implement prompt + save + five states; 4) copy `web/journal.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test journal.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; invent prompts; add a second primary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/journal`, layout TempoShell. Data: `journal.list()`, `journal.promptForToday({date})`. Actions: `saveEntry({date, body})`. States: default, empty, loading, error, offline. One primary: "Write a line" (or Save). Key copy: EN "Journal"/HE "יומן"; empty EN "The journal is here when you want it."/HE "היומן מחכה לך כשתרצי."; empty body EN "Write one line about today, or answer the question. There is no right length."/HE "אפשר לכתוב שורה אחת על היום, או לענות על השאלה. אין אורך נכון."; error EN "Couldn't load the journal."/HE "לא הצלחנו לטעון את היומן." RTL full mirror; entry `dir="auto"`. Breakpoints 390/768/1024/1280. Motion: save ≤250 ms. Full strings = `web/journal.html`.
- **TESTS:** Given no entry / When load / Then prompt + empty copy. Given type + Save / When submit / Then saved toast. Given error / When fail / Then safe copy + Retry. Playwright: prompt→write→save, empty/error, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · form width ≤68ch (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** journal storage authority — UNKNOWN, Amit answers (conflict #7).

### TFV2-0131 — Screen: Calendar
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0066, TFV2-0102, TFV2-0103, TFV2-0104, TFV2-0105 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-07; APP-FLOW §5 item 7; screen `web/calendar.html`.
- **GOAL:** Calendar shows month/day/week with a legend, add event, and edit/delete, all five states.
- **SCOPE:** `apps/web/app/(tempo)/calendar/page.tsx` · `apps/web/components/calendar/calendar-client.tsx` · `apps/web/e2e/calendar.spec.ts`.
- **MUTATES:** none (wires `events.listMonth`, `events.listDay`, `events.update`, `events.delete`).
- **STEPS:** 1) Graphify code-map of the calendar route; 2) wire; 3) implement month grid + day timeline + legend + add/edit/delete + five states; 4) copy `web/calendar.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test calendar.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; allow end-before-start; hard-delete.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/calendar`, layout TempoShell. Data: `events.listMonth`, `events.listDay`. Actions: add event, edit, delete (soft). Components: MonthGrid, DayTimeline, WeekColumns, Dot, legend. States: default, empty day, form error (end before start), loading, error, offline. One primary: "Add event". Key copy: EN "Calendar"/HE "לוח שנה"; EN "Add event"/HE "הוספת אירוע"; legend EN "What the dots mean"/HE "מה הנקודות אומרות"; EN Fixed "Fixed"/HE "קבוע"; EN Flexible "Flexible"/HE "גמיש"; empty day EN "Nothing on this day. A free day is allowed."/HE "אין כלום ביום הזה. מותר שיהיה יום פנוי."; error EN "Couldn't load the calendar."/HE "לא הצלחנו לטעון את לוח השנה."; form error EN "End can't be before start."/HE "הסיום לא יכול להיות לפני ההתחלה." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: event add ≤250 ms. Full strings = `web/calendar.html`.
- **TESTS:** Given events / When load / Then grid with dots + day list. Given empty day / When select / Then empty-day copy. Given add with end before start / When Save / Then form error. Given edit / When change title / Then saved. Given delete / When confirm / Then event gone (soft). Playwright: add→edit→delete, empty-day, form-error, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).

### TFV2-0132 — Screen: Habits
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0068, TFV2-0084, TFV2-0097, TFV2-0111 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-10; screen `web/habits.html`.
- **GOAL:** Habits list shows each habit with a log toggle and a welcome-back state, all five states.
- **SCOPE:** `apps/web/app/(tempo)/habits/page.tsx` · `apps/web/components/habits/habits-client.tsx` · `apps/web/e2e/habits.spec.ts`.
- **MUTATES:** none (wires `habits.list`, `habits.log`).
- **STEPS:** 1) Graphify code-map of `components/habits`; 2) wire; 3) implement ListRow/HabitBlock + add form + welcome-back + five states; 4) copy `web/habits.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test habits.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** show a streak counter; edit `convex/`; label a missed day as failure.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/habits`, layout TempoShell. Data: `habits.list`. Actions: `habits.log({habitId, localDate})` toggle; add habit. States: default, welcome back (untouched 7+ days), empty, loading, error, offline. One primary: "Add habit". Key copy: EN "Habits"/HE "הרגלים"; empty EN "No habits yet. You don't need one for a good day."/HE "עוד אין הרגלים. לא צריך אף אחד כדי שיהיה יום טוב."; welcome back EN "Welcome back"/HE "ברוך שובך" (kind, no pressure); EN "Log today"/HE "לתעד היום"; error EN "Couldn't load habits."/HE "לא הצלחנו לטעון את ההרגלים." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: toggle dot ≤250 ms. Full strings = `web/habits.html`.
- **TESTS:** Given 2 habits / When load / Then 2 HabitBlocks. Given toggle / When click / Then logged today + Undo. Given none / When load / Then empty copy. Given untouched 7+ days / When load / Then welcome-back state. Playwright: toggle→undo, empty, welcome-back, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · row ≥56px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0133 — Screen: Habit detail
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0067, TFV2-0068, TFV2-0084, TFV2-0077 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** APP-FLOW §5 item 4 (6-week grid); screen `web/habit-detail.html`.
- **GOAL:** Habit detail shows a 6-week day grid and a nag, with a paused state.
- **SCOPE:** `apps/web/app/(tempo)/habits/[id]/page.tsx` · `apps/web/components/habit-detail/habit-detail-client.tsx` · `apps/web/e2e/habit-detail.spec.ts`.
- **MUTATES:** none (wires `habits.get`, `habits.listDays`, `habits.summary`, `nags.getForHabit`).
- **STEPS:** 1) Graphify code-map of `components/habit-detail`; 2) wire; 3) implement 42-day grid + summary + nag + paused + five states; 4) copy `web/habit-detail.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test habit-detail.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** show a streak counter; edit `convex/`; ring a missed day as failure.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/habits/[id]`, layout TempoShell. Data: `habits.get`, `habits.listDays` (42 days), `habits.summary`, `nags.getForHabit`. Actions: log/undo by day; edit; nag. States: default, paused, empty (no check-ins yet), loading, error, offline. One primary: none (log). Key copy: EN "No check-ins yet. Every habit starts this way."/HE "עוד לא נרשם כלום. ככה כל הרגל מתחיל."; EN "logged"/"not logged" sr /HE "תועד"/"לא תועד"; nag title EN "Your reminder"/HE "התזכורת שלך"; error EN "Couldn't load the habit."/HE "לא הצלחנו לטעון את ההרגל." RTL full mirror; day grid flows RTL. Breakpoints 390/768/1024/1280. Motion: dot fill ≤250 ms. Full strings = `web/habit-detail.html`.
- **TESTS:** Given a habit / When load / Then name + 42-day grid. Given check-in / When log today / Then today's ring fills. Given none / When load / Then empty copy, no streak number. Given paused / When load / Then paused state. Playwright: log→undo, empty, paused, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md) · 42-day grid (BACKEND-SCHEMA §3).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).

### TFV2-0134 — Screen: Routines
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0076, TFV2-0097 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0076 and TFV2-0097.
- **WHY:** #447 (Routines backend); screen `web/routines.html`.
- **GOAL:** Routines list shows each routine with a run suggestion and a paused-run state.
- **SCOPE:** `apps/web/app/(tempo)/routines/page.tsx` · `apps/web/components/routines/routines-client.tsx` · `apps/web/e2e/routines.spec.ts`.
- **MUTATES:** none (wires `routines.list`, `routines.suggestNow`, `routines.startRun`).
- **STEPS:** 1) Graphify code-map of `components/routines`; 2) wire; 3) implement ListRow + suggest + five states; 4) copy `web/routines.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test routines.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; call a model; auto-run a routine.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/routines`, layout TempoShell. Data: `routines.list`, `routines.suggestNow`. Actions: start a run. States: default, paused run, empty, loading, error, offline. One primary: "Start". Key copy: EN "Routines"/HE "שגרות"; empty EN "No routines yet. Your days count without them too."/HE "עוד אין שגרות. הימים שלך נחשבים גם בלי."; empty body EN "If mornings or evenings feel like many small decisions, write the steps once and let Tempo walk you through."/HE "אם הבקרים או הערבים מרגישים כמו הרבה החלטות קטנות, אפשר לכתוב את הצעדים פעם אחת ולתת ל־Tempo ללוות אותך."; error EN "Couldn't load routines."/HE "לא הצלחנו לטעון את השגרות." RTL full mirror; step text `dir="auto"`. Breakpoints 390/768/1024/1280. Motion: run start ≤250 ms. Full strings = `web/routines.html`.
- **TESTS:** Given 2 routines / When load / Then 2 rows. Given suggestNow / When matches / Then one routine suggested. Given start / When click / Then run opens. Given empty / When load / Then empty copy. Playwright: list→suggest→start, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0135 — Screen: Routine detail
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0076, TFV2-0097 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0076 and TFV2-0097.
- **WHY:** screen `web/routine-detail.html`.
- **GOAL:** Routine detail shows ordered steps and a run cursor, with paused and finished states.
- **SCOPE:** `apps/web/app/(tempo)/routines/[id]/page.tsx` · `apps/web/components/routines/routine-detail-client.tsx` · `apps/web/e2e/routine-detail.spec.ts`.
- **MUTATES:** none (wires `routines.get`, `routines.getRun`, `routines.completeStep`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement step list + run cursor + paused/finished + five states; 4) copy `web/routine-detail.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test routine-detail.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; auto-advance without a tap.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/routines/[id]`, layout TempoShell. Data: `routines.get`, `routines.getRun`. Actions: `completeStep({runId, stepIndex})`; edit steps. States: default, paused, finished, empty (no steps), loading, error, offline. One primary: "Next step". Key copy: EN "This routine has no steps yet."/HE "לשגרה הזאת עוד אין צעדים."; EN "Add two or three small steps. You can change them anytime."/HE "אפשר להוסיף שניים או שלושה צעדים קטנים. אפשר לשנות אותם בכל זמן."; EN "Paused"/HE "מושהה"; EN "Finished"/HE "הסתיים"; error EN "Couldn't load the routine."/HE "לא הצלחנו לטעון את השגרה." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: step advance ≤250 ms. Full strings = `web/routine-detail.html`.
- **TESTS:** Given a routine with 3 steps / When load / Then 3 steps, cursor at 0. Given Next / When click / Then cursor advances. Given last step / When click / Then finished state. Given no steps / When load / Then empty copy. Playwright: advance→finish, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0136 — Screen: Goals
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0069, TFV2-0096, TFV2-0097, TFV2-0098 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** #457 (Goals); screen `web/goals.html`.
- **GOAL:** Goals list shows goals with status and a filter, all five states.
- **SCOPE:** `apps/web/app/(tempo)/goals/page.tsx` · `apps/web/components/goals/goals-client.tsx` · `apps/web/e2e/goals.spec.ts`.
- **MUTATES:** none (wires `goals.list`, `goals.create`, `projects.listByGoals`).
- **STEPS:** 1) Graphify code-map of the goals route; 2) wire; 3) implement ListRow + Segmented filter + create + five states; 4) copy `web/goals.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test goals.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; auto-link projects; add a second primary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/goals`, layout TempoShell. Data: `goals.list`, `projects.listByGoals`. Actions: `goals.create({title})`; filter. States: default, filtered-to-nothing, empty, loading, error, offline. One primary: "Write a goal". Key copy: EN "Goals"/HE "מטרות"; empty EN "No goals yet. That's fine."/HE "עדיין אין מטרות. זה בסדר."; empty body EN "A goal is just something you'd like to be true. Write one in your own words, and link a project later."/HE "מטרה היא פשוט משהו שהיית רוצה שיתקיים. כתבי אחת במילים שלך, ואפשר לקשר פרויקט אחר כך."; filtered-none EN "Nothing here for this filter."/HE "אין כאן כלום עם הסינון הזה."; error EN "Couldn't load your goals."/HE "לא הצלחנו לטעון את המטרות שלך." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/goals.html`.
- **TESTS:** Given 2 goals / When load / Then 2 rows. Given create / When submit / Then new goal appears. Given filter / When choose / Then filtered. Given empty / When load / Then empty copy. Playwright: create→filter, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · row ≥56px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0137 — Screen: Goal detail
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0069, TFV2-0097 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0069 and TFV2-0097.
- **WHY:** screen `web/goal-detail.html`.
- **GOAL:** Goal detail shows linked projects/tasks and a suggested next step.
- **SCOPE:** `apps/web/app/(tempo)/goals/[id]/page.tsx` · `apps/web/components/goals/goal-detail-client.tsx` · `apps/web/e2e/goal-detail.spec.ts`.
- **MUTATES:** none (wires `goals.get`, `projects.listByGoal`, `tasks.listByGoal`, `goals.nextStep`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement links + next step + five states; 4) copy `web/goal-detail.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test goal-detail.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; call a model for next step; add a second primary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/goals/[id]`, layout TempoShell. Data: `goals.get`, `projects.listByGoal`, `tasks.listByGoal`, `goals.nextStep`. Actions: link project, add task. States: default, empty (no steps yet), loading, error, offline. One primary: "Add a step". Key copy: EN "This goal has no steps yet."/HE "למטרה הזו עדיין אין צעדים."; EN "You can link a project that already exists, or add one small task that points here."/HE "אפשר לקשר פרויקט שכבר קיים, או להוסיף משימה קטנה אחת שמכוונת לשם."; EN "Next step"/HE "הצעד הבא"; error EN "Couldn't open this goal."/HE "לא הצלחנו לפתוח את המטרה הזו." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/goal-detail.html`.
- **TESTS:** Given a goal with 2 projects / When load / Then both listed. Given next step / When load / Then suggested step. Given no steps / When load / Then empty copy. Given error / When fail / Then Retry. Playwright: open→next step, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0138 — Screen: Goals progress
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0069, TFV2-0108, TFV2-0109, TFV2-0110 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/goals-progress.html`.
- **GOAL:** Goals progress shows per-goal and per-week charts, each with a required summary.
- **SCOPE:** `apps/web/app/(tempo)/goals/progress/page.tsx` · `apps/web/components/goals/goals-progress-client.tsx` · `apps/web/e2e/goals-progress.spec.ts`.
- **MUTATES:** none (wires `goals.progressByGoal`, `goals.stepsByWeek`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement BarChart/LineChart + ChartSummary + five states; 4) copy `web/goals-progress.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test goals-progress.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** render a chart without a summary; edit `convex/`; invent metrics.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/goals/progress`, layout TempoShell. Data: `goals.progressByGoal`, `goals.stepsByWeek`. Components: BarChart, LineChart, ChartSummary (required figcaption). States: default, empty, loading, error, offline. One primary: none. Key copy: EN "How your goals are going"/HE "איך המטרות שלך מתקדמות"; empty EN "Nothing to show yet."/HE "עדיין אין מה להציג."; empty body EN "Once a goal has a task or two linked, a quiet picture appears here."/HE "ברגע שלמטרה יהיו משימה או שתיים מקושרות, תופיע כאן תמונה שקטה שלה."; offline EN "You're offline. These charts are from your last visit."/HE "אין חיבור כרגע. הגרפים האלה מהביקור הקודם שלך."; error EN "Couldn't load your progress."/HE "לא הצלחנו לטעון את ההתקדמות שלך." RTL full mirror; chart values `.tp-num`. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/goals-progress.html`.
- **TESTS:** Given goals with tasks / When load / Then BarChart + LineChart each with a ChartSummary. Given empty / When load / Then empty copy, no charts. Given error / When fail / Then Retry. Playwright: charts + summaries, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · every chart has a summary (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0139 — Screen: Projects
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0069, TFV2-0096, TFV2-0098 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-08; screen `web/projects.html`.
- **GOAL:** Projects list shows projects with status badges and a filter.
- **SCOPE:** `apps/web/app/(tempo)/projects/page.tsx` · `apps/web/components/projects/projects-client.tsx` · `apps/web/e2e/projects.spec.ts`.
- **MUTATES:** none (wires `projects.list`, `goals.listNames`).
- **STEPS:** 1) Graphify code-map of `components/projects`; 2) wire; 3) implement ListRow + ProjectStatus + Segmented + create + five states; 4) copy `web/projects.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test projects.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; invent statuses beyond four.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/projects`, layout TempoShell. Data: `projects.list`, `goals.listNames`. Actions: create project; filter by status. States: default, filtered-to-nothing, empty, loading, error, offline. One primary: "Start a project". Key copy: EN "Projects"/HE "פרויקטים"; empty EN "No projects yet."/HE "עדיין אין פרויקטים."; empty body EN "A project is just a name and a few tasks. Start with one thing on your mind."/HE "פרויקט הוא רק שם וכמה משימות. אפשר להתחיל מדבר אחד שמעסיק אותך."; statuses EN Idea·Active·Paused·Done /HE רעיון·פעיל·מושהה·הושלם; error EN "Couldn't load your projects."/HE "לא הצלחנו לטעון את הפרויקטים שלך." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/projects.html`.
- **TESTS:** Given 3 projects / When load / Then 3 rows with status badges. Given filter Active / When choose / Then filtered. Given create / When submit / Then new project. Given empty / When load / Then empty copy. Playwright: create→filter, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · row ≥56px (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0140 — Screen: Project detail
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0069, TFV2-0097, TFV2-0096 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/project-detail.html`.
- **GOAL:** Project detail shows linked pages, tasks and goals, with empty and error states.
- **SCOPE:** `apps/web/app/(tempo)/projects/[id]/page.tsx` · `apps/web/components/projects/project-detail-client.tsx` · `apps/web/e2e/project-detail.spec.ts`.
- **MUTATES:** none (wires `projects.get`, `pages.listByProject`, `tasks.listByProject`, `pages.backlinks`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement pages/tasks/goals sections + five states; 4) copy `web/project-detail.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test project-detail.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; auto-rename; add a second primary.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/projects/[id]`, layout TempoShell. Data: `projects.get`, `pages.listByProject`, `tasks.listByProject`, `pages.backlinks`. Actions: add task. States: default, empty (name only), loading, error, offline. One primary: "Add task". Key copy: EN "Pages in this project"/HE "דפים בפרויקט הזה"; EN "Tasks"/HE "משימות"; EN "Goals"/HE "מטרות"; empty EN "This project is just a name for now."/HE "הפרויקט הזה הוא בינתיים רק שם."; EN "Add a first task"/HE "הוספת משימה ראשונה"; error EN "Couldn't open this project."/HE "לא הצלחנו לפתוח את הפרויקט הזה." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/project-detail.html`.
- **TESTS:** Given a project / When load / Then title + pages + tasks + goals. Given empty / When load / Then empty copy + Add first task. Given error / When fail / Then Retry. Playwright: open, empty, error, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0141 — Screen: Project kanban
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0106, TFV2-0107 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/project-kanban.html`; PRD F-08.
- **GOAL:** Project kanban shows task columns with move buttons on every card.
- **SCOPE:** `apps/web/app/(tempo)/projects/[id]/kanban/page.tsx` · `apps/web/components/projects/project-kanban-client.tsx` · `apps/web/e2e/project-kanban.spec.ts`.
- **MUTATES:** none (wires `projects.get`, `tasks.listByProjectColumns`, `tasks.moveColumn`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement Kanban + KanbanCard + five states; 4) copy `web/project-kanban.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test project-kanban.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** require drag; edit `convex/`; enable an edge move button.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/projects/[id]/kanban`, layout TempoShell. Data: `projects.get`, `tasks.listByProjectColumns`. Actions: `tasks.moveColumn` via `kanban-move` `data-dir`. States: default, empty board, empty column, loading, error, offline. One primary: "Add card". Key copy: column names EN "To do"·"Doing"·"Done" /HE "לעשות"·"בעבודה"·"הושלם"; empty board EN "This board is empty for now."/HE "הלוח הזה ריק בינתיים."; empty column EN "Nothing waiting here."/HE "שום דבר לא מחכה כאן."; error EN "Couldn't load this board."/HE "לא הצלחנו לטעון את הלוח הזה." RTL: move buttons `.tp-icon--flip`/`.tp-icon--back`; columns flow RTL. Breakpoints 390/768/1024/1280 (snap-scroll at 390). Motion: card move ≤250 ms. Full strings = `web/project-kanban.html`.
- **TESTS:** Given 3 columns / When load / Then 3 columns with counts. Given move next / When click / Then card moves + counts update, edge disabled. Given empty column / When render / Then column empty copy. Given error / When fail / Then Retry. Playwright: move card between columns, disabled edges, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0142 — Screen: Insights
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0079, TFV2-0080, TFV2-0108, TFV2-0109, TFV2-0110 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/insights.html`; PRD F-55 (observations).
- **GOAL:** Insights shows pattern sentences plus weekday and focus charts, each with a summary.
- **SCOPE:** `apps/web/app/(tempo)/insights/page.tsx` · `apps/web/components/insights/insights-client.tsx` · `apps/web/e2e/insights.spec.ts`.
- **MUTATES:** none (wires `insights.getPatterns`, `insights.tasksByWeekday`, `insights.focusMinutesByWeek`).
- **STEPS:** 1) Graphify code-map of `components/insights`; 2) wire; 3) implement pattern list + charts + summaries + five states; 4) copy `web/insights.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test insights.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** write shaming copy; render a chart without a summary; edit `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/insights`, layout TempoShell. Data: `insights.getPatterns`, `insights.tasksByWeekday`, `insights.focusMinutesByWeek`. Components: BarChart, LineChart, ChartSummary. States: default, empty, loading, error, offline. One primary: none. Key copy: EN "Insights"/HE "תובנות"; empty EN "Patterns need about a week."/HE "לדפוסים צריך בערך שבוע."; empty body EN "Use Tempo however works for you. Gentle patterns appear here on their own. There is nothing to do."/HE "השתמשי ב־Tempo איך שנוח לך. דפוסים עדינים יופיעו כאן מעצמם. אין שום דבר שצריך לעשות."; error EN "Couldn't load insights."/HE "לא הצלחנו לטעון את התובנות." RTL full mirror; chart values `.tp-num`. Breakpoints 390/768/1024/1280. Motion: none. Full strings = `web/insights.html`.
- **TESTS:** Given patterns + data / When load / Then sentences + two charts each with summary. Given empty / When load / Then empty copy. Given error / When fail / Then Retry. Playwright: charts + summaries, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · every chart has a summary (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0143 — Screen: Activity
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0081, TFV2-0097, TFV2-0098 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-22 (5-min Undo); screen `web/activity.html`.
- **GOAL:** Activity shows a 7-day feed of changes, coach changes undoable for 5 minutes.
- **SCOPE:** `apps/web/app/(tempo)/activity/page.tsx` · `apps/web/components/activity/activity-client.tsx` · `apps/web/e2e/activity.spec.ts`.
- **MUTATES:** none (wires `activity.listRecent`, `activity.undo`).
- **STEPS:** 1) Graphify code-map of `components/activity`; 2) wire; 3) implement feed + filter + Undo + five states; 4) copy `web/activity.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test activity.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** show Undo after 5 minutes; edit `convex/`; undo a user's own action.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/activity`, layout TempoShell. Data: `activity.listRecent`. Actions: `activity.undo({activityId})` (coach-origin, ≤5 min). Components: ListRow, Segmented filter. States: default, empty, loading, error, offline. One primary: none. Key copy: EN "Recent activity"/HE "פעילות אחרונה"; EN "Everything that changed in the last seven days, by you or the coach."/HE "כל מה שהשתנה בשבעת הימים האחרונים, על ידייך או על ידי המאמן."; empty EN "Nothing changed this week."/HE "שום דבר לא השתנה השבוע."; filter EN "By you"/"By the coach"/HE "על ידייך"/"על ידי המאמן"; EN "Undo"/HE "ביטול"; undo toast EN "The change was undone."/HE "השינוי בוטל. שום דבר אחר לא זז."; error EN "Couldn't load recent activity."/HE "לא הצלחנו לטעון את הפעילות האחרונה." RTL full mirror; timestamps `.tp-num`. Breakpoints 390/768/1024/1280. Motion: row removal ≤250 ms. Full strings = `web/activity.html`.
- **TESTS:** Given feed / When load / Then rows by you + coach. Given a coach change <5 min / When load / Then Undo shown. Given >5 min / When load / Then no Undo. Given Undo / When click / Then row removed + toast. Playwright: filter→undo, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0144 — Screen: Search
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0099, TFV2-0097, TFV2-0100 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** screen `web/search.html`.
- **GOAL:** Search searches pages, tasks and coach threads, with a no-results state.
- **SCOPE:** `apps/web/app/(tempo)/search/page.tsx` · `apps/web/components/global-search/search-client.tsx` · `apps/web/e2e/search.spec.ts`.
- **MUTATES:** none (wires `search.query`, `search.recentQueries`).
- **STEPS:** 1) Graphify code-map of `components/global-search`; 2) wire; 3) implement SearchInput + results + no-results + five states; 4) copy `web/search.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test search.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** search only client-side; edit `convex/`; show raw JSON.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/search`, layout TempoShell. Data: `search.query`, `search.recentQueries`. Actions: type → query. States: default, no results (`?results=none`), empty (no query), loading, error, offline. One primary: none. Key copy: EN "What are you looking for?"/HE "מה את מחפשת?"; empty body EN "Type a word or idea you roughly remember. Tempo searches pages, tasks and coach chats."/HE "הקלידי מילה או רעיון שאת זוכרת בערך. Tempo יחפש בדפים, במשימות ובשיחות עם המאמן."; no-results EN "Nothing found for"/HE "לא נמצא כלום עבור"; loading EN "Searching"/HE "מחפש"; error EN "Couldn't search right now."/HE "לא הצלחנו לחפש כרגע."; offline EN "You're offline. Searching pages and tasks on this device; chats return when connected."/HE "אין חיבור כרגע. עדיין מחפשים בדפים ובמשימות שבמכשיר. השיחות יחזרו כשתהיי מחוברת." RTL full mirror; query `dir="auto"`. Breakpoints 390/768/1024/1280. Motion: results ≤250 ms. Full strings = `web/search.html`.
- **TESTS:** Given query "bank" / When type / Then results grouped. Given no match / When search / Then no-results copy. Given empty / When load / Then prompt. Given error / When fail / Then Retry. Playwright: search→results, no-results, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0145 — Screen: Command palette
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0099 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0099.
- **WHY:** components.md §8 (CommandPalette candidate); screen `web/command.html`.
- **GOAL:** The Ctrl K command palette jumps to pages and actions, with an empty recent list state.
- **SCOPE:** `apps/web/app/(tempo)/command/page.tsx` · `apps/web/components/global-search/command-palette.tsx` · `apps/web/e2e/command.spec.ts`.
- **MUTATES:** none (wires `pages.listRecent`, static jump targets, `search.quick`).
- **STEPS:** 1) Graphify code-map of `components/global-search`; 2) implement the palette (dialog + listbox, reusing SlashMenu styling); 3) five states; 4) copy `web/command.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test command.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** duplicate the slash-menu listbox (share one list component); edit `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/command` (dialog over the last page); also the Ctrl K trigger on every TempoShell screen. Data: `pages.listRecent`, static jump targets, `search.quick`. Keyboard: arrows, Enter, Esc; focus returns on close. States: default, empty (no recent pages), loading, error, offline. Key copy: EN "Search or jump to"/HE "חיפוש או מעבר אל"; EN "Type a page, place or action"/HE "הקלידי דף, מקום או פעולה"; EN "Results"/HE "תוצאות"; empty EN "Pages you open will show here."/HE "דפים שתפתחי יופיעו כאן."; error EN "Couldn't load recent pages. Your data is safe; everything below still works."/HE "לא הצלחנו לטעון את הדפים האחרונים. המידע שלך שמור, וכל מה שלמטה עדיין עובד." RTL full mirror. Breakpoints 390/768/1024/1280 (centred dialog ≥768). Motion: open ≤250 ms opacity. Full strings = `web/command.html`.
- **TESTS:** Given recent pages / When open Ctrl K / Then list. Given no recent / When open / Then empty copy. Given type / When keys / Then filtered + arrow + Enter navigates. Given Esc / When press / Then closes + focus returns. Playwright: open→type→navigate, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none.

### TFV2-0146 — Screen: Notifications
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0078, TFV2-0097 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after TFV2-0078 and TFV2-0097.
- **WHY:** screen `web/notifications.html`.
- **GOAL:** Notifications list shows in-app notifications with mark-read, all five states.
- **SCOPE:** `apps/web/app/(tempo)/notifications/page.tsx` · `apps/web/components/notifications-preferences/notifications-client.tsx` · `apps/web/e2e/notifications.spec.ts`.
- **MUTATES:** none (wires `notifications.list`, `notifications.markRead`, `notifications.markAllRead`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement list + mark-read + five states; 4) copy `web/notifications.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test notifications.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** add push/email delivery (conflict #11); edit `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/notifications`, layout TempoShell. Data: `notifications.list`. Actions: `markRead`, `markAllRead`. States: default, empty, loading, error, offline. One primary: "Mark all read". Key copy: EN "Notifications"/HE "התראות"; empty EN "Nothing new. Quiet is good."/HE "אין שום דבר חדש. שקט זה טוב."; empty body EN "When Amit replies, when your week is ready, or when the coach saves something, it shows here."/HE "כשעמית עונה, כשהשבוע שלך מוכן, או כשהמאמן שומר משהו, זה יופיע כאן."; error EN "Couldn't load notifications."/HE "לא הצלחנו לטעון את ההתראות."; offline EN "You're offline. Changes save when you're back."/HE "אין חיבור כרגע. השינויים יישמרו כשתחזרי." RTL full mirror. Breakpoints 390/768/1024/1280. Motion: read-state ≤250 ms. Full strings = `web/notifications.html`.
- **TESTS:** Given 3 notifications / When load / Then 3 rows. Given markRead / When click / Then read. Given markAllRead / When click / Then all read. Given empty / When load / Then empty copy. Playwright: markRead→markAllRead, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** none (in-app only).

### TFV2-0147 — Screen: Nags
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0077, TFV2-0111, TFV2-0112, TFV2-0113, TFV2-0114, TFV2-0115, TFV2-0116 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-60, F-61; screen `web/nags.html`.
- **GOAL:** Nags screen lists the user's phrases and enforces "no accepted phrase → cannot switch on".
- **SCOPE:** `apps/web/app/(tempo)/nags/page.tsx` · `apps/web/components/nags/nags-client.tsx` · `apps/web/e2e/nags.spec.ts`.
- **MUTATES:** none (wires `nags.list`, `nags.addPhrase`, `nags.setEnabled`).
- **STEPS:** 1) Graphify code-map of `components/nags`; 2) wire; 3) implement phrase list + add form + switch + five states; 4) copy `web/nags.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test nags.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** add stock copy or emoji; allow enable with no phrase; edit `convex/`.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/nags`, layout TempoShell. Data: `nags.list`. Actions: `nags.addPhrase`, `nags.setEnabled` (blocked until ≥1 phrase). Components: Form, Field, Textarea, Switch. States: default, empty, loading, error, offline. One primary: "Add phrase". Key copy: EN "Nags"/HE "נדנודים"; EN "Your nags"/HE "הנדנודים שלך"; empty EN "No nags yet."/HE "עוד אין נדנודים."; empty body EN "On any task or habit, choose 'Nag me about this', then write what you'd like to hear. Tempo uses only your words."/HE "בכל משימה או הרגל, בחרי ״לנדנד לי על זה״, ואז כתבי מה היית רוצה לשמוע. Tempo משתמש רק במילים שלך."; EN "Your words"/HE "המילים שלך"; EN "Add phrase"/HE "הוספת משפט"; error EN "Couldn't load nags."/HE "לא הצלחנו לטעון את הנדנודים." RTL full mirror; phrases `dir="auto"`. Breakpoints 390/768/1024/1280. Motion: phrase add ≤250 ms. Full strings = `web/nags.html`.
- **TESTS:** Given a nag with 1 phrase / When load / Then phrase shown. Given enable with no phrase / When try / Then switch disabled. Given add phrase / When submit / Then phrase added + switch enabled. Given empty / When load / Then empty copy. Playwright: add phrase→enable, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** delivery channel beyond in-app — UNKNOWN, Amit answers (conflict #11).

### TFV2-0148 — Screen: Weekly page (with WeekStrip)
- **Stage:** B · **Pass:** 1 · **Depends:** TFV2-0065, TFV2-0095, TFV2-0124 · **Folds-in:** none
- **FOR:** Tempo Flow (`Levidavidspublic/tempo-rhythm`); lane per `factory/SLOTS.md`.
- **WHEN:** after the Depends set.
- **WHY:** PRD F-07 (weekly view); screen `web/weekly-page.html`.
- **GOAL:** The weekly page shows intentions and tasks by day, with a WeekStrip to pick the day.
- **SCOPE:** `apps/web/app/(tempo)/week/[week]/page.tsx` · `apps/web/components/today/weekly-page-client.tsx` · `apps/web/e2e/weekly-page.spec.ts`.
- **MUTATES:** none (wires `pages.getWeekly`, `tasks.listForWeek`, `pages.backlinks`).
- **STEPS:** 1) Graphify code-map; 2) wire; 3) implement WeekStrip + intentions + tasks-by-day + five states; 4) copy `web/weekly-page.html` strings; 5) Playwright; 6) run DONE.
- **DONE:** `CI=1 bunx playwright test weekly-page.spec.ts` → pass at 390/1280, EN/HE.
- **EVIDENCE:** Playwright output + screenshots.
- **DO NOT:** edit `convex/`; hardcode the week; mix weekly view into Today.
- **REPORT:** status / evidence / changed / unknowns / notes for ticket sync.
- **SPEC:** Route `(tempo)/week/[week]` (entry `/week/[isoWeek]`), layout TempoShell. Data: `pages.getWeekly`, `tasks.listForWeek`, `pages.backlinks`. Components: WeekStrip, Section, ListRow. States: default, empty, loading, error, offline. One primary: none. Key copy: EN "Week"/HE "שבוע"; EN "Intentions for this week"/HE "כוונות לשבוע הזה"; EN "Tasks by day"/HE "משימות לפי יום"; empty EN "This week is still open."/HE "השבוע הזה עוד פתוח."; empty body EN "Write one intention, or give one day one small task."/HE "אפשר לכתוב כוונה אחת, או לתת ליום אחד משימה קטנה אחת."; error EN "Couldn't load your week."/HE "לא הצלחנו לטעון את השבוע שלך." RTL: days run RTL per conflict #10; counts `.tp-num`. Breakpoints 390/768/1024/1280. Motion: day select ≤250 ms. Full strings = `web/weekly-page.html`.
- **TESTS:** Given a week / When load / Then WeekStrip + intentions + tasks-by-day. Given select Tuesday / When click / Then that day's tasks highlight. Given empty / When load / Then empty copy. Given error / When fail / Then Retry. Playwright: select day, empty, at 390/1280, EN/HE.
- **NUMBERS:** contrast ≥4.5:1 AA (https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) · target ≥24×24 px (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · INP ≤200 ms / LCP ≤2.5 s / CLS ≤0.1 (https://web.dev/articles/vitals) · motion ≤250 ms (components.md).
- **GATES:** 1 Build/typecheck/lint · 2 own TESTS green · 3 NUMBERS in range · 4 Google style formatting/naming · 5 secret + forbidden-tech scan · 6 scope guard · 7 config guard · 8 never weaken/skip/lower/delete a check.
- **OPEN:** week start — UNKNOWN, Amit answers (conflict #10).
