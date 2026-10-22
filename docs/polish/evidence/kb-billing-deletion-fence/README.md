# WALK — account billing deletion fence

Date: 2026-10-22. Ticket #1299. Candidate 2 prepared from integration
`7d1a0f6957852fe9f6d60849e3df9bc7505e90ac`.

Verdict: local mocked lifecycle tests pass. Account deletion now records a
generation and deletion instant that survive the unchanged restore patch. This
does not implement payment recovery, authorize provider access or enable billing.

## Exact source scope and schema delta

- `convex/schema.ts`: only two optional numeric fields on existing users:
  `billingDeletionEpoch` and `billingDeletedAt`. No index/table/other schema change.
- `convex/lib/accountDeletion.ts`: only the existing live-user deletion patch
  changes. A missing epoch becomes 1, valid unsaturated integers advance once,
  saturated/malformed values use Number.MAX_SAFE_INTEGER without blocking privacy
  deletion. Both markers commit with deletedAt/isActive/updatedAt in the same
  existing user patch; deletedCount still counts one user row.
- `convex/lib/billing_deletion_fence.test.ts`: 16 new fictional mocked tests.

`softDeleteUserAccount`'s signature, all child cleanup, subscription deactivation
and missing-user behavior are unchanged. Repeated deletion of an already-deleted
user never changes or fabricates these markers. `signInRestorePatch` is
byte-for-byte unchanged. Restoration patches deletedAt/isActive only and retains
the fence; a subsequent actual deletion advances once even in the same millisecond.

No env, provider, package, handler, route, approval or grant-policy changes. No
real account data, keys, provider requests or deployment. Root owns DECISIONS,
convex-arch admission and serial schema integration with #1262/#1273/#1289.

## Code map and compatibility evidence

Read pinned schema.users, the full account-deletion helper and its existing test.
The auth caller at `convex/auth.ts:115` obtains `signInRestorePatch` and spreads it
into `db.patch`, so unspecified markers remain. No auth caller was edited.

The pinned-base comparison verified:

1. Entire schema source equals the selected integration source plus exactly the
   two optional numeric users validators. Every existing table/field/index is
   byte-for-byte unchanged.
2. Restore helper is byte-for-byte unchanged. All account-deletion source before
   and after the live-user patch is byte-for-byte unchanged.
3. Existing `accountDeletion.test.ts` is byte-for-byte identical to the selected
   integration source. It is a scratch validation input, excluded from publication.

The new schema regression checks both optional numeric fields, every legacy users
validator and all six exact legacy index definitions. It deliberately permits
separately approved additive fields/indexes such as beta requests; the independent
whole-file pinned diff proves this ticket itself adds exactly the two fields.
No existing lifecycle/schema assertions were weakened or edited. #1280 remains
separate and untouched.

## Test results (cloud agent sandbox)

Bun 1.3.9. All fixtures are synthetic in-memory rows. Parent owns the heavy slot;
this worker ran only the permitted lightweight checks below.

| Candidate/check | Result |
| --- | --- |
| 1: `bun test convex/lib/billing_deletion_fence.test.ts` | Exit 0; 16 pass, 0 fail, 102 assertions, 522ms |
| 1: `bun test convex/lib/accountDeletion.test.ts` | Exit 0; 66 pass, 0 fail, 899 assertions, 1.482s |
| 1: scoped Biome lint on the three publication source/test files | Exit 0; 0 errors/warnings |
| 1: pinned-source delta/restore/old-test comparison | Exit 0; all three invariants pass |
| 1: root's minimal strict/noResolve fixture diagnostic | TS2559 at weak-shape-diagnostic.ts:4:9; this is a minimal reproduction, not a full-file/backend typecheck |
| 2: `bun test convex/lib/billing_deletion_fence.test.ts` | Exit 0; 16 pass, 0 fail, 102 assertions, 287ms |
| 2: scoped Biome lint | Exit 0; 0 errors/warnings |

Root identified a concrete weak-type error in candidate 1's fictional Row shape
through a minimal TypeScript reproduction. Candidate 2 adds explicit optional
`deletedAt: number` and `isActive: boolean` lifecycle fields to that test type;
all assertions and product source are unchanged. It reran only the permitted
16 focused tests and scoped lint. The unchanged 66-case lifecycle result still
applies to the identical product source. Two candidates used; no third attempted.
The four-line minimal reproduction is included as `minimal-weak-shape.fixture.txt`.
`minimal-weak-shape.failure.log` is the authentic complete original failure
output, saved by root from tool receipt chunk85aa40 (exit 2, 6.661665806 seconds).
Its command used Bun 1.3.9 and `tsc --noEmit --strict --skipLibCheck --noResolve
--types bun --lib ES2021 weak-shape-diagnostic.ts` with the absolute scratch path.
It establishes the fixture defect only, not a full-file/backend graph result.
Focused/lifecycle/lint/delta logs accompany this report. Scratch validation uses
read-only dependency links to installed packages and existing support modules;
only manifest-listed files are publication candidates.

UNKNOWN: publication-checkout `bun install --frozen-lockfile`, `bun run lint`,
`bun run typecheck`, `bun run test`, forbidden-tech/RAM-only/design-token/notices
checks, local Playwright and build (parent-serialized mandatory gate). No strict
app/Convex graph was run by this worker. Local mock tests do not replace hosted
CI/guards or current CodeRabbit review. Screenshots are not applicable here.

## Frozen source fingerprints

| File | SHA-256 |
| --- | --- |
| convex/schema.ts | e2216e0ae62e9ac55bb056af84bb7b04287f2648d755ad50992d5e334d7d9894 |
| convex/lib/accountDeletion.ts | 212ff6c4840c4db1ec3c57a0c736fa9ef2274670637072c5dee75e6c01c99e28 |
| convex/lib/billing_deletion_fence.test.ts | 63e7e4e1ba481e1e0b6da1aa6187f133cbd7ecd507275954509ec0a640f0d491 |

Unmodified scratch lifecycle test fingerprint:
`1f0fee1cf085b12385c0996f0198d531a1bbeb021f11aaa7ded3919153568bab`.

## Consumer limits

Absence is backward-compatible storage, not proof of no historical deletion.
There is no guessed backfill. Already-restored legacy accounts require a separate
activation migration/recovery contract before payments can be enabled.

Future #1294 consumers must re-read the markers before and after snapshot fetch,
and reject automatic recovery. Provider dispatch/observation time, renewal or
uncancellation is not recovery consent and cannot clear this fence. The marker
preparation itself does not wire or enforce that future billing path.

## Report

status: blocked
ticket: #1299
evidence: 16 new + 66 unchanged lifecycle tests pass; scoped lint and exact source-delta verification pass
changed: schema.ts, accountDeletion.ts, billing_deletion_fence.test.ts, scoped evidence
unknowns: full publication-checkout/hosted gates and current CodeRabbit
notes for ticket sync: root records two optional users fields in DECISIONS; later billing recovery/migration remains held; no scope correction required
