# KB-66 — activity load more keeps the reader's place

The mounted `/activity` screen now keeps keyboard readers on the first row revealed by Show older. After the final click removes that button, the focused new row remains in the list and a quiet message says that all **currently available** activity is shown. The existing query returns at most 50 recent records, so this message does not claim to cover all historical activity. The current seven-day grouping, row destinations and exact query calls are unchanged.

![Before and after contact sheet, with viewport, language and theme labels](kb-66-activity-load-more-keeps-reading-place.jpg)

## Capture method and limits

The **before** images use the exact original mounted `ActivityScreen.tsx` source, frozen before any scoped edit in ignored `work/before/ActivityScreen.tsx` (SHA-256 `21dd14aea1e40b703b64039fca24326c5c4a6702441f567e72967f607f4d20d8`). An isolated browser fixture imports that frozen production component with fictional Maya, Dana and Yoni rows and mocked `activity.list`/profile responses. The browser capture itself ran later in the shared validation queue, after code editing began; its import stays pinned to the original source. It exercised the two Show older clicks that remove the final button; `document.activeElement` was then `<body>` in all eight before frames. These are production-component fixture captures, not authenticated `/activity` route captures.

The **after** images use the changed mounted `ActivityScreen` in the same kind of isolated hydrated fixture, with the same fictional 31-item feed. The contact sheet compares the bottom of the list after the final click at 390 and 1280 px, English and Hebrew, light and dark. The visible `Other action` button is a fixture-only control used to test focus moved elsewhere. An interactive `Kb66Gallery` also imports the same `ActivityLoadMore`, `ActivityEndStatus` and row views used by production. No real account data appears.

## Browser findings

- Show older reveals 10 more items per press; 21 and 30 items end after one press, 31 after two, and exactly 20 shows the end message immediately.
- Keyboard activation focuses the first newly revealed row, including after the final button disappears. That row has `tabIndex=-1`, so it adds no extra Tab stop. Moving focus to another control during the update is respected.
- A reactive new row does not itself move focus; subsequent paging uses the last visible row as its boundary. StrictMode does not duplicate the live count.
- Count and time text remain left-to-right inside Hebrew direction. The fixture checks one `main`/`h1`, 44 px targets, visible keyboard focus, reduced motion, large text, and no horizontal viewport overflow.

The unchanged authenticated `/activity` E2E spec requires `TEMPO_E2E_STORAGE_STATE` and skips without it. Authenticated data, the backend snapshot beyond its 50-item cap, device VoiceOver/TalkBack and native Hebrew copy review remain **UNKNOWN** in this sandbox. Hebrew strings are machine-drafted for Amit's native read.


## Review repair and sandbox diagnostics

Review-repair source and test commit: `fa0599e763ff1d9b6d7dccc30e1695b90e751464`. This follow-up is locally tested; it does not claim deployment or authenticated backend verification.

- **AT — 4335159709:** A pending Show older click now records the last visible row's `occurredAt` value. If that row disappears from the reactive snapshot, fallback focus considers only unseen rows at or before that ordering boundary. The existing anchor-present search remains intact. The new case, `pending load keeps its older boundary when the anchor disappears beside a new top row`, changes the query during the same click, removes `a19`, inserts a newer row at the top, and verifies focus on older `a20` in English and Hebrew under StrictMode. The preceding product source failed this regression while all 18 existing cases passed.
- **AT — 4335159718:** Screenshot outputs now live inside the fixture's unique temporary directory and are removed by the existing `afterAll` cleanup. Both the failing and passing child runs left zero `kb66-gallery-*` fixture directories. **AWAY — ignore-file edit:** `git check-ignore -v work/kb66-mounted-final-390-en-light.png` confirms the checkout's shared `.git/info/exclude` already ignores `/work/`. Cleanup also prevents this test's screenshots from remaining untracked in a fresh checkout. No out-of-scope `.gitignore` edit was needed.
- **AT — fixture isolation:** Normal test execution runs all 19 actual cases in one clean Bun child process, preserving every original assertion and individual timeout. The parent registers the same named cases, rejects every nonzero child exit, and retains the child's output. Even when a parent name filter selects fewer reports, the child executes its entire suite. The actual component import, `Bun.build`, `Bun.serve` and browser instance stay in that clean process. The failed child status was observed and propagated during the regression proof. Combined full-suite behavior remains pending root-owned validation.

