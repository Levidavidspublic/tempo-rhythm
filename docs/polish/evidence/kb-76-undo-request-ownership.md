# KB-76: a completed Undo cannot dismiss a newer Undo

This polishes the existing `UndoToast` and adds **zero primary views**. Original source/test commit: `499745a6670d4667d1265997ddb3d6e1f8de9230`. Integration base and frozen original: `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The original `shared.tsx` and unchanged `ProjectDetailScreen.tsx` were frozen at **2026-10-20 01:13 UTC**, before any production edit. The initial original-code browser reproduction completed before the repair; later original contact-sheet captures import that exact frozen module. The 20 Oct three-round freeze and historical results below are preserved; the separately authorized 21 Oct repair is recorded at the end. That repair changes only UndoToast settlement, the scoped test and this evidence; existing captures remain historical evidence of the unchanged appearance.

The [before/after contact sheet](kb-76-undo-request-ownership.jpg) shows the actual unchanged `ProjectDetailScreen` at 390/1280 px, English/Hebrew, light/dark. Its existing checkboxes create toast A and toast B through the real caller callbacks. A's Undo waits, B replaces it, then A resolves. The original loses B; the changed shared toast keeps B and B's own Undo callback. The lower sheet compares the original toast in a standalone fixture with the new interactive gallery; there was no original production gallery. Each full 900 px viewport uses the same compiled app `globals.css`, actual v3 styles and icon sprite, with local font fallback. Desktop captures are scaled to fit their evidence column.

The hydrated fixture renders the actual shared exports and actual `ProjectDetailScreen`. Only Convex auth/query/mutation boundaries, generated API references and Next Link are fictional local substitutes. The real `LocaleProvider` and production pure helpers remain in use. The controlled browser clock advances the existing deadline without five-minute sleeps. No live account, provider, backend mutation or deployed persistence is verified.

## Behavior and contract

`ToastState`, `makeToast`, `UNDO_WINDOW_MS`, `UndoToast({toast,onClose})` and all caller signatures remain intact. Other existing shared exports are byte-for-byte unchanged, checked against pinned base-section SHA-256 values. The shared view calls only the supplied `onUndo()` with **zero arguments**, once per activation, and calls `onClose()` only for its own current mounted request. The original five-minute deadline remains unchanged; activation at or after the deadline is rejected even between ticks. No automatic retry, backend call, route or policy is added.

Ownership follows the toast **object** and an individual request token. Layout cleanup invalidates a replaced/unmounted owner, including replacements with the same `Date.now()` ID. StrictMode setup/cleanup/setup creates a fresh owner. Current rejection or a synchronous callback throw shows plain localized feedback and a keyboard/pointer reachable retry; a stale result cannot close, mark failed or focus a replacement. Dismissal still hides the receipt while an already-started operation may finish. The server remains authoritative about whether that operation succeeds.

The actual caller regression verifies the unchanged update arguments `{taskId:"maya",status:"todo"}` then `{taskId:"dana",status:"todo"}` for the two fictional tasks. This is mocked-boundary evidence, not a live write. `Kb76Gallery` reuses the existing toast with working fictional replacement, completion, rejection, long-title and no-Undo controls. Phone toast buttons measure at least 44×44 px, titles wrap, mixed text retains `dir="auto"`, and numeric countdowns retain their LTR isolation. Changing seconds stay `aria-hidden`; the screen-reader-only full window text stays stable. Visible keyboard focus is checked as an actual outline or shadow. Reduced-motion durations are at most 0.001 seconds. Screen/gallery each have one main/h1 and no horizontal overflow in all eight combinations.

Hebrew is machine-drafted for Amit's native review. Device screen-reader results, live backend Undo writes and deployed persistence remain UNKNOWN.

## Test results (cloud agent sandbox)

All required local commands were attempted on the unchanged source/test commit. Non-test checks have no test pass/fail/skip count.

| Command/check | Exit, counts and result |
|---|---|
| `bun --version` | exit 0; `1.3.9`. |
| `bun install --frozen-lockfile` | UNKNOWN: first attempt stalled at dependency resolution and was terminated (143); bounded repeat after cached-directory bootstrap timed out (124). |
| `bun install --frozen-lockfile --offline` | UNKNOWN: also stalled resolving and was terminated (143). |
| Cache bootstrap | Ignored node_modules directories linked from KB-75; byte comparison confirmed identical lockfile and every workspace package.json. Every declared dependency is present and every workspace dependency resolves inside this checkout. **Not an exact-install PASS.** |
| `bun run lint` | exit 0; 5/5 tasks successful, 0 errors; 9 existing web warnings. |
| `bun run typecheck` | exit 0; 5/5 tasks successful. |
| `bun run test` | exit 0; **3328 pass, 0 fail, 3 todo**; Ran 3331 tests across 202 files. [119.71s] All 27 KB-76 cases included; 81099 outer suite assertions. |
| `bun run scan:forbidden-tech` | exit 0; OK. |
| `bun run scan:ram-only-audit` | exit 0; OK; 6 hard deletes against baseline 10. |
| `bun run scan:design-tokens` | exit 0; OK; arbitrary hex 4/18, raw hex 2/2. |
| `bun run check:notices` | exit 0; OK; 66 documented. |
| `CI=1 bunx playwright test --reporter=line` | exit 1; **26 pass, 2 fail, 89 skipped**. Sign-out visibility and task-title fill time out while Today remains a loading skeleton. Remaining wiring cases completed; credential-gated skips disclosed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | exit 0; 1/1 task successful, 0 cached. Used process-only `TURBO_CACHE=local:r`; no file/config change. |
| Final `bun test tests/unit/kb-76.test.tsx` (repair round 3) | exit 0; **27 pass, 0 fail**, 81 outer wrapper assertions, 141.08 s. The isolated child exercises all 27 actual cases once. |
| Scoped `biome lint` | exit 0; 3 production files checked, no fixes. |
| Frozen-original regression | expected exit 1; 0 pass/1 fail, 2 wrapper assertions; actual caller expected 1 toast, received 0 after A settled. |
| Repair round 1 focused check | exit 1; 23 pass/1 fail, 71 outer assertions, 200.14 s. Retry pointer action timed out at `performing click action`; initial run did not retain a trace/screenshot for that timeout. |
| Repair round 2 focused check | exit 0; 26 pass/0 fail, 78 outer assertions, 121.94 s. Keyboard retry plus added dismissal/expiry rejection cases; no claim this older run covered the later extra pointer case. |
| Separate pointer diagnostic on round-2 product | exit 0; 1 pass/0 fail, 3 wrapper assertions, 10.67 s. Exact default pointer retry after a 5 s clock jump. Enabled button rect: x33/y763/165.2×44; elementFromPoint belonged to the button. Trace: first click 563 ms, retry 93 ms, no error. Both pointer and keyboard retry remain in the final 27-case suite. |

The initial pointer timeout is preserved as an observed failure; the later trace proves the later diagnostic succeeded, not why the initial timeout happened. Three implementation/check repair rounds have been used; no fourth source/test repair is authorized. Current scoped source/test work is frozen. Required long checks run in AGENTS order, including later steps after any failure. Full validation uses the outer validation lock; embedded browser tests also take fixture then E2E locks. Fixture-only jobs take fixture then E2E locks and launch no Next server. Existing Chromium is used through a process-only browser path.

GitHub CI at first evidence head `13763ab05c4328063a1ef2ac9019892e265425ba` independently reported success for ci, full Test, E2E, e2e-preview, Lint, Typecheck, Build, scans, notices, secrets and scope/config guards ([run](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39354289651)). The later reporting head `6bf810cb3a3c240ae9803588a9287b3c52d93e41` **failed required `ci` and `Test`**, with the scoped KB-76 wrapper assertion expecting an UndoToast containing “Change B” but finding no element within 5,000 ms ([failing Test](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39355394466/job/118408875303)). Its other four required checks passed. Detailed remote counts, the exact failing named case and remote root cause remain UNKNOWN because Actions log retrieval returned 403. The first head's historical green result does not establish that the later head is green and does not erase local E2E failures. Any new repair head requires its own checks.

Local failure details: `screens/sign-out.spec.ts:13` timed out after 30 seconds waiting for the Sign out button; `task-views-core.spec.ts:22` timed out filling Task title. Both retained screenshots were visually inspected and show the Today loading skeleton, with no UndoToast visible. These observations do not establish a root cause. No unrelated test, route, auth or backend change was made, and no broad repeat was run solely for green.

## Named 20 Oct cases

1. current success closes once
2. current rejection retains a reachable retry
3. retry success closes without extending the deadline
4. pointer retry remains clickable after countdown updates
5. same-tick duplicate activation calls Undo once
6. synchronous callback throw is a safe error
7. resolution after replacement keeps the new toast
8. rejection after replacement leaves the new toast clean
9. dismissal then replacement ignores the old resolution
10. expiry during a pending request cannot close a later toast
11. rejection after dismissal leaves a replacement clean
12. rejection after expiry leaves a replacement clean
13. activation at the deadline is rejected before the timer tick
14. a toast without Undo has only dismissal
15. replacement clears old busy and error feedback
16. the callback receives no arguments
17. StrictMode cleanup does not disable the current request
18. same-id replacement ignores the previous request
19. real ProjectDetail caller keeps B after A settles
20. real ProjectDetail caller ignores A rejection after B
21. English and Hebrew new dictionary keys and feedback match
22. gallery controls drive the actual shared toast
23. keyboard focus is visible and a late completion cannot steal it
24. countdown changes stay out of live announcements
25. real screen and gallery fit both widths languages and themes
26. reduced motion stays below one millisecond
27. all unrelated shared exports remain identical to the base

## Preserved failure tails (last 20 lines, or full shorter log)

Frozen-original regression (expected red proof)

```text
+ Received: 0
+ Timeout:  5000ms
+
+ Call log:
+   - Expect "to.have.count" with timeout 5000ms
+   - waiting for locator('[data-component="UndoToast"]')
+     14 × locator resolved to 0 elements
+        - unexpected value "0"
+ "

