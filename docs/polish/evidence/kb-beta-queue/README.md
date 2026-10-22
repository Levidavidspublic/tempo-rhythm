# Beta approval queue: scoped preparation

Ticket #1275. Prepared 2026-10-22 against `origin/integration` and the frozen #1266 backend contract (PR #1273). No actual account, payment, provider, deployment, or environment action was performed.

The mounted administrator page now shows one live, bounded page of beta requests and preserves ordinary account management. Only `approval.myStatus` runs before the administrator gate. The queue calls `approval.listBetaRequests({ cursor: string | null, numItems: 20 })`, which returns `{ page: { id, email, name, requestedAt }[], continueCursor, isDone }`. Confirmed decisions call the existing `approval.setStatus({ userId, status })`; the server remains responsible for authorization and entitlements.

Empty filtered pages follow their continuation for at most ten automatic hops. After that, Next requests explicitly continues; the UI does not turn an unfinished queue into an empty result. A terminal later page says only that this page is empty. Repeating cursors offer a restart. Pages replace one another rather than retaining a growing cache of applicant identities.

Approval explains Max at no charge and preserves the backend's existing paid/founder-access exception. Pause and pending decisions disclose that the request is cleared. Confirmation checks that the captured request is still current. Duplicate submissions and page changes during a decision are disabled. Administrator identity changes remount sensitive state and ignore late UI completions; this does not cancel a mutation already submitted to the server. Queue read failures have a local Retry without removing ordinary account management.

The existing confirmation sheet supplies focus management and Escape behavior. Existing token classes are reused, no extra main or h1 is introduced, and new English/Hebrew strings live only in the settings group. Hebrew is machine-drafted and awaits Amit's native read. Browser rendering and touch-target measurements remain unverified.

## Test results (cloud agent sandbox)

Bun 1.3.9. No check rules were disabled. Scoped Biome uses `--vcs-enabled=false` solely because this isolated scratch directory has no Git metadata.

| Check | Result |
| --- | --- |
| `bun --no-env-file test tests/unit/tempo-beta-queue.test.tsx` | PASS: one parent isolation test, asserting all 21 child mounted cases pass with zero failures; 4.19 seconds in candidate 3 |
| `bun --no-env-file test apps/web/lib/i18n.test.ts` | PASS: unchanged global i18n regression suite, 6 pass / 0 fail, 2,120 assertions, 664 ms in candidate 3 |
| Scoped Biome lint of the two implementation files and one test with the repository config | PASS: three files checked, no fixes applied |
| Full application typecheck | UNKNOWN: held by lead to avoid competing with the allocated browser/full-test process |
| Full lint, full tests, build, four scans and scope/CI guards | UNKNOWN: require the actual allocated checkout and complete dependency stack |
| Browser contact sheets at 390/1280, English/Hebrew, light/dark | UNKNOWN: no browser or Next server allocated to this worker |
| CI and CodeRabbit gate | UNKNOWN: parent publishes and runs review gates |

The test runs actual mounted `AdminApprovals` and the existing `ConfirmSheet` in a small isolated DOM, with mocked Convex boundaries and fictional `example.invalid` applicants. It covers administrator gating, loading, empty and paginated queues, empty-page continuation and its limit, repeated cursors, confirmation, exact mutation arguments, duplicate prevention, errors/retry, stale requests, changed administrators, lost authorization, ordinary management, admin protection, keyboard focus/Escape, Hebrew/RTL attributes, heading ownership, and queue failure recovery. This does not substitute for real-browser layout or server authorization tests.

Attempt ledger: candidate 1 mounted tests passed; scoped lint found four semantic-element diagnostics for `p role="status"`. Candidate 2 replaces them with native `output`, then mounted tests and scoped lint pass. Hosted validation subsequently found the word `must` in `adminApproval.revokeBody`, violating the unchanged global copy rule. Candidate 3 changes that one English/Hebrew confirmation to a neutral explanation that beta access can be requested again with a new request. The existing pause-action test gains assertions for the new-request explanation and the global prohibited-word set; all 21 mounted cases remain. Candidate 3 passes mounted tests, the unchanged six global i18n tests and scoped lint. Three candidates total; this is the final repair candidate, with no fourth attempt. Earlier receipts are retained.

The global i18n check uses unchanged `i18n.ts` and `i18n.test.ts` fetched from PR #1284 head `6699873373fdbd3b37a02349554d6ea4d6ae4aca`, plus the seven unchanged integration dictionary dependencies, alongside the corrected settings group. Those copied validation files are scratch-only and must not be published. No global test, check configuration or schema assertion was weakened. The separate inherited account-deletion schema failure remains assigned to #1274 / PR #1280; it was not changed by this UI repair.

Publish only `apps/web/components/approval/AdminApprovals.tsx`, `apps/web/lib/i18n-groups/settings.ts`, `tests/unit/tempo-beta-queue.test.tsx`, and this evidence directory. Scratch dependency and Controls symlinks are read-only test wiring and must not be published. No schema, environment, route, root-i18n, package or backend file changes.

```text
status: blocked
ticket: #1275
evidence: candidate 3 mounted test -> parent 1 pass / 0 fail; child 21 pass / 0 fail; unchanged global i18n -> 6 pass / 0 fail; scoped lint -> 3 files, no diagnostics
changed: AdminApprovals.tsx; settings.ts; tempo-beta-queue.test.tsx; docs/polish/evidence/kb-beta-queue/
unknowns: actual-checkout full gates, browser evidence, CI/CodeRabbit, native Hebrew read
notes for ticket sync: depends on #1266 / PR #1273; pricing translation edits must follow this settings-group handoff sequentially
```
