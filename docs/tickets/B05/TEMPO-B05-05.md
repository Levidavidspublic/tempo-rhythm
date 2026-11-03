---
ticket: TEMPO-B05-05
batch: B05
loop: f3-2
type: component
lane: claude
browser_test: false
scope:
  - apps/web/app/(tempo)/habits/
  - apps/web/components/habits/
  - apps/web/app/(tempo)/brain-dump/
  - apps/web/app/(tempo)/search/
  - tests/e2e/wiring/habits-braindump-search.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people managing habits, dumping thoughts and searching
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B01.md "Hot files" (habits/page.tsx + HabitsScreen.tsx: mount HabitsLibrary; habits/[id]/page.tsx: mount HabitDetail), B03.md (brain-dump/page.tsx: BrainDumpScreen), B04.md (search/page.tsx: SearchScreen). CHECKLIST §3 (#635, #638, #632, #649).
GOAL: /habits shows HabitsLibrary, /habits/[id] shows HabitDetail, /brain-dump shows BrainDumpScreen and /search shows SearchScreen (all replace scaffolds or old screens).
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: apps/web/app/(tempo)/habits/page.tsx, apps/web/components/habits/HabitsScreen.tsx, apps/web/app/(tempo)/habits/[id]/page.tsx, apps/web/app/(tempo)/brain-dump/page.tsx, apps/web/app/(tempo)/search/page.tsx, tests/e2e/wiring/habits-braindump-search.spec.ts (new)
STEPS:
1. Read HabitsLibrary, HabitDetail (`habitId`), BrainDumpScreen, SearchScreen (reads `?q=`; wrap in Suspense if it uses useSearchParams).
2. Mount each on its route; /habits/[id] passes the awaited `params.id` to HabitDetail. Keep HabitEnergySuggestions if HabitsScreen still uses it.
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/habits-braindump-search.spec.ts: one test per route asserting its component marker.
5. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: the spec passes in CI for all four routes; none renders ScaffoldScreen.
EVIDENCE: Playwright output.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
