---
ticket: TEMPO-B05-04
batch: B05
loop: f3-2
type: component
lane: cursor
browser_test: true
scope:
  - apps/web/app/(tempo)/coach/
  - apps/web/components/coach/
  - tests/e2e/wiring/coach.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people using the coach on /coach
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B03.md "Hot files": `coach/page.tsx`: render `CoachChat` plus `CoachControls`, `CoachProposalCard`, `CrisisResourcesCard`; make `CoachChat` render `CrisisResourcesCard` for a crisis reply. CHECKLIST §3 (#637, #644, #647).
GOAL: /coach shows CoachControls (dial 0-10 + panic) and CoachProposalCard next to CoachChat, and CoachChat shows CrisisResourcesCard (via useCrisisGuard) for a crisis message instead of coaching.
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: apps/web/app/(tempo)/coach/page.tsx, apps/web/components/coach/CoachChat.tsx, tests/e2e/wiring/coach.spec.ts (new)
STEPS:
1. Read apps/web/components/coach-controls/, coach-proposal/, coach-crisis/ (CrisisResourcesCard, useCrisisGuard, crisisCopy).
2. coach/page.tsx: CoachControls + CoachProposalCard + CoachChat. CoachChat: run useCrisisGuard on the outgoing message; on a crisis match show CrisisResourcesCard and do not send coaching. Keep tests/e2e/screens/coach.spec.ts selectors working (heading Coach, label Message).
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/coach.spec.ts: /coach renders the dial/panic controls and the proposal card markers.
5. Signed in on your cloud computer if you can: set the dial, reload, press panic; type a crisis phrase.
6. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: coach.spec.ts passes in CI; a unit test or the spec shows the crisis path renders CrisisResourcesCard.
EVIDENCE: Playwright output; screenshot of /coach.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
