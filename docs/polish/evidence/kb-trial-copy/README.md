# WALK — Trial-copy candidate 2, 22 October 2026

Ticket #1281 / draft PR #1285. State: locally tested focused copy, not shipped or browser verified. Publication/full gates remain with root.

## Final changes

Public pricing now states the current rollout truth: Account access currently needs approval. Beta requests wait for approval. The main Sign up or request access link uses the existing /sign-up magic-link route; the header retains /sign-in. This fixes the unchanged rootEntry regression and grants no access. Checkout stays OFF and the UI does not claim a working paid rollout. English and Hebrew remain aligned, with Hebrew machine-drafted for Amit's native read.

Every Basic, Pro and Max card still derives its $1 / three-week trial note from the unchanged catalog, in both billing periods. Monthly $10/$20/$40 and annual $100/$200/$400 remain unchanged. The standalone trial no longer includes the contradictory Everything in Basic bullet; it uses the existing chosen-plan confirmation and no-automatic-payment EN/HE keys. Pro and Max retain their truthful Everything in Basic benefit. No entitlement, catalog, schema, route, environment, provider, package or payment operation changed.

The billing translation overlay uses #1275's final frozen settings parent, SHA256 a35bc3133c961bee453e33a1f475ea13f66767efc91ec92d937da4099190bba0. All nonbilling keys are preserved, including its corrected neutral adminApproval.revokeBody. The only added billing key remains set.billing.planTrial; the existing billing copy changes remain as documented in candidate 1.

## Test results (cloud agent sandbox)

Bun 1.3.9. Candidate 2:

- Existing BillingPlan suite plus its previously added cases: 7 pass, 0 fail, 93 assertions, 1.384s. Six additional assertions cover the restored rollout/link contract and no Basic-only trial claim in English/Hebrew.
- Unchanged rootEntry and global i18n regressions: 16 pass, 0 fail, 2172 assertions, 4.99s. This includes the real installed public-route matcher, isolated public pricing render, all EN/HE keys and forbidden-copy checks.
- Scoped Biome: 4 files checked, no errors or fixes. The actual web Biome configuration was used with explicit config path; no configuration changed.
- Parent dictionary preservation: PASS, all nonbilling values retained.

The initial scratch overlay accidentally split the LocaleProvider context between copied and linked modules: BillingPlan 4 pass/3 fail and rootEntry+i18n 15 pass/1 fail. Those receipts are retained. Only readonly scratch dependency copies/resolution were corrected, not source behavior, tests, checks or deadlines. The corrected overlay uses the published parent rootEntry tests unchanged and one shared LocaleProvider throughout. The published parent i18n source was already byte-identical to the readonly scratch snapshot; an attempted redundant overwrite was denied and left it unchanged.

No browser or full TypeScript graph ran. No real account, email, model, provider or billing request was made.

## Delivery boundary

Publish only the four files in manifest.json and docs/polish/evidence/kb-trial-copy/. Everything else in this scratch directory is dependency snapshots, helper scripts, old candidate backups or test configuration, not deliverables. In particular rootEntry.ts/rootEntry.test.ts/i18n.ts/i18n.test.ts, LocaleProvider, MarketingChrome, settings controls/states and BillingPlan.tsx are readonly validation dependencies and MUST NOT be published.

UNKNOWN: actual 390/1280 EN/HE browser screenshots, rendered focus/touch/overflow behavior, mandatory full install/lint/typecheck/tests/four scans/local Playwright/build, hosted CI, CodeRabbit and guards. Existing SSR checks prove markup/copy, not rendered geometry or live payments.

status: blocked (full validation, browser evidence and review remain)
ticket: #1281
evidence: 23 focused/regression tests pass; scoped lint passes
changed: PublicPricing.tsx, PlanCard.tsx, settings.ts, BillingPlan.test.tsx, scoped evidence
unknowns: full gates and browser/preview behavior
notes for ticket sync: preserve #1275 final settings parent during dependency reconciliation; payment activation remains OFF.
