# Current checkbox gate receipts

WALK — The required local gates are not green. Frozen source: `f653de8bb84738404c3b701e4d1b422490a6f9b3`; no source or test changes occurred during these commands. All remaining commands ran despite failures. No unchanged failing command was rerun. This evidence-only follow-up does not alter that source attribution.

| Command | Result and source |
|---|---|
| Bun | 1.3.9 |
| Frozen install | Earlier f23f324 capacity-recovery receipt: exit 0, 1033 installs / 1079 packages, no changes; earlier exit 124 and NoSpaceLeft exit 1 retained |
| Lint | Platform-corrected candidate, committed as 97528b1: exit 0, 5/5 |
| Typecheck | 97528b1: exit 0, 5/5; f653de8 changed evidence only |
| Full test | f653de8: exit 1; 3496 pass, 5 fail, 3 todo, 1 error; 81554 assertions, 212 files, 1060.86 seconds |
| Four scans and notices | f653de8: exit 0, all four OK |
| Exact local Playwright | f653de8: exit 1; 23 pass, 5 fail, 89 existing credential/preview-gated skips, 5.0 minutes |
| Placeholder build | f653de8: authoritative exit 0; 1/1 successful, 2m12.285s Turbo duration |

The corrected checkbox group passed all eight cases inside the full suite, including the unchanged screenshot matrix (11948.59ms). The earlier corrected focused run passed 8/0 with 39 assertions; these focused results do not override aggregate failures. No preview, real account, paid model call or production deployment was exercised. Mac and Windows execution remains UNKNOWN; the browser run was Linux.

## Full test: complete failure list, aggregate and last 20 lines

```text
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


5 tests failed:
(fail) KB-74 real shell drawer focus > mounted shell and gallery fit both languages, themes and widths [60017.43ms]
  ^ this test timed out after 60000ms.
(fail) KB-74 real shell drawer focus > reduced motion uses the existing near-zero CSS policy [156.69ms]
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [3331.62ms]
(fail) preferences and notifications > the coach dial saves 400 ms after it stops moving [26809.23ms]
  ^ a beforeEach/afterEach hook timed out for this test.
(fail) preferences and notifications > Mark all read calls notifications.markAllRead and Mark read targets one item [1397.93ms]

 3496 pass
 3 todo
 5 fail
 1 error
 81554 expect() calls
Ran 3504 tests across 212 files. [1060.86s]
error: script "test" exited with code 1
```

