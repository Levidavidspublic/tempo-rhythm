# KB-02 brain dump evidence

Source commits: first production change `1dd30ac53dcb6463ca93b1e5bfea9b203e79f749`, previous source/test revision `adf589515a8276a8c66b161d6cd14cc8c68cc3cb` (`t/1153-kb-02`). The [contact sheet](kb-02-brain-dump-keeps-the-draft-and-makes-the-next-step-clear.jpg) compares the original mounted `BrainDumpScreen` saved before editing with the changed mounted screen at 390 and 1280 px, English and Hebrew, light and dark. Each image uses fictional Maya, Dana and Yoni data. The screen, its pure helpers, i18n, icons, and v3 styles are production modules; Convex data/actions/mutations, locale context and Next link are fixture stubs. The fixture uses local font fallback. No real account or backend is exercised, and labels appear only on the evidence sheet.

## Authorized extra repair — 2026-10-21

The owner authorized one additional cohesive repair pass without changing the acceptance checks. Fixture/test source commit: `3093bb44abb2ae1fd68ff49bc1b02c08d0ad1f61`; production logic, dictionaries and CSS remain at the previously recorded revision. This pass addresses CodeRabbit discussions [4335174361](https://github.com/Levidavidspublic/tempo-rhythm/pull/1160#discussion_r4335174361) and [4335174381](https://github.com/Levidavidspublic/tempo-rhythm/pull/1160#discussion_r4335174381).

The original assertions were reproduced before repair: 0 pass, 2 fail, 9 filtered. The focused button matched `:focus-visible`, but its computed outline was `none`, its box shadow was `none`, and `--color-ring` was empty while `--tp-accent` was defined. The fixture served raw Tailwind `@theme` declarations, which browsers ignore. Compiling the existing application CSS with the installed application PostCSS/Tailwind pipeline restores the real application's resolved focus token; no production focus CSS was added. Fixture bundles and HTML now stay under ignored `work/`, as the ticket requires.

The repaired test keeps the keyboard assertion and strengthens it to require an opaque, visible, solid outline at least 2 px wide with a 2 px gap and measured contrast of at least 3:1. All eight width/language/theme combinations pass. Computed light focus is `rgb(163, 70, 31)` against `rgb(243, 238, 228)`, 5.2593:1; dark focus is `rgb(238, 148, 104)` against `rgb(22, 20, 18)`, 7.9370:1. The 390 px English/light and Hebrew/dark gallery captures were visually inspected: the focused Empty control has a clear ring, and the phone layout and RTL controls remain within the viewport.

The global reduced-motion rule intentionally sets an important `0.01ms` duration, serialized by Chromium as `1e-05s`. The new assertions normalize units and require that exact duration for both the capture status and recovery notice. They also require `transition-property: none`, `animation-name: none`, iteration count 1, and zero active animations. This preserves instant reduced-motion behavior without accepting a broad tolerance or removing motion coverage.

The existing clean-child isolation is preserved: a normal full-suite import defines wrapper cases, spawns exactly this test file with `KB02_ISOLATED=1`, and fails the suite on a nonzero child exit. All `Bun.build`, `Bun.serve` and browser setup stays inside that child. The standalone original-screen capture uses its own dedicated process. No assertions, CI configuration or other ticket fixtures were removed or changed to obtain these results.

Fresh screenshots and measured JSON are under `/workspace/work/kb-finish/kb02/after/`; corrected original-screen screenshots are under `before/`. The scoped contact sheet was regenerated from both compiled-CSS fixtures at 390/1280 px, en/he, light/dark. No real account, backend action or runtime model was exercised. Hebrew remains machine-drafted for native review; device screen-reader verification remains UNKNOWN.

### Test results (cloud agent sandbox) — authorized repair

| Command | Exit and result |
|---|---|
| `bun --version` | exit 0; `1.3.9`, reconfirmed 2026-10-21 UTC. |
| `bun install --frozen-lockfile` | UNKNOWN; bounded at 120 seconds, exit 124, still at registry resolution. |
| `bun run lint` | exit 0; 5/5 tasks, 0 errors; 9 existing web warnings. |
| `bun run typecheck` | exit 0; 5/5 tasks. |
| `bun test tests/unit/kb-02.test.tsx` | exit 0; 11 pass, 0 fail, 11 outer assertions. The isolated child completed successfully; all eight focus/motion metric files and 16 screen/gallery captures were produced. |
| Original-screen capture case | exit 0; 1 pass, 0 fail, 10 filtered, 24 assertions; all eight original-screen captures produced. |
| `bun run test` | Pending in the root-owned validation runner. |
| `bun run scan:forbidden-tech` | Pending in the root-owned validation runner. |
| `bun run scan:ram-only-audit` | Pending in the root-owned validation runner. |
| `bun run scan:design-tokens` | Pending in the root-owned validation runner. |
| `bun run check:notices` | Pending in the root-owned validation runner. |
| `CI=1 bunx playwright test --reporter=line` | Pending in the root-owned validation runner; unchanged route wiring is included. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | Pending in the root-owned validation runner. |

The root agent owns remaining mandatory validation and will append its exact outcomes before integration. This evidence records a successful scoped repair, not completed integration or production verification. Root review/CI/merge gates remain required.

```text
status: blocked
ticket: #1153
evidence: focused KB-02 fixture 11 pass/0 fail; eight cells prove 2px focus at 5.2593:1 light and 7.9370:1 dark, exact 0.01ms reduced durations with no active animations; broad validation pending
changed: scoped KB-02 test and evidence artifacts in this authorized pass
unknowns: exact frozen install; pending broad gates and current CI/review; signed-in backend; device screen reader
notes for ticket sync: one extra repair pass authorized by owner; no acceptance checks waived; accepted-task Undo remains outside this ticket; Hebrew machine-drafted for native review
```

Frozen-install output (the complete output, fewer than 20 lines):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

The earlier evidence and failures below are retained as historical records; the successful focus/motion results above supersede those two earlier failures only.

The original screen preserved a draft and showed the sorted proposal but left the recovery and sorting state implicit. The changed screen mounts `CaptureStatus` beside the draft, adds a quiet `DraftRecoveryNotice` only for genuinely restored content, and returns focus to the draft when it is dismissed. A pending sort keeps the draft visible and temporarily disables dismissal until focus can return. Before accepting an idea, a person can edit its title locally; Save, Cancel and Escape restore focus to the Edit control. The existing Sort, Accept, Add, Save as a page and page Undo mutation calls and argument expressions are unchanged. Open and Undo for a saved page remain keyboard reachable while its removal request is pending. The proposal has one primary Add action, while Sort becomes secondary once a proposal exists.

The interactive `Kb02Gallery` uses the same production views with controlled fictional values for Default, Empty, Loading, Error, Offline, Disabled and Long text. Its controls, language switch, retry callback, disabled action and focus return were exercised in a hydrated browser before the last two assertions were added. All eight after gallery screenshots (390/1280, en/he, light/dark) remain temporary fixture outputs under `/workspace/work/kb-02-capture/after`, not a product route. At 390 px the previously tested controls were at least 44 px high and long text fit without horizontal scrolling. Both the screen and gallery have one `main` and one `h1` in the isolated fixture. Hebrew direction is RTL and user text retains `dir="auto"`; light/dark use v3 tokens. In that earlier pass, the final focus-style and exact reduced-motion duration assertions failed in CI, so those details were unverified at that point.

New named cases in `tests/unit/kb-02.test.tsx`:

1. empty capture gives a gentle prompt before sorting
2. multiline Hebrew capture keeps direction and wraps
3. pending sort leaves the draft visible and then shows a proposal
4. proposal is a preview until a person accepts and adds
5. saved page retains keyboard reachable Open and Undo while removal waits
6. recovery notice dismisses and returns focus to the draft
7. 390 px long text does not widen the viewport
8. offline copy explains the draft and the connection
9. gallery states, controls, focus, and disabled action work
10. English and Hebrew new keys match
11. mounted screen and gallery fit phone and desktop in both languages and themes

## Previous test results (cloud agent sandbox) — before the authorized extra pass

Validation completed on unchanged source/test revision `adf589515a8276a8c66b161d6cd14cc8c68cc3cb`. Counts distinguish the outer suite from its isolated browser child; wrapper cases after the first one do not rerun the browser cases. Non-test checks have no test pass/fail/skip count.

| Check | Exit and result |
|---|---|
| `bun --version` | exit 0; `1.3.9` (reconfirmed 2026-10-20 UTC) |
| `bun install --frozen-lockfile --offline` | exit 0 previously; 2000 packages from cache. |
| `bun install --frozen-lockfile` | UNKNOWN locally; online repeat hung at registry resolution and was interrupted after about 2.5 minutes. CI install on prior pushed heads passed. |
| `bun run lint` | exit 0; 5/5 tasks successful, 0 errors; web lint reports 9 warnings. |
| `bun run typecheck` | exit 0; 5/5 tasks successful. |
| `bun run test` | exit 1; 3310 pass, 2 fail, 3 todo (3315 tests / 202 files). KB-02 isolated browser child: 9 pass, 2 fail, 40 assertions. Outer failures: child wrapper and separate NotesScreen pagehide/debounce assertion. |
| `bun run scan:forbidden-tech` | exit 0; OK. |
| `bun run scan:ram-only-audit` | exit 0; OK (6 hard deletes against baseline 10). |
| `bun run scan:design-tokens` | exit 0; OK (arbitrary hex 4/18, raw hex 2/2). |
| `bun run check:notices` | exit 0; OK (66 documented). |
| `CI=1 bunx playwright test --reporter=line` | exit 1; 27 pass, 1 fail, 89 skipped. Failure: task-views-core completion click times out. Unchanged `/brain-dump` route wiring passes; signed-out E2E bypass fixture only. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | exit 0; 1/1 task successful, 0 cached. Also used process-only `TURBO_CACHE=local:r`; no file/config change. |
| Historical focused fixture run | 11 pass, 0 fail, 78 assertions on the older fixture before child isolation and the two final assertions. **Not validation of the final source/test revision.** |
| Baseline mounted fixture capture | exit 0; 1 screenshot case passed, 10 filtered, 0 failed; 24 assertions. |

Required scans ran individually in prescribed order so every result was retained. Existing Chromium was used with a process-only browser path; no test/config/baseline changes. Contact sheet visually reviewed 2026-10-20: before/after, both widths, both languages and both themes are present. Screenshots alone do not resolve failing focus/motion checks.

The first two draft CI Test attempts on the prior test fixture reported one later `shared codec is browser-safe` failure: `EISDIR reading file: .../zod@4.3.6/node_modules/zod/index.js`. The third attempt removed that later failure by running the fixture's Bun build in a clean child process. I also added two browser assertions beyond that isolation fix without validating them locally before the final push. Both failed in the third CI child run: a focused element matched `:focus-visible` but its computed `outlineStyle` was `none`, and the reduced-motion transition duration was `1e-05s` rather than literal `0s`. The outer CI suite reported 3311 pass, 1 fail, 3 todo because the wrapper surfaced the child failure. The PR is stuck under the agreed three-attempt limit; no further source or test revision is made here.

The existing five-minute Undo belongs to **Save as a page**. `Add accepted` has no task Undo on this screen; a separate backend contract and scoped follow-up are needed to provide one. This ticket does not claim task Undo. Hebrew text is machine-drafted for Amit's native review. Signed-in backend behavior and device screen-reader results remain UNKNOWN.

Open PR #1053 also edits `BrainDumpScreen.tsx`. Its Today placement, receipt and Open Today behavior already exist in this branch's integration base and remain intact. Comparing its proposed file against that base also shows removal of the current two-hour tab draft/plan/choice retention and changes to saved-page tracking. The recovery notice in this PR relies on that retained behavior, so the two proposals require deliberate same-file reconciliation before integration. No merge or rebase was attempted in this ticket.


## Failure logs (last 20 lines)

`bun run test`

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.26ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.47ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.53ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


2 tests failed:
(fail) KB-02 isolated: empty capture gives a gentle prompt before sorting [23297.97ms]
(fail) a waiting save is sent when the page goes away > with nothing waiting, pagehide sends nothing, and typing still waits 500 ms [579.42ms]

 3310 pass
 3 todo
 2 fail
 81026 expect() calls
Ran 3315 tests across 202 files. [76.42s]
error: script "test" exited with code 1
```

`CI=1 bunx playwright test --reporter=line`

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:132558) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:132662) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.9m)
```

The two own browser failures on the final revision are `gallery states, controls, focus, and disabled action work` (`outlineStyle` received `none`) and `mounted screen and gallery fit phone and desktop in both languages and themes` (transition duration expected `0s`, received `1e-05s`). The separate unit failure expected no update after 200 ms but received one at `NotesScreen.test.tsx:303`; the E2E task completion click timed out at `task-views-core.spec.ts:41`. These are observed failures; no unrelated repair or fourth KB-02 source/test attempt was made.

```text
status: stuck
ticket: #1153
evidence: final source adf589515a8276a8c66b161d6cd14cc8c68cc3cb; full test 3310 pass/2 fail/3 todo; own browser 9 pass/2 fail; E2E 27 pass/1 fail/89 skip; lint/typecheck/scans/build pass
changed: scoped BrainDumpScreen, local kb-02 dictionary/CSS, kb-02 test, two scoped evidence artifacts
unknowns: exact online frozen install; signed-in backend; device screen reader; focus/motion correctness after failing assertions
notes for ticket sync: third attempt exhausted; preserve stuck; reconcile #1053 overlap before integration; task Undo outside existing contract; Hebrew machine-drafted for native review
```

<!-- KB-FINISH-KB02-HELD-RESULTS -->
## AWAY — completed full test and refreshed review hold

Bun 1.3.9, source head `407f2e1` rebased on integration `542f2cf`. Full `bun run test` exited 1: **3,426 pass / 3 todo / 12 fail / 1 error**, 81,340 assertions across 208 files in 1,245.99 seconds. Failures concern the existing KB-64/74 browser fixtures and history/page-summary timing checks; they are retained, not reported as passes. The KB-02 isolated child completed successfully. All four scans/notices then exited 0.

Remaining local E2E/build are **UNKNOWN: paused before starting**, to prioritize eligible tickets after the refreshed review identified a valid rejected-edit dead end and inaccurate per-case child-fixture reporting. Existing historical E2E/build results above are not new runs. Hosted checks passed at this head, but the review findings remain unresolved and the PR has returned to draft.

AT-07 on planning PR #1140 requests a further scoped repair because the authorized additional pass has been used. Rejecting the currently edited idea hides its controls while leaving `editingIndex` set, blocking both submission buttons. No further product/test edit or merge was made.

Last 20 lines of full-test failure:

```text
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [120001.76ms]
  ^ this test timed out after 120000ms.
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [30007.27ms]
  ^ this test timed out after 30000ms.
(fail) (unnamed) [5000.92ms]
  ^ a beforeEach/afterEach hook timed out for this test.
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "\ud800" [5325.70ms]
  ^ this test timed out after 5000ms.
(fail) pathological bodies stay linear > deepQuoteLines [18394.65ms]
(fail) pathological bodies stay linear > deepListLines [6117.80ms]
(fail) pathological bodies stay linear > blocksInHtmlBlocks [3298.85ms]
(fail) pathological bodies stay linear > definitionStarts [3081.14ms]

 3426 pass
 3 todo
 12 fail
 1 error
 81340 expect() calls
Ran 3441 tests across 208 files. [1245.99s]
error: script "test" exited with code 1
```
