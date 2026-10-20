# KB-59 — Web search preference request ownership

**Stuck — do not integrate.** Three source/test candidates are exhausted. Besides final tracked 24 pass / 1 fail (font-family assertion), a bounded unchanged-source diagnostic **verified an introduced functional regression**: temporary new-UTC-day status loading discards a pending choice. All mandatory local commands have completed; no fourth repair is authorized. Zero new primary production views. The production host remains mounted by unchanged `/settings/preferences` Page → SettingsScreen → CoachWebSearchSetting, with the real shared switch and header status callback.

## Verified original

Frozen integration base `52bf2803e9105b25c2538aedd81a754a9fbfdedb`; original host SHA-256 `b34a3702a5f7bc8e67ce6387949a173e508e24a4bc7c601c11273e46d831e40f`. Source was frozen before implementation; the lead reviewed the original actual-caller proof and screenshots.

FIFO On(A), Off(B), reject A, resolve B: original shows stored/switch Off and header “Saved.” while retaining “That change didn't save. Try again in a moment.” FIFO On(A), Off(B), On(C), resolve A then B with C unresolved: original displays Off despite latest pending C=On. These do not require out-of-order Convex responses. Adversarial completion tests are separately labelled callback robustness coverage, not assertions about live Convex ordering.

## Existing contract and repair

Only the existing `preferences.update({coachWebSearch:boolean}) → null` mutation is called for each accepted user toggle. `preferences.get({})` remains authoritative when no current request is pending. `coach.webSearchStatus({utcDay})` retains its full available/enabled/usedToday/dailyLimit contract. No backend, provider, quota, routing, configuration or AI behavior changes.

Each mounted private row uses a monotonically unique request identity and a layout lifecycle fence. Only the latest live request owns pending cleanup, errors and the existing Saved announcement. Starting a new choice clears the preceding header status through its existing callback. The switch remains changeable while saving; unavailable providers remain masked Off/locked. Current failure returns to stored query state, explains recovery and permits an explicit new toggle. No automatic retry, serialization, cancellation, compensation or additional network operation.

A typed directly imported English/Hebrew dictionary and scoped token CSS add pending/recovery feedback associated with the switch. Machine-drafted Hebrew is flagged for native review. The gallery shares the same private production row/ownership logic and uses fictional delayed preference saves; gallery/helper exports do not count as new primary product views.

## Test results (cloud agent sandbox)

Bun **1.3.9**. Exact frozen install: **UNKNOWN**, `timeout 120s bun install --frozen-lockfile`, exit 124 at `Resolving dependencies`. `bun.lock` plus all seven root/workspace package manifests match KB78 byte for byte; all six ignored node_modules directories were copied from that working cache. No Turbo archives copied. Every remaining mandatory command was attempted in order, including after failed gates.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | **UNKNOWN** — exit 124 at120-second resolver bound; all available output shown below. |
| `bun test tests/unit/kb-59.test.tsx` | **FAIL** — round 3:24 pass, 1 fail, 25 parent assertions,58.73s; unused-family font assertion in matrix. |
| `bun run lint` | PASS — exit 0, 5/5 tasks, zero errors; 9 existing warnings,Turbo1.792s. |
| `bun run typecheck` | PASS — exit 0, 5/5 tasks,Turbo42.364s. |
| `bun run test` | **FAIL** — exit 1,3,325 pass, 3 todo, 1 fail,81,043 assertions,3,329 tests/202 files,95.69s; sole failure KB59 font matrix. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS — exit 0, all four OK; 0.4s. No baseline changes. |
| `CI=1 bunx playwright test --reporter=line` | **FAIL** — exit 1,27 pass, 89 skipped, 1 task-view Home reset failure;3.1min. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS — actual exit 0,1/1 task, 84.5s; bounded900s,`TURBO_CACHE=local:r`. |

Each heavy gate acquired/released validation.lock separately, preserving command order. Full unit additionally held fixture.lock; E2E held e2e.lock; build held build.lock. Logger elapsed times include shared-lock wait:lint225.9s,typecheck147.8s,test95.8s,E2E185.5s,build84.5s. Source/test were frozen throughout; no broad rerun or fourth repair.

## Browser provenance and limits

