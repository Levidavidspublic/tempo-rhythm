# WALK — Explicit beta requests and transactional approval

Ticket #1266. Prepared 22 October 2026. State: coded with focused handler tests; full checkout validation and preview remain UNKNOWN.

Dependency sources: integration `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`, frozen #1212/KB-01 schema at `kb01-oct22/convex/schema.ts`, and #1263 account policy at `account-grants-oct22/convex/lib/entitlements.ts`. Apply this as a stack; the schema replacement contains KB-01's preceding changes.

## Behavior and compatibility

- `approval.requestBetaAccess({})` resolves only the authenticated owner. The request writes a timestamp and updatedAt, never approval, a subscription, a trial or access. A repeated pending request preserves its original timestamp. Anonymous users fail; revoked, deleted or deactivated owners receive unavailable. Existing approved testers receive approved without any write.
- `approval.listBetaRequests({cursor,numItems})` uses the existing admin authorization, requires an integer from 1 to 50, and reads one bounded ascending index page. Filtering unavailable rows happens after pagination; an empty page can have `isDone:false`, and consumers must keep its continuation cursor.
- Existing `setStatus` and internal `setStatusByEmail` signatures remain unchanged. Both call the same transactional decision helper. An explicit outstanding beta request can grant tester/paid/Max and an active lifetime subscription with `source: beta_approval`. The old exact beta placeholder may be replaced; independent subscription rows and founder/purchased entitlements are preserved. Those approvals record betaApprovedAt without rewriting the purchase.
- The administrator's decision consumes betaRequestedAt. Repeated approval therefore cannot issue another grant or undo a later cancellation/downgrade. Pending/revoked decisions consume the request without granting; a revoked user cannot reopen it. Existing admin authorization, ordinary approval paths and unrelated release/backfill functions remain intact.
- Ordinary approval without a beta request changes approval state only. Coordinate rollout with #1263 so the beta request/approval path is available when automatic ordinary signup grants are removed. No beta-request UI is added by this backend ticket.

## DECISIONS — exact schema changes for the shared register

| Table | Change | Compatibility / purpose |
| --- | --- | --- |
| users | Add `betaRequestedAt: v.optional(v.number())` | Timestamp of an outstanding explicit owner request; absent on existing rows, consumed by an admin decision; no backfill |
| users | Add index `by_deletedAt_betaRequestedAt` with fields `["deletedAt", "betaRequestedAt"]` | Query live rows with request timestamp greater than zero, ordered oldest first; bounded native pagination |

No new table, env variable, provider, package, checkout, migration or deployment. Existing betaApprovedAt records approval; existing subscriptionStates stores grant evidence. No unrelated schema changes beyond the frozen KB-01 dependency.

## Test results (cloud agent sandbox)

Bun 1.3.9 (`cf6cdbbb`). `bun test convex/beta_access.test.ts`: **13 pass, 0 fail, 57 assertions**. Four scoped TypeScript files also pass Bun transpilation syntax checks; this is not typecheck.

Tests execute registered request/list/admin mutation handlers with synthetic identities and an in-memory database. Coverage: anonymous and owner isolation, non-admin self/foreign approval refusal, request idempotency, revoked/deleted/deactivated refusal, 50-row indexed pagination and empty-page continuation, explicit one-time Max grant, repeated approval after cancellation, ordinary approval without grant, internal email decision equivalence, rejection, purchased/founder preservation, and existing tester preservation.

Required frozen install, lint, typecheck, full tests, four scans, local Playwright and build: **UNKNOWN pending an allocated checkout and root's serialized validation**. No live account, magic-link, payment, provider or preview operation was performed.

Report: `status: blocked` pending full validation; `ticket: #1266`; `evidence: 13 pass / 0 fail`; `changed: convex/schema.ts, convex/approval.ts, convex/lib/beta_access.ts, convex/beta_access.test.ts, scoped evidence`; `unknowns: full checks and mounted beta request UI`; `notes for ticket sync: rollout and two DECISIONS rows above`.
