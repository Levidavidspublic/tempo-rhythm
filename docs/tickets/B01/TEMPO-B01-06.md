---
ticket: TEMPO-B01-06
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/habit-checkin-strip/
depends_on: [TEMPO-B01-01]
contract:
  - api.habits.list(args: {}) -> Habit[]
  - api.habitCheckIns.listForDate(args: { localDate }) -> HabitCheckIn[]
  - api.habitCheckIns.check(args: { habitId, localDate, source, note? }) -> { checkInId, alreadyChecked, currentStreak, longestStreak }
  - api.habitCheckIns.undo(args: { habitId, localDate }) -> { removed, currentStreak, longestStreak }
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person checking in habits from `/today`
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… habit check-ins by local day …)"; docs/APP-FLOW.md §2 "habits can't be checked from the strip yet" and §5 step 4: "Habit strip: check and undo by **local calendar day**". docs/BACKEND-SCHEMA.md §2: "'Checked today' is a rolling 24 h window, not a calendar day". PRD §6: "Streaks are dosing data, never pressure."
GOAL: a `HabitCheckInStrip` component on `/today` shows each habit with a check / undo toggle that works per local calendar day.
SCOPE: apps/web/components/habit-checkin-strip/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/habit-checkin-strip/HabitCheckInStrip.tsx (new, exports `HabitCheckInStrip`), apps/web/components/habit-checkin-strip/checkedState.ts (new, pure: `localDateKey(d)`, `checkedHabitIds(checkIns)`), apps/web/components/habit-checkin-strip/checkedState.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/today/TodayHabitStrip.tsx` and `apps/web/lib/habitCompletedToday.test.ts`; adjust to the current code (the old strip is read-only reference; it stays in place).
2. checkedState.ts: `localDateKey` returns local `YYYY-MM-DD`; `checkedHabitIds` returns a `Set` of habit ids from `HabitCheckIn[]`.
3. HabitCheckInStrip.tsx (`"use client"`): query `api.habits.list` and `api.habitCheckIns.listForDate` with today's `localDate` (re-evaluated across local midnight via `useLocalDayBounds()`), gated on auth and `api.users.getProfile`. Each habit is a toggle button (`aria-pressed`): unchecked calls `api.habitCheckIns.check({ habitId, localDate, source: "today" })`, checked calls `api.habitCheckIns.undo({ habitId, localDate })`. Optimistic state while the mutation runs; revert with a short message on error.
4. Show a neutral streak line per habit ("3 days in a row") only when `currentStreak >= 2`; never show a "streak lost", zero, or broken-streak message. Empty state: "No habits yet. Add one on the Habits page." with a link to `/habits`.
5. Add checkedState.test.ts: local key just before/after midnight, empty list, duplicates.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/habit-checkin-strip/checkedState.test.ts` passes; lint, typecheck and test green; check then reload then undo works against Convex dev (state survives reload).
EVIDENCE: test output; screenshot path of the strip before and after a check.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `TodayHabitStrip.tsx`, `TodayScreen.tsx` and `habits/page.tsx`
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't call `api.habits.completeToday`; don't show "streak lost" or any shaming copy
REPORT: what changed, what was verified, anything missing from the contract.
