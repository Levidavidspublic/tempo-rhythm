# KB-59 — Web search preference request ownership

## Owner-authorized additional repair pass — 21 Oct 2026

The owner explicitly authorized one additional cohesive repair pass on this existing assignment, with scope and required checks unchanged. The earlier three-round limit and all earlier failed results remain in the historical record below. This pass repairs the verified query-loading regression and addresses the four CodeRabbit findings together. Zero new primary production views.

**Functional repair verified:** the strengthened before-fix run failed at the actual midnight loading gap (expected On, received Off) and at a success settling during loading (expected Saved, received empty). That run had 23 pass / 3 fail in 191.02 seconds; its third failure was a 30-second fixture navigation timeout in the FIFO ABA case. The frozen repaired source passes all 26 named focused browser cases in 162.18 seconds. All 26 scoped cases also pass inside the full unit suite; its three failing cases are the two history-normalization timeouts and the page-summary pathological-body timing assertion recorded below. The full mandatory results remain separate. No further source/test repair followed this pass.

`WebSearchPreference` now stays mounted when either query is undefined. Its explicit loading return runs after the existing request state and layout lifecycle fence. Loading still renders no actionable row; accepted pending choices and their eventual Saved/error feedback survive. Genuine removal through the unchanged real `ProfileReady` gate still invalidates the old controller, including settlement in the parent's removal commit. The gallery continues using the same controller. APIs, provider availability, daily quota policy, UTC timer, mutation payload, server authority and rapid-toggle behavior are unchanged.

The midnight fixture now makes the newly requested UTC day return undefined before becoming ready. It verifies retained On/Saving while the stored choice is still false, then one Saved announcement after success and timer cleanup. A new named case checks success and failure settling while either preferences or status is loading. The lifecycle cases now cause genuine profile-gate removal instead of mistaking query loading for component removal. The font matrix asserts each locale's computed heading/label family and Chromium CDP custom-font glyph use: Newsreader/Source Sans 3 for English and Frank Ruhl Libre/Assistant for Hebrew. It therefore verifies the fonts actually used without requiring unused locale families to load.

### CodeRabbit disposition

