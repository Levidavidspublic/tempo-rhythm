---
ticket: TEMPO-B05-06
batch: B05
loop: f3-2
type: component
lane: claude
browser_test: false
scope:
  - apps/web/app/(tempo)/settings/profile/
  - apps/web/app/(tempo)/settings/preferences/
  - apps/web/app/(tempo)/notifications/
  - apps/web/app/(tempo)/billing/
  - apps/web/components/tempo/Topbar.tsx
  - tests/e2e/wiring/settings-account.spec.ts
depends_on: [TEMPO-B05-01]
contract:
  - "No new backend functions. Components call the APIs named in docs/contracts/B01.md - B04.md."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: signed-in people on their account pages and in the shell greeting
WHEN: loop f3-2 (wiring), after TEMPO-B05-01 (E2E harness) landed on integration
WHY: docs/contracts/B04.md "Hot files": settings/profile -> ProfileForm + DeleteAccountCard (apps/web/components/account/), Topbar -> GreetingName, settings/preferences + notifications -> B04-07 (PreferencesForm, NotificationsList), billing -> BillingPlan. CHECKLIST §3 (#636, #640, #648).
GOAL: /settings/profile shows ProfileForm + DeleteAccountCard, /settings/preferences shows PreferencesForm, /notifications shows NotificationsList, /billing shows BillingPlan, and the shell greeting uses GreetingName.
SCOPE: the route files and the one Playwright spec listed in `scope:` only (route `page.tsx` files are explicitly allowed here).
MUTATES: the four page.tsx files, apps/web/components/tempo/Topbar.tsx, tests/e2e/wiring/settings-account.spec.ts (new)
STEPS:
1. Use apps/web/components/account/ProfileForm.tsx (B04-06), not apps/web/components/settings-profile/ProfileForm.tsx.
2. Mount each component on its route (replace ScaffoldScreen). Add GreetingName to the Topbar where a greeting fits; it must never show the literal 'User'.
3. The E2E harness (TEMPO-B05-01, already on integration) lets the local Playwright webServer open the wired routes signed out, with a placeholder Convex URL. So a component shows its own signed-out, loading or empty state there: assert on something ONLY that component renders (its heading, its signed-out card text, or a `data-testid` you add on the route's wrapper element around it). Never assert on live data.
4. Add tests/e2e/wiring/settings-account.spec.ts: one test per route asserting its component marker.
5. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: the spec passes in CI for the four routes; none renders ScaffoldScreen.
EVIDENCE: Playwright output.
DO NOT:
- don't change convex/ (no backend change is needed; if a function is missing, report `blocked: missing backend <function>`)
- don't change the component folders you mount (they are merged and reviewed; only import them). If a component truly needs a prop or export change, report it instead
- don't change files outside scope: package.json, lockfiles, config, apps/web/proxy.ts, other routes
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't request a Bugbot review; open the PR as a DRAFT (Bugbot reviews the loop's batch PR once)
- don't render raw JSON anywhere (PRD §6)
- don't change apps/web/components/tempo/Sidebar.tsx or apps/web/lib/tempo-nav.ts (TEMPO-B05-07 owns nav entries)
REPORT: what changed, what was verified (paste the Playwright output), anything a component could not do when mounted. 