Bun 1.3.9 and installed Chromium were used. The following are focused/light diagnostics, not a claim that the complete ordered AGENTS.md gate sequence has finished.

| Command | Exit | Results |
| --- | --- | --- |
| `bun --version` | 0 | `1.3.9` |
| `bun test tests/unit/kb-66.test.tsx -t 'anchor disappears'` before the product fix | 1 | Clean child: 18 pass, 1 fail, 32 Bun assertions; parent: 1 fail, 18 filtered reports. Expected focus regression; 77.72 seconds total. |
| `bun test tests/unit/kb-66.test.tsx` after the product fix | 0 | Clean child: 19 pass, 0 fail, 32 Bun assertions plus the retained Playwright checks, 90.67 seconds. Parent: 19 pass, 0 fail, 19 report assertions, 93.64 seconds total. These are the same 19 cases, not 38 independent cases. |
| `bun run lint` | 0 | 5 successful tasks / 5 total; 0 errors, 10 warnings in untouched files. |
| `bun run typecheck` | 0 | 5 successful tasks / 5 total; 1m13.786s. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four checks OK. |
| `bun install --frozen-lockfile` | UNKNOWN | Pending root-owned ordered validation. |
| `bun run test` | UNKNOWN | Full standard suite pending root-owned validation. |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN | Full E2E run pending root-owned validation. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN | Build pending root-owned validation. |

The complete diagnostic logs are retained under `/workspace/work/kb-finish/kb66/`: `anchor-before.log`, `focused-after.log`, `version.log`, `lint.log`, `typecheck.log` and `scans.log`. Final checks after the integration rebase belong to root. No test skip, assertion removal, timeout extension, scan-baseline or configuration change was used.

Last 20 lines of the expected failing regression run:

```text
      at captureRawStack (/workspace/work/kb-66/node_modules/.bun/playwright-core@1.62.1/node_modules/playwright-core/lib/coreBundle.js:9681:21)
      at callMatcherAsStep (/workspace/work/kb-66/node_modules/.bun/playwright@1.62.1/node_modules/playwright/lib/matchers/expect.js:13310:57)
      at /workspace/work/kb-66/tests/unit/kb-66.test.tsx:194:32
      at processTicksAndRejections (native:7:39)
(fail) KB-66 hydrated activity gallery and mounted screen > pending load keeps its older boundary when the anchor disappears beside a new top row [10277.06ms]
(pass) KB-66 hydrated activity gallery and mounted screen > gallery controls and retry callback remain operable [4121.39ms]
(pass) KB-66 hydrated activity gallery and mounted screen > mounted production view and gallery fit phone and desktop in both languages and themes [29016.04ms]

 18 pass
 1 fail
 32 expect() calls
Ran 19 tests across 1 file. [73.95s]

      at <anonymous> (/workspace/work/kb-66/tests/unit/kb-66.test.tsx:38:39)
(fail) pending load keeps its older boundary when the anchor disappears beside a new top row [74019.87ms]

 0 pass
 18 filtered out
 1 fail
Ran 1 test across 1 file. [77.72s]
```


## Overnight v3 fixture correction — 2026-10-21

PR open — all 19 original KB-66 cases pass with the shared harness; local mandatory checks are recorded below, and final shared-review adoption plus hosted gates remain pending. Role: WORKHORSE. Issue #1165 was already reopened; original PR #1168 remains merged. This corrective branch depends on shared harness PR #1203, source `511065b`, and changes only this evidence file and `tests/unit/kb-66.test.tsx`. Activity product code and existing screenshots are retained.