The clean-child bundle uses the unchanged actual Page/SettingsScreen/PreferencesForm with real locale/theme providers, shared controls, header status, icon sprite and compiled application CSS. Auth/profile/query/mutation/router/Link boundaries use fictional data and the actual existing API shapes. HTML has explicit UTF-8 metadata and response encoding; exact readable Hebrew is asserted. Existing font files are served from `apps/web/fonts` at requested URLs. Actual rendered-font/console results and final capture timestamps are recorded below. No live account, model/search call, provider or paid service is used.

Deployed preference persistence, live search quality, native screen readers and native Hebrew review remain UNKNOWN. The Browser runtime tool is unavailable in this session; the approved ticket explicitly authorizes isolated Playwright/installed Chromium. Root RULES.md is absent from the base snapshot; AGENTS, SLOTS and cited design/rules/callers were read.

## Ownership and scope

Fresh audit before implementation: 116 open PRs / 3,867 complete file entries and 293 open issue bodies. #1053's 309-file list excludes this component. KA1104's actual declared scope excludes it; shared settings are verify-only. KA1105 references it read-only. Scope is exactly three production files, one test and these two evidence paths. No source/test repair beyond the three-round budget is authorized.

## Candidate ledger and retained failure

1. Initial production request-identity/layout-fence/shared-gallery change: 24 pass /1 fail, 76.19 seconds. Midnight test started only 100ms before midnight; the page load crossed into the next day before its expected initial query. All behavioral regressions and the then-rendered matrix passed, but later review found its dark-labelled captures were light.
2. Test-only clock repair starts 60s before midnight, advances 61s explicitly and asserts the actual UTC timer is cleared when the root unmounts:25 pass / 0 fail,82.22 seconds. Independent review still rejected dark evidence because the isolated fixture omitted RootLayout's prehydration theme script.
3. Test-only fixture correction runs actual themeInitScript, asserts requested data-theme and computed body background, and provides RootLayout's local Newsreader/Mono font variables from the same bundled files. Final tracked result24 pass /1 fail, 58.73 seconds: the new generic font-family check returns false in the matrix. The source/test are frozen after this candidate; no fourth repair, skipped assertion or replacement passing test is authorized.

The immutable original still reproduces both FIFO bugs. The round 3 original capture loop also stops at that font check. Earlier captures are retained in ignored scratch but are not final dark evidence. A separately labelled supplemental read-only visual/font diagnostic is authorized to make the failed draft reviewable; its results do not replace the tracked failure or satisfy the failed gate.

Last 20 lines of final focused failure:

```text
+ Expected: true
+ Received: false"
+ ,
+   "pass": false,
  }

- Expected  - 1
+ Received  + 7

(fail) KB-59 web search preference request ownership > caller and gallery render English Hebrew responsive theme matrix [1.84ms]
(pass) KB-59 web search preference request ownership > gallery shares production save and recover behavior
(pass) KB-59 web search preference request ownership > fixture interactions avoid uncaught app errors and extra operations

1 tests failed:
(fail) KB-59 web search preference request ownership > caller and gallery render English Hebrew responsive theme matrix [1.84ms]

 24 pass
 1 fail
 25 expect() calls
Ran 25 tests across 1 file. [58.73s]
```

Final source/test SHA-256 (frozen during all subsequent checks):

```text
89a2ddca39dbb15affabeb5a306b95b4b78e5faf1b9caf6da1982bcca6818af3  apps/web/components/coach/CoachWebSearchSetting.tsx
c7d840a11c7bbf9a9e7089e5cd43b2af4a4e6f0f813df0de8cf075131258edb0  apps/web/lib/i18n-groups/kb-59.ts
40f38af6c44f97445d5611da9bec77d8198d601530fbe35c478a5f73d80da7e8  apps/web/app/v3/kb-59.css
9c409d1de8de85c3061b069c55e422a5d0c398e9e91cbe6b621b19c9a2f53fd6  tests/unit/kb-59.test.tsx
```

## Supplemental font diagnosis (does not replace the failed gate)

A separate read-only capture diagnostic uses the identical immutable original/current source, real caller and gallery, actual UTF-8/theme script and compiled CSS, while recording individual font checks instead of asserting unused families. Chromium CDP `CSS.getPlatformFontsForNode` identifies the fonts actually rendering the heading and switch label.

