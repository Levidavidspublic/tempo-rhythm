# WALK — Ordinary sign-in no longer creates a Max grant

Ticket: #1263. Prepared from integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`, 22 October 2026. State: coded; focused tests passed in isolated scratch. Not preview-tested.

Ordinary creation now persists `userType: free`, `entitlementTier: none`, `betaAccess: none`, and pending approval. These are existing database states, not an advertised free plan. No subscription or trial is activated. The existing explicit admin-approved creation path is preserved. Both returning-login paths read subscription state before considering repairs.

Missing fields alone no longer confer access. Historical tester/founder, retired god entitlement, exact old beta placeholder or active lifetime open-signup grant evidence can repair missing entitlement fields. Explicit free/none/basic/pro decisions, inactive/deleted/revoked accounts and independent billing rows prevent that repair. Existing subscription rows are never overwritten except the exact historical beta placeholder, and never when the user has an explicit downgrade. Purchased entitlements are left unchanged.

## Test results (cloud agent sandbox)

Bun: 1.3.9 (`cf6cdbbb`).

| Check | Result |
| --- | --- |
| `bun test convex/lib/entitlements.test.ts` in scratch | PASS: 20 tests, 0 failures, 129 assertions |
| Required install/lint/typecheck/full tests/scans/Playwright/build | UNKNOWN: root must run the mandatory sequence after allocating a checkout |
| Real magic-link login, approval, purchase | UNKNOWN: no live account or provider calls |

The focused suite retains prior regression assertions except the explicit superseded policy assumptions that every new account, wholly missing account fields, or an unsupported missing subscription row grants Max. Seven added cases cover repeated ordinary login, founders/admin approval, active historical grants, old placeholder migration with downgrade precedence, unrelated subscriptions, cancellation and inactive/revoked users.

Two optional scratch lint probes did not execute: the installed Biome rejected an obsolete CLI option, and a root Biome configuration does not exist at the probed path. Neither is a repository lint result; mandatory lint is still UNKNOWN. No configuration or check was weakened.

## Integration notes

- Exactly three source files and one existing test changed; no schema, env, dependency, provider or payment activation changes.
- Protected #1193 overlaps account/auth files. Its PR and branch were not readied, edited, rebased, merged or otherwise changed. Serialize this work with other account writers.
- `approval.ts` currently flips approval status and historically relied on the automatic signup grant. The separately scoped beta-request/approval work must explicitly assign approved beta testers Max. This ticket deliberately does not create that queue or modify approval endpoints.
- Full replacement files are prepared under `account-grants-oct22/`; root owns checkout integration, draft PR publication, CodeRabbit and all merge gates.

Report: `status: blocked` pending required checkout validation; `ticket: #1263`; `evidence: focused suite 20 pass / 0 fail`; `changed: convex/lib/entitlements.ts, convex/auth.ts, convex/users.ts, convex/lib/entitlements.test.ts, scoped evidence`; `unknowns: full checks and live auth`; `notes for ticket sync: separate beta approval grant dependency above`.
