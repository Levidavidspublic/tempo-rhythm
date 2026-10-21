# Shared Kitchen fixture harness

PR open — the shared harness has 13 passing focused cases; worker adoption and hosted verification are still required. No existing fixture, case, assertion, timeout or deadline changes in this ticket.

Date: 2026-10-21. Role: WORKHORSE. Ticket: TEMPO-KB-HARNESS, #1202. Tracking: planning PR #1140.

The shared runner uses a fresh OS process, streams both output channels immediately and retains at most 1 MiB per channel. Truncated output cannot pass the exit gate. Printed success and EOF never replace the actual fixture exit. Linux uses Python 3 and PR_SET_CHILD_SUBREAPER to adopt, terminate and reap browser descendants, including separate process groups and children retaining output pipes. Python 3 is present in this sandbox and Ubuntu hosted runners; a missing runtime fails the fixture rather than silently reducing cleanup. The supervisor emits the fixture's token-bound OS exit separately from its own exit; both are checked.

Controlled tests established a sandbox detail: `/proc/PID/task/PID/children` returned an empty list while a live descendant's stat and process table named that parent. The supervisor therefore enumerates `/proc` stat parent IDs. It signals only its own descendant tree. Cleanup starts every named release independently and preserves all failures. Child handlers allow server/browser cleanup before supervisor escalation. Cancellation or timeout always fails the run.

`isolatedBrowserBuild` constructs the resolver in a fresh Bun process. React resolves from the web workspace; scheduler resolves from the actual importing package, because Bun's isolated dependency layout does not expose scheduler at the web root. Fixture-specific exact aliases and defines are serializable. No code/plugin closure or module mock is shared with the parent. Hosted EISDIR reproduction remains UNKNOWN until the existing KB fixtures adopt this helper and run CI. Nested runners ignore other invocation tokens while checking exactly one own-token receipt; a nested failure still fails its outer fixture.

`waitForCommittedFocus` awaits the active element using the caller's existing assertion timeout. `waitForSettledTransition` first awaits a supplied real committed signal and then checks browser animation state, sharing one deadline. No fixed sleep advances a browser assertion. The supervisor blocks on actual OS child-exit signals; SIGALRM escalates cleanup within its deadline. There are no fixed sleeps.

## Adoption contract

- Import `runIsolatedFixture`, `requireFixtureSuccess`, `fixturePhase`, and `fixtureCleanup` from `tests/helpers/kitchen-fixture.ts`.
- Pass the original execution deadline and cleanup allowance. The outer hook must already contain both; do not increase any existing deadline. If it does not, fit execution and cleanup inside the existing outer deadline.
- Keep one cached bounded promise for a shared child. Later case reports immediately receive its settled failure. Preserve every individual case/result and the final authoritative exit check.
- Mark build, server start, browser launch, each test, cleanup and completion with `fixturePhase`. The runner supplies start, EOF/OS state and exit evidence.
- Register owned server/browser/directory cleanup with `fixtureCleanup` in the child and invoke that same idempotent cleanup on normal exit.
- `FixtureRun.code` and `.signal` describe the fixture child. `supervisorCode` is separate. Call `requireFixtureSuccess` before accepting any child results.
- Keep evidence output below the bounded retained tail, or use the streamed callback to parse token-bound records as they arrive. Truncation fails closed.

## Test results (cloud agent sandbox)

Bun 1.3.9. The official Bun release download returned 403; the same version was installed from the official `@oven/bun-linux-x64` npm distribution without changing repository dependencies. System Chromium is `/usr/bin/chromium`.