English: `document.fonts.check` is true for Newsreader and Source Sans3; the unused Hebrew serif face is false. CDP renders the heading with custom `Newsreader16pt16pt-Regular` and the label with custom `SourceSans3-Roman`. Hebrew: Newsreader and Source Sans3 checks are false because those Latin families are unused/unloaded; Hebrew serif is true. CDP renders the heading with custom `FrankRuhlLibre-Regular` and the switch label with custom `Assistant-ExtraLight`, with actual Hebrew glyph counts. Thus the tracked assertion incorrectly requires unused Latin families on Hebrew pages; this verified diagnostic cause does not turn the failed test into a pass. No fourth source/test repair was made.

The original supplemental 8-scenario diagnostic asserts the requested data-theme and body background: light `rgb(243,238,228)`, dark `rgb(22,20,18)`. It has no uncaught page errors or console errors/warnings. Current caller/gallery diagnostic results and final contact sheet are recorded below. Local assets are served at the actual requested font URLs; RootLayout's Next local-font CSS variables are represented using the same Newsreader/Mono files. Native platform rendering/screen-reader and live deployed behavior are still UNKNOWN.

Final supplemental result: **24 frames** (8 immutable-original caller, 8 current caller, 8 current shared-row gallery), both languages, widths and themes, all requested theme attributes and computed backgrounds verified. Current and original diagnostics both have 0 uncaught page errors,0 console errors and0 console warnings. These are supporting diagnostics, not a passing tracked matrix gate. Full-resolution PNGs, CDP font results and hashes remain in ignored work/kb59; the committed contact sheet uses those supplemental captures only.

Contact sheet `kb-59-web-search-preference-request-ownership.jpg`: 1880 × 7796, 872,963 bytes; SHA-256 `e71439c26c1b445a7c9d9044f3f40196fb4531b0e0b1d2993d6eb1b49d0eb3d9`; composed `2026-10-20T03:46:31.136362+00:00`. Caller tiles join explicitly labelled header and final-row crops to show real header status and the row together; complete PNGs retain the full page. The gallery uses the same private production row,  not a second save algorithm. Frozen-original captures were refreshed after repair from the immutable pre-edit source, within unchanged real Page wiring. Prior incorrectly themed frames are not included.

## Named tracked cases

1. stored false and true drive the real preference row — PASS in final round 3
2. loading either query waits without an actionable row — PASS in final round 3
3. one toggle sends exactly the existing preference patch — PASS in final round 3
4. FIFO earlier rejection cannot outlive later success — PASS in final round 3
5. FIFO ABA keeps latest intent while older equal value settles — PASS in final round 3
6. current success clears pending and announces once — PASS in final round 3
7. current rejection shows authoritative stored choice — PASS in final round 3
8. explicit toggle after error retries once and recovers — PASS in final round 3
9. earlier rejection cannot interrupt newer pending choice — PASS in final round 3
10. earlier success cannot announce or clear newer pending choice — PASS in final round 3
11. adversarial old rejection cannot undo newer success feedback — PASS in final round 3
12. adversarial old success cannot dismiss newer failure — PASS in final round 3
13. synchronous callback throw is recoverable — PASS in final round 3
14. unmounted request cannot announce into surviving SettingsScreen — PASS in final round 3
15. older mount cannot change replacement row — PASS in final round 3
16. parent removal commit fences a settling request — PASS in final round 3
17. StrictMode lifecycle still permits current success — PASS in final round 3
18. unavailable provider stays off and locked — PASS in final round 3
19. daily remaining count stays clamped without a new quota lock — PASS in final round 3
20. UTC midnight refresh preserves latest intent and cleans timer — PASS in final round 3 for synchronous status only; transient-loading regression is verified below
21. query boundary keeps the preferences page usable — PASS in final round 3
22. keyboard switching retains focus and phone targets — PASS in final round 3
23. caller and gallery render English Hebrew responsive theme matrix — **FAIL in final round 3**
24. gallery shares production save and recover behavior — PASS in final round 3
25. fixture interactions avoid uncaught app errors and extra operations — PASS in final round 3

## Verified functional regression — Needs Amit before integration

This is an implementation blocker independent of the font-test failure. Moving ownership state into the private `WebSearchPreference` below the host's undefined-query guard means transient query loading unmounts that state. The original host kept pending state through its null render. The named midnight test passes only when the new-day query returns synchronously; it does not cover this loading interval.

A separate bounded read-only diagnostic runs the actual unchanged Page/SettingsScreen and immutable-original/current host. It starts the real UTC hook at `2026-10-20T23:59:00Z`, toggles On once, holds the legitimate `preferences.update({coachWebSearch:true})` promise unresolved, and advances 61s. The fictional new-day status query supplies its valid loading value `undefined`, then its full ready response; stored preference remains false. This is controlled subscription-boundary simulation, not a claim that a live backend was exercised.

