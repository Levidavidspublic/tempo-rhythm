# KB-02 brain dump evidence

Source commits: first production change `1dd30ac53dcb6463ca93b1e5bfea9b203e79f749`, latest source/test revision `adf589515a8276a8c66b161d6cd14cc8c68cc3cb` (`t/1153-kb-02`). The [contact sheet](kb-02-brain-dump-keeps-the-draft-and-makes-the-next-step-clear.jpg) compares the original mounted `BrainDumpScreen` saved before editing with the changed mounted screen at 390 and 1280 px, English and Hebrew, light and dark. Each image uses fictional Maya, Dana and Yoni data. The screen, its pure helpers, i18n, icons, and v3 styles are production modules; Convex data/actions/mutations, locale context and Next link are fixture stubs. The fixture uses local font fallback. No real account or backend is exercised, and labels appear only on the evidence sheet.

The original screen preserved a draft and showed the sorted proposal but left the recovery and sorting state implicit. The changed screen mounts `CaptureStatus` beside the draft, adds a quiet `DraftRecoveryNotice` only for genuinely restored content, and returns focus to the draft when it is dismissed. A pending sort keeps the draft visible and temporarily disables dismissal until focus can return. Before accepting an idea, a person can edit its title locally; Save, Cancel and Escape restore focus to the Edit control. The existing Sort, Accept, Add, Save as a page and page Undo mutation calls and argument expressions are unchanged. Open and Undo for a saved page remain keyboard reachable while its removal request is pending. The proposal has one primary Add action, while Sort becomes secondary once a proposal exists.

The interactive `Kb02Gallery` uses the same production views with controlled fictional values for Default, Empty, Loading, Error, Offline, Disabled and Long text. Its controls, language switch, retry callback, disabled action and focus return were exercised in a hydrated browser before the last two assertions were added. All eight after gallery screenshots (390/1280, en/he, light/dark) remain temporary fixture outputs under `/workspace/work/kb-02-capture/after`, not a product route. At 390 px the previously tested controls were at least 44 px high and long text fit without horizontal scrolling. Both the screen and gallery have one `main` and one `h1` in the isolated fixture. Hebrew direction is RTL and user text retains `dir="auto"`; light/dark use v3 tokens. The final focus-style and exact reduced-motion duration assertions failed in CI, so those details are not verified by this evidence.

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

## Test results (cloud agent sandbox)

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