- Expected  - 1
+ Received  + 13

      at <anonymous> (/workspace/work/kb-76/tests/unit/kb-76.test.tsx:209:138)
(fail) KB-76: real ProjectDetail caller keeps B after A settles [2.64ms]

 0 pass
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [16.62s]
```

Repair round 1 focused check

```text
(pass) KB-76: the callback receives no arguments
(pass) KB-76: StrictMode cleanup does not disable the current request
(pass) KB-76: same-id replacement ignores the previous request [0.02ms]
(pass) KB-76: real ProjectDetail caller keeps B after A settles
(pass) KB-76: real ProjectDetail caller ignores A rejection after B
(pass) KB-76: English and Hebrew new dictionary keys and feedback match
(pass) KB-76: gallery controls drive the actual shared toast
(pass) KB-76: keyboard focus is visible and a late completion cannot steal it
(pass) KB-76: countdown changes stay out of live announcements
(pass) KB-76: real screen and gallery fit both widths languages and themes
(pass) KB-76: reduced motion stays below one millisecond
(pass) KB-76: all unrelated shared exports remain identical to the base

1 tests failed:
(fail) KB-76: retry success closes without extending the deadline [1.54ms]

 23 pass
 1 fail
 71 expect() calls
Ran 24 tests across 1 file. [200.14s]
```

Exact install after cache bootstrap (UNKNOWN timeout)

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```