| Step | Immutable original | Current frozen draft |
| --- | --- | --- |
| On A pending, stored false, UTC20 | On | On, Saving feedback |
| UTC21 status query undefined | Row temporarily absent | Row temporarily absent |
| UTC21 status ready; A unresolved; stored false | **On retained** | **Off; pending feedback lost** |
| A then succeeds; stored true | On + header Saved | On; header remains empty |

Both diagnostic commands exited0 because they assert and record this before/current distinction; this does not mean the current behavior is correct or a tracked gate passed. Each trace contains exactly one mutation with the unchanged payload. There are 0 uncaught page errors/console errors/warnings. Complete traces: ignored `work/kb59/loading-original.json` and `loading-current.json`; complete screenshots `original-utc-query-loading.png` and `current-utc-query-loading.png`. Source/test hashes still match the frozen final candidate.

The correct follow-up would retain latest-request state across temporary query loading while preserving real unmount fencing, and cover the interval in a regression test. It requires an explicit repair-budget exception on this same assignment; no duplicate ticket, fourth source/test change, test skip or new API was made. The report remains stuck regardless of other green checks.

## Completed mandatory failure logs

Full unit command: **FAIL**,3,325 pass, 3 todo, 1 fail,81,043 assertions,3,329 tests/202 files,95.69 seconds. Sole local failure is the named KB59 font matrix. Last 20 lines:

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > catalog.validate() drops bindings, so it cannot vet actions [0.77ms]
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.99ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [1.04ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.39ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


1 tests failed:
(fail) KB-59 web search preference request ownership > caller and gallery render English Hebrew responsive theme matrix [1.96ms]

 3,325 pass
 3 todo
 1 fail
 81043 expect() calls
Ran 3,329 tests across 202 files. [95.69s]
error: script "test" exited with code 1
```

Local E2E: **FAIL**,27 pass, 89 skipped, 1 fail,3.1 minutes. The task-view test cannot find Home reset after /projects navigation. Prior separate integration baseline has the same named failure, but the current result remains counted and its root cause is not asserted. Last 20 lines:

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:252093) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:252167) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.1m)
```

Earlier round 1 focused failure (last 20 lines; retained):

```text
+   "pass": false,
  }

- Expected  - 1
+ Received  + 12

(fail) KB-59 web search preference request ownership > UTC midnight refresh preserves latest intent and cleans timer [2.52ms]
(pass) KB-59 web search preference request ownership > query boundary keeps the preferences page usable [0.01ms]
(pass) KB-59 web search preference request ownership > keyboard switching retains focus and phone targets
(pass) KB-59 web search preference request ownership > caller and gallery render English Hebrew responsive theme matrix
(pass) KB-59 web search preference request ownership > gallery shares production save and recover behavior
(pass) KB-59 web search preference request ownership > fixture interactions avoid uncaught app errors and extra operations

1 tests failed:
(fail) KB-59 web search preference request ownership > UTC midnight refresh preserves latest intent and cleans timer [2.52ms]

 24 pass
 1 fail
 25 expect() calls
Ran 25 tests across 1 file. [76.19s]
```

Round3 immutable-original proof/capture command (all available output, exit 0 but captured result false; not a passing capture gate):

```text
{"original FIFO stale error":{"pass":true},"original FIFO ABA loses C":{"pass":true},"original caller captures":{"pass":false,"detail":"Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: true\nReceived: false"}}
```

## Hosted checks and final disposition

Source/test head `b648cf9b22efb6851a2651160ec2a4eb384e5c98`: hosted `ci` and `Test` FAIL; E2E/preview,lint, typecheck, build,scans,notices,scope/config/secret guards PASS. Test annotation records the same expected-true/received-false boolean assertion text; exact hosted totals were not retrieved and remain UNKNOWN. The final reporting-only head is identified in the PR body; read its actual checks rather than inferring a pass from the preceding source head.

**Status: stuck.** Required gates fail and the introduced query-loading regression is verified. The report and supplemental diagnostics make the draft reviewable; they do not establish readiness, satisfy the failing matrix, or authorize a fourth repair. Needs Amit before integration: explicit retry-budget exception on this same assignment to retain pending state across temporary query loading and correct the unused-font assertion, followed by verification. No duplicate issue or source/test change was made.

Frozen install output (all available lines before timeout):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```
