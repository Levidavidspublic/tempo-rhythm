---
ticket: TEMPO-B02-01
batch: B02
type: data
lane: claude
scope:
  - convex/
depends_on: []
contract:
  - api.calendar_events.update(args: {eventId, title?, startsAtMs?}) -> Id<"calendarEvents">
  - api.calendar_events.remove(args: {eventId}) -> {success, undoUntilMs}
  - api.calendar_events.restore(args: {eventId}) -> {success}
  - api.tasks.remove(args: {taskId}) -> {success, undoUntilMs}   # now soft delete
  - api.tasks.restore(args: {taskId}) -> {success}
  - api.tasks.create / api.tasks.update (+ flexibility, timeEstimate) -> Id<"tasks">
  - api.notes.getSafe(args: {noteId: string}) -> Note | null
  - api.notes.remove(args: {noteId}) -> {success, undoUntilMs}
  - api.notes.restore(args: {noteId}) -> {success}
  - api.focusBlocks.create(args: {startedAtMs, durationMs, label?, taskId?}) -> Id<"focusBlocks">
  - api.focusBlocks.listInRange(args: {startMs, endMs}) -> FocusBlock[]
  - api.focusBlocks.remove(args: {focusBlockId}) -> {success, undoUntilMs}
  - api.focusBlocks.restore(args: {focusBlockId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: the component tickets of batch B02 (TEMPO-B02-02 .. 09)
WHEN: first in the batch; components depend on it
WHY: docs/PRD.md §3 "Broken live" (`/notes/[id]` crash on a bad id #526, `/tracking` focus blocks lost on reload, `/calendar` add #527, `/insights` #528); §5 "Soft delete": "30-day grace. Undo for 5 minutes inside the app; confirm anything external."; §5 "Priority calibration: inelastic vs elastic items — Elastic items reflow around fixed ones."; docs/TRD.md §7.4: "Remaining hard deletes at `5b9675e` are defects: `tasks.remove` ...".
GOAL: provide every function in docs/contracts/B02.md: soft delete + restore for calendar events, tasks, notes and focus blocks, a crash-proof note lookup, a persisted `focusBlocks` table, and a `flexibility` (fixed/elastic) field on tasks.
SCOPE: convex/ only (schema, functions, tests, and the regenerated convex/_generated/). Size: schema.ts, tasks.ts, notes.ts, calendar_events.ts, focusBlocks.ts, lib/softDelete.ts plus tests (the data ticket may exceed 3 files; it is the batch's only convex/ editor).
MUTATES: convex/schema.ts (new `focusBlocks` table with indexes `by_userId`, `by_userId_deletedAt_startedAtMs`; new `v.optional` field `tasks.flexibility`); convex/lib/softDelete.ts (new: `UNDO_WINDOW_MS`, `GRACE_MS`, `undoUntil(deletedAt)`, `isRestorable(deletedAt, now)`); convex/calendar_events.ts; convex/tasks.ts; convex/notes.ts; convex/focusBlocks.ts (new); convex/focusBlocks.test.ts, convex/softDelete.test.ts (new tests); convex/_generated/*.
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for convex/ and the callers of `tasks.remove`, `notes.remove`, `calendarEvents`; adjust the plan to the current code.
2. Schema: add `focusBlocks` and `tasks.flexibility` (`v.optional(v.union(v.literal("fixed"), v.literal("elastic")))`). Every added field is optional (TF-OSS-01 comment in schema.ts).
3. `lib/softDelete.ts`: `UNDO_WINDOW_MS = 5 * 60 * 1000`, `GRACE_MS = 30 * 24 * 60 * 60 * 1000`, pure helpers, unit-tested.
4. calendar_events: add `update`, `remove` (sets `deletedAt` and `updatedAt`, returns `undoUntilMs`), `restore` (only when `deletedAt` is set and within `GRACE_MS`). Trim titles; reject empty. Ownership check on every call.
5. tasks: change `remove` from `ctx.db.delete` to soft delete returning `{ success, undoUntilMs }` (update its `returns` validator); add `restore`; add `flexibility` to `taskReturnValidator`, `create` and `update`; add `timeEstimate` to `create`/`update`. Do not rename or remove other functions.
6. notes: add `getSafe` (arg `v.string()`, `ctx.db.normalizeId("notes", noteId)`, return null for bad id, other user, or deleted); change `remove` to return `{ success, undoUntilMs }`; add `restore`.
7. focusBlocks.ts: `create` (durationMs 1..8h, label trimmed to 120 chars), `listInRange` (throw above 93 days, desc by `startedAtMs`, only `deletedAt === undefined`), `remove`, `restore`.
8. Check `analytics.insightsSummary` (#528): add a test that a brand-new user with zero tasks, habits and goals returns zeros without throwing, and that a call from a non-UTC local-day window is accepted. If it throws, fix it in convex/analytics.ts (add to MUTATES and REPORT).
9. Regenerate and commit `convex/_generated/` (`bunx convex codegen`; needs Convex auth, see AGENTS.md §8.8).
10. Tests for each new function (owner-only access, soft delete hidden from lists, restore within grace, restore refused after 30 days, `getSafe("not-an-id") === null`). Then `bun run lint && bun run typecheck && bun run test`.
11. Note: it deploys to the TEST deployment (ceaseless-dog-617) only on merge, via convex-deploy-test. Never deploy yourself.
DONE: every contract name exists in convex/_generated/api.d.ts with the listed shapes; `bun run test` prints all convex tests passing including focusBlocks.test.ts and softDelete.test.ts; lint and typecheck green.
EVIDENCE: test output; list of contract names -> file:line; REPORT lists hot files touched (schema.ts, tasks.ts, notes.ts, `_generated/`) for the merge agent.
DO NOT:
- don't change files outside convex/
- don't deploy; never touch the live deployment
- don't rename or remove existing functions other tickets use
- don't add a cron or purge job for the 30-day grace; only the restore window check (note any need under `notes for ticket sync`)
- don't add fields that are not `v.optional` to existing tables
REPORT: contract names created, anything that couldn't match the contract and why, whether `insightsSummary` needed a fix.
