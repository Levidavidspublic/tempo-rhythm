---
ticket: TEMPO-B05-02
batch: B05
loop: f3-2
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/app/(tempo)/plan/
  - tests/e2e/wiring/plan.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people planning their day on /plan
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B01.md "Hot files": `apps/web/app/(tempo)/plan/page.tsx`: mount `DayTimeline` and `TimeBlockDialog` (replaces `ScaffoldScreen`). CHECKLIST-2026-10-06 §3 (#625).
GOAL: /plan shows the day timeline for the selected local date and opens TimeBlockDialog to create, edit and delete a time block (replaces ScaffoldScreen).
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: apps/web/app/(tempo)/plan/page.tsx (+ a small client screen file in the same folder if needed), tests/e2e/wiring/plan.spec.ts (new)
STEPS:
1. Read DayTimeline (`localDate`, `onSelectBlock`, `onCreateAt`) and TimeBlockDialog props in apps/web/components/day-timeline/ and apps/web/components/time-block-dialog/.
2. Replace ScaffoldScreen on /plan with a client screen: today's local date (YYYY-MM-DD), DayTimeline, and TimeBlockDialog opened by onCreateAt (create) and onSelectBlock (edit/delete).
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/plan.spec.ts: /plan renders the DayTimeline (and no ScaffoldScreen placeholder).
5. Signed in on your cloud computer if you can (real browser): create, edit and delete a block on /plan.
6. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: plan.spec.ts passes in CI; /plan no longer renders ScaffoldScreen.
EVIDENCE: Playwright output; screenshot of /plan.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
