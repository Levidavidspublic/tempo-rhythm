---
ticket: TEMPO-B01-01
batch: B01
type: data
lane: claude
scope:
  - convex/
depends_on: []
contract:
  - api.dayPlans.getForDate(args: { localDate }) -> DayPlan | null
  - api.dayPlans.upsert(args: { localDate, timezone?, intention?, topTaskIds?, energy? }) -> Id<"dayPlans">
  - api.dayPlans.commit(args: { localDate }) -> { dayPlanId, committedAt }
  - api.dayPlans.listCarryOver(args: { beforeMs }) -> Task[]
  - api.dayPlans.moveTaskToDay(args: { taskId, dueAt }) -> Id<"tasks">
  - api.timeBlocks.listForDate(args: { localDate }) -> TimeBlock[]
  - api.timeBlocks.create(args: { localDate, title, startMinute, durationMinutes, startsAtMs, endsAtMs, kind, taskId?, habitId? }) -> Id<"timeBlocks">
  - api.timeBlocks.update(args: { timeBlockId, title?, startMinute?, durationMinutes?, startsAtMs?, endsAtMs?, kind? }) -> Id<"timeBlocks">
  - api.timeBlocks.setStatus(args: { timeBlockId, status }) -> Id<"timeBlocks">
  - api.timeBlocks.remove(args: { timeBlockId }) -> { success: true }
  - api.habitCheckIns.listForDate(args: { localDate }) -> HabitCheckIn[]
  - api.habitCheckIns.listForHabit(args: { habitId, fromLocalDate, toLocalDate }) -> HabitCheckIn[]
  - api.habitCheckIns.check(args: { habitId, localDate, source, note? }) -> { checkInId, alreadyChecked, currentStreak, longestStreak }
  - api.habitCheckIns.undo(args: { habitId, localDate }) -> { removed, currentStreak, longestStreak }
  - api.habits.get(args: { habitId }) -> Habit | null
overlap_test: false
expected_merge: clean
hold: false
---

FOR: the component tickets of batch B01 (TEMPO-B01-02 … TEMPO-B01-09)
WHEN: first in the batch; components depend on it
WHY: docs/PRD.md §4.1 "Added 3 Oct: Tempo should work as a **daily planner by Sunday morning** (day plan, time blocks, habit check-ins by local day, carry-over tasks)"; §5 "daily / weekly / monthly pages" (daily only); §6 "Never shame … Streaks are dosing data, never pressure". Tables: docs/BACKEND-SCHEMA.md §3 (`dayPlans`, `timeBlocks`, `habitCheckIns`); flow: docs/APP-FLOW.md §5.
GOAL: provide every function in docs/contracts/B01.md, backed by the additive tables `dayPlans`, `timeBlocks` and `habitCheckIns`.
SCOPE: convex/ only (schema, functions, and the regenerated convex/_generated/). Size: new modules plus one test each; this is the batch's only backend ticket.
MUTATES: convex/schema.ts (three new tables with the indexes from docs/BACKEND-SCHEMA.md §3; no existing field changed), convex/dayPlans.ts (new), convex/timeBlocks.ts (new), convex/habitCheckIns.ts (new), convex/habits.ts (add `get` only), convex/lib/accountDeletion.ts (add the three tables to `USER_OWNED_TABLES`), convex/lib/habitCheckInStreak.ts (new, pure streak math), convex/dayPlans.test.ts, convex/lib/habitCheckInStreak.test.ts, convex/_generated/.
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`) for convex/schema.ts, convex/habits.ts, convex/lib/habitStreak.ts and convex/lib/accountDeletion.ts; confirm no other open PR is editing convex/schema.ts.
2. Schema (additive; every new field optional or on a new table): `dayPlans` (userId, localDate, timezone?, intention?, topTaskIds? max 3, energy?, status draft|committed, committedAt?, reflection?, createdAt, updatedAt, deletedAt?; indexes `by_userId`, `by_userId_deletedAt`, `by_userId_deletedAt_localDate`); `timeBlocks` (fields per BACKEND-SCHEMA §3; indexes `by_userId`, `by_userId_deletedAt`, `by_userId_deletedAt_localDate`, `by_userId_deletedAt_startsAtMs`, `by_taskId`); `habitCheckIns` (habitId, localDate, checkedAt, source habits|today|suggestion|legacy, note?, timestamps, deletedAt?; indexes `by_userId`, `by_userId_deletedAt_localDate`, `by_habitId_deletedAt_localDate`). Add the three names to `USER_OWNED_TABLES` in convex/lib/accountDeletion.ts.
3. convex/dayPlans.ts: `getForDate`, `upsert` (one live plan per user per `localDate`, enforced inside the mutation; reject more than 3 `topTaskIds` or ids the caller does not own; never moves `committed` back to `draft`), `commit` (idempotent), `listCarryOver` (open tasks with `dueAt < beforeMs`, max 50, ascending `dueAt`), `moveTaskToDay` (patch `dueAt`, `updatedAt` only; owner check). Use `requireUser`; return validators on every function.
4. convex/timeBlocks.ts: `listForDate`, `create` (validate `startMinute` 0–1439, `durationMinutes` 5–720, `endsAtMs > startsAtMs`, non-empty trimmed title; set `dayPlanId` if a plan exists for that date), `update`, `setStatus`, `remove` (soft delete). Owner check on every id.
5. convex/habitCheckIns.ts with pure math in convex/lib/habitCheckInStreak.ts: `listForDate`, `listForHabit`, `check` (one live row per habit per `localDate`; second call returns `alreadyChecked: true`), `undo` (soft delete the row). After each, recompute the habit's `currentStreak`, `longestStreak`, `lastCompletedAt` from live check-ins (daily cadence = consecutive local dates ending today or yesterday; never negative, never a "lost" state) and patch the `habits` row. Add `habits.get` to convex/habits.ts (owner + `deletedAt` filter, returns `null` otherwise). Leave `habits.completeToday` untouched.
6. Regenerate and commit `convex/_generated/` (`bunx convex codegen`; needs Convex auth, see AGENTS.md §8.8).
7. Tests: convex/lib/habitCheckInStreak.test.ts (consecutive days, gap, undo, same-day idempotence) and convex/dayPlans.test.ts (upsert uniqueness, >3 top tasks rejected, carry-over filter). Add a hot-file note in REPORT for the merge agent (contract "Hot files").
8. `bun run lint && bun run typecheck && bun run test`.
9. Note: it deploys to the TEST deployment (ceaseless-dog-617) only on merge, via convex-deploy-test. Never deploy yourself.
DONE: every contract name exists in convex/_generated/api.d.ts with the listed shapes (`grep -c "dayPlans\|timeBlocks\|habitCheckIns" convex/_generated/api.d.ts` is non-zero); `bun test convex/lib/habitCheckInStreak.test.ts convex/dayPlans.test.ts` passes; lint, typecheck and test are green.
EVIDENCE: test output; list of contract names → file:line.
DO NOT:
- don't change files outside convex/
- don't deploy; never touch the live deployment
- don't rename or remove existing functions other tickets use
- don't add a hard delete (`ctx.db.delete`) anywhere; don't change `habits.completeToday` or any existing table's fields
- don't add tables or functions for calendar edit, tasks list, notes, tracking, focus sessions, inbox, coach or nags (other batches own them)
REPORT: contract names created, anything that couldn't match the contract and why; the hot files the merge agent must wire (docs/contracts/B01.md → "Hot files for the merge agent").
