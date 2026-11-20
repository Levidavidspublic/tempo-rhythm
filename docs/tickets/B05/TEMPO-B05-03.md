---
ticket: TEMPO-B05-03
batch: B05
loop: f3-2
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/app/(tempo)/today/
  - apps/web/components/today/
  - tests/e2e/wiring/today.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people starting their day on /today
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B01.md "Hot files": `today/page.tsx` and `components/today/TodayScreen.tsx`: mount `DayPlanPanel`, `DayPlanSummary`, `CarryOverStrip`, `HabitCheckInStrip` (replaces `TodayHabitStrip`). CHECKLIST §3 (#633, #643).
GOAL: /today shows DayPlanPanel, DayPlanSummary, CarryOverStrip and HabitCheckInStrip (HabitCheckInStrip replaces TodayHabitStrip).
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: apps/web/components/today/TodayScreen.tsx (and TodayHabitStrip.tsx removal if unused), tests/e2e/wiring/today.spec.ts (new)
STEPS:
1. Read the four components (apps/web/components/day-plan-panel/, day-plan-summary/, carry-over-strip/, habit-checkin-strip/).
2. Mount them in TodayScreen in a calm order (plan panel/summary, carry-over, habits); replace TodayHabitStrip with HabitCheckInStrip. Keep the existing task list, quick add and brain-dump panel working: tests/e2e/task-views-core.spec.ts must still pass (/today uses the local task store under the E2E bypass).
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/today.spec.ts: /today renders HabitCheckInStrip and DayPlanSummary (or DayPlanPanel) markers.
5. Signed in on your cloud computer if you can: commit a day plan, check a habit, reload.
6. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: today.spec.ts and task-views-core.spec.ts pass in CI.
EVIDENCE: Playwright output; screenshot of /today.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