## Completed local E2E failure tail (last 20 lines)

```text
[109/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:201672) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:201747) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  2 failed
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  26 passed (3.9m)
```

Initial exact install (UNKNOWN terminated stall)

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Offline exact install (UNKNOWN terminated stall)

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

```text
status: blocked
ticket: #1180
evidence: source 499745a6670d4667d1265997ddb3d6e1f8de9230; final focused browser 27 pass/0 fail; full unit 3328 pass/0 fail/3 todo; local E2E 26 pass/2 fail/89 skip; lint/typecheck/four scans/build completed; first-head GitHub CI green
changed: apps/web/components/goals/shared.tsx; apps/web/lib/i18n-groups/kb-76.ts; apps/web/app/v3/kb-76.css; tests/unit/kb-76.test.tsx; docs/polish/evidence/kb-76-undo-request-ownership.md; docs/polish/evidence/kb-76-undo-request-ownership.jpg (zero new primary views)
unknowns: exact frozen install stalled; detailed remote test counts (log download 403); device screen reader; live backend writes and deployed persistence
notes for ticket sync: local E2E loading timeouts remain outside this toast repair; three repair rounds exhausted; no fourth source/test repair; Hebrew machine-drafted; callbacks and deadline unchanged
```


## 21 Oct: explicitly authorized additional repair pass

