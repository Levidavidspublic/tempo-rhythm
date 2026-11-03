---
ticket: TEMPO-B01-09
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/day-plan-summary/
depends_on: [TEMPO-B01-01]
contract:
  - api.dayPlans.getForDate(args: { localDate }) -> DayPlan | null
  - api.timeBlocks.listForDate(args: { localDate }) -> TimeBlock[]
  - api.timeBlocks.setStatus(args: { timeBlockId, status }) -> Id<"timeBlocks">
  - api.tasks.listToday(args: { dueFrom, dueTo }) -> Task[]
  - api.tasks.toggleCompletion(args: { taskId }) -> { taskId, status }
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person who has committed their day and returns to `/today` during it
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "daily planner … (day plan, time blocks, … carry-over tasks)"; docs/APP-FLOW.md §5 steps 1–2: after "This is my day" commits the plan, the day's top 3 and time blocks are what the person works from; "tick a block done or let it go ('skipped' is neutral)". PRD §5 "daily … pages".
GOAL: a `DayPlanSummary` component on `/today` shows the committed day plan (intention, top 3 tasks, energy) and the next time blocks, with one-tap done on tasks and blocks.
SCOPE: apps/web/components/day-plan-summary/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/day-plan-summary/DayPlanSummary.tsx (new, exports `DayPlanSummary`), apps/web/components/day-plan-summary/nextBlocks.ts (new, pure: `pickNextBlocks(blocks, nowMinute, limit = 3)` returns the in-progress block plus upcoming `planned` blocks; `planProgress(topTasks)` returns `{ done, total }`), apps/web/components/day-plan-summary/nextBlocks.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/today/TodayGreeting.tsx`, `TodayTaskList.tsx` and `apps/web/lib/useLocalDayBounds.ts`; adjust to the current code.
2. nextBlocks.ts: `pickNextBlocks` ignores `done` and `skipped` blocks, includes a block whose range contains `nowMinute`, orders by `startMinute`; `planProgress` counts done top tasks.
3. DayPlanSummary.tsx (`"use client"`): query `api.dayPlans.getForDate`, `api.timeBlocks.listForDate` and `api.tasks.listToday` for today's local date/bounds (gated on auth and `api.users.getProfile`). Render nothing unless the plan is `committed`. Show the intention as a quote line, the top 3 tasks (titles resolved from `topTaskIds`; ids not in today's list are shown only if present, otherwise skipped) each with a checkbox calling `api.tasks.toggleCompletion`, the energy label, and "2 of 3 done" progress text.
4. Under it, "Up next": up to 3 blocks from `pickNextBlocks` with time range and buttons "Done" / "Let it go" calling `api.timeBlocks.setStatus`. Neutral copy only; when nothing is left: "Nothing else is planned for today."
5. Add nextBlocks.test.ts: in-progress block included, done/skipped excluded, limit, progress count.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/day-plan-summary/nextBlocks.test.ts` passes; lint, typecheck and test green; only contract function names are used.
EVIDENCE: test output; screenshot path of the summary with 3 top tasks and 2 upcoming blocks.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `today/page.tsx`, `TodayScreen.tsx` and `TodayGreeting.tsx`
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't build the plan editing form (TEMPO-B01-02) or the timeline (TEMPO-B01-04); don't use "failed", "overdue" or shaming copy
REPORT: what changed, what was verified, anything missing from the contract.
