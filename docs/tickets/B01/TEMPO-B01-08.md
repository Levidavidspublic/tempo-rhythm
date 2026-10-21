---
ticket: TEMPO-B01-08
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/habit-detail/
depends_on: [TEMPO-B01-01]
contract:
  - api.habits.get(args: { habitId }) -> Habit | null
  - api.habitCheckIns.listForHabit(args: { habitId, fromLocalDate, toLocalDate }) -> HabitCheckIn[]
  - api.habitCheckIns.check(args: { habitId, localDate, source, note? }) -> { checkInId, alreadyChecked, currentStreak, longestStreak }
  - api.habitCheckIns.undo(args: { habitId, localDate }) -> { removed, currentStreak, longestStreak }
  - api.habits.update(args: { habitId, name?, cadence? }) -> Id<"habits">
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person opening one habit from `/habits`
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… habit check-ins by local day …)"; docs/APP-FLOW.md §1 `/habits/[id]`: "placeholder · not linked from `/habits`" and §5 step 4: "`/habits/[id]` shows a 6-week grid." PRD §6 "Never shame … Streaks are dosing data, never pressure."
GOAL: a `HabitDetail` component for `/habits/[id]` shows the habit's name, cadence, current and longest streak, and a 6-week grid of check-in days that can be toggled.
SCOPE: apps/web/components/habit-detail/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/habit-detail/HabitDetail.tsx (new, exports `HabitDetail` with prop `habitId: string`), apps/web/components/habit-detail/sixWeekGrid.ts (new, pure: `buildSixWeekGrid(today: Date, checkedDates: Set<string>)` returns 6 rows x 7 cells `{ localDate, checked, isFuture, isToday }`, weeks starting Monday), apps/web/components/habit-detail/sixWeekGrid.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/app/(tempo)/habits/[id]/page.tsx` (scaffold, read-only), `apps/web/lib/localDay.ts` and `apps/web/components/habits/HabitsScreen.tsx`; adjust to the current code.
2. sixWeekGrid.ts: the grid ends with the week containing `today` (Monday start, matching `startOfLocalWeekMondayMs`) and covers 42 days; dates are local `YYYY-MM-DD`; days after today are `isFuture`.
3. HabitDetail.tsx (`"use client"`): cast `habitId` to `Id<"habits">`; query `api.habits.get` and `api.habitCheckIns.listForHabit` over the grid's first and last local date, gated on auth and `api.users.getProfile`. Render name, cadence, "Current streak" and "Longest streak" numbers, and the grid. Clicking a past or today cell toggles it with `api.habitCheckIns.check` (`source: "habits"`) / `api.habitCheckIns.undo`; future cells are disabled. Inline rename via `api.habits.update`.
4. `get` returning `null` renders "This habit isn't here any more." with a link back to `/habits`. Unchecked days are plain empty cells, never red or marked as misses. Cells are buttons with accessible labels ("Tuesday 6 October, checked").
5. Add sixWeekGrid.test.ts: 42 cells, Monday start, future flag, checked dates applied, month boundary.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/habit-detail/sixWeekGrid.test.ts` passes; lint, typecheck and test green; toggling a cell persists after reload.
EVIDENCE: test output; screenshot path of the 6-week grid.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `habits/[id]/page.tsx`
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't call `api.habits.completeToday` or `api.habits.remove`; don't show "streak lost", "missed" or any shaming copy; don't build insights or tracking charts (other batches own them)
REPORT: what changed, what was verified, anything missing from the contract.
