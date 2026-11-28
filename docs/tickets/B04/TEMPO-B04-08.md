---
ticket: TEMPO-B04-08
batch: B04
type: component
lane: auto
scope:
  - apps/web/components/billing-plan/
depends_on: [TEMPO-B04-01]
contract:
  - "api.users.getMyPlan(args: {}) -> {plan, status, label, betaAccess, entitlementTier, userType, isBeta} | null"
overlap_test: false
expected_merge: clean
hold: false
---

FOR: signed-in people on /billing
WHEN: batch B04, after TEMPO-B04-01 (backend contract in docs/contracts/B04.md)
WHY: docs/PRD.md §5 "Billing visible: RevenueCat on all surfaces, Polar as web fallback. Billing is never hidden." Batch brief: show the real beta plan only, no checkout. docs/APP-FLOW.md: the price shows "—" until loaded.
GOAL: /billing shows the person's real current plan (for example Beta tester) and status, with no checkout button and no invented price.
SCOPE: apps/web/components/billing-plan/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/billing-plan/BillingPlan.tsx (new), apps/web/components/billing-plan/PlanCard.tsx (new), apps/web/components/billing-plan/BillingPlan.test.tsx (new)
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. `BillingPlan` reads `api.users.getMyPlan`; while undefined show "—" placeholders; null shows a signed-out message.
3. `PlanCard` shows label, status, beta access and a line that beta access is free while Tempo is in beta. No upgrade, pay or checkout control and no link to /checkout.
4. Add a muted note that paid plans arrive after beta. RevenueCat/Polar wiring is not part of this ticket: record it as `UNKNOWN` in the PR.
5. Add or extend one test for the behaviour (apps/web/components/billing-plan/BillingPlan.test.tsx, Vitest + Testing Library, mock `convex/react`).
6. `bun run lint && bun run typecheck && bun run test`.
DONE: the test shows the label from the query renders, "—" shows while loading, and no button or link matching /upgrade|checkout|pay/i exists; checks green.
EVIDENCE: test output; screenshot of /billing.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't touch apps/web/components/payments/, apps/web/app/checkout/ or any RevenueCat/Polar code, and don't show a made-up price
- don't render raw JSON anywhere (PRD §6: the user never sees JSON)
REPORT: what changed, what was verified, anything missing from the contract. Under `notes for ticket sync`: apps/web/app/(tempo)/billing/page.tsx must import `BillingPlan` (hot file, merge agent wires it).
