---
ticket: TEMPO-FEATURE-PRICING
batch: FEATURE
type: data
lane: astra
wave: 2
browser_test: true
scope:
  - apps/web/app/pricing/page.tsx
  - apps/web/components/marketing-pages/PublicPricing.tsx
  - apps/web/lib/rootEntry.ts
  - apps/web/lib/rootEntry.test.ts
  - docs/polish/evidence/feature-pricing/
depends_on: []
overlap_test: false
expected_merge: clean
hold: false
---

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE. Type data is required by scope-guard for the new route entry; this ticket has no Convex/backend changes.
WHEN: Independent public route; serialize the worktree after the hero ticket. Do not change landing source or protected #1193/#1198. Lead owns the shared register.
WHY: Amit's 21 October request for a tiered pricing page, plain EN/HE copy, flagged provider wiring and no live charges; docs/HARD_RULES.md, DESIGN.md v3.
GOAL: /pricing is public without an auth bypass, shows existing Trial/Basic/Pro/Max monthly/yearly prices, and clearly states that checkout is not enabled. Existing signup/signin links remain usable; no purchase or mock entitlement mutation occurs.
SCOPE: Three implementation files, one existing route-guard test, evidence metadata only. PublicPricing contains its bounded EN/HE copy; reuse existing translated PlanCard/billing keys and price catalog. No protected i18n.ts registration edit.
MUTATES: Public route /pricing and its exact public-route allowlist entry; no auth policy, backend, schema, keys, environment, payment state or dependency changes.
CONTRACT: Pure TIERS/tierPrice/formatUsd helpers from apps/web/lib/settings/billing.ts, existing PlanCard props, LocaleProvider and LanguageSwitch. PAYMENT_SYSTEM_ENABLED=false stays unchanged. No provider request, purchase handler, webhook or mutation is called.
STEPS:
1. Read rootEntry.ts and its public-route tests, app root gates, BillingPlan/PlanCard, settings/billing.ts, appConfig.ts and marketing locale/header patterns. Confirm /pricing is absent and the protected routes remain protected.
2. Add a thin route and real PublicPricing view. Add only exact /pricing to the public allowlist. Reuse existing pricing calculations, token classes and locale handling. Display annual totals honestly, including the unchanged three-week trial.
3. Include plain checkout-off and approved-beta copy without claiming regular paid admission already works. Link only existing signup/signin routes. Draft Hebrew uses plural/impersonal forms and is marked for native read in evidence.
4. Preserve every existing rootEntry.test.ts assertion, updating its exact allowlist expectation for /pricing. Add public-pricing and protected-subpath cases. With a bounded local browser evidence run, test signed-out /pricing without auth bypass, unchanged protected-route behavior, exact monthly/yearly values, English/Hebrew, RTL, keyboard focus,390/1280 widths, no horizontal scroll and no checkout/provider/mutation traffic. Capture fictional/no-account screenshots.
5. Run Bun1.3.9 and all AGENTS mandatory checks; retain every assertion, deadline and check. Report failures/UNKNOWN exactly. No route-level auth bypass or new test skip.
DONE: Scoped routing tests and actual local browser interaction checks pass and all current CI/review/guards pass before integration merge. Lint0errors,typecheck5/5,test0fail,all four scans/notices,local Playwright/build outcomes recorded. Public prices are not evidence of operational paid admission or preview deployment.
EVIDENCE: docs/polish/evidence/feature-pricing/ contains source commit, result table/failure tails and before/after route captures en/he390/1280. No real account data.
DO NOT: No Convex, package/lock/config/global styling changes; no payment enablement, mockupgrade, provider call, live charge, new env/key, deploy or default/production push. No invented price or Premium tier mapping. No protected PR/source changes. No rawcolors/px outside tokens; honor reducedmotion, one main/h1,44px phone controls, RTL and non-shaming copy.
REPORT: One draft PR into integration with Closes issue and AGENTS report. Lead updates OVERNIGHT-REPORT.md.
