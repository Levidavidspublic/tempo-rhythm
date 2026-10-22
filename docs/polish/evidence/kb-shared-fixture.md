# Shared Kitchen fixture harness

WALK — BLOCKED. The single additional AT-21 candidate authorized on 22 October fails focused validation: 16 pass / 4 fail / 1 error. Its ownership-list optimization is a failed hypothesis and introduces cleanup regressions; it must not merge. The earlier 18/0 result belongs to `2d99c84`, not this candidate. Every original named case, assertion, timeout and deadline remains.

Date: 2026-10-22. Role: WORKHORSE. Ticket: TEMPO-KB-HARNESS, #1202. Tracking: planning PR #1140. Earlier receipts below remain attributed to 21 October.

The shared runner uses a fresh OS process, streams both output channels immediately and retains at most 1 MiB per channel. Truncated output cannot pass the exit gate. Printed success and EOF never replace the actual fixture exit. Linux uses Python 3 and PR_SET_CHILD_SUBREAPER to adopt, terminate and reap browser descendants, including separate process groups and children retaining output pipes. Python 3 is present in this sandbox and Ubuntu hosted runners; a missing runtime fails the fixture rather than silently reducing cleanup. The supervisor emits the fixture's token-bound OS exit separately from its own exit; both are checked.

Controlled tests established a sandbox detail: `/proc/PID/task/PID/children` returned an empty list while a live descendant's stat and process table named that parent. The original supervisor therefore enumerated `/proc` stat parent IDs. The 22 October correction below instead checks every thread's child list, not only the process leader's list. It signals only its own descendant tree. Cleanup starts every named release independently and preserves all failures. Child handlers allow server/browser cleanup before supervisor escalation. Cancellation or timeout always fails the run.

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
| Earlier signal-based supervisor plus nested-runner proof | PASS on `511065b`; 13 pass / 0 fail, 43 assertions, 2.50 s; installed browser discovered without an environment override |
| Scoped TypeScript compile | PASS on earlier implementation source `511065b` |
| `bun run test` | INCOMPLETE on `c5fd530`: observed 1534 pass lines / 1 fail / 3 todo before cancellation, exit 143; unchanged KB-66 cached child promise exceeded 240000 ms |
| Four scans/notices | PASS: forbidden-tech, RAM-only audit, design-tokens and notices |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN infrastructure: 1 pass / 28 fail / 88 skip; required bundled browser absent; lead independently verified Chromium CDN 403. No config or skips changed |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, 1/1 task (shared Turbo cache) |

The two failed candidates remain evidence. A failed supervisor probe left exited descendants adopted by PID 1; its executing descendant was terminated. The final controlled cases verify their own direct child and detached descendant PIDs no longer exist after cleanup. This does not claim unrelated pre-existing PID-1 zombies were reaped.

Before versus after counts above are controlled harness tests, not a claim that every worker's hosted failure has disappeared. That broader comparison belongs to each worker rerun and the overnight register.

## Full-suite limitation and failure tails

The full local run loaded the helper tests from `c5fd530` and passed all 12. It also passed every KB-64 case. It then reached unchanged KB-66 and timed out its first case at 240017.58 ms while awaiting its cached child promise. The run was cancelled before repeating that same pending lifecycle for later cases. At cancellation, a `/proc` stat-parent inventory found no descendant under the test runner. This supports an exit-delivery stall hypothesis; it does not prove a browser or product defect. The remaining suite has no authoritative final totals and is UNKNOWN. The subsequent `511065b` implementation passed its then-expanded 13-case focused proof; later review corrections below expand coverage to 18 cases. Hosted CI and worker migrations remain the integration gate.

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

## CodeRabbit correction: drained receipts and failed spawns

Fixed — the runner now records the OS exit immediately but validates the token-bound receipt only after the child close event has drained stderr. A controlled fresh child pauses the real supervisor stderr until its OS exit event, then resumes it on a microtask; the receipt is accepted after close. Its process-local module mock never enters the parent or another suite.

Fixed — a failed spawn has no owned PID. Cancellation returns without signaling it, and the signal helper refuses zero/noninteger process IDs. A controlled child runs with a nonexistent executable search path, verifies the spawn error remains a failure, and proves its caller survives; no caller process group is signaled.

The first added delayed-drain regression captured a live import binding that its own mock replaced, causing recursion: **14 pass / 1 fail**, 44 assertions. That scaffolding failure is retained. Capturing the native spawn function before installing the isolated mock completed the same authorized review correction. The corrected proof is **15 pass / 0 fail**, 45 assertions, 2.96 seconds. Every previous case, assertion and timeout remains. The current full hosted run remains required; earlier local full-suite and E2E limitations above remain unchanged.


