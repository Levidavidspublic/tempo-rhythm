# KB-78 ConfirmSheet pending focus evidence

PR open — v3 fixture continuation passes all 22 KB-78 cases and the final shared harness (40 combined passes). The earlier-source full unit suite passes; mandatory E2E retains one existing task-view timeout. Shared #1203, current-head CI and CodeRabbit remain merge gates. The dated v3 section below contains exact receipts; prior sections are historical.

**Status: authorized additional repair handed to root for remaining build and latest-head CI (2026-10-21).** The original three-candidate run stopped with two scoped CI failures. Amit subsequently granted exactly one additional repair pass for exhausted KB tickets, with scopes and checks unchanged. The new pass repairs React commit synchronization in the scoped browser fixture; historical failures below remain evidence. Both CodeRabbit findings are addressed and all 22 focused cases pass. Fresh full unit and E2E failures are disclosed below; root owns the remaining build and latest-head required checks. Local frozen install remains UNKNOWN after its fresh 120-second timeout.

This polishes the existing `ConfirmSheet` in `components/you/Controls.tsx` and adds **zero primary views**. The confirm button remains focusable with `aria-disabled` and an explicit busy guard, while the dialog reports `aria-busy`. Tab containment also recovers focus lost outside the open dialog. The parent still supplies `busy`, owns accepted request lifetime/success/error and decides whether an explicit close proceeds. Confirm and close callbacks receive no arguments. Existing Cancel initial focus, Escape/Close/Cancel behavior and opener restoration remain available. Segmented/Switch source and runtime behavior are unchanged.

## Baseline and real mount

Baseline: integration `52bf2803e9105b25c2538aedd81a754a9fbfdedb`, frozen before editing. Original Controls SHA256: `2c5f1998fe329c67acbf604782eb1af2c2f90d94b270f5c91575c6436140ee9a`. The exact frozen source is embedded in the one scoped test to make the original/current comparison reproducible in a clean CI checkout. The original lead proof was reused only after exact source hashes matched; its JSON/log were copied into ignored `work/kb78-baseline/`.

Read-only mount: `app/(tempo)/settings/integrations/page.tsx` → `IntegrationsList` → actual unchanged `ExecutorConnection` → actual `ConfirmSheet`. The browser fixture renders that real host with fictional query/auth and deferred existing action boundaries. It sends exactly `connections.disconnect({provider:"executor"})` once; no live connection or account is read or changed. This is a screen slice with the existing page/main/heading supplied by the fixture, not a full authenticated route or deployed-service check. The gallery mounts the production ConfirmSheet itself.

Original trace: Enter on Confirm → active element BODY → Tab to background `#after` while alertdialog stays open. Current trace: Enter → active element BUTTON → Tab remains inside the still-open dialog. Shift+Tab remains contained. Repeated Enter, Space and real mouse-coordinate clicks while busy produce one accepted action. The unchanged caller closes and updates its own state on success; rejection remains its safe error/close path.

## Focused browser validation

Command: `bun test tests/unit/kb-78.test.tsx` using Bun `1.3.9` and installed Chromium under validation → fixture → E2E locks. **PASS: 21 tests, 0 failures, 24 expectations; 138.15 seconds.** Run/capture interval: 2026-10-20 03:33:29–03:35:47 UTC. All 24 captures completed at 390/1280 px, en/he and light/dark, covering frozen original caller, corrected caller and real gallery. Current cases assert one main/h1, 44 px minimum dialog targets, no horizontal overflow, visible focus, near-zero reduced motion, bilingual copy and RTL. Browser page/console errors: none.

The initial queue from 02:28:58 was interrupted during an environment/session interval before Bun started: log size zero, no retained exit and no live process. It is UNKNOWN, not a test pass. The pre-run review candidate still counts toward the three-candidate limit. Two test-only pre-run review corrections were applied before the first actual run: use real pointer coordinates for aria-disabled controls, and accept the app's existing `0.01ms !important` reduced-motion rule. No global CSS/config changed.

Named regression cases:

- dictionary parity and exact frozen source preserve the other exports
- actual caller original escape and current Enter pending Tab containment
- Shift Tab stays inside the busy real caller
- pointer accepted action retains focus while pending
- busy Enter Space and pointer repeat send one unchanged call
- normal forward and reverse wrapping includes available body controls
- lost outside focus recovers in either direction
- Cancel receives initial safe focus
- Escape Close and Cancel restore the existing opener
- busy explicit closing still follows the parent callback
- real parent success closes and updates its own connection state
- real parent rejection owns error and closing without raw detail
- fresh callbacks receive no event arguments
- StrictMode unmount removes listeners and restores once
- Segmented and Switch keep their existing runtime behavior
- parent busy remains authoritative without an inferred lifetime
- English Hebrew RTL and real gallery states
- exact UTF8 production copy and actual shell icons render
- visible focus and reduced motion stay available while busy
- 390 1280 light dark matrix has 44px targets and no overflow
- real fonts are served and fixture console stays clean

## Capture and font provenance

Three review/check candidates were used and two focused runs executed. The first executed run passed 20 cases but root visual review found fixture mojibake and a missing shell icon sprite; those captures are invalid locale/visual evidence and are archived only under ignored `work/kb78-round1/`. Candidate 3 changes only the fixture: explicit UTF-8 HTML/JS/CSS headers and meta, the actual TpIconSprite, and exact production-language/icon assertions. The product source stayed unchanged through those fixture corrections. The final sheet contains only the 24 third-candidate captures, verified against the recorded run interval (ended timestamps have one-second resolution). At that stop, no fourth source/test repair was permitted; the later explicit one-pass exception is recorded below.

The [contact sheet](./kb-78-confirm-sheet-focus.jpg) uses actual unmodified browser screenshots, resized only for the labelled grid. The production components, real LocaleProvider and compiled app Tailwind/v3 styles are used. The fixture serves app font files at equivalent `/fonts/...` URLs, waits for `document.fonts.ready` and asserts loaded Source Sans 3/Assistant in the language matrix. Actual requested faces: /fonts/newsreader/Newsreader-latin.woff2, /fonts/source-sans-3/SourceSans3-latin.woff2, /fonts/frank-ruhl-libre/FrankRuhlLibre-latin.woff2, /fonts/assistant/Assistant-latin.woff2, /fonts/frank-ruhl-libre/FrankRuhlLibre-hebrew.woff2, /fonts/assistant/Assistant-hebrew.woff2. Next's generated font class names and fallback-metric adjustment are not recreated; the local Newsreader face supplies the root variable directly. IBM Plex Mono is not exercised here and uses a generic monospace fallback if requested. No remote font/provider call occurs.

Hebrew additions are machine-drafted for Amit's native read. Native device/screen-reader behavior and live disconnect authorization/writes remain UNKNOWN. The screenshot sheet proves appearance only; the hydrated assertions prove focus, activation and callback results.

## Ownership and scoped source

Refresh: 116 open PRs. Compared with the complete 113-PR cache, new #1185/#1186/#1187 and changed #1183/#1140 are disjoint from Controls. The existing complete file audit shows Controls only in release promotion #728; the active-issue cache has no Controls scope owner. KA #1118's separate ExecutorConnection mount stays read-only.

Other-export section SHA256 remains `5124c4660af9f99eedd876eec519225125106eefb3492c0e42f8d9ff114aa9ed`. Source hashes at the passing focused run:

- `apps/web/components/you/Controls.tsx`: `d1c1e8ae2b983a82501e75d3a9080db44572cf7761723a9419792771bc656a02`
- `apps/web/lib/i18n-groups/kb-78.ts`: `b33a4250292c74f4ed114ccade89f7f39e79e63150b658fc62f6fd7c44094d56`
- `apps/web/app/v3/kb-78.css`: `dd1c39a72c58e89396d65fa5e7035e11518d352e85078ba5725ffe83f2845cff`
- `tests/unit/kb-78.test.tsx`: `9a9186725bb3369b815fe8acda6cc87ec92a9bfd6129a8fa0f9f92237d7e2a0a`

## Test results (cloud agent sandbox)

| Exact command | Result |
| --- | --- |
| `bun --version` | PASS: 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: exit 124 at the authorized 120-second limit, stalled at Resolving dependencies |
| Scoped Biome check from apps/web | PASS: 3 files, no fixes/errors |
| `bun test tests/unit/kb-78.test.tsx` | PASS: 21 pass, 0 fail, 24 expectations |
| `bun run lint` | PASS: exit 0, 5/5 tasks, 9 existing warnings |
| `bun run typecheck` | PASS: exit 0, 5/5 tasks |
| `bun run test` | PASS: exit 0, 3322 pass, 3 todo, 0 fail; 81042 expectations, 3325 tests / 202 files, 130.25s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS: exit 0; all four scans OK, 66 notices documented |
| `CI=1 bunx playwright test --reporter=line` | FAIL: exit 1; 2 failed, 89 skipped, 26 passed (5.2m) |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS: exit 0; 1/1 tasks |