The reopened cause was a cached unbounded child promise: eight successive parent 240-second timeouts occurred in each of hosted jobs119278684404/119279342909 before their cancellation. Those incomplete hosted runs have no full-suite total and are not passes. The child phase was hidden by buffered pipes.

Source `b190b2b` runs that one cached promise through `runIsolatedFixture`, streams setup/build/browser/case/cleanup/exit phases, and accepts results only after the actual child exit, supervisor exit and cleanup receipts all succeed. Later reports receive an already-settled failure immediately. The 19 original case names, every child assertion line and all existing test/hook timeout literals remain unchanged. The existing 240-second parent bound budgets 225 seconds of execution plus bounded cleanup and result delivery; no test deadline is extended. The browser build uses the shared fresh-process resolver and a unique output directory inside the existing temporary fixture directory. Server, browser and directory cleanup start independently through the shared idempotent cleanup function; its 5-second allowance fits the existing default cleanup hook deadline. Parent reports also require an actual Bun `(pass)` record for that specific case, not merely the case name inside an error.

The first attempted focused run occurred before local dependency installation completed (0 pass/1 fail/1 error, missing local React); no case ran. Two exact frozen-install commands stalled during resolution and were interrupted. An identical dependency tree was copied from the shared-harness worktree; lockfile/root/web package manifests match and relative links resolve inside this worktree. Installation is UNKNOWN, not a claimed frozen-install pass.

The first executable adapter candidate then ran seven child cases before setup failed because it eagerly resolved the unused original react-native-web alias. The adapter restores that alias's original lazy path. Its child exited1 and cleanup completed; all19 parent reports rejected the same settled result within0.94seconds rather than repeating the240-second timeout. This failure is retained as a real failed candidate. The nested isolated-build contract also exposed a shared receipt parser issue, corrected centrally in#1203; no private helper fork was added.

Final focused proof: `bun test tests/unit/kb-66.test.tsx`, Bun1.3.9, system Chromium. Child19pass/0fail with32 Bun assertions in12.60seconds; parent19pass/0fail with38 reporting assertions in12.99seconds. These are the same19 behavioral cases, not38 separate behaviors. Both build and fixture child exits were0, both supervisors completed, and their PIDs no longer existed afterward. The historical intermittent hosted stall is not claimed reproduced or cured solely by this local pass.

| Required command | Current result |
|---|---|
| `bun --version` | PASS1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: two resolution stalls interrupted; identical dependency tree used for validation |
| `bun run lint` | PASS5/5, zero errors;9 existing warnings |
| `bun run typecheck` | PASS5/5 |
| `bun run test` | FAIL:3,489pass/17fail/3todo,3,509tests/212files,344.89seconds; all17 failures are unchanged KB-64 browser-close cases; own19/0 and shared13/0 |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS:all four |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN:Playwright browser unavailable/CDN403; actual1pass/28launch failures/88skip |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS1/1, cached |

Focused failure tail (unused alias candidate):
```text
(fail) gallery statically mounts the actual activity heading and feed views
(fail) mounted caller and exact query contract remain wired
(fail) English and machine-drafted Hebrew keys have parity [0.02ms]
(fail) no entries retain the mounted empty view and no paging control
(fail) exactly 20 items show a current-snapshot end without a button
(fail) 21 items focus the new row after final-button removal
(fail) 30 exactly completes in one chunk and keeps the new row in view
(fail) 31 items require two chunks and focus rows 21 then 31 [0.02ms]
(fail) focus moved elsewhere during a load remains there
(fail) Hebrew direction, time and counts remain readable
(fail) StrictMode announces each loaded count once and transfers focus once
(fail) reactive insertion alone does not steal focus and next chunk uses its stable boundary
(fail) pending load keeps its older boundary when the anchor disappears beside a new top row
(fail) gallery controls and retry callback remain operable
(fail) mounted production view and gallery fit phone and desktop in both languages and themes
[kitchen-fixture] EOF OS pid=22807 stat=22807 (python3) Z 22793 22807 22807 0 -1 4227340 2659 35419 0 0 2 0 62 5 20 0 1 0 90458 0 0 18446744073709551615 0 0 0 0 0 0 0 16781312 0 1 0 0 17 3 0 0 0 0 0 0 0 0 0 0 0 0 0 wchan=0

 0 pass
 19 fail
Ran 19 tests across 1 file. [938.00ms]
```

