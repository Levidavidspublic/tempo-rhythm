---
ticket: TEMPO-B05-08
batch: B05
loop: f3-2
type: component
lane: claude
browser_test: false
scope:
  - apps/web/app/(tempo)/templates/
  - apps/web/app/(bare)/templates/
  - apps/web/app/(bare)/onboarding/
  - tests/e2e/wiring/templates-onboarding.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: people using templates and new people onboarding
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B04.md "Hot files": templates/page.tsx -> TemplatesLibrary; (bare)/templates/run/[id] -> TemplateRun; (bare)/templates/builder -> TemplateBuilderScreen; templates/editor/[id] -> TemplateEditorScreen; (bare)/onboarding -> OnboardingFlow. CHECKLIST §3 (#628, #631).
GOAL: /templates shows TemplatesLibrary, /templates/builder shows TemplateBuilderScreen (prefilled from ?from=<id>), /templates/editor/[id] shows TemplateEditorScreen, /templates/run/[id] shows TemplateRun, and /onboarding shows OnboardingFlow.
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: the five page.tsx files, tests/e2e/wiring/templates-onboarding.spec.ts (new)
STEPS:
1. Read TemplatesLibrary, TemplateBuilderScreen (`fromId`), TemplateEditorScreen (`templateId`), TemplateRun (`templateId`), OnboardingFlow.
2. Mount each on its route; builder reads `searchParams.from`; [id] routes pass the awaited `params.id`. Leave /templates/sketch alone.
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/templates-onboarding.spec.ts: one test per route asserting its component marker.
5. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: the spec passes in CI for all five routes; none renders ScaffoldScreen.
EVIDENCE: Playwright output.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