After the install timeout, bun.lock and all seven root/workspace manifests were verified byte-identical to the existing KB75 worktree; all six ignored dependency directories were copied, with no Turbo archives. The first formatting invocation from repo root could not resolve the app's relative Biome config; the same scoped command passed from apps/web, without a config or product-source correction.

Install timeout log (all available lines):
```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

All six mandatory formal stages ran on frozen source head `6e66869056df56fde7f5873f946a8cfc054316a7`; SHA256 checks confirm all three implementation files and the scoped test remained byte-identical after every stage completed. Heavy commands were serialized. Build used process-only `TURBO_CACHE=local:r` to avoid cache-archive disk growth; its required command and placeholder Convex URL were otherwise unchanged. No failed gate was rerun. Exact per-stage timings/exits are retained in ignored `work/kb78-validation/results.json`.

## Source-head GitHub checks

At source head `6e66869056df56fde7f5873f946a8cfc054316a7`, [CI run 39365351106](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39365351106) completed with aggregate ci **FAIL**. Test: **3320 pass, 3 todo, 2 fail**, 81042 expectations, 3325 tests / 202 files, 60.89s. The two new failures were:

- `fresh callbacks receive no event arguments`: close callback expected `{version:3,args:0}`, received `{version:2,args:0}`.
- `StrictMode unmount removes listeners and restores once`: expected close count 1, received 2.

Read-only inspection suggests the tests issue Escape immediately after `evaluate(setState)` without awaiting the React commit. That is an unverified timing hypothesis; neither a product nor a harness cause has been established. Both failures remain unresolved and disclosed, even if a later evidence-only head happens to pass. No rerun or further repair is authorized by the exhausted budget.

All other source-head checks passed: Typecheck 5/5; Build 1/1; E2E 28 pass / 89 credential-gated skips; preview smoke 4 pass (preview job used Bun 1.3.14, while primary CI used 1.3.9); lint; scans/notices; scope/config/secret guards; secret self-tests. Primary CI dependency installs succeeded; that does not replace the local install timeout.

CI failed command actual last 20 lines (trailing whitespace omitted) before job cleanup:
```text
2026-10-20T03:39:46.4441919Z
2026-10-20T03:39:46.4442269Z ##[endgroup]
2026-10-20T03:39:46.4442444Z
2026-10-20T03:39:46.4442952Z 3 tests todo:
2026-10-20T03:39:46.4443578Z (todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
2026-10-20T03:39:46.4444782Z (todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
2026-10-20T03:39:46.4445396Z (todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages
2026-10-20T03:39:46.4445676Z
2026-10-20T03:39:46.4445688Z
2026-10-20T03:39:46.4445767Z 2 tests failed:
2026-10-20T03:39:46.4446161Z (fail) KB-78 actual confirm pending focus > fresh callbacks receive no event arguments [1.00ms]
2026-10-20T03:39:46.4446715Z (fail) KB-78 actual confirm pending focus > StrictMode unmount removes listeners and restores once
2026-10-20T03:39:46.4446995Z
2026-10-20T03:39:46.4447069Z  3320 pass
2026-10-20T03:39:46.4447242Z  3 todo
2026-10-20T03:39:46.4447420Z  2 fail
2026-10-20T03:39:46.4447592Z  81042 expect() calls
2026-10-20T03:39:46.4447836Z Ran 3325 tests across 202 files. [60.89s]
2026-10-20T03:39:46.4807279Z error: script "test" exited with code 1
2026-10-20T03:39:46.4817185Z ##[error]Process completed with exit code 1.
```

Local `CI=1 bunx playwright test --reporter=line` actual last 20 lines (trailing whitespace omitted):
```text
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[110/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:247475) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:247540) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  2 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  26 passed (5.2m)
```

Local E2E diagnostics (actual log excerpts):
```text
  1) [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date

    Test timeout of 30000ms exceeded.

    Error: locator.fill: Test timeout of 30000ms exceeded.
    Call log:
      - waiting for getByRole('textbox', { name: 'Event title' })


      16 |   await page.waitForLoadState("networkidle");
      17 |
    > 18 |   await page.getByRole("textbox", { name: "Event title" }).fill("Boundary planning call");
         |                                                            ^
      19 |   await page.getByLabel("Event date").fill("2026-08-01");
      20 |   await page.getByRole("button", { name: "Add event" }).click();
      21 |
        at /workspace/work/kb-78/tests/e2e/calendar-views.spec.ts:18:60

    Error Context: test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/calendar-views-event-creat-2a98f-d-Month-views-for-that-date-chromium/trace.zip
  2) [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record

    Test timeout of 30000ms exceeded.

    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
    Call log:
      - navigating to "http://localhost:3000/tasks", waiting until "load"


      27 |     await expect(page.getByText(taskTitle)).toBeVisible();
      28 |
    > 29 |     await page.goto("/tasks");
         |                ^
      30 |     await expect(main.getByRole("heading", { name: "Inbox" })).toBeVisible();
      31 |     await expect(page.getByText(taskTitle)).toBeVisible();
      32 |
        at /workspace/work/kb-78/tests/e2e/task-views-core.spec.ts:29:16

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
```

## Authorized additional repair — 2026-10-21

The user’s KB FINISH instruction explicitly grants one additional repair pass after the original budget was exhausted. This is that single cohesive pass, within the existing six-file scope. The branch was clean before a no-op rebase onto `origin/integration` (`52bf280`). No package, configuration, caller, backend, or production dialog code changes are needed for the observed CI failures. The independent review finding below additionally requires committing dialog handler refs in a layout effect.

The root cause is now established by an actual-source, clean-child Chromium diagnostic, using the same production ConfirmSheet and Direct fixture. React state setters schedule work; the former tests treated return from `evaluate(setState)` as proof of a committed callback update or completed unmount. A same-task scheduled version change plus Escape observed DOM `data-version="1"` and called version 1, while the equivalent Escape after the DOM committed version 4 called version 4. A scheduled unmount plus immediate Escape still found one mounted dialog and increased the close count to 2. After committed removal and restoration, another Escape left that count unchanged; a later independently committed unmount also left the count unchanged. This distinguishes a mounted listener handling input before unmount from a leaked listener after cleanup. Diagnostic output is retained in ignored `work/repair-diagnostic.log`; both diagnostic cases passed with exit 0.

The tracked fixture now renders its callback version as a `data-version` marker and awaits exact versions 2 and 3 before sending the respective activation/Escape. The StrictMode case awaits dialog absence and opener focus before checking post-unmount Escape. The existing exact callback payload, version 3, close count 1, no-argument, focus, and all remaining assertions are preserved. No timeout increase, sleep, retry, test skip, production callback contract change, or local lifetime inference was introduced.

CodeRabbit completed review of `3feeb6b` with exactly two actionable comments: [commit synchronization](https://github.com/Levidavidspublic/tempo-rhythm/pull/1190#discussion_r4335144101), independently confirmed above, and [render-time ref writes](https://github.com/Levidavidspublic/tempo-rhythm/pull/1190#discussion_r4335144078). The latter is a separate concurrency issue: a suspended or discarded render can update handler/busy refs even though the displayed dialog still represents the previous commit. An added regression schedules a version-2/busy transition that suspends after rendering ConfirmSheet, verifies that version 1 remains displayed, and checks that Confirm and Escape still call the version-1 callbacks with no arguments. The new regression failed on the prior source for the expected reason: committed version 1 stayed displayed, `confirms` was `[]` because the uncommitted busy ref blocked activation, and `closes` was `[{version:2,args:0}]`. Browser errors were `[]`. The exact red diagnostic output and trace are retained in ignored `work/repair-concurrent-before.log` and `work/repair-concurrent-before-traces.json`. The narrow correction now updates all three refs in `useLayoutEffect` rather than render, keeping callbacks and busy state synchronized with the committed UI.

Additional-pass validation results are recorded below; build and latest-head checks remain with root. The earlier focused queue was canceled before Bun started (zero-byte log) to incorporate this completed review in the same cohesive repair candidate. Screenshot pixels remain applicable because no rendered markup or visual style changes are required; the new concurrent fixture is separate from captured host/gallery modes.

Fresh validation on the corrected source (Bun 1.3.9):

| Exact command | Additional-pass result |
| --- | --- |
| `bun install --frozen-lockfile` | UNKNOWN: exit 124 after 120.02s at Resolving dependencies; manifests/lock unchanged |
| `bun run lint` | PASS: exit 0, 5/5 tasks, 9 existing warnings, 3.77s |
| `bun run typecheck` | PASS: exit 0, 5/5 tasks, 33.45s |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS: exit 0 after full unit; all four scans OK, 66 notices, 1.66s |
| `bun test tests/unit/kb-78.test.tsx` | PASS: exit 0, 22 pass, 0 fail, 25 expectations; 137.99s |
| `bun run test` | FAIL: exit 1; 3320 pass, 3 todo, 3 fail, 81043 expectations; 3326 tests / 202 files; 275.87s. All 22 KB-78 cases pass |
| `CI=1 bunx playwright test --reporter=line` | FAIL: natural exit 1; 18 pass, 89 credential-gated skips, 10 fail; 10.0m (603.33s process duration) |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PENDING: root explicitly took ownership of build after the active E2E finishes; this additional-pass build has not started |

Final candidate implementation/test SHA256:

- Controls.tsx: `1e673ff934387d05c1284db5e095425a9e0ed0c310b94c8b27fea1be3135c541`
- scoped test: `5be19d47484b49d070d7f076c5c2d8ca25fb4653cd3c4d3225a61527d6ef2c12`
- Dictionary and CSS hashes remain the historical values above.

The corrected focused run passes all 22 cases, including the original CI callback/StrictMode cases and the new `suspended render cannot replace committed callbacks or busy state` regression. Green concurrent trace: `confirms:[{version:1,args:0}]`, `closes:[{version:1,args:0}]`. The actual unchanged caller still produces exactly one `connections.disconnect({provider:"executor"})` action and stays contained: original BODY/outside, corrected BUTTON/inside. Browser errors: `[]`; all six expected local font files were requested. Full traces are retained in ignored `work/repair-focused-traces.json`.

The full unit suite failed three unchanged page-summary performance cases, each against a 3,000ms limit: `preInItem` (4,863.62ms case duration), `tagsOpenOnEveryLine` (7,301.59ms), and `closingTagsOpenOnEveryLine` (4,502.83ms). These files are outside KB-78 scope and were not modified or rerun. No full-suite pass is claimed.

Additional-pass `bun run test` actual last 20 lines:

```text
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [1.38ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [1.19ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


3 tests failed:
(fail) pathological bodies stay linear > preInItem [4863.62ms]
(fail) pathological bodies stay linear > tagsOpenOnEveryLine [7301.59ms]
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [4502.83ms]

 3320 pass
 3 todo
 3 fail
 81043 expect() calls
Ran 3326 tests across 202 files. [275.87s]
error: script "test" exited with code 1
```

Additional-pass E2E completed naturally. Ten cases failed: calendar reload; persisted task views; /habits; /habits/[id]; /brain-dump; /plan dev-bypass wiring; /notifications; /templates/builder; /templates/builder?from=<id>; and /today. The log reports 30-second timeouts. No startup failure from a cache-directory symlink occurred: this worktree uses real copied dependency/cache directories and local @tempo workspace links. The cause of these route timeouts has not been established; no E2E pass or production regression attribution is claimed. All failures are retained without changing tests, configuration, routes or timeouts.

Additional-pass E2E actual last 20 lines (trailing whitespace omitted):

```text
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:41579) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  10 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  89 skipped
  18 passed (10.0m)
```

At root’s explicit request, the active E2E finished naturally and the next build was handed back without starting, so the shared slot could serve other scoped diagnostics. The additional-pass build is PENDING, owned by root; the historical successful build above does not substitute for it. No push, PR metadata, merge or deployment was performed by this repair worker. Source/test SHA256 remained frozen through the mandatory full-unit, scan and E2E stages.

<!-- KB-FINISH-COMPLETED-ROOT-GATES -->
## AWAY — completed root-owned validation

Bun 1.3.9. Commands below ran on the repaired ticket branch with the existing checks, assertions, skips and timeouts unchanged. These local results are separate from hosted CI and CodeRabbit. Earlier scoped results, failures and installation UNKNOWN remain above.

| Command | Result |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | **PASS**, exit 0; Tasks:    1 successful, 1 total |

No production release, live-account validation, native Hebrew review or real-device screen-reader verification is claimed.


## 2026-10-21 — v3 AT-11 shared fixture continuation

PR open — WORKHORSE replaced the buffered parent wait with the shared supervised fixture lifecycle from #1203. All 22 existing cases, assertions, 7,000 ms browser operation timeout, and original 240,000 ms setup deadline (480,000 ms for optional captures) remain intact. All 21 browser callback bodies and the full parent case/assertion block were compared byte-for-byte with `99d216f`. The product, prior screenshots, frozen original source and committed-state waits are unchanged.

Initial validation source `e618a0fb6ac6da7d06e4f6a14c591277583750b9` includes shared `4d30965` and integration via ordinary merges. The whole fixture was already isolated, so its existing Bun builds continue inside that clean child. Build, stylesheet, browser, case and cleanup phases now stream immediately. The shared parent runner reserves cancellation and receipt delivery within the unchanged outer deadline. Cleanup is registered before imports or resource allocation, and browser, loopback server and the unique temporary directory release independently. Diagnostic traces remain at `work/kb78-fixture-traces.json`; optional captures remain at their requested external directory. Successful result JSON is emitted only after teardown. Setup/cleanup failures retain their actual nonzero exit; per-case results keep their existing exact parent assertions.

Before: integration merge-queue run 39592295303, Test job 119196005071, reported 3452 pass / 1 fail / 3 todo; KB-78 setup hit its original 240-second deadline with buffered child phase UNKNOWN. After, initial local focused run on `e618a0f` with shared `4d30965`: `bun test tests/unit/kb-78.test.tsx` exits 0, 22 pass / 0 fail, 25 assertions, 25.35 s. All child phases and cleanup are visible, with authoritative child exit 0 and supervisor descendant reap. These environments differ; the initial local pass does not replace final hosted validation or the shared exit-event correction under review.

Bun 1.3.9. Frozen install is UNKNOWN: the exact command stalled at resolution and exited 124 after an external 120-second bound. Local validation uses the verified installed dependency tree copied from KB-06 after the installer exited; relative workspace links are preserved and no manifest/lockfile changes were made.

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Mandatory sequence on `e618a0f` with shared `4d30965`, in repository order:

| Command | Result |
|---|---|
| `bun --version` | 0; 1.3.9 |
| `bun install --frozen-lockfile` | 124; UNKNOWN resolution stall at external 120-second bound |
| `bun run lint` | 0; PASS, 5/5 tasks |
| `bun run typecheck` | 0; PASS, 5/5 tasks |
| `bun run test` | 0; PASS, 3530 pass / 0 fail / 3 todo, 81,596 assertions, 213 files, 280.28 s; all 22 KB-78 cases pass |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0; PASS, all four |
| `CI=1 bunx playwright test --reporter=line` | 1; FAIL, 27 pass / 1 fail / 89 credential-gated skips, 1.9 min; shared lock used |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | 0; PASS, 1/1 tasks |

The full-suite receipt deliberately identifies the earlier shared source. The final combined proof below covers the subsequent shared exit-event correction.

 Current-head CI, CodeRabbit coverage, shared #1203 and every repository guard remain merge prerequisites. Hebrew native reading and physical-device checks remain pre-production work.


The mandatory E2E failed the existing `task-views-core.spec.ts` case at its original 30,000 ms timeout. Its cause is unconfirmed and its files are outside this scoped fixture correction. No rerun, test edit or timeout change was made.

Last 20 lines of the failed E2E command:

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:150577) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:151098) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (1.9m)
```


Final shared-source proof: ordinary merge source `58d469827eb88a7ba09989263678659f9c123d59` includes shared `2d99c84a365c6ead0009715012b0cdd908b570aa`. The command `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-78.test.tsx` exited 0: **40 pass / 0 fail, 78 assertions, 45.04 s** (18 shared cases plus all 22 unchanged KB-78 cases). The shared owned-waitpid regression and receipt/signal handling pass. Its log includes actual owned supervisor reap rather than assuming a delayed Bun exit event will arrive. The mandatory full-run receipt above remains on `e618a0f`/`4d30965`; it is not presented as a full run of the later dependency.

This branch includes the shared fix for validation, but shared #1203 has not yet landed in integration. Its helper paths therefore remain in this PR diff and are a prerequisite for scope-guard clearance; the issue's allowed scope is not widened. Synthetic receipt identifiers are omitted from evidence; real exit/count/phase/error evidence is retained. No production or deployment action was taken.