The mandatory sequence above used shared511065b and KB-66 sourceb190b2b. The validation coordinator was paused after starting full tests to serialize the later localhost E2E run; no active test was paused, cancelled or given a changed timeout. E2E then held the shared browser lock. The full test itself reported344.89seconds; coordinator wall time includes the serialization hold.

The planning baseline had3,473pass/20fail/3todo. This composed run adds13 shared-harness cases and has three fewer KB-64 failures. That unrelated variation is not evidence that KB-66 fixed KB-64. Both sources retain failing full-suite outcomes.

Last20lines — kb66-full.log
```text
(fail) KB64 Undo recovery > fulfillment makes no invented success claim and does not expire early [16.02ms]
(fail) KB64 Undo recovery > unmount fences a stale rejected request and cancels expiry [16.05ms]
(fail) KB64 Undo recovery > changed deadline fences an old rejection without leaking error or busy state [16.25ms]
(fail) KB64 Undo recovery > changed deadline fences an old fulfilled request after the old deadline [16.00ms]
(fail) KB64 Undo recovery > new inline callback identities do not reset an active request [16.10ms]
(fail) KB64 Undo recovery > Hebrew recovery has RTL direction and localized action copy [16.10ms]
(fail) KB64 Undo recovery > an immediate fulfillment crossing the deadline still schedules post-commit expiry [22.86ms]
(fail) KB64 Undo recovery > late successful real detail restoration keeps the parent navigation authoritative [16.20ms]
(fail) KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [21.54ms]
(fail) KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [50.12ms]
(fail) KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [37.13ms]
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [16.46ms]
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [16.18ms]

 3489 pass
 3 todo
 17 fail
 81431 expect() calls
Ran 3509 tests across 212 files. [344.89s]
error: script "test" exited with code 1
```

Last20lines — kb66-e2e.log
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
  1 passed (13.8s)
```

Final shared-review adoption: merged shared commit `4d30965` normally, including receipt validation after stderr drain and the failed-spawn PID guard. `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-66.test.tsx` exited 0: 34 pass / 0 fail / 83 assertions across the shared 15 cases and KB-66’s original 19 cases, in 15.42 seconds. The isolated KB-66 child also reported 19 pass / 0 fail / 32 assertions in 12.47 seconds and completed browser/server/directory cleanup before authoritative exit 0. Log: `/workspace/kb-run-logs/kb66-final-focused.log`.

The mandatory full-sequence receipts above remain explicitly tied to shared `511065b`; this final check covers the changed shared runner and its KB-66 consumer. Hosted CI and CodeRabbit review of the final PR are pending. No merge is authorized while the prerequisite, mandatory failures, or review gates remain unresolved.

Shared correction refresh: normal merge `6b67704` incorporates shared `2d99c84`. `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-66.test.tsx` exited 0 with **37 pass / 0 fail / 91 assertions in 18.08 seconds** (shared 18 plus original KB-66 19). KB-66's child retained all 19 cases and 32 assertions, actual exit 0 and completed browser/server/directory cleanup. Log: `/workspace/kb-run-logs/kb66-final-shared2-focused.log`. No ticket source changed in this refresh. Earlier mandatory checks remain tied to their documented older source; they were not rerun or relabeled as final-head results.

Blocked: the coordinating worker separately observed a shared cleanup race in KB-75's combined proof, with supervisor SIGKILL before the fixture exit receipt. Shared #1203 is held after its authorized repair budget; this local pass does not clear that dependency. Current hosted gates and actual CodeRabbit coverage remain necessary.