| Check | Result |
|---|---|
| `bun install --frozen-lockfile` | PASS; 2000 packages, main checkout 19.36 s and isolated worktree 1.94 s |
| `bun run lint` | PASS; 5/5 tasks, zero errors; 9 pre-existing web warnings |
| `bun run typecheck` | PASS; 5/5 tasks |
| Focused harness test, initial resolver candidate | 9 pass / 1 fail; scheduler could not resolve from web root |
| Focused test, importer-relative resolver | 10 pass / 0 fail |
| Focused test, initial Linux supervisor | 8 pass / 4 fail / 1 error; empty task-children listing prevented cleanup |
| Focused test, stat-parent enumeration | PASS; 12 pass / 0 fail, 37 assertions, 3.03 s |
| Final signal-based supervisor plus nested-runner proof | PASS on `511065b`; 13 pass / 0 fail, 43 assertions, 2.50 s; installed browser discovered without an environment override |
| Scoped TypeScript compile | PASS on final implementation source `511065b` |
| `bun run test` | INCOMPLETE on `c5fd530`: observed 1534 pass lines / 1 fail / 3 todo before cancellation, exit 143; unchanged KB-66 cached child promise exceeded 240000 ms |
| Four scans/notices | PASS: forbidden-tech, RAM-only audit, design-tokens and notices |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN infrastructure: 1 pass / 28 fail / 88 skip; required bundled browser absent; lead independently verified Chromium CDN 403. No config or skips changed |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, 1/1 task (shared Turbo cache) |

The two failed candidates remain evidence. A failed supervisor probe left exited descendants adopted by PID 1; its executing descendant was terminated. The final controlled cases verify their own direct child and detached descendant PIDs no longer exist after cleanup. This does not claim unrelated pre-existing PID-1 zombies were reaped.

Before versus after counts above are controlled harness tests, not a claim that every worker's hosted failure has disappeared. That broader comparison belongs to each worker rerun and the overnight register.

## Full-suite limitation and failure tails

The full local run loaded the helper tests from `c5fd530` and passed all 12. It also passed every KB-64 case. It then reached unchanged KB-66 and timed out its first case at 240017.58 ms while awaiting its cached child promise. The run was cancelled before repeating that same pending lifecycle for later cases. At cancellation, a `/proc` stat-parent inventory found no descendant under the test runner. This supports an exit-delivery stall hypothesis; it does not prove a browser or product defect. The remaining suite has no authoritative final totals and is UNKNOWN. The final shared implementation subsequently passed its expanded 13-case focused proof. Hosted CI and worker migrations remain the integration gate.

Full test final 20 lines:

```text

tests/unit/kb-08.test.tsx:
(pass) KB-08 isolated: empty projects offer one deliberate start action [4921.67ms]
(pass) KB-08 isolated: one project renders a named summary with distinct safe destinations [0.01ms]
(pass) KB-08 isolated: count labels distinguish 0/1, 1/1 and multiple tasks
(pass) KB-08 isolated: long user names retain auto direction and a wrapping class
(pass) KB-08 isolated: actions are peers, never nested interactive controls
(pass) KB-08 isolated: disabled navigation has no href or keyboard target
(pass) KB-08 isolated: Hebrew count has RTL copy and isolated LTR digits
(pass) KB-08 isolated: offline state stays a notice and does not create a project
(pass) KB-08 isolated: filtered state only exposes the supplied reset callback [0.02ms]
(pass) KB-08 isolated: error and loading states render separately
(pass) KB-08 isolated: gallery renders the real exported row and owns one h1 and one main
(pass) KB-08 isolated: English and Hebrew dictionaries have exact key parity
(pass) KB-08 isolated: hydrated gallery and mounted projects: keyboard, callbacks, RTL and full-width rows

tests/unit/kb-66.test.tsx:
(fail) load-more view names the currently visible count and preserves LTR numerals [240017.58ms]
  ^ this test timed out after 240000ms.
error: script "test" was terminated by signal SIGTERM (Polite quit request)
```

E2E final 20 lines:

```text
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:26:7 › habits, brain dump and search wiring › /search mounts SearchScreen
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/harness.spec.ts:14:7 › wiring E2E harness › a route outside the wiring list still redirects
    [chromium] › tests/e2e/wiring/plan.spec.ts:9:7 › plan wiring › /plan shows the day timeline and not the scaffold placeholder
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/profile mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/preferences mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:7:7 › settings nags + memory wiring › /settings/nags renders the nags screen and nav links exist
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  88 skipped
  1 passed (34.7s)
```
