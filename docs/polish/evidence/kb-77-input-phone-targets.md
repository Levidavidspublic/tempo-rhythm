# KB-77 shared Input phone targets

Existing shared Input fields now have a 44px minimum phone target below 768px. Default desktop height remains 40px; explicit taller/narrower caller classes and custom minimum sizes retain their desktop behavior. The component layer permits intentional caller utility overrides. Native props, events, controlled/uncontrolled values, form behavior, ARIA, ref, and displayName are preserved. No route, caller, backend, config or dependency version changed. A pure, explicitly bilingual gallery adds zero primary production views.

Baseline: integration `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. Original Input frozen before editing (SHA-256 `8f5e338505257a77383bed56015ff08132bd65c133e4f4f9470cb2af6be41b30`). Exact implementation/test source commit: `758a0fc5e876393ea21ee900b6b00d0456b24cad`. The first frozen caller run passed before implementation edits, and its original 16 frames are preserved separately. Viewports are 390×1100 and 1280×1100. Both phases of the comparative fixture use one identical compiled globals/v3/Tailwind stylesheet; only the current phase adds scoped kb-77.css. Before mode loads the byte-for-byte frozen Input; after loads the production module. All other caller source remains unchanged.

The real DayPlanPanel, with real TodayGreeting in the existing Today frame, and the real TimeBlockDialog/Radix dialog are mounted with fictional Maya/Dana/Yoni query/mutation boundaries. These are labeled production caller slices, not full authenticated routes. The fixture stubs auth, locale and Convex query/mutation boundaries only, never Input or either caller. Existing Today blur and Plan title/time submit interactions verify the original API argument shapes through spies; no live account or write is used. The matrix contains 16 before/current caller pairs and eight current gallery frames at 390/1280, en/he, light/dark, with one h1/main, no horizontal overflow, visible keyboard focus and reduced motion. Native time editing worked in installed Chromium. The Input minimum is scoped; existing buttons, selects and dialog close targets remain outside this ticket.

Font provenance is a fixture limitation. Production font files exist under apps/web/fonts/source-sans-3 and apps/web/fonts/assistant. The lightweight fixture serves JS/CSS and returns HTML for font asset URLs; it does not serve those files. Both before/current captures therefore use system fallback fonts. A narrow supplemental metadata probe compiled the same unchanged globals through the fixture's PostCSS/Tailwind pipeline and routing. It records non-custom Noto Sans for sampled Latin text/input and Liberation Sans plus Noto Sans for its Hebrew text sample, Source Sans 3 and Assistant faces in error status, and requests for `/fonts/source-sans-3/SourceSans3-latin.woff2`, `/fonts/assistant/Assistant-latin.woff2` and `/fonts/assistant/Assistant-hebrew.woff2`. It records warning-level `Failed to decode downloaded font` and `OTS parsing error: invalid sfntVersion: 1008821359`. This probe is font metadata, not another real-caller pass; the original captures do not retain per-element font metadata. Production-font text geometry remains UNKNOWN. The named console case collects page errors and console error-level events only; its pass does not establish a warning-free console. Original capture warnings were not retained. The contact sheet explicitly labels this limitation.

Hebrew in kb-77.ts is machine-drafted for Amit's native read. Native-device/VoiceOver/TalkBack behavior remains UNKNOWN. Native time controls use the installed Chromium locale; Hebrew page copy does not prove device-localized time chrome. Browser extension tools were unavailable in this runtime after tool discovery; the ticket explicitly permits the installed Playwright Chromium fixture. No provider or hook was added for the gallery.

## Test results (cloud agent sandbox)

| Command | Result |
| --- | --- |
| `bun --version` | 1.3.9 |
| `bun install --frozen-lockfile` | UNKNOWN: resolver timed out after 120s, actual exit 124. Root plus all six workspace manifests and bun.lock matched prepared kb-75 byte-for-byte; all ignored dependency folders restored with no broken links, no tracked changes and no Turbo archives. |
| `KB77_BEFORE_ONLY=1 bun test tests/unit/kb-77.test.tsx` | PASS, actual exit 0; 1 test/3 Bun assertions; unchanged real Today/Plan fields measured 40px at both widths before implementation edits; 16 original frames. |
| `bun test tests/unit/kb-77.test.tsx` | 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions; focused actual exit 0; browser assertions exercise actual callers and native controls. |
| `bun run lint` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run typecheck` | PASS; actual exit 0; 5 successful, 5 total |
| `bun run test` | FAIL; actual exit 1; 3318 pass, 3 todo, 1 fail, 0 error(s); 81072 Bun assertions |
| `bun run scan:forbidden-tech` | PASS; actual exit 0; scan OK |
| `bun run scan:ram-only-audit` | PASS; actual exit 0; scan OK |
| `bun run scan:design-tokens` | PASS; actual exit 0; scan OK |
| `bun run check:notices` | PASS; actual exit 0; scan OK |
| `CI=1 bunx playwright test --reporter=line` | FAIL; actual exit 1; 27 passed, 89 skipped, 1 failed |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS; actual exit 0; 1 successful, 1 total |