## Hosted exit-delivery fault and scoped OS recovery

Fixed locally — the original 15 cases and assertions remain; three additional fault cases now pass. Final focused validation: **18 passed / 0 failed, 53 assertions, 4.33 seconds**, exit 0. Scoped helper/test TypeScript compilation passed. No existing deadline was increased, including the delayed-drain case's 5000 ms deadline.

Hosted receipts before this correction remain failures. Shared source `4d30965` completed with 3487 passed, 1 failed and 3 todos across 3491 tests / 212 files in 729.37 seconds. Its sole failure was unchanged KB-61's 480028.61 ms hook timeout. A consumer run on KB-03 with the same helper completed with 3522 passed, 1 failed and 3 todos in 291.66 seconds: the shared delayed-drain regression timed out at 5002.98 ms.

The KB-03 job log (job 119437017848) shows the inner delayed receipt was accepted after its real OS exit and pipe drain. The outer Python supervisor then printed its own receipt and reaped-descendants marker, both pipes ended, and its `/proc` state was zombie, but Bun never delivered the outer ChildProcess exit event before the unchanged test deadline. This observed outer exit-delivery failure is distinct from the deliberately delayed inner stderr; the original regression remains unchanged.

On Linux, EOF and SIGCHLD now trigger a nonblocking `waitpid` for only that invocation's direct supervisor. Its captured process start identity and current parent must still match before calling libc through Bun's built-in FFI. Only a matching `waitpid` return supplies authoritative wait status and proves reaping; `/proc`, EOF and printed receipts never imply success. If Bun wins the reaping race, its normal event remains authoritative. Completion also requires both streams to drain before receipt validation. This Linux path requires the existing glibc runtime (`libc.so.6`) used by Ubuntu CI; no package or configuration was added.

The added fault proof creates a real direct child through POSIX spawn inside a fresh fixture process, deliberately omitting Bun's process watcher and all synthetic exit/close events. The runner must recover actual OS status, retain the fixture's exit 23 as failure, drain both channels and leave no supervisor PID. The preliminary OS probe returned the exact owned PID with wait status 5888 (exit 23). The full controlled case passed in 184.66 ms. No fixed readiness sleep is used.

The supervisor receipt now begins with a newline so a fixture's unfinished stderr line cannot swallow it. A separate controlled case preserves such stderr and accepts exactly one authoritative receipt. Parent SIGINT/SIGTERM is recorded and re-raised after cleanup if no remaining listener owns that signal; a controlled case proves both default termination and survival when another listener explicitly owns it. The transition helper computes its remaining budget after the Playwright import. Earlier 13-case receipts are labeled as historical rather than final.

Hosted checks on this correction remain required. The earlier 14/1 mock-binding scaffolding failure, local incomplete full run, and earlier missing-browser E2E receipt remain in the ledger above. The later KB-05 consumer run with helper `4d30965` passed all 15 shared cases and all 13 consumer cases locally, and its runtime-repaired E2E passed 28 tests with 89 expected skips; that is separate consumer evidence, not a replacement for the shared PR's current-head CI.

## Lane 1 continuation: portable evidence and child termination

The 21 October continuation keeps the shared fix first. This is one cohesive correction after reviewed candidates `511065b`, `4d30965` and `2d99c84`; it does not reset their earlier failures or authorize unlimited retries.

The child cleanup handler now retains the first SIGINT or SIGTERM, finishes every registered cleanup, removes its own handlers, and re-raises the original signal when no other listener owns it. A rejected cleanup remains printed before signal termination. The earlier real-server cleanup case explicitly installs a caller-owned code-1 termination listener, retaining its original exit-code and resource assertions; new controlled cases separately require default SIGINT/SIGTERM after both successful and rejected cleanup.

All 18 original named cases remain, with their deadlines unchanged; two additional cases exercise native fallback and child termination. Linux retains its real POSIX-spawn/waitpid proof and original receipt assertions. On other platforms, the same named case proves that drained output without an exit notification fails within the original bound, instead of loading Linux libc or skipping the case. The native fallback also runs in a fresh child with a process-local platform override on Linux. Unfinished stderr is checked against the applicable native exit or supervisor receipt; nested exits retain their success/failure assertions. Native-platform execution remains UNKNOWN until run on that platform; the override is branch coverage, not a macOS or Windows certification.

Initial continuation check: **17 pass / 3 fail**, 70 assertions, 25.87 seconds, exit 1. This run started while the new worktree's physical dependency copy was incomplete. The isolated React browser build could not resolve `react-dom/client` or `react/jsx-dev-runtime`; the final browser-signal case reached its unchanged 10-second deadline. The unchanged 150 ms cancellation case also failed: the supervisor exited with SIGKILL without a child receipt, so the fixture signal remained unknown rather than being fabricated. The specific child phase is UNKNOWN. All new native-fallback and child-signal assertions passed. This failed receipt is retained; no timeout, assertion or test is weakened to replace it.