Amit's **AWAY — KB FINISH** instruction grants one additional repair pass for an exhausted KB ticket, with the existing six-file scope and checks unchanged. This authorizes the repair below; the three failed/historical rounds above remain part of the record. The branch rebased onto `origin/integration` at `52bf280` with no change. A refreshed ownership audit found no competing writer for `goals/shared.tsx`.

The [CodeRabbit review](https://github.com/Levidavidspublic/tempo-rhythm/pull/1183#pullrequestreview-5597556707) raised two valid findings: replacement tests settled A before proving B had committed, and this evidence omitted the latest required CI failure. Both are addressed. No paid review CLI, additional provider or bot run was invoked by the repair worker.

The scheduling concern was also a product defect within the existing callback contract. An isolated diagnostic against the unchanged pre-pass `499745a` product queued `c.replace("B")` and `c.settle("A",true)` in the same browser task. React had not committed B, so A still owned its component and immediately called the parent's parameterless `onClose`. React batched the parent's B update with the later null update, and no toast remained. The child process exited 0 while recording the case as `pass: false`, with the same missing “Change B” / 5,000 ms assertion signature reported by hosted CI. This local proof establishes the demonstrated ordering; the exact hosted case and remote trace remain UNKNOWN because the job logs were unavailable.

Success now publishes a completion token in the toast's local state. A post-commit effect verifies the toast object, mounted owner and request token before consuming that completion and calling the existing `onClose` once. An already queued replacement can commit first and invalidate A. Expiry invalidates the owner before closing so a pending completion cannot close again. Failure still clears the synchronous duplicate guard and exposes retry, with the original deadline and callback arguments unchanged. No caller, public signature, retention policy or other shared export changes.

Committed-replacement tests now explicitly observe the replacement title before settling the old request. Two additional tests deliberately queue the parent replacement and settle A in the **same browser task**, without waiting for a commit, covering different IDs and the same ID. Both prove B remains actionable, A causes zero closes, and B's own successful Undo closes exactly once. The 27 original cases, post-settlement assertions and all existing timeouts remain intact; no configuration, assertion or check was relaxed.

| Additional-pass check | Result |
|---|---|
| Diagnostic against pre-pass product | Recorded failure: expected “Change B”, element not found within 5,000 ms; process exit 0 because the child serializes results. |
| Preliminary synchronization-only `bun test tests/unit/kb-76.test.tsx` | exit 0; **27 pass, 0 fail**, 81 wrapper assertions, 119.49 s. This run predates the additional product repair and two new cases. |
| Final `bun test tests/unit/kb-76.test.tsx` | exit 0; **29 pass, 0 fail**, 87 wrapper assertions, 135.46 s. Includes both queued-replacement cases and unchanged real ProjectDetail caller. |
| Scoped `biome lint` from `apps/web` | exit 0; 3 production files checked, no fixes. An earlier root-level invocation could not resolve the existing relative config extension; using the package's working directory resolved it without any config edit. |

Final product source SHA-256: `7b8d9caa48a2b71e5bbd6574216a3cf20a7fa0b605b2095aa300da57e0494863`. Final scoped test SHA-256: `91adcc64d090a412993114d1ebca95bb86d9813c02dee799b942e3dd682694dc`. Existing contact-sheet images describe the historical appearance; no new view or visual styling is added by this pass.

Additional named cases:

28. a queued replacement survives success in the same browser task
29. a queued same-id replacement survives success in the same browser task

The final mandatory gate outcomes will be recorded below. A new pushed head's required GitHub results are separate from these local results and must be checked on that exact head.

## AWAY — repair draft, validation pending

Root independently completed final typecheck (5/5); lint passes. Frozen installation remains UNKNOWN after its resolver bound. All 29 focused cases pass. The prior failed hosted and local candidates above remain part of the evidence.

The lead owns the remaining full unit suite, scan confirmation, local E2E and build commands. They are queued separately under the shared resource lock; no passing result is claimed for an unfinished command. This repair may be pushed as a draft for hosted CI, but is not yet eligible for integration. No assertions, check configuration, timeout or skip conditions were weakened. The lead will append actual outcomes and failure tails before the merge gate.