| Finding | Repair and evidence |
| --- | --- |
| [Request controller unmounts during query loading](https://github.com/Levidavidspublic/tempo-rhythm/pull/1191#discussion_r4335118377) | Controller stays mounted; loading hides its view after hooks. Both reproduced failures pass on repaired source. |
| [Evidence spacing](https://github.com/Levidavidspublic/tempo-rhythm/pull/1191#discussion_r4335118392) | Missing prose/table spaces restored; historical values and verbatim logs preserved. |
| [Unused locale font assertion](https://github.com/Levidavidspublic/tempo-rhythm/pull/1191#discussion_r4335118404) | Exact computed families plus actual embedded glyph use checked across the full caller/gallery matrix. |
| [Midnight test misses loading](https://github.com/Levidavidspublic/tempo-rhythm/pull/1191#discussion_r4335118431) | New-day loading gap is now explicit; current pending intent, success announcement and cleanup are asserted. |

Relevant exported/nested functions also have concise documentation. The bot's PR-template warning belongs to PR metadata, managed by the lead. Its nested-root Biome tool error did not justify any config edit; the unchanged mandatory local lint command passed.

### Test results (cloud agent sandbox) — additional pass

Bun **1.3.9**. Frozen installation again timed out at dependency resolution after 120 seconds (exit 124), so it remains **UNKNOWN**. `bun.lock` and all seven package manifests byte-match the main checkout before and after the install attempt. The ignored duplicate `.bun` cache was initially replaced with a link to the identical main third-party cache, reclaiming about 1.3 GB. The first E2E startup then failed because Turbopack rejects package realpaths outside the project root. Only this worktree's ignored cache was repaired to a real directory with hard-linked identical package files, keeping valid worktree paths and the reclaimed disk space. The unchanged E2E retest was queued after that setup repair; its waiting process was later canceled at the lead’s explicit instruction before it could start. The first startup failure remains below. Workspace `@tempo/*` links still resolve to this worktree, and its existing package-level dependency directories remain present. No tracked lock, manifest, dependency, config or environment file changed.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | **UNKNOWN** — exit 124; 120-second timeout at Resolving dependencies; no successful frozen install claimed. |
| `bun test tests/unit/kb-59.test.tsx` | **PASS** — exit 0; 26 pass, 0 fail. |
| `bun run lint` | **PASS** — exit 0; 5/5 tasks; existing warnings retained. |
| `bun run typecheck` | **PASS** — exit 0; 5/5 tasks, 3m2.862s. |
| `bun run test` | **FAIL** — exit 1; 3324 pass, 3 todo, 3 fail. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | **PASS** — exit 0; all four scans completed; no baseline/config changes. |
| `CI=1 bunx playwright test --reporter=line` | **FAIL; corrected-setup retest pending** — first startup exit 1, no application test ran; the waiting retest was canceled before starting at the lead’s explicit instruction. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | **UNKNOWN / pending** — canceled while waiting for the shared lock at the lead’s explicit instruction; command never started. |

Completed commands followed the required order after the installation timeout. The focused run preceded the full suite. Lint/typecheck used the unchanged workspace commands; full unit and the first E2E attempt each held `/workspace/work/kb-finish/heavy-check.lock`. At `2026-10-21T10:04:50Z`, the lead explicitly reprioritized the queue and directed cancellation of only this worktree’s waiting build (PID 36418) and E2E retest (PID 38672), plus their parent runners. Both had no command child and were verified to be waiting on the lock. No active command was canceled. The corrected-setup E2E retest and build are **pending**, handed to the lead; no result is claimed for either. Heavy-stage wrapper timings in ignored `extra-pass-checks.json` include lock waits and are not represented as command execution time. The pending build command is prepared with a 900-second bound and local cache reads. No preview/live URL or real credentials were used.

Completed local failed gates: test, e2e (E2E failed only at its initial setup startup). Installation remains UNKNOWN. Corrected-setup E2E and build remain pending under the explicit lead handoff. **Status: blocked / verification pending; not done.** Hosted CI/review on the repair commit must be observed separately by the lead; this report does not substitute local passes for hosted checks or claim completion with unknown/failed gates.

### Frozen source and visual evidence

All four source/test hashes below were frozen before validation and rechecked afterward. The immutable original remains base `52bf2803e9105b25c2538aedd81a754a9fbfdedb`, source SHA-256 `b34a3702a5f7bc8e67ce6387949a173e508e24a4bc7c601c11273e46d831e40f`.

```text
dda09b2f3108b3f684ecb8545221929f5382d4006116e99191e371d2fc8002cf  apps/web/components/coach/CoachWebSearchSetting.tsx
c7d840a11c7bbf9a9e7089e5cd43b2af4a4e6f0f813df0de8cf075131258edb0  apps/web/lib/i18n-groups/kb-59.ts
40f38af6c44f97445d5611da9bec77d8198d601530fbe35c478a5f73d80da7e8  apps/web/app/v3/kb-59.css
e9de9b85d2d2cd0d9e4a039caaa0cea7a13240f5b306395e5006190fbd2dff51  tests/unit/kb-59.test.tsx
```

The refreshed contact sheet contains 24 frames: eight previously verified immutable-original caller frames, plus sixteen fresh repaired caller/gallery frames captured by the passing tracked test. Both widths (390/1280), languages and themes use the actual unchanged caller, real settings status, compiled CSS, sprite, UTF-8 and existing font assets. Original/repaired caller tiles explicitly join header/final-row crops; full-page PNGs and their timestamps/hashes remain in ignored scratch. Current capture font use is asserted through CDP. The full suite reused the raw screenshot filenames, so the final contact sheet and capture metadata were refreshed afterward; all 24 matching input PNGs are preserved in ignored extra-pass-frozen-captures/. The original captures keep their prior immutable-source provenance; they are not relabelled as newly captured.

Contact sheet: 1880 × 7796, 880,601 bytes; SHA-256 `0feb3f7584be5e042c42abeb303a9a50c109ffa7198fdd15113ce4d477300151`; composed `2026-10-21T09:49:22.952787+00:00`. Capture metadata: ignored `extra-pass-capture-sha256.json`. Native Hebrew review, native screen readers, deployed persistence and live search quality remain UNKNOWN.

### Focused named cases — 26 pass / 0 fail

1. stored false and true drive the real preference row — PASS in focused repair run
2. loading either query waits without an actionable row — PASS in focused repair run
3. one toggle sends exactly the existing preference patch — PASS in focused repair run
4. FIFO earlier rejection cannot outlive later success — PASS in focused repair run
5. FIFO ABA keeps latest intent while older equal value settles — PASS in focused repair run
6. current success clears pending and announces once — PASS in focused repair run
7. current rejection shows authoritative stored choice — PASS in focused repair run
8. explicit toggle after error retries once and recovers — PASS in focused repair run
9. earlier rejection cannot interrupt newer pending choice — PASS in focused repair run
10. earlier success cannot announce or clear newer pending choice — PASS in focused repair run
11. adversarial old rejection cannot undo newer success feedback — PASS in focused repair run
12. adversarial old success cannot dismiss newer failure — PASS in focused repair run
13. synchronous callback throw is recoverable — PASS in focused repair run
14. unmounted request cannot announce into surviving SettingsScreen — PASS in focused repair run
15. older mount cannot change replacement row — PASS in focused repair run
16. parent removal commit fences a settling request — PASS in focused repair run
17. StrictMode lifecycle still permits current success — PASS in focused repair run
18. unavailable provider stays off and locked — PASS in focused repair run
19. daily remaining count stays clamped without a new quota lock — PASS in focused repair run
20. UTC midnight refresh preserves latest intent and cleans timer — PASS in focused repair run
21. query boundary keeps the preferences page usable — PASS in focused repair run
22. keyboard switching retains focus and phone targets — PASS in focused repair run
23. caller and gallery render English Hebrew responsive theme matrix — PASS in focused repair run
24. gallery shares production save and recover behavior — PASS in focused repair run
25. fixture interactions avoid uncaught app errors and extra operations — PASS in focused repair run
26. request settlement during either query loading retains feedback ownership — PASS in focused repair run

### Retained additional-pass failure output

First E2E setup failure (before the ignored cache-directory repair; no application test ran), last 20 available lines:

```text
[WebServer] - Execution of get_entrypoints_with_issues_operation failed
[WebServer] - Execution of EntrypointsOperation::new failed
[WebServer] - Execution of Project::entrypoints_with_app_route_filter failed
[WebServer] - Execution of AppProject::routes_with_filter failed
[WebServer] - Execution of directory_tree_to_entrypoints_internal failed
[WebServer] - Execution of directory_tree_to_loader_tree failed
[WebServer] - Execution of try_get_next_package failed
[WebServer] - Execution of *ResolveResult::first_source failed
[WebServer] - Execution of resolve failed
[WebServer] - Execution of resolve_internal failed
[WebServer] - Execution of find_package failed
[WebServer] - Symlink [project]/apps/web/node_modules/next is invalid, it points out of the filesystem root
[WebServer]     at ignore-listed frames {
[WebServer]   location: undefined
[WebServer] }

[WebServer] error: script "dev" exited with code 1

Error: Process from config.webServer was not able to start. Exit code: 1

```

An initial before-fix focused process was interrupted promptly when another pre-existing full suite was identified; no result was claimed. The completed before-fix run below supplies the regression proof. A formatting attempt from the repository root also failed to resolve the existing nested Biome configuration. The test was then formatted using the existing explicit packages/config/biome.json, with no config edit; the unchanged mandatory lint passed. The formatting failure output is retained below.

```text
configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Failed to resolve the configuration from ../../packages/config/biome.json

    Caused by:
      Could not resolve ../../packages/config/biome.json: module not found


configuration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  × Biome exited because the configuration resulted in errors. Please fix them.


```

Before-fix regression run last 20 lines:

```text
+        - unexpected value ""
+ "
+ ,
+   "pass": false,
  }

- Expected  - 1
+ Received  + 16

(fail) KB-59 web search preference request ownership > request settlement during either query loading retains feedback ownership [0.15ms]

3 tests failed:
(fail) KB-59 web search preference request ownership > FIFO ABA keeps latest intent while older equal value settles [0.49ms]
(fail) KB-59 web search preference request ownership > UTC midnight refresh preserves latest intent and cleans timer [0.16ms]
(fail) KB-59 web search preference request ownership > request settlement during either query loading retains feedback ownership [0.15ms]

 23 pass
 3 fail
 26 expect() calls
Ran 26 tests across 1 file. [191.02s]
```

`bun install --frozen-lockfile` — exit 124, last 20 available lines:

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

`bun run test` — exit 1, last 20 available lines:

```text

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


3 tests failed:
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "\ud800" [5293.01ms]
  ^ this test timed out after 5000ms.
(fail) history normalization (synthetic fixtures only) > duplicate identities compare large and deep malformed fields structurally [5380.47ms]
  ^ this test timed out after 5000ms.
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [3008.30ms]

 3324 pass
 3 todo
 3 fail
 81044 expect() calls
Ran 3330 tests across 202 files. [271.27s]
error: script "test" exited with code 1
```

Report assembled from completed local output and the explicit pending-gate handoff at `2026-10-21T10:06:06.936055+00:00`.


## Historical record before the owner-authorized additional repair pass

The sections below retain the previous candidate outcomes and the introduced regression as observed before the 21 Oct retry-budget exception. Current repair and validation results are recorded separately when complete.

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
| `bun install --frozen-lockfile` | **UNKNOWN** — exit 124 at 120-second resolver bound; all available output shown below. |
| `bun test tests/unit/kb-59.test.tsx` | **FAIL** — round 3: 24 pass, 1 fail, 25 parent assertions, 58.73s; unused-family font assertion in matrix. |
| `bun run lint` | PASS — exit 0, 5/5 tasks, zero errors; 9 existing warnings, Turbo 1.792s. |
| `bun run typecheck` | PASS — exit 0, 5/5 tasks, Turbo 42.364s. |
| `bun run test` | **FAIL** — exit 1; 3,325 pass, 3 todo, 1 fail, 81,043 assertions, 3,329 tests / 202 files, 95.69s; sole failure KB59 font matrix. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS — exit 0, all four OK; 0.4s. No baseline changes. |
| `CI=1 bunx playwright test --reporter=line` | **FAIL** — exit 1; 27 pass, 89 skipped, 1 task-view Home reset failure; 3.1min. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS — actual exit 0; 1/1 task, 84.5s; bounded 900s,`TURBO_CACHE=local:r`. |

Each heavy gate acquired/released validation.lock separately, preserving command order. Full unit additionally held fixture.lock; E2E held e2e.lock; build held build.lock. Logger elapsed times include shared-lock wait:lint 225.9s, typecheck 147.8s, test 95.8s, E2E 185.5s, build 84.5s. Source/test were frozen throughout; no broad rerun or fourth repair.

## Browser provenance and limits

The clean-child bundle uses the unchanged actual Page/SettingsScreen/PreferencesForm with real locale/theme providers, shared controls, header status, icon sprite and compiled application CSS. Auth/profile/query/mutation/router/Link boundaries use fictional data and the actual existing API shapes. HTML has explicit UTF-8 metadata and response encoding; exact readable Hebrew is asserted. Existing font files are served from `apps/web/fonts` at requested URLs. Actual rendered-font/console results and final capture timestamps are recorded below. No live account, model/search call, provider or paid service is used.

Deployed preference persistence, live search quality, native screen readers and native Hebrew review remain UNKNOWN. The Browser runtime tool is unavailable in this session; the approved ticket explicitly authorizes isolated Playwright/installed Chromium. Root RULES.md is absent from the base snapshot; AGENTS, SLOTS and cited design/rules/callers were read.

## Ownership and scope

Fresh audit before implementation: 116 open PRs / 3,867 complete file entries and 293 open issue bodies. #1053's 309-file list excludes this component. KA 1104's actual declared scope excludes it; shared settings are verify-only. KA 1105 references it read-only. Scope is exactly three production files, one test and these two evidence paths. No source/test repair beyond the three-round budget is authorized.

## Candidate ledger and retained failure

1. Initial production request-identity/layout-fence/shared-gallery change: 24 pass / 1 fail, 76.19 seconds. Midnight test started only 100ms before midnight; the page load crossed into the next day before its expected initial query. All behavioral regressions and the then-rendered matrix passed, but later review found its dark-labelled captures were light.
2. Test-only clock repair starts 60s before midnight, advances 61s explicitly and asserts the actual UTC timer is cleared when the root unmounts:25 pass / 0 fail,82.22 seconds. Independent review still rejected dark evidence because the isolated fixture omitted RootLayout's prehydration theme script.
3. Test-only fixture correction runs actual themeInitScript, asserts requested data-theme and computed body background, and provides RootLayout's local Newsreader/Mono font variables from the same bundled files. Final tracked result 24 pass / 1 fail, 58.73 seconds: the new generic font-family check returns false in the matrix. The source/test are frozen after this candidate; no fourth repair, skipped assertion or replacement passing test is authorized.

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

English: `document.fonts.check` is true for Newsreader and Source Sans 3; the unused Hebrew serif face is false. CDP renders the heading with custom `Newsreader16pt16pt-Regular` and the label with custom `SourceSans3-Roman`. Hebrew: Newsreader and Source Sans 3 checks are false because those Latin families are unused/unloaded; Hebrew serif is true. CDP renders the heading with custom `FrankRuhlLibre-Regular` and the switch label with custom `Assistant-ExtraLight`, with actual Hebrew glyph counts. Thus the tracked assertion incorrectly requires unused Latin families on Hebrew pages; this verified diagnostic cause does not turn the failed test into a pass. No fourth source/test repair was made.

The original supplemental 8-scenario diagnostic asserts the requested data-theme and body background: light `rgb(243,238,228)`, dark `rgb(22,20,18)`. It has no uncaught page errors or console errors/warnings. Current caller/gallery diagnostic results and final contact sheet are recorded below. Local assets are served at the actual requested font URLs; RootLayout's Next local-font CSS variables are represented using the same Newsreader/Mono files. Native platform rendering/screen-reader and live deployed behavior are still UNKNOWN.

Final supplemental result: **24 frames** (8 immutable-original caller, 8 current caller, 8 current shared-row gallery), both languages, widths and themes, all requested theme attributes and computed backgrounds verified. Current and original diagnostics both have 0 uncaught page errors, 0 console errors and 0 console warnings. These are supporting diagnostics, not a passing tracked matrix gate. Full-resolution PNGs, CDP font results and hashes remain in ignored work/kb59; the committed contact sheet uses those supplemental captures only.

Contact sheet `kb-59-web-search-preference-request-ownership.jpg`: 1880 × 7796, 872,963 bytes; SHA-256 `e71439c26c1b445a7c9d9044f3f40196fb4531b0e0b1d2993d6eb1b49d0eb3d9`; composed `2026-10-20T03:46:31.136362+00:00`. Caller tiles join explicitly labelled header and final-row crops to show real header status and the row together; complete PNGs retain the full page. The gallery uses the same private production row,  not a second save algorithm. Frozen-original captures were refreshed after the original repair from the immutable pre-edit source, within unchanged real Page wiring. Prior incorrectly themed frames are not included.

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
| On A pending, stored false, UTC 20 | On | On, Saving feedback |
| UTC 21 status query undefined | Row temporarily absent | Row temporarily absent |
| UTC 21 status ready; A unresolved; stored false | **On retained** | **Off; pending feedback lost** |
| A then succeeds; stored true | On + header Saved | On; header remains empty |

Both diagnostic commands exited 0 because they assert and record this before/current distinction; this does not mean the current behavior is correct or a tracked gate passed. Each trace contains exactly one mutation with the unchanged payload. There are 0 uncaught page errors/console errors/warnings. Complete traces: ignored `work/kb59/loading-original.json` and `loading-current.json`; complete screenshots `original-utc-query-loading.png` and `current-utc-query-loading.png`. Source/test hashes still match the frozen final candidate.

The correct follow-up would retain latest-request state across temporary query loading while preserving real unmount fencing, and cover the interval in a regression test. It requires an explicit repair-budget exception on this same assignment; no duplicate ticket, fourth source/test change, test skip or new API was made. The report remains stuck regardless of other green checks.

## Completed mandatory failure logs

Full unit command: **FAIL**, 3,325 pass, 3 todo, 1 fail, 81,043 assertions, 3,329 tests / 202 files, 95.69 seconds. Sole local failure is the named KB59 font matrix. Last 20 lines:

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

Local E2E: **FAIL**, 27 pass, 89 skipped, 1 fail, 3.1 minutes. The task-view test cannot find Home reset after /projects navigation. Prior separate integration baseline has the same named failure, but the current result remains counted and its root cause is not asserted. Last 20 lines:

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

Round 3 immutable-original proof/capture command (all available output, exit 0 but captured result false; not a passing capture gate):

```text
{"original FIFO stale error":{"pass":true},"original FIFO ABA loses C":{"pass":true},"original caller captures":{"pass":false,"detail":"Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: true\nReceived: false"}}
```

## Hosted checks and final disposition

Source/test head `b648cf9b22efb6851a2651160ec2a4eb384e5c98`: hosted `ci` and `Test` FAIL; E2E/preview, lint, typecheck, build, scans, notices, scope/config/secret guards PASS. Test annotation records the same expected-true/received-false boolean assertion text; exact hosted totals were not retrieved and remain UNKNOWN. The final reporting-only head is identified in the PR body; read its actual checks rather than inferring a pass from the preceding source head.

**Status: stuck.** Required gates fail and the introduced query-loading regression is verified. The report and supplemental diagnostics make the draft reviewable; they do not establish readiness, satisfy the failing matrix, or authorize a fourth repair. Needs Amit before integration: explicit retry-budget exception on this same assignment to retain pending state across temporary query loading and correct the unused-font assertion, followed by verification. No duplicate issue or source/test change was made.

Frozen install output (all available lines before timeout):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

## AWAY — completed root-owned validation on rebased repair

Source head: `1dd3a80bd2ca044affa5054cbb8b837632760a7f`, based on integration `542f2cf`. The rebase retained the scoped source/test patch. Bun 1.3.9; no assertion, timeout, skip, config, environment or dependency-version change.

| Remaining command | Actual result |
|---|---|
| `CI=1 bunx playwright test --reporter=line` | **FAIL**, exit 1: 17 pass / 89 credential-dependent skips / 11 fail in 10.1 minutes. The corrected local dependency setup started Next and ran all scheduled cases; this does not convert the earlier startup failure to a pass. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | **PASS**, exit 0: 1 successful / 1 total, 2m56.91s. |

The 26-case focused pass, local full-unit failures, frozen-install UNKNOWN, successful lint/typecheck/scans and image provenance remain above. Hosted Test, E2E, Build and all five required checks passed on this exact source head; CodeRabbit's completed review covered it and reported no actionable comments. Hosted results are separate from the local failures. No production or live-account validation is claimed.

Last 20 lines of the completed local E2E failure:

```text

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:51187) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  11 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/fix/calendar-add.spec.ts:26:7 › calendar add event › local mode: form renders and adds without a sign-in message
    [chromium] › tests/e2e/fix/insights-loads.spec.ts:5:5 › /insights leaves the loading placeholders within 8 s
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
  89 skipped
  17 passed (10.1m)
```