The full-unit failure is the unchanged history normalization UTF-8 cap emoji case: 5921.66ms exceeded its 5000ms limit. All 18 KB-77 cases passed in this full run as well as the focused run. Local E2E failed in the existing core task views case while navigating to /projects at tests/e2e/task-views-core.spec.ts:38, exceeding the 30000ms test limit. The 89 skipped tests remain credential-gated; no live account was supplied. These local failures are retained separately from the all-green initial evidence head eab626d02c8a41cc2bd069f71aa5a562b8d044c3 GitHub checks. No source/config/baseline repair or broad retry was made for them.

## Named regression cases

- original and current real Today intention geometry
- original and current real Plan title and native time geometry
- phone defaults reach 44 px and desktop stays 40 px
- explicit taller and narrower caller classes remain usable
- controlled change keeps the native event value
- uncontrolled input preserves its editable default value
- forwarded ref focuses the real input
- name type required autocomplete and native form behavior survive
- disabled and readOnly remain native and do not change
- invalid state and description stay associated
- English and Hebrew gallery dictionaries have exact parity
- pure gallery mounts real inputs with one main and heading
- long Hebrew labels wrap and user text keeps its direction
- keyboard focus remains visible with reduced motion
- real Today blur saves the existing intention argument
- real Plan title and time submit the existing native arguments
- caller and gallery matrix fits both widths languages and themes
- browser identity content and console stay healthy

## Failure evidence

The frozen install produced this complete log (exit 124):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Final 20 lines of bun run test (exit 1):

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.58ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.75ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.45ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


1 tests failed:
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "😀" [5921.66ms]
  ^ this test timed out after 5000ms.

 3318 pass
 3 todo
 1 fail
 81072 expect() calls
Ran 3322 tests across 202 files. [149.22s]
error: script "test" exited with code 1
```

Final 20 lines of CI=1 bunx playwright test --reporter=line (exit 1):

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:223733) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:223845) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.6m)
```

## Factory report

```text
status: blocked
ticket: #1184
evidence: draft PR https://github.com/Levidavidspublic/tempo-rhythm/pull/1186; source 758a0fc; 18 pass, 0 todo, 0 fail, 0 error(s); 54 Bun assertions focused; full unit 3318 pass, 3 todo, 1 fail, 0 error(s); 81072 Bun assertions; E2E 27 passed, 89 skipped, 1 failed; baseline caller 40px -> phone 44px, desktop 40px; lint exit 0; typecheck exit 0; test exit 1; forbidden exit 0; ram exit 0; tokens exit 0; notices exit 0; e2e exit 1; build exit 0; contact sheet and exact failure tails
changed: apps/web/components/ui/input.tsx; apps/web/lib/i18n-groups/kb-77.ts; apps/web/app/v3/kb-77.css; tests/unit/kb-77.test.tsx; docs/polish/evidence/kb-77-input-phone-targets.md and .jpg
unknowns: frozen install resolver timed out (124); production-font geometry (fixture font URLs return HTML and system fallbacks are used); device screen-reader and native device behavior; live account/deployed writes; exact evidence-head remote CI recorded in PR
notes for ticket sync: existing Input polish adds zero primary views; Hebrew machine draft needs Amit's native read; existing KA-owned callers remain read-only; no retry budget reset or backend/caller changes
```

