---
ticket: TEMPO-B05-01
batch: B05
loop: f3-2
type: component
lane: claude
browser_test: false
scope:
  - apps/web/proxy.ts
  - apps/web/lib/e2eWiringRoutes.ts
  - tests/e2e/wiring/harness.spec.ts
depends_on: []
contract:
  - "No backend functions."
overlap_test: false
expected_merge: clean
hold: false
---

FOR: the factory's wiring tickets (loop f3-2) and their Playwright smoke specs
WHEN: loop f3-2, first (ticket 0 of the loop: lands on integration with CI only, before the wiring tickets start; no Convex change in this loop)
WHY: CHECKLIST-2026-10-06 §3: none of the F1-F3 components is mounted on its route, and the local Playwright webServer redirects every non-task route to /sign-in, so no smoke spec can see a wired component. The existing dev-only bypass (proxy.ts, core task routes) is the pattern.
GOAL: in dev with both E2E bypass flags set (never in production), the local Playwright webServer opens the wiring routes signed out, so each wiring ticket's smoke spec can assert its component renders.
SCOPE: apps/web/proxy.ts, a new apps/web/lib/e2eWiringRoutes.ts route list, one spec. Size: 2 files plus 1 test.
MUTATES: apps/web/proxy.ts, apps/web/lib/e2eWiringRoutes.ts (new), tests/e2e/wiring/harness.spec.ts (new)
STEPS:
1. Add `E2E_WIRING_ROUTES` (apps/web/lib/e2eWiringRoutes.ts): /plan, /habits, /habits/(.*), /brain-dump, /search, /coach, /settings/profile, /settings/preferences, /settings/nags, /settings/memory, /notifications, /billing, /templates, /templates/(.*), /onboarding.
2. In proxy.ts, extend the existing dev-only bypass (same three conditions: NODE_ENV !== "production", TEMPO_E2E_AUTH_BYPASS === "1", NEXT_PUBLIC_TEMPO_E2E_AUTH_BYPASS === "1") to those routes. Production behaviour is unchanged.
3. tests/e2e/wiring/harness.spec.ts: signed out, `/plan` does not redirect to /sign-in under the local webServer; skips when PLAYWRIGHT_BASE_URL is set (preview stays protected).
4. `bun run lint && bun run typecheck && bun run test && CI=1 bunx playwright test --reporter=line`.
DONE: the harness spec passes locally and in CI; a production build still redirects signed-out visitors (unchanged code path).
EVIDENCE: Playwright output.
DO NOT:
- don't weaken production auth: every new branch is behind the three dev-only conditions
- don't change convex/, package.json, lockfiles, .github/, scripts/factory/, .cursor/, AGENTS.md, docs/
REPORT: what changed, the Playwright output.
