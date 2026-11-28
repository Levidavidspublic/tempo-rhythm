---
ticket: TEMPO-B01-05
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/time-block-dialog/
depends_on: [TEMPO-B01-01]
contract:
  - api.timeBlocks.create(args: { localDate, title, startMinute, durationMinutes, startsAtMs, endsAtMs, kind, taskId?, habitId? }) -> Id<"timeBlocks">
  - api.timeBlocks.update(args: { timeBlockId, title?, startMinute?, durationMinutes?, startsAtMs?, endsAtMs?, kind? }) -> Id<"timeBlocks">
  - api.timeBlocks.remove(args: { timeBlockId }) -> { success: true }
  - api.tasks.listToday(args: { dueFrom, dueTo }) -> Task[]
  - api.habits.list(args: {}) -> Habit[]
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person who wants to put a task, habit or focus session into a time slot
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… time blocks …)"; docs/BACKEND-SCHEMA.md §3 `timeBlocks` (`startMinute` 0–1439, `durationMinutes` 5–720, `kind` focus/task/habit/break/other). PRD §4.1 A4: "Every control on every signed-in screen works".
GOAL: a `TimeBlockDialog` component creates, edits and deletes a time block, optionally linked to a task or a habit.
SCOPE: apps/web/components/time-block-dialog/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/time-block-dialog/TimeBlockDialog.tsx (new, exports `TimeBlockDialog` with props `open`, `onOpenChange`, `localDate`, `initialStartMinute?`, `block?` (edit mode)), apps/web/components/time-block-dialog/blockForm.ts (new, pure: `parseBlockForm(input)` returns `{ ok: true, value } | { ok: false, errors }` and computes `startsAtMs`/`endsAtMs` from the local date), apps/web/components/time-block-dialog/blockForm.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/ui/dialog.tsx`, `input.tsx`, `label.tsx` and `apps/web/components/today/TodayQuickAdd.tsx`; adjust to the current code.
2. blockForm.ts: inputs title, `HH:MM` start, duration in minutes, kind, optional task/habit id. Validate: title non-empty after trim, duration 5–720, start 00:00–23:59, block must not cross local midnight. Build `startsAtMs` with `new Date(y, m, d, h, min)` from `localDate` (local time, not UTC).
3. TimeBlockDialog.tsx (`"use client"`): built on `Dialog` from `apps/web/components/ui/dialog.tsx`. Fields: title, start time, duration (quick buttons 15/30/60/90), kind select, optional "Link a task" (from `api.tasks.listToday`) and "Link a habit" (from `api.habits.list`). Create mode calls `api.timeBlocks.create`; edit mode calls `api.timeBlocks.update` and shows a "Delete block" button calling `api.timeBlocks.remove` after an inline confirm.
4. Show field errors inline; on a server error show one plain sentence and keep the dialog open. Close on success. Focus goes to the title field on open; Escape closes.
5. Add blockForm.test.ts: valid block, bad duration, midnight crossing, `startsAtMs` for a given local date.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/time-block-dialog/blockForm.test.ts` passes; lint, typecheck and test green; only contract function names are used.
EVIDENCE: test output; screenshot path of the dialog in create and edit mode.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `plan/page.tsx` and `apps/web/components/ui/`
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't build the timeline itself or any calendar event editor (other tickets/batches own them)
REPORT: what changed, what was verified, anything missing from the contract.