## Owner-authorized fixture repair — 21 Oct 2026

The [current CodeRabbit finding](https://github.com/Levidavidspublic/tempo-rhythm/pull/1186#discussion_r4335089440) is valid for concurrent-run collisions: the fixture sources/builds and result JSON previously used shared fixed paths. In this workspace, `work/` is already ignored by `.git/info/exclude`; this repair uses that existing location without changing ignore/config files.

Each parent run now owns a unique `work/kb77-run-*` directory. Its browser child writes fixture sources/builds inside `fixture/` and results to `results.json` in that same owned directory. The parent removes its directory in `finally`, including child spawn failure, unsuccessful child exit, invalid results, and success. Chromium executable/launch failure stops the loopback server; browser-close failure still reaches server shutdown. The existing nonzero-child-exit check remains before result parsing. All 18 case names, browser/native assertions, 54 parent assertions, and the 480,000 ms setup timeout are retained. Static comparisons of the case-name block, assertion calls, and timeout matched the prior head.

A controlled launch-failure probe used a disposable executable in a separate temporary browser cache. It wrote plausible successful results for all 18 names, then exited 73. The browser child and its parent test failed as expected (test command exit 1), so the successful-looking JSON could not bypass child failure. The probe verified that the unique run directory had been removed; its disposable cache/audit files were also removed. The probe harness exited 0. This exercised the final launch-failure cleanup path without a real browser or live writes.

The earlier table records the original implementation. Current repair checks use Bun 1.3.9:

| Command | Exit | Repair result |
| --- | ---: | --- |
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: resolver remained at `Resolving dependencies` after the authorized 120-second bound. Existing worktree `.bun` is a real directory; workspace dependencies resolve inside this worktree. |
| `bun run lint` | 0 | 5 successful, 5 total |
| `bun run typecheck` | 0 | 5 successful, 5 total |
| `bun test tests/unit/kb-77.test.tsx` | 0 | Final-tree replay: 18 passed, 0 failed, 54 parent assertions; 215.75 seconds |
| `python3 /workspace/work/kb-finish/kb77/check-launch-failure.py` | 0 | Controlled negative probe passed: injected test exit 1, fake browser exit 73, authoritative child failure retained, owned artifacts removed |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK; 66 documented notices |
| `bun run test` | — | Pending lead validation on the integrated candidate |
| `CI=1 bunx playwright test --reporter=line` | — | Pending lead validation on the integrated candidate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | Pending lead validation on the integrated candidate |

The fixture still builds frozen and current phases in its existing clean child. No cross-build collision was reproduced in the focused run or controlled probe. Production Input/callers, copy, styling, and the existing contact sheet retain their prior source and provenance. The font/device/live-write limitations above remain UNKNOWN. The lead records the final integrated source commit with the remaining command results.

Frozen-install output at the bound (exit 124):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

## Third ordinary fixture repair — 21 Oct 2026

The retained source ledger has two prior candidates: implementation `758a0fc` (rebased `e45b6ff`) and the per-run artifact repair `2c38049` (rebased `c45031d304f4532c5c8663599e2b0b97953bfefe`). The intervening JPEG/Markdown commits changed evidence only. This is the third ordinary source candidate on issue #1184/PR #1186; it does not reset the budget or claim an additional exception.

Hosted head `6ef30b2`, job `119198225194`, reached KB-77's setup deadline after about 480 seconds with no individual case output. Its unchanged retry `119208946400` passed every KB-77 case and failed only the then-baseline KB-67 cleanup hook. Later head `c45031d`, job `119219928829`, repeated KB-77's own setup timeout at 480,026 ms, alongside a separate codec timeout. Those buffered logs cannot identify whether KB-77 stalled during imports, CSS, either build, browser work or cleanup; they do not establish a cause in Input or the codec test.

This fixture now streams timestamped child and parent phases, including CSS/build starts and completions, page navigation/readiness, every original case, independent server/browser release, child exit, pipe EOF, result parsing and parent cleanup. Each original case checks the child's authoritative exit and completed cleanup before using its invocation-token results. The 18 original case names and assertions are retained; setup remains 480,000 ms. As in the established KB-61 lifecycle pattern at `35b1c32`, its final second is reserved for cancellation, killing the owned descendant tree/process group, reaping the child and removing its unique parent-owned directory. A timeout cannot become success.

An outer setup `finally` covers failures before and after server/browser acquisition. Server stop and browser close start independently, so a pending/rejected browser release cannot prevent server release. Each case also releases pages retained by failed navigation/assertions. The frozen/current builds remain sequential in the clean child; no unproven cross-build rewrite, production change, assertion removal, skip or deadline increase is included.

Six added lifecycle regressions check original-result completeness, independent pending release, controlled setup failure, browser-close rejection, cancellation during a stalled close with a detached descendant, and retention of both descendant/process-group cleanup errors. The last regression addresses the fresh KB-61 review finding `4336980389`: both cleanup paths are attempted and aggregated rather than letting a `finally` error overwrite an earlier failure; ESRCH remains the only ignored process-exit error. They use fictional loopback resources. The local focused command was canceled while still a verified childless lock waiter after the hosted result below supplied a narrower failure; no local browser case had started. The prior 18-case result remains historical.

| Command | Exit | Third-candidate result |
| --- | ---: | --- |
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: `Resolving dependencies` at the unchanged 120-second bound |
| `bun run lint` | 0 | 5 successful, 5 total |
| `bun run typecheck` | 0 | 5 successful, 5 total |
| `bun test tests/unit/kb-77.test.tsx` | — | Not executed locally: verified unstarted lock waiter canceled after hosted failure |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK; 66 documented notices |
| `bun run test` | — | Lead owns broad validation; its currently running immutable checkout still has the earlier KB-77 head |
| `CI=1 bunx playwright test --reporter=line` | — | Pending lead validation on the integrated final candidate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | Pending lead validation on the integrated final candidate |

Font provenance, physical-device screen readers, live-account behavior and native Hebrew review retain the UNKNOWN limits above. The lead records the final integrated source SHA and broad command outcomes.

## Owner-authorized extra: child OS exit receipt — 21 Oct 2026

The third source candidate `da491f9bfbab34db9124f2f0cf269cffcf6b523a` ran in hosted run `39607985962`, job `119249084458`. Its streamed trace proves all 18 original browser cases passed. Server stop, browser close and results writing completed at 31,500 ms; both output pipes reached EOF at 31,559 ms. The parent never logged a child exit, canceled at 479,003 ms, and hit its existing 480,000 ms hook deadline. The other failure was KB-59's separate 600,016 ms hook timeout. This isolates KB-77's observed failure to parent exit observation after successful child work; it does not establish a product failure or permit treating JSON/EOF as a successful process exit.

The owner authorized the previously unused extra repair pass. Source `502f0cc9214d6d22680f97df2e12188bdf0a4d55` registers `Bun.spawn`'s OS `onExit` receipt at launch and uses that receipt for completion and reaping. A wait-status error rejects; a signal maps to a failing status; nonzero code still rejects every original wrapper. The fixture does not await the stalled legacy `.exited` promise. Bun 1.3.9 reports signal names at runtime despite the numeric callback declaration, so signal handling accepts the observed runtime names through platform signal constants.

A seventh lifecycle regression launches a real child with all 18 successful-looking results, completed cleanup and exit code 73 while deliberately leaving its legacy `.exited` accessor pending. It must receive actual OS status 73, reject success, observe the dead child/server and remove its owned directory. The existing six lifecycle regressions, 18 original case bodies, parent assertions and all deadlines are retained. There are now 25 focused cases. This consumes the one authorized extra; no further source candidate remains authorized.

Syntax and static preservation checks passed before the source commit. Bun-only primitive probes independently verified a real child exit 73 with a pending legacy accessor and the runtime SIGKILL callback shape. These primitive observations do not substitute for the focused suite or integrated gates.

| Command | Exit | Extra-candidate result |
| --- | ---: | --- |
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: `Resolving dependencies` at the unchanged 120-second bound |
| `bun run lint` | 0 | 5 successful, 5 total |
| `bun run typecheck` | 0 | 5 successful, 5 total |
| `bun test tests/unit/kb-77.test.tsx` | — | NOT RUN: the still-childless local lock waiter was canceled (143) after the exact-source hosted failure; no local browser case started |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK; 66 documented notices |
| `bun run test` | 1 | Exact-source hosted Test job `119267322831`: KB-77 setup hook failed at 480,001 ms; separate unchanged codec timeout also failed |
| `CI=1 bunx playwright test --reporter=line` | — | Lead owns broad validation; AT-18 hold after the exact-source hosted failure |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | Lead owns broad validation; AT-18 hold after the exact-source hosted failure |

Hosted [run `39613225865`, Test job `119267322831`](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39613225865/job/119267322831) failed on exact source `502f0cc`. Its child again passed all 18 original browser cases and finished cleanup/results at 20,074 ms. Both pipes reached EOF at 20,122 ms, but no `parent:os-exit` callback was observed. Cancellation occurred at 479,003 ms and the original hook failed at 480,001 ms. The new lifecycle cases were not reached because setup did not complete. The full filtered KB-77 trace is retained locally at `/workspace/work/kb-finish/kb77-extra/hosted-119267322831.log`; the stopped local waiter's receipt is `focused-queue-release.json` in that directory. The local command did not run and is not counted as a focused pass or browser failure.

The underlying cause remains UNKNOWN. Neither the absent `.exited` receipt nor the absent `onExit` callback distinguishes an OS process still alive during runtime teardown from a lost wait-status notification. Results and pipe EOF are insufficient to establish actual OS exit, so the authoritative failure gate remains in place. AT-18 holds this ticket: the third ordinary and one owner-authorized extra source pass are consumed, with no further source change or retry authorized. The missing read-only diagnostic is the child's OS state, wait channel and process start time at EOF, with bounded cleanup; any further code repair needs Amit's authorization.

The font, physical-device, live-account and native Hebrew limits above remain UNKNOWN. The lead owns remote operations and records the final integrated head and broad gate results. No source, package, config, timeout, original assertion or production change followed the failed extra candidate.

## Overnight v3 shared fixture correction — 21 October 2026

Draft; final gates pending. The owner authorized a further scoped fixture pass after the shared Step 0 repair. Role: WORKHORSE. This continues issue #1184 and draft #1186 on its existing branch, retaining prior implementation, screenshots and failed-attempt evidence. Shared prerequisite: #1203 at `4d30965`; scoped source: `3f0145b`.

The parent now uses the shared bounded process runner instead of the bespoke Bun `.exited`/`onExit` observer and hand-written process-tree teardown. It streams phase evidence, retains the actual fixture OS exit and signal, validates completed invocation-token results, and removes the owned directory after the shared supervisor reaps descendants. The original cancellation point remains `deadline - 1_000`; bounded cleanup fits inside the original final second. The 480,000 ms setup deadline and all existing lifecycle-test deadlines remain unchanged.

Frozen and current browser builds use the shared isolated builder in separate owned output directories. The exact frozen Input source and existing fake auth/query/mutation/locale boundaries are preserved; neither actual caller is replaced. Normal and canceled fixture paths share independent server/browser cleanup. All 18 original browser cases, seven existing lifecycle cases, and all 91 original Playwright/Bun assertion lines remain. The entire seven-test lifecycle block is byte-identical. No product, caller, dictionary, stylesheet, screenshot, package or config changed.

The historical test name referring to the stalled legacy exit promise remains. Its original actual exit-73 probe and every assertion remain; the obsolete Bun accessor injection is removed together with the old Bun process observer. The shared runner never consults that legacy receipt and must still reject all-success result data paired with actual OS exit 73. No printed case result or EOF is accepted as an exit.

Before: hosted job `119267322831` printed all 18 browser passes and completed cleanup at 20.074 seconds, then reached stdout/stderr EOF without a received OS exit. Cancellation at 479 seconds and the 480-second setup failure remain the authoritative failed receipt. Its lifecycle regressions never ran; the full run also had an unrelated codec failure.

After: `bun test tests/unit/kb-77.test.tsx`, Bun 1.3.9, exited 0 with **25 pass / 0 fail / 110 assertions in 32.71 seconds**. All 18 real-caller/browser checks and all seven existing lifecycle regressions passed. Main fixture actual exit 0, independent browser/server cleanup, invocation-result validation and parent directory removal were observed. The negative probe returned actual exit 73 despite successful-looking results; cancellation of the deliberately stalled close returned a failing signal, reaped its detached descendant, refused the stopped server and removed the directory. Log: `/workspace/kb-run-logs/kb77-focused.log`.

`bun install --frozen-lockfile` stalled at resolution until the unchanged 120-second external bound, exit 124: UNKNOWN. Dependency directories were copied from the preceding worktree only after byte equality of the lockfile and every root/workspace package manifest was checked. Relative workspace links remain local. No install success is claimed.

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Test results (cloud agent sandbox), scoped source `3f0145b` with shared `4d30965`:

| Required command | Exit | Result |
|---|---|---|
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 124 | UNKNOWN: stalled at resolution for 120 seconds |
| `bun run lint` | 0 | PASS: 5/5, zero errors; existing warnings retained |
| `bun run typecheck` | 0 | PASS: 5/5 |
| `bun run test` | 1 | FAIL: 3,512 pass / 1 fail / 3 todo, 3,516 tests across 213 files, 81,660 assertions, 759.11 seconds |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | PASS: all four |
| `CI=1 bunx playwright test --reporter=line` | 0 | PASS: 28 passed / 0 failed / 89 existing gated skips; 1.2 minutes; shared browser lock held |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | 0 | PASS: 1/1, 32.143 seconds |

The sole full-suite failure was unchanged KB-61’s 480-second setup hook. Its child was observed as an exited zombie under the full-suite parent while the existing Bun exit promise remained pending. No active test was canceled or deadline changed. The failed hook prevented KB-61’s cases from executing, which explains the lower executed count; no cases were removed. All 25 KB-77 cases and all 15 shared cases at that revision passed inside this full run. These failed broad-check receipts remain tied to `4d30965`, not the later shared update.

Last 20 lines of `/workspace/kb-run-logs/kb77-full.log`:
```text
(pass) react-dom inside @tempo/ui > the manifest pins react-dom exactly like apps/web and declares it as a peer [0.09ms]
(pass) react-dom inside @tempo/ui > react-dom resolves here at the pinned version, the same install apps/web uses [0.28ms]
(pass) react-dom inside @tempo/ui > react-dom/server renders a React element from inside packages/ui [0.83ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


1 tests failed:
(fail) (unnamed) [480016.99ms]
  ^ a beforeEach/afterEach hook timed out for this test.

 3512 pass
 3 todo
 1 fail
 81660 expect() calls
Ran 3516 tests across 213 files. [759.11s]
error: script "test" exited with code 1
```

After the mandatory sequence completed, shared `2d99c84` was merged normally for a final combined focused proof. The coordinating worker subsequently reported a separate cleanup race in KB-75’s combined proof: supervisor SIGKILL preceded the child receipt, leaving actual exit unknown. The shared ticket is held for its exhausted repair budget; no local private workaround or repeated retry is authorized. A passing local KB-77 proof cannot clear that prerequisite blocker.

The existing font provenance, native Hebrew, physical-device and live-account limitations remain unchanged.

Final combined proof on merge `e33d9a4` (own source `3f0145b`, shared `2d99c84`): `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-77.test.tsx` exited 0 with **43 pass / 0 fail / 163 assertions in 29.95 seconds**. This is shared 18 plus existing KB-77 25. KB-77's main fixture had actual exit 0; setup-failure/close-rejection probes exited 1; the all-success-data probe exited 73; the intentionally stalled child returned SIGTERM with timeout recorded. Shared waitpid recovery reaped the owned supervisors. All existing lifecycle assertions passed. Log: `/workspace/kb-run-logs/kb77-final-focused.log`.

Hosted CI and actual CodeRabbit coverage of the pushed head remain pending. The shared prerequisite's separately observed cleanup race and the failed mandatory broad run remain blockers; no merge is claimed or requested.
