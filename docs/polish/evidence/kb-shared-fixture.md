# Shared Kitchen fixture harness

PR open — the shared harness has 12 passing focused cases; worker adoption and hosted verification are still required. No existing fixture, case, assertion, timeout or deadline changes in this ticket.

Date: 2026-10-21. Role: WORKHORSE. Ticket: TEMPO-KB-HARNESS, #1202. Tracking: planning PR #1140.

The shared runner uses a fresh OS process, streams both output channels immediately and retains at most 1 MiB per channel. Truncated output cannot pass the exit gate. Printed success and EOF never replace the actual fixture exit. Linux uses Python 3 and PR_SET_CHILD_SUBREAPER to adopt, terminate and reap browser descendants, including separate process groups and children retaining output pipes. Python 3 is present in this sandbox and Ubuntu hosted runners; a missing runtime fails the fixture rather than silently reducing cleanup. The supervisor emits the fixture's token-bound OS exit separately from its own exit; both are checked.

Controlled tests established a sandbox detail: `/proc/PID/task/PID/children` returned an empty list while a live descendant's stat and process table named that parent. The supervisor therefore enumerates `/proc` stat parent IDs. It signals only its own descendant tree. Cleanup starts every named release independently and preserves all failures. Child handlers allow server/browser cleanup before supervisor escalation. Cancellation or timeout always fails the run.

`isolatedBrowserBuild` constructs the resolver in a fresh Bun process. React resolves from the web workspace; scheduler resolves from the actual importing package, because Bun's isolated dependency layout does not expose scheduler at the web root. Fixture-specific exact aliases and defines are serializable. No code/plugin closure or module mock is shared with the parent. Hosted EISDIR reproduction remains UNKNOWN until the existing KB fixtures adopt this helper and run CI.

`waitForCommittedFocus` awaits the active element using the caller's existing assertion timeout. `waitForSettledTransition` first awaits a supplied real committed signal and then checks browser animation state, sharing one deadline. No fixed sleep advances a browser assertion. The supervisor's 5 ms OS reap poll only collects process status.

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
| Scoped TypeScript compile | PASS before final supervisor enumeration correction; current final rerun pending |
| `bun run test` | Pending |
| Four scans/notices | Pending |
| `CI=1 bunx playwright test --reporter=line` | Pending |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Pending |

The two failed candidates remain evidence. A failed supervisor probe left exited descendants adopted by PID 1; its executing descendant was terminated. The final controlled cases verify their own direct child and detached descendant PIDs no longer exist after cleanup. This does not claim unrelated pre-existing PID-1 zombies were reaped.

Before versus after counts above are controlled harness tests, not a claim that every worker's hosted failure has disappeared. That broader comparison belongs to each worker rerun and the overnight register.
