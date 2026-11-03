---
ticket: TEMPO-B01-07
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/habits-library/
depends_on: [TEMPO-B01-01]
contract:
  - api.habits.list(args: {}) -> Habit[]
  - api.habits.create(args: { name, cadence }) -> Id<"habits">
  - api.habits.update(args: { habitId, name?, cadence? }) -> Id<"habits">
  - api.habitCheckIns.listForDate(args: { localDate }) -> HabitCheckIn[]
  - api.habitCheckIns.check(args: { habitId, localDate, source, note? }) -> { checkInId, alreadyChecked, currentStreak, longestStreak }
  - api.habitCheckIns.undo(args: { habitId, localDate }) -> { removed, currentStreak, longestStreak }
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person managing their habits on `/habits`
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… habit check-ins by local day …)"; docs/APP-FLOW.md §1 `/habits`: "wired · create, check persist; 24-hour window bug" and "`/habits/[id]` … not linked from `/habits`". PRD §6 "Never shame … Streaks are dosing data, never pressure."
GOAL: a `HabitsLibrary` component lists habits, creates and renames them, checks / undoes today by local day, and links each habit to `/habits/[id]`.
SCOPE: apps/web/components/habits-library/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/habits-library/HabitsLibrary.tsx (new, exports `HabitsLibrary`), apps/web/components/habits-library/habitForm.ts (new, pure: `parseHabitName(input)` trims, rejects empty or over 80 chars; `habitHref(id)` returns `/habits/${id}`), apps/web/components/habits-library/habitForm.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/habits/HabitsScreen.tsx`, `apps/web/app/(tempo)/habits/page.tsx` and `apps/web/components/habits/HabitEnergySuggestions.tsx`; adjust to the current code (read-only reference; HabitsScreen stays in place).
2. habitForm.ts: `parseHabitName` and `habitHref` as above.
3. HabitsLibrary.tsx (`"use client"`): `api.habits.list` and `api.habitCheckIns.listForDate` for today's local date (via `useLocalDayBounds()`), gated on auth and `api.users.getProfile`. Add-habit form (name + cadence daily/weekly) calls `api.habits.create`. Each row: toggle button (check → `api.habitCheckIns.check` with `source: "habits"`, undo → `api.habitCheckIns.undo`), the name as a `next/link` to `/habits/[id]`, an inline "Rename" calling `api.habits.update`.
4. Show cadence and a neutral streak line ("4 days in a row", only when `currentStreak >= 2`). No delete button (habit removal needs soft delete, owned by another ticket). Empty state with a one-line prompt to add the first habit.
5. Add habitForm.test.ts: trim, empty, 81 chars, href.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/habits-library/habitForm.test.ts` passes; lint, typecheck and test green; a created habit and its check survive a page reload.
EVIDENCE: test output; screenshot path of the list with one checked habit.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `HabitsScreen.tsx`, `habits/page.tsx` and `HabitEnergySuggestions.tsx`
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't call `api.habits.completeToday` or `api.habits.remove`; don't show "streak lost" or any shaming copy
REPORT: what changed, what was verified, anything missing from the contract.