## Authorized continuation — 22 October 2026

WALK — Amit explicitly approved AT-21: one additional scoped correction, including the preserved portability and process-signal work. This is that single additional candidate; all previous failures remain above. No existing test name, assertion, timeout or cleanup deadline was removed or relaxed.

The Linux supervisor previously scanned every `/proc` process for each descendant during cancellation. The current workspace contains more than 1,700 unrelated zombie processes, making that traversal compete with the unchanged 300 ms cleanup allowance. The correction follows only each owned process's `/proc/<pid>/task/*/children` links, including children created by any thread and descendants adopted by the subreaper. Only disappeared processes are ignored; other enumeration errors still fail. Signal handlers are installed before child creation, and a cancellation received during creation is applied again to the new child without restarting its cleanup timer. OS exit receipts, reaping, owned-process checks and forced termination remain required.

This attempted to remove an unbounded traversal cost, but focused validation disproved its safety in this environment: all-thread child listings still fail to provide the required cleanup behavior. The earlier main-thread-list failure was already recorded; broadening it to all tasks did not resolve that limitation. The failed optimization is frozen for review, not accepted or retried. The historical failure is not retroactively relabeled an environment-only failure. The earlier preserved patch's 17/3 receipt remains distinct from this authorized candidate.

Current candidate results (Bun 1.3.9):

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | PASS, exit 0, 313.75s; checked 1,033 installs across 1,079 packages, no changes. |
| `bun test tests/unit/kitchen-fixture.test.ts` | FAIL, exit 1; 16 pass / 4 fail / 1 error, 66 assertions, 28.35s. No rerun. |
| Remaining AGENTS mandatory checks | Pending the lead's shared validation slot; no passing result inferred. |

Four failures: streamed-output cancellation supplied no fixture exit; the existing 150 ms / 300 ms cancellation expected SIGKILL but received null; server/subprocess cancellation expected code 1 but received null; detached-descendant cleanup hit its unchanged 5,000 ms test deadline. An output-close rejection (`fixture output close exceeded 1000ms`) was unhandled after that timeout. The new native-fallback and child-signal cases pass; the fresh browser build and committed focus/transition cases also pass. These passes do not erase failed resource cleanup.

The failed detached-descendant case left its explicitly reported controlled subprocess alive. After the suite exited, the worker matched its exact controlled command and stable `/proc` start identity, terminated only that owned PID with SIGKILL, and confirmed no live owned process remained. Port 3000 was free. A PID-1-adopted zombie remains outside the worker's reaping authority. Raw local output is retained under `/workspace/work/overnight/harness-oct22/`; synthetic per-run receipt identifiers are redacted in public excerpts.

Focused failure output, final 20 lines (synthetic receipt identifier redacted):

```text
[kitchen-fixture] EOF OS pid=264082 stat=264082 (python3) Z 263823 264082 264082 0 -1 4227340 2658 4856 0 0 15 7 23 19 20 0 1 0 7839247 0 0 18446744073709551615 0 0 0 0 0 0 0 16781312 0 1 0 0 17 1 0 0 0 0 0 0 0 0 0 0 0 0 0 wchan=0
[kitchen-fixture] start pid=264093
[kitchen-fixture] build start
[kitchen-fixture] build complete outputs=1

KITCHEN_CHILD_EXIT={"token": "<redacted synthetic receipt identifier>", "code": 0}
[kitchen-fixture] supervisor reaped all descendants
[kitchen-fixture] stderr EOF pid=264093 exit-observed=false
[kitchen-fixture] waitpid reaped owned supervisor pid=264093 status=0
[kitchen-fixture] exit pid=264093 code=0 signal=none
[kitchen-fixture] stdout EOF pid=264093 exit-observed=true
[kitchen-fixture] EOF OS pid=264093 stat=264093 (python3) Z 263823 264093 264093 0 -1 4227340 2685 8283 0 3 9 8 28 21 20 0 1 0 7839314 0 0 18446744073709551615 0 0 0 0 0 0 0 16781312 0 1 0 0 17 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 wchan=0
(pass) shared kitchen fixture lifecycle > fresh browser builds resolve React scheduler from its actual importing package [668.52ms]
(pass) shared kitchen fixture lifecycle > committed focus and settled transition use browser signals [7401.64ms]

 16 pass
 4 fail
 1 error
 66 expect() calls
Ran 20 tests across 1 file. [28.35s]
```
