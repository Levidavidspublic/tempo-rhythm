---
ticket: TEMPO-B01-02
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/day-plan-panel/
depends_on: [TEMPO-B01-01]
contract:
  - api.dayPlans.getForDate(args: { localDate }) -> DayPlan | null
  - api.dayPlans.upsert(args: { localDate, timezone?, intention?, topTaskIds?, energy? }) -> Id<"dayPlans">
  - api.dayPlans.commit(args: { localDate }) -> { dayPlanId, committedAt }
  - api.tasks.listToday(args: { dueFrom, dueTo }) -> Task[]
  - api.dayPlans.listCarryOver(args: { beforeMs }) -> Task[]
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person planning their morning on `/today`
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "daily planner by Sunday morning (day plan, …)"; docs/APP-FLOW.md §5 step 1: "Morning on `/today`: 'Plan for today' panel: intention, top 3 tasks, energy pick, then **This is my day** (commits the day plan)."
GOAL: a `DayPlanPanel` component on `/today` lets the user write an intention, pick up to 3 top tasks and an energy level, and commit the day with "This is my day".
SCOPE: apps/web/components/day-plan-panel/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/day-plan-panel/DayPlanPanel.tsx (new, exports `DayPlanPanel`), apps/web/components/day-plan-panel/dayPlanDraft.ts (new, pure helpers: `toLocalDateKey(d: Date)`, `toggleTopTask(ids, id)` capped at 3), apps/web/components/day-plan-panel/dayPlanDraft.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/today/TodayScreen.tsx`, `TodayEnergyRecommendations.tsx` and `apps/web/lib/useLocalDayBounds.ts`; adjust the plan to the current code (import them read-only for patterns).
2. dayPlanDraft.ts: `toLocalDateKey` returns local `YYYY-MM-DD` (not UTC); `toggleTopTask` adds/removes an id and refuses a 4th.
3. DayPlanPanel.tsx (`"use client"`): subscribe to `api.dayPlans.getForDate` with `{ localDate }` from `useLocalDayBounds()`/`toLocalDateKey`, gated by `useConvexAuth` and `api.users.getProfile` like `TodayScreen`. Fields: intention text input, up to 3 top tasks chosen from `api.tasks.listToday` plus `api.dayPlans.listCarryOver` (checkbox list, label "Pick up to 3"), energy choice low/medium/high. Save changes with `api.dayPlans.upsert` (debounced or on blur). Primary button "This is my day" calls `api.dayPlans.commit`.
4. When the plan is `committed`, render a short read-only note "Your day is set." and an "Edit plan" button that re-enables the fields (upsert keeps it committed). Loading, empty and error states use the existing `Button`, `Card` and `Input` from `apps/web/components/ui/`; mutation errors show a plain sentence with a retry, no shame wording.
5. Add dayPlanDraft.test.ts: local-date key near midnight, 3-task cap, toggle off.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/day-plan-panel/dayPlanDraft.test.ts` passes; lint, typecheck and test green; the panel renders with mock-free Convex hooks only (no new API names beyond the contract).
EVIDENCE: test output; screenshot path of the panel in both draft and committed state (not committed to GitHub if signed in).
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `today/page.tsx` and `TodayScreen.tsx`; mounting is the merge agent's job
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't use "failed", "overdue" or any shaming copy
REPORT: what changed, what was verified, anything missing from the contract.