Exact uncaught error (the aggregate's separate 1 error):

```text
# Unhandled error between tests
-------------------------------
86 |   const pageErrors: string[] = [];
87 |
88 |   async function open(width = 390, params = ""): Promise<Page> {
89 |     const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
90 |     page.on("pageerror", error => { pageErrors.push(error.message); console.error("KB-74 fixture page error:", error.message); });
91 |     await page.goto(`${origin}/?${params}`, { waitUntil: "load", timeout: 60_000 });
                    ^
error: goto: Target page, context or browser has been closed
Call log:
  - navigating to "http://127.0.0.1:36689/?lang=he&theme=dark", waiting until "load"

 log: [ "  - navigating to \"http://127.0.0.1:36689/?lang=he&theme=dark\", waiting until \"load\"" ],

      at open (/workspace/work/lane2-pages/tests/unit/kb-74.test.tsx:91:16)
      at /workspace/work/lane2-pages/tests/unit/kb-74.test.tsx:312:6
      at processTicksAndRejections (native:7:39)
-------------------------------
```

Failure details: KB-74 matrix exceeded its unchanged 60000ms deadline and the next reduced-motion case encountered a closed browser. The shared page-summary pathological case measured 3320.563137ms against its unchanged 3000ms threshold. The preferences coach-dial case timed out in a beforeEach/afterEach hook; the following notification case threw `TypeError: null is not an object (evaluating 'view.textContent')` at PreferencesForm.test.tsx:563.

The failing test files and page-summary module have no diff against the merged integration base `7d1a0f6`. The PR's only product change is the editor live-preview module. This establishes unchanged files, not proof of failure causality; all five failures and the uncaught error remain FAIL.

## Exact local Playwright: complete failure list and last 20 lines

Command: `CI=1 bunx playwright test --reporter=line`. No preview base URL was set.

```text
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:222860) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:222905) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  5 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/fix/calendar-add.spec.ts:26:7 › calendar add event › local mode: form renders and adds without a sign-in message
    [chromium] › tests/e2e/fix/insights-loads.spec.ts:5:5 › /insights leaves the loading placeholders within 8 s
    [chromium] › tests/e2e/fix/passkeys-signed-in.spec.ts:22:7 › passkeys settings › signed out goes to /sign-in
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  23 passed (5.0m)
```

The five failures were calendar reload, local calendar-add textbox readiness, insights loading, signed-out passkeys navigation, and cross-view task persistence. Each reached its unchanged 30000ms test deadline. The insights assertion also reported a protocol session-closed error; task navigation reported ERR_ABORTED. These test files have no diff against integration base `7d1a0f6`; causality is not established by that fact.

## Scans, build and cleanup

```text
$ bun scripts/scan-forbidden-tech.ts
scan:forbidden-tech OK — no forbidden dependencies or imports found.
$ bun scripts/scan-ram-only-audit.ts
scan:ram-only-audit OK — hard deletes dropped to 6 (baseline 10). Lower scripts/scan-baselines.json to lock in the improvement.
$ bun scripts/scan-design-tokens.ts
scan:design-tokens OK — arbitrary hex 4/18, raw hex 2/2 (at or below baseline).
$ bun scripts/check-notices.ts
check:notices OK — every runtime dependency has a notices entry (66 documented).
```

The build ran with the existing placeholder URL command `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build`. Its actual exit was observed at 2026-10-21T22:56:17Z before success was recorded.

```text
tempo-rhythm-web:build: ├ ƒ /templates/builder
tempo-rhythm-web:build: ├ ƒ /templates/editor/[id]
tempo-rhythm-web:build: ├ ƒ /templates/run/[id]
tempo-rhythm-web:build: ├ ƒ /templates/sketch
tempo-rhythm-web:build: ├ ƒ /terms
tempo-rhythm-web:build: ├ ƒ /today
tempo-rhythm-web:build: ├ ƒ /tracking
tempo-rhythm-web:build: ├ ƒ /week
tempo-rhythm-web:build: └ ƒ /week/[week]
tempo-rhythm-web:build:
tempo-rhythm-web:build:
tempo-rhythm-web:build: ƒ Proxy (Middleware)
tempo-rhythm-web:build:
tempo-rhythm-web:build: ƒ  (Dynamic)  server-rendered on demand
tempo-rhythm-web:build:

 Tasks:    1 successful, 1 total
Cached:    0 cached, 1 total
  Time:    2m12.285s
```

After E2E stopped, its owned Next and browser processes were inactive and port 3000 was empty. Only the verified gitignored `apps/web/.next/dev` directory was removed before building. At build exit the owned runner/compiler/browser processes were inactive, port 3000 was empty, and the worktree was clean. The shared heavy slot was then released before this documentation was written.

## Earlier source: preserved failures, not current-head receipts

The original f23f324 suite had 3464 pass / 37 fail / 3 todo / 1 error. Its complete final failure list follows; it was not replaced by the current run. The current run followed actual test changes and the integration merge. The environment-interrupted earlier run remains UNKNOWN without an exit receipt.

```text

37 tests failed:
(fail) KB-74 real shell drawer focus > mounted shell and gallery fit both languages, themes and widths [60009.12ms]
  ^ this test timed out after 60000ms.
(fail) KB-74 real shell drawer focus > reduced motion uses the existing near-zero CSS policy [137.62ms]
(fail) KB64 Undo recovery > expiry during a pending request waits for fulfillment then expires once [214.55ms]
(fail) KB64 Undo recovery > rejection after pending expiry expires without offering a fresh retry [38.44ms]
(fail) KB64 Undo recovery > retry does not restart the expiry timer [9.22ms]
(fail) KB64 Undo recovery > fulfillment makes no invented success claim and does not expire early [4.96ms]
(fail) KB64 Undo recovery > unmount fences a stale rejected request and cancels expiry [1.80ms]
(fail) KB64 Undo recovery > changed deadline fences an old rejection without leaking error or busy state [16.02ms]
(fail) KB64 Undo recovery > changed deadline fences an old fulfilled request after the old deadline [16.02ms]
(fail) KB64 Undo recovery > new inline callback identities do not reset an active request [16.04ms]
(fail) KB64 Undo recovery > Hebrew recovery has RTL direction and localized action copy [16.02ms]
(fail) KB64 Undo recovery > an immediate fulfillment crossing the deadline still schedules post-commit expiry [16.04ms]
(fail) KB64 Undo recovery > late successful real detail restoration keeps the parent navigation authoritative [16.05ms]
(fail) KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [16.10ms]
(fail) KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [16.03ms]
(fail) KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [16.04ms]
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [16.05ms]
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [16.26ms]
(fail) load-more view names the currently visible count and preserves LTR numerals [152356.14ms]
(fail) end view describes the current snapshot rather than all history [0.25ms]
(fail) Hebrew count and end message keep numbers isolated [0.15ms]
(fail) Hebrew load-more control remains a real button [0.12ms]
(fail) gallery statically mounts the actual activity heading and feed views [1.20ms]
(fail) mounted caller and exact query contract remain wired [0.65ms]
(fail) English and machine-drafted Hebrew keys have parity [0.16ms]
(fail) no entries retain the mounted empty view and no paging control [0.10ms]
(fail) exactly 20 items show a current-snapshot end without a button [0.11ms]
(fail) 21 items focus the new row after final-button removal [0.03ms]
(fail) 30 exactly completes in one chunk and keeps the new row in view [0.06ms]
(fail) 31 items require two chunks and focus rows 21 then 31 [0.03ms]
(fail) focus moved elsewhere during a load remains there [0.17ms]
(fail) Hebrew direction, time and counts remain readable [0.40ms]
(fail) StrictMode announces each loaded count once and transfers focus once [0.05ms]
(fail) reactive insertion alone does not steal focus and next chunk uses its stable boundary [0.03ms]
(fail) pending load keeps its older boundary when the anchor disappears beside a new top row [0.22ms]
(fail) gallery controls and retry callback remain operable [2.06ms]
(fail) mounted production view and gallery fit phone and desktop in both languages and themes [1.19ms]

 3464 pass
 3 todo
 37 fail
 1 error
 81388 expect() calls
Ran 3504 tests across 212 files. [1426.08s]
error: script "test" exited with code 1
```

Earlier f23f324 E2E ended 25 pass / 3 fail / 89 skips. Its final failure list is preserved here:

```text

  3 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  89 skipped
  25 passed (4.3m)
```

Earlier install exit 124 (120-second observation), subsequent NoSpaceLeft exit 1, and recovered exit 0 remain distinct receipts. The recovery followed proven disk-capacity restoration and reported no dependency changes. See the README for those failure tails and the fresh-checkout browser prerequisite; no install hook or CI provisioning was changed.
