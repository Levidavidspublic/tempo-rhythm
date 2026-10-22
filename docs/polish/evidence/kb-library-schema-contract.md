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
| Full lint/typecheck/test/scans/notices/e2e/build | Frozen actual-checkout gate below | FAIL: full test and local E2E; install/lint/typecheck/scans/build passed |
| Current-head CI, scope guards and CodeRabbit | Publication/review gate | Root reported clear on frozen source head; evidence-only head reconciliation remains pending |

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

## Actual-checkout mandatory validation — 22 October 2026 UTC

**WALK — blocked: the scoped lifecycle suite passed all 69 cases, but the full test command and exact local E2E command failed.** No failures were repaired or commands repeated. The mandatory run used frozen source [`c8cd3e88eb94073f2552212c456b0ca3ba85dbd1`](https://github.com/Levidavidspublic/tempo-rhythm/commit/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1); [the scoped test](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/convex/lib/accountDeletion.test.ts) blob remained `5cefc4b74e29e1d488dc316f9b08f99d89f7d34a`, and `bun.lock` remained `aaa67ac9516b6a324de35af1771b3d1524713d19` throughout.

Bun **1.3.9**, existing local Chromium/cache, synthetic local E2E configuration only. No live URL, storage-state account, credentials, configuration or deadline changes. Every required command ran exactly once in the prescribed order. Root paused between static checks and full tests for the shared browser slot. A transient agent capacity interruption did not interrupt the original command: its original session completed and supplied the authoritative aggregate below.

| Exact command | Result | Start → end (UTC) |
| --- | --- | --- |
| `bun install --frozen-lockfile` | PASS — exit 0; 1033 installs checked across 1079 packages, no changes, 312.84 s | 2026-10-22T08:42:51Z → 2026-10-22T08:48:04Z |
| `bun run lint` | PASS — exit 0; 5/5 tasks cached, 9 existing warnings, 389 ms | 2026-10-22T08:48:11Z → 2026-10-22T08:48:12Z |
| `bun run typecheck` | PASS — exit 0; 5/5 tasks cached, 350 ms | 2026-10-22T08:48:17Z → 2026-10-22T08:48:18Z |
| `bun run test` | FAIL — exit 1; 3484 pass / 12 fail / 3 todo, 81482 assertions; 3499 tests / 211 files, 968.08 s. Scoped accountDeletion file: 69 pass / 0 fail | 2026-10-22T08:53:51Z → 2026-10-22T09:09:59Z |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS — exit 0; all four scans/checks OK; 66 documented dependencies | 2026-10-22T09:10:09Z → 2026-10-22T09:10:11Z |
| `CI=1 bunx playwright test --reporter=line` | FAIL — exit 1; 23 pass / 5 fail / 89 skip, 117 cases, 6.7 min | 2026-10-22T09:13:03Z → 2026-10-22T09:19:46Z |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS — exit 0; 1/1 successful cached Turbo task, 1.533 s; no fresh compile claimed | 2026-10-22T09:20:44Z → 2026-10-22T09:20:46Z |

Lint, typecheck and build used the existing Turbo cache; the table records that limitation. The full command completed normally with exit 1; it was not terminated. The 89 E2E skips are the suite's account/live-URL dependent cases under its local mock configuration. The five failed tests remain FAIL; no unverified environmental explanation is substituted.

### Full-test failures and source attribution

- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > new inline callback identities do not reset an active request [639.40ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > Hebrew recovery has RTL direction and localized action copy [15.99ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > an immediate fulfillment crossing the deadline still schedules post-commit expiry [16.67ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > late successful real detail restoration keeps the parent navigation authoritative [15.42ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [16.11ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [16.04ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [16.03ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [16.05ms]
- [`tests/unit/kb-64.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/tests/unit/kb-64.test.tsx): KB64 Undo recovery > large text wraps and reduced motion has no toast animation [9.45ms]
- [`packages/utils/src/page-summary.test.ts`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/packages/utils/src/page-summary.test.ts): pathological bodies stay linear > closingTagsOpenOnEveryLine [3048.85ms]
- [`apps/web/components/notifications-preferences/PreferencesForm.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/apps/web/components/notifications-preferences/PreferencesForm.test.tsx): preferences and notifications > the coach dial saves 400 ms after it stops moving [5001.11ms]
- [`apps/web/lib/openui/coach-openui.test.tsx`](https://github.com/Levidavidspublic/tempo-rhythm/blob/c8cd3e88eb94073f2552212c456b0ca3ba85dbd1/apps/web/lib/openui/coach-openui.test.tsx): no third-party telemetry > parsing and rendering on a server runtime never calls fetch [6410.97ms]

The nine KB64 failures reported `newPage: Target page, context or browser has been closed`. The other failures were the named linear-performance assertion and two existing 5000 ms timeouts. The telemetry case's timeout is not evidence that a fetch occurred. These paths and observations identify the logged failures, not a verified root cause or permission to repair other tickets. No unchanged reruns were made.

### Exact local E2E failures

```text
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
```

Calendar navigation logged `net::ERR_ABORTED`; the other four cases exceeded their existing 30000 ms deadlines (including the task-view beforeEach). The habits case failed while navigating; this run does not establish a Beta-preview assertion defect. All five failures are retained.

### Failure tails

The following are the original last 20 lines of each failed command, with **only CRLF→LF and trailing spaces/tabs normalized** for Markdown. Raw byte-exact originals, lossless gzip copies and SHA256s remain in scratch. Normalization does not change counts, errors or deadlines.

Full test; original log SHA256 `69b92cc4a98e413136f7fffe9f8ec8ecb5343cac9cc0fd8659076d448d5caf28`:

```text
(fail) KB64 Undo recovery > new inline callback identities do not reset an active request [639.40ms]
(fail) KB64 Undo recovery > Hebrew recovery has RTL direction and localized action copy [15.99ms]
(fail) KB64 Undo recovery > an immediate fulfillment crossing the deadline still schedules post-commit expiry [16.67ms]
(fail) KB64 Undo recovery > late successful real detail restoration keeps the parent navigation authoritative [15.42ms]
(fail) KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [16.11ms]
(fail) KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [16.04ms]
(fail) KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [16.03ms]
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [16.05ms]
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [9.45ms]
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [3048.85ms]
(fail) preferences and notifications > the coach dial saves 400 ms after it stops moving [5001.11ms]
(fail) no third-party telemetry > parsing and rendering on a server runtime never calls fetch [6410.97ms]
  ^ this test timed out after 5000ms.

 3484 pass
 3 todo
 12 fail
 81482 expect() calls
Ran 3499 tests across 211 files. [968.08s]
error: script "test" exited with code 1

```

Exact local E2E; original log SHA256 `7ed1965bf8dd64ea3b18b87f9f3e98eb1c115da3415435770685ca27363b0ff1`:

```text
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:307165) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:307243) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  5 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
  89 skipped
  23 passed (6.7m)

```

### Receipt preservation and process boundary

Scratch receipts: `/workspace/work/overnight/library-schema-contract-gates/c8cd3e8`. Every stage has the exact command, start/end UTC, exit, frozen hashes, Bun version, owner, disk receipts, raw log and last-20 tail. All 56 stage receipt files have verified lossless gzip copies in `raw-gzip/`; `sha256-map.json` maps original and compressed SHA256s. These artifacts stay outside the checkout to respect this ticket's two-file scope.

| Original raw log | SHA256 |
| --- | --- |
| `install.log` | `19b8bb2e4d7fda95db055b9acaf0d481ea37f74b035d8acd07ca606bf22b9a44` |
| `lint.log` | `c1e6e272a666d9cfb6865757f172274acfa0d10cbfeac22e59e50d88be06c990` |
| `typecheck.log` | `09ffda6a0c3cc2c98fc479a4a674cacf65f88d315bd5ad27d45022b9a6d8eef5` |
| `test.log` | `69b92cc4a98e413136f7fffe9f8ec8ecb5343cac9cc0fd8659076d448d5caf28` |
| `scans.log` | `69e266a48dd9cf3df8575e0bed6adff0a7afa19f84c8f1e3893ebb0ef040b069` |
| `e2e.log` | `7ed1965bf8dd64ea3b18b87f9f3e98eb1c115da3415435770685ca27363b0ff1` |
| `build.log` | `f0d93b036c163c7777a668c6d0651090a2f25d449259b594c3bd9405a7ea21af` |

After the full test, only verified owned residual Chromium/crashpad processes were terminated, with identity/start-time checks recorded in `owned-browser-cleanup.json`. The pre-browser snapshot proved an empty worktree process set and a free port 3000. E2E then completed normally and its own server/browser processes exited. The post-browser snapshot again proved no live worktree processes and a free port 3000. To meet the build disk boundary, only the ignored `apps/web/.next/dev` directory was removed after checking every ancestor was a nonsymlink directory, its exact realpath, its ignored status, no live owned E2E group and a free port 3000; the Bun removal used `recursive:true, force:false`. Final snapshot at 09:20:58.865 UTC proved no live worktree processes, port 3000 free and 3386160 KiB available. Heavy/browser slot released at 09:20:59 UTC.

Root reported hosted CI/guards and CodeRabbit clear on the frozen source head before this mandatory run. This local run does not override its failures or establish hosted results for the later evidence-only commit. Root owns current-head reconciliation, review and merge.

## Scope and report

Changed: `convex/lib/accountDeletion.test.ts` and this evidence file only. Runtime, schema, environment, package/configuration files, checks and deployments are unchanged. Composer #1258 and active checkouts were not edited during this assignment. Protected PRs #1193 and #1198 were not touched.

```text
status: blocked
ticket: #1274
evidence: both focused schemas 69/0; mandatory scoped file 69/0; full test 3484 pass / 12 fail / 3 todo; local E2E 23 pass / 5 fail / 89 skip; other required commands exit 0
changed: convex/lib/accountDeletion.test.ts; docs/polish/evidence/kb-library-schema-contract.md
unknowns: causes of logged full-test/E2E failures; hosted checks on evidence-only head
notes for ticket sync: independent compatibility PR first, then reconcile KB-01; exactly two approved schema versions, no partial additions
```
