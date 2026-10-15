---
ticket: TEMPO-B01-03
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/carry-over-strip/
depends_on: [TEMPO-B01-01]
contract:
  - api.dayPlans.listCarryOver(args: { beforeMs }) -> Task[]
  - api.dayPlans.moveTaskToDay(args: { taskId, dueAt }) -> Id<"tasks">
  - api.tasks.toggleCompletion(args: { taskId }) -> { taskId, status }
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person whose tasks from earlier days are still open
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… carry-over tasks)"; docs/APP-FLOW.md §2 gap "yesterday's open tasks vanish" and §5 step 3: "'Still open from earlier days' strip: move tasks to today with one tap." PRD §6 "Never shame … no 'overdue!'".
GOAL: a `CarryOverStrip` component on `/today` lists open tasks from earlier days and moves any of them to today with one tap.
SCOPE: apps/web/components/carry-over-strip/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/carry-over-strip/CarryOverStrip.tsx (new, exports `CarryOverStrip`), apps/web/components/carry-over-strip/carryOver.ts (new, pure helpers: `groupByLocalDay(tasks)`, `todayDueAt(now)`), apps/web/components/carry-over-strip/carryOver.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/today/TodayTaskList.tsx`, `apps/web/lib/localDay.ts` and `apps/web/lib/useLocalDayBounds.ts`; adjust to the current code.
2. carryOver.ts: `groupByLocalDay` groups tasks by the local day of `dueAt` (newest first); `todayDueAt(now)` returns a due instant inside today's local day (start of day via `startOfLocalDayMs` from `apps/web/lib/localDay.ts`, plus 9 hours, or `now` if later).
3. CarryOverStrip.tsx (`"use client"`): query `api.dayPlans.listCarryOver` with `{ beforeMs: bounds.startMs }` (gated on auth and `api.users.getProfile`). Render nothing when empty. Heading "Still open from earlier days". Each row: title, a quiet day label ("Thursday"), button "Move to today" calling `api.dayPlans.moveTaskToDay({ taskId, dueAt })`, and a checkbox calling `api.tasks.toggleCompletion`. Rows disappear reactively after the move.
4. Show at most 5 rows with "Show more" for the rest. Copy is neutral: no "overdue", "late", "missed". Use `Button` and `Card` from `apps/web/components/ui/`.
5. Add carryOver.test.ts: grouping across DST/midnight, `todayDueAt` stays inside today.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/carry-over-strip/carryOver.test.ts` passes; lint, typecheck and test green; only contract function names are used.
EVIDENCE: test output; screenshot path of the strip with 2+ rows.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `today/page.tsx`, `TodayScreen.tsx` and the tasks screens
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't use "overdue", "late", "failed" or any shaming copy; don't build a tasks list screen (another batch owns tasks)
REPORT: what changed, what was verified, anything missing from the contract.
