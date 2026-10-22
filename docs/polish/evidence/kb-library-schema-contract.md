# WALK — Exact Library lifecycle schema compatibility (#1274)

The account-deletion contract now recognizes exactly two approved schema versions: the existing legacy plus four Agent fields, and that same shape plus all four approved optional Library fields. Partial additions, missing legacy or Agent fields, wrong types and unknown fields still fail. No product/schema changes are included.

## Trigger and dependency order

KB-01 PR #1262 at `cfd52008cb3276d75495d1fa1f2220b4718b1c8c` adds `tags`, `archivedAt`, `libraryRevision`, and `libraryReceipts`. Its hosted [Test failure](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39739616610/job/119693404749) exposed the stale exact expectation at `convex/lib/accountDeletion.test.ts:1085`: “conversations gain exactly four optional fields.” That expectation described the four Agent fields and omitted the four approved Library fields.

This compatibility test can land independently on integration before KB-01 is rebased, avoiding a dependency cycle. It does not permit an arbitrary optional field. KB-01's own tests still require its Library functions and fields. Root must reconcile and rerun hosted checks on the resulting exact heads before merging KB-01.

## Exact checks retained and added

- The schema assertion remains `toEqual` against the complete field map. Presence of **any** Library field selects the full approved eight-addition shape; otherwise the exact original four-Agent-field shape is required.
- All three conversation index names and their exact ordered fields remain unchanged in the assertion.
- New negative cases remove every original field, remove each Library field from the complete Library shape, try each Library field alone, replace Library types with `any?`, change the owner type, and add an unapproved field. Each is rejected.
- The complete nested receipt shape is checked through the existing deep validator helper: required token, requestKey, appliedRevision, undoUntilMs, previous and result objects; each metadata object has exactly optional string-array tags, optional numeric archivedAt and optional numeric deletedAt. The original schema must have none of these four fields. Legacy rows still have exactly the same required fields and need no backfill.
- The new lifecycle fixture runs on both schema versions. Account deletion tombstones the owner's conversation and message, keeps metadata inert and leaves the foreign account/conversation/message exactly unchanged. Restoring the account does not restore the chat or message. When the approved Library API exists, its actual Undo function rejects the old receipt both while the account is deleted and after account restoration. The test requires that API to exist with the Library schema; it does not silently skip a missing implementation.

The fixture includes synthetic future metadata in the existing in-memory database when testing the original schema. It does not claim the original deployed schema accepts new fields; validator compatibility and lifecycle behavior are tested separately. All example rows and receipt labels are fictional.

## Test results (cloud agent sandbox)

Bun **1.3.9**. All **66 original tests are preserved**, plus **3 new tests**. No test skips, subset schema assertions, timeout/configuration edits or provider requests.

| Exact source under test | Command | Result |
| --- | --- | --- |
| Original integration schema/functions, `7d1a0f6957852fe9f6d60849e3df9bc7505e90ac` | `bun test --no-env-file ./convex/lib/accountDeletion.test.ts` | **69 pass, 0 fail, 994 assertions**, one file, 4.36 s |
| Frozen KB-01 schema/conversations/messages, `cfd52008cb3276d75495d1fa1f2220b4718b1c8c` | Same command in scratch with read-only dependency references | **69 pass, 0 fail, 996 assertions**, one file, 14.53 s |
| Full lint/typecheck/test/scans/notices/e2e/build | Mandatory actual-checkout gate | UNKNOWN: awaiting root's validation slot |
| Current-head CI, scope guards and CodeRabbit | Publication/review gate | UNKNOWN: root owns publication and merge |

Initial filter-style Bun invocations also discovered the dependency checkout's unchanged test through a symlink (135 pass, zero failures). The table records subsequent explicit-file runs, which isolate the modified test and verify each schema in a separate completed process.

Final focused output tails:

```text
Original integration:
 69 pass
 0 fail
 994 expect() calls
Ran 69 tests across 1 file. [4.36s]

Frozen KB-01:
 69 pass
 0 fail
 996 expect() calls
Ran 69 tests across 1 file. [14.53s]
```

## Scope and report

Changed: `convex/lib/accountDeletion.test.ts` and this evidence file only. Runtime, schema, environment, package/configuration files, checks and deployments are unchanged. Composer #1258 and active checkouts were not edited during this assignment. Protected PRs #1193 and #1198 were not touched.

```text
status: blocked
ticket: #1274
evidence: focused original and approved Library schema runs -> 69 pass / 0 fail each
changed: convex/lib/accountDeletion.test.ts; docs/polish/evidence/kb-library-schema-contract.md
unknowns: actual-checkout mandatory checks; hosted current-head guards and CodeRabbit
notes for ticket sync: independent compatibility PR first, then reconcile KB-01; exactly two approved schema versions, no partial additions
```
