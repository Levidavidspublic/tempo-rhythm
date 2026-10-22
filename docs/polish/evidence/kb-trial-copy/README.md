# WALK — Trial-copy preparation, 22 October 2026

Ticket #1281 (TEMPO-KB-TRIAL-COPY), stacked on pricing PR #1220 at `97dcc874460568a89152fad0ae5f85ef4132d6b0` and serialized after #1275's settings translations. This is preparation, not a shipped billing or browser-validation claim.

## Intended deliverables

- `apps/web/components/marketing-pages/PublicPricing.tsx`
- `apps/web/components/billing-plan/PlanCard.tsx`
- `apps/web/lib/i18n-groups/settings.ts` — #1275 frozen candidate 2 plus billing-only delta.
- `apps/web/components/billing-plan/BillingPlan.test.tsx`
- Approved evidence under `docs/polish/evidence/kb-trial-copy/`.

The translation delta is in `translation-delta.json`. The prior owner explicitly froze #1275 candidate 2 before the settings snapshot was copied. Its adminApproval keys and every nonbilling key are preserved, verified against the frozen parent. No active checkout or shared translation source was edited. Dependency snapshots of i18n.ts and BillingPlan.tsx, symlinked dependencies and test-resolution.json are scratch harness files only, not deliverables.

## Behavior

Every Basic, Pro and Max card gains a trial note derived from the unchanged catalog's trial price and duration, for both monthly and annual display. The amount is isolated with bdi for Hebrew/RTL. Existing prices stay $1 for three weeks, $10/$20/$40 monthly and $100/$200/$400 annually. No catalog number, feature entitlement or billing operation changes.

The trial description no longer promises that every trial becomes Basic. Checkout copy explicitly says payments are unavailable and no details are collected here; the old unsupported payment-provider claim is removed. The public account link uses the existing /sign-in route. Beta requests await approval; approved beta testers and existing testers get Max free. This is not a marketed free plan or self-approval control.

No new component, CSS file, raw color, pixel value, route, backend, schema, package, environment variable, provider ID or network payment action. Existing card and responsive classes are reused. Payment controls remain absent; billing-period buttons only change the display.

## Validation / limitations

PASS: the isolated BillingPlan suite reports 7 pass, 0 fail, 87 assertions in 1263 ms, using Bun 1.3.9. This is the first actual test run and candidate 1: the original 2 tests plus 5 new cases. Coverage includes early-access/paid-plan/loading states, per-plan trial notes in both billing periods, unchanged catalog amounts, standalone trial, public copy/links, Hebrew/RTL amount isolation and OFF checkout. Translation verification confirms only the 9 intended billing keys per language changed and no adminApproval/nonbilling key changed. Two initial scratch harness invocations failed before tests ran (typed Hebrew-export boundary and Bun tsconfig override invocation); only scratch preparation scripts/configuration were corrected, not checks or source behavior.

UNKNOWN: actual browser evidence at 390 and 1280 px in English/Hebrew, overflow, target sizes, focus painting, and inherited reduced-motion behavior. Static markup tests do not prove rendered geometry. Root must allocate the gallery/screenshot slot and take fictional-data screenshots; do not edit routes or e2eWiringRoutes.ts for evidence.

UNKNOWN: mandatory actual-checkout Bun install, full lint/typecheck/tests, four scans, Playwright/build, hosted CI, CodeRabbit and guards. Root owns publication and review. Hebrew copy is machine-drafted in plural/impersonal forms and remains for Amit's native read; no live account or billing provider was contacted.
