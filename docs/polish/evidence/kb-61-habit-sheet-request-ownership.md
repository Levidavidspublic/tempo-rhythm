# KB-61 — HabitSheet request ownership

Draft implementation is verified by 21 focused browser cases and 3,322 passing repository tests. Lint, typecheck, scans and build pass. The ticket remains blocked: the frozen install is UNKNOWN and local E2E has one failing task-view test. No production-readiness claim is made.

## Scope and existing contracts

The existing shared HabitSheet is mounted by the unchanged `/habits` HabitsScreen and `/habits/[id]` HabitDetail. The sheet calls only `onSubmit({ name: trimmedName, cadence: "daily" | "weekly" })`; both callbacks continue to use their existing create/update operations. Closing the sheet does not cancel, compensate or roll back a submitted save. Zero new primary production views are added.

Changed production files are HabitSheet.tsx, its directly imported typed `kb-61.ts` copy dictionary and scoped `kb-61.css`. No callers, backend, routes, central copy/styles, dependencies, configuration or test baselines change.

## Frozen original reproduction

- Base: `52bf2803e9105b25c2538aedd81a754a9fbfdedb` (`integration`).
- Original source was frozen in ignored `work/kb61/before.tsx` before product edits; its SHA-256 and commit were recorded separately.
- Command: `KB61_FIXTURE_CHILD=1 KB61_ORIGINAL_PROOF=1 bun tests/unit/kb-61.test.tsx`, using Bun 1.3.9 and fixture/e2e locks.
- Real unchanged HabitsScreen was bundled with its real HabitSheet, real locale provider and actual compiled Tailwind/v3 styles. Only auth/query/mutation boundaries and Next Link are fictional; no live account or backend/model call occurs.
- Submit A through the existing create callback, close A, reopen B, type `New draft stays here`, then resolve A: original result `{open:0,draft:null,focused:false}`. B and its unsaved draft disappear.
- Reject A instead: original result `{open:1,draft:"New draft stays here",focused:true}`. This distinction was recorded before repair.

## Source round 1

A synchronous request token prevents duplicate submissions. Each explicit Close, Cancel, Escape or scrim interaction immediately invalidates that instance's ownership. Success/error from an old request cannot close or update a newer sheet. Pending saves preserve their submitted snapshot: the name is read-only and focusable, the cadence is disabled, and localized status explains that closing does not cancel saving. Current rejection retains the draft and enables explicit retry; synchronous callback throws are contained.

`bun test tests/unit/kb-61.test.tsx`: **20 pass, 0 fail**, 20 assertions, 79.45 seconds. The controlled browser cases cover exact trimmed name/cadence, length/empty validation, synchronous duplicate submission, current success, rejection/retry, synchronous throw, real-caller old success/rejection, all four close paths, close-before-unmount, pending snapshot and explanation, StrictMode, focus trap/opener/body scroll, interactive gallery, English/Hebrew and RTL, 390/1280 light/dark targets/wrapping, visible focus, reduced motion and uncaught browser errors.

The independent review edge was reproduced: resolving the pending save from the parent’s layout effect during removal invoked the old close callback once (expected zero). Layout-effect lifecycle cleanup now invalidates that request during the removal commit, while the existing focus/scroll effect remains unchanged. The expanded suite passes this regression.

Final source round 3: **21 pass, 0 fail**, 21 parent assertions, 122.57 seconds. A semantic fieldset/legend groups gallery controls. Workspace-local Biome checks all three production files with zero errors. The source/test files are frozen; no fourth repair is authorized.

Repair ledger: round 1 implemented the main fix (20 focused cases passed), then review reproduced the parent-removal edge; round 2 repaired that lifecycle boundary (21 cases passed) and identified a gallery semantic lint error; round 3 corrected the fieldset/CSS and passed the final 21-case suite. Intentional original-regression proof is separate from these implementation rounds.

## Test results (cloud agent sandbox)

Bun: **1.3.9**.

| Command | Result |
| --- | --- |
| `bun install --frozen-lockfile` | **UNKNOWN** — timed out after 120 seconds at `Resolving dependencies`, exit 124. All lockfile/workspace manifests were compared byte for byte to KB-75, then its existing ignored node_modules caches were copied for every workspace. No Turbo archives were copied. |
| `bun test tests/unit/kb-61.test.tsx` | Final round 3: 21 pass, 0 fail (122.57 seconds). |
| `bun run lint` | PASS — exit 0, 5/5 tasks, zero errors; 9 existing warnings (14.3 seconds). |
| `bun run typecheck` | PASS — exit 0, 5/5 tasks (79.2 seconds). |
| `bun run test` | PASS — exit 0: 3322 pass, 3 todo, 0 fail, 81,039 assertions across 202 files; Bun reports 200.88 seconds, excluding the preceding shared-lock wait. |
| Four scans/notices | PASS — exit 0; forbidden-tech, RAM-only audit, design tokens and notices all print OK. |
| `CI=1 bunx playwright test --reporter=line` | **FAIL** — exit 1: 27 pass, 89 skipped, 1 fail (3.7 minutes); missing `Home reset` heading on `/projects` in `task-views-core.spec.ts:39`. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS — exit 0; Next compiled, typechecked and generated routes; 1/1 task, 182.0 seconds. |

The E2E failure remains counted. The prior integration baseline log at ignored `work/kb/baseline-task-views-recheck.log` has the same named Home reset task-view failure. This establishes prior failure evidence, not a passing current run or an asserted root cause. Sign-out passed in this run. No task-view/config/baseline repair or broad rerun was made.

Last 20 lines of the failed E2E command:

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:214469) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:214519) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (3.7m)
```

Failing assertion excerpt (20 lines ending at the source location):

```text
    Expected: visible
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" with timeout 10000ms
      - waiting for getByRole('main').getByRole('heading', { name: 'Home reset' })
      - Test timeout of 30000ms exceeded.


      37 |
      38 |     await page.goto("/projects");
    > 39 |     await expect(main.getByRole("heading", { name: "Home reset" })).toBeVisible();
         |                                                                     ^
      40 |     await expect(page.getByText(updatedTitle)).toBeVisible();
      41 |     await page.getByRole("button", { name: `Mark ${updatedTitle} complete` }).click();
      42 |     await expect(page.getByText("Done")).toBeVisible();
        at /workspace/work/kb-61/tests/e2e/task-views-core.spec.ts:39:69

    Error Context: test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/error-context.md

```

Frozen install log (all available output before the bounded timeout):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

The Browser plugin skill is listed, but its required JavaScript runtime tool is not callable in this tool inventory. The approved ticket explicitly permits the isolated Playwright/installed Chromium fixture used here. It runs on an ephemeral 127.0.0.1 port with fictional data, actual compiled CSS and **system fallback fonts**. Font files exist under `apps/web/fonts/source-sans-3` and `apps/web/fonts/assistant`; `apps/web/public/fonts` is absent. The isolated fixture does not serve the requested `/fonts/source-sans-3/SourceSans3-latin.woff2`, `/fonts/assistant/Assistant-latin.woff2` and `/fonts/assistant/Assistant-hebrew.woff2` URLs. The fixture returns its HTML fallback at these URLs; Chromium reports `Failed to decode downloaded font` for these named paths and `OTS parsing error: invalid sfntVersion: 1008821359`. An additional strict console diagnostic consequently failed; the full messages remain in ignored logs. Do not interpret the fixture as a completely clean console or proof of production-font geometry. This proves local UI behavior; deployed persistence, native screen readers and Hebrew native review remain UNKNOWN. Referenced root `RULES.md` is absent from this integration snapshot; AGENTS, SLOTS, HARD_RULES and the cited design/product sections were read.

Additional bounded diagnostic: the actual caller and gallery at 390 × 844, English/light and Hebrew/dark, each had one main/h1, the expected fixture title, no framework overlay and working pending interaction. Pending-status foreground/surface contrast was 5.12:1 in light and 4.78:1 in dark, using the computed glass color composited conservatively over the ink token. No unexpected app errors/warnings were observed. All four runs retained the exact font decode/OTS warnings above; filtering those known messages only in this ignored diagnostic does not establish a clean console. The strict-console failure was not a tracked source/test repair. Native Hebrew copy review remains UNKNOWN (machine-drafted copy is flagged in source).

Last 20 lines of the earlier strict-console diagnostic failure:

```text
+   "Failed to decode downloaded font: http://127.0.0.1:44003/fonts/source-sans-3/SourceSans3-latin.woff2",
+   "OTS parsing error: invalid sfntVersion: 1008821359",
+   "Failed to decode downloaded font: http://127.0.0.1:44003/fonts/assistant/Assistant-latin.woff2",
+   "OTS parsing error: invalid sfntVersion: 1008821359",
+ ]
 matcherResult: {
  actual: [ "Failed to decode downloaded font: http://127.0.0.1:44003/fonts/source-sans-3/SourceSans3-latin.woff2",
    "OTS parsing error: invalid sfntVersion: 1008821359", "Failed to decode downloaded font: http://127.0.0.1:44003/fonts/assistant/Assistant-latin.woff2",
    "OTS parsing error: invalid sfntVersion: 1008821359"
  ],
  expected: [],
  message: "expect(received).toEqual(expected) // deep equality\n\n- Expected  - 1\n+ Received  + 6\n\n- Array []\n+ Array [\n+   \"Failed to decode downloaded font: http://127.0.0.1:44003/fonts/source-sans-3/SourceSans3-latin.woff2\",\n+   \"OTS parsing error: invalid sfntVersion: 1008821359\",\n+   \"Failed to decode downloaded font: http://127.0.0.1:44003/fonts/assistant/Assistant-latin.woff2\",\n+   \"OTS parsing error: invalid sfntVersion: 1008821359\",\n+ ]",
  name: "toEqual",
  pass: false,
},

      at captureRawStack (/workspace/work/kb-61/node_modules/.bun/playwright-core@1.62.1/node_modules/playwright-core/lib/coreBundle.js:9681:21)
      at callMatcherAsStep (/workspace/work/kb-61/node_modules/.bun/playwright@1.62.1/node_modules/playwright/lib/matchers/expect.js:13310:57)

Bun v1.3.9 (Linux x64)
```

## Named focused cases

1. trimmed name and weekly cadence reach callback exactly
2. name length and empty validation are preserved
3. synchronous repeated submit starts one request
4. current success closes exactly once
5. current rejection keeps draft and allows explicit retry
6. synchronous callback throw becomes recoverable error
7. real caller old success cannot close newer draft
8. real caller old rejection cannot change newer draft
9. close remains available during save
10. cancel remains available during save
11. escape remains available during save
12. scrim remains available during save
13. close fences settlement before React unmount
14. parent removal fences settlement during commit
15. pending name stays focusable and snapshot cannot change
16. pending explanation tells closing does not cancel save
17. StrictMode preserves initial focus trap opener and body scroll
18. gallery uses real interactive sheet with deferred success and error
19. English Hebrew responsive theme matrix keeps usable sheet
20. focus ring and reduced motion are rendered
21. all browser interactions avoid uncaught errors

## Evidence

The final source SHA-256 hashes are below. The baseline capture refresh re-bundles the immutable original component inside the unchanged real caller after source edits; it does not substitute an older caller snapshot. Both original and current fixtures include the real icon sprite. The immutable-original refresh completed on 20 Oct 2026; it reproduced the same close/reopen result. Current matrix captures are from final round 3. The contact sheet was composed at 2026-10-20T01:54:01Z and independently reviewed alongside full-resolution English/light and Hebrew/dark phone caller images. No visual blocker was identified.

Contact sheet: `kb-61-habit-sheet-request-ownership.jpg`, 1880 × 6354, 1,072,046 bytes; SHA-256 `364aa5b832a6af74b1de42cf85c2a00a1bb5d83ae187a63b5ae639adf1e9e364`. It shows original caller/current caller/current gallery in all eight width/language/theme combinations; separate original direct-sheet harness captures are retained in the ignored workspace. All 32 PNG source capture hashes are retained in ignored `work/kb61/capture-sha256.txt`.

- Original HabitSheet: `dacd593a92480e8b39149d6e093b50eff5b5574590ac81c8b9168a46ac2d31dc`.
- Current HabitSheet: `5e52db6c8a8debf626b1e8dd5e0e30acc95475d16f7617b08f7533b7e61598d9` (Git blob `79fa2b22f931c9e683b095e00b62c2055d63e8c7`).
- Dictionary: `b425b4e0c30a095e3d07576d521c0f080eb174a6716a75880a7a6e46b7f96663`.
- CSS: `02a39bb06adf35f76a89a2e9e74f8dc07f6b4debdfe41f24c8adc2bcf0d6667d`.
- Test: `5f9cf113aeff3f2a141725ac6c14b8fd4b56710519eb1bd34cc3382f6eb9f413`. Original/current source labels refer to the actual caller; gallery images use the real shared sheet and fictional deferred saves. No private account data is captured.

## Scope metadata and disposition

The lead corrected indentation only in the canonical ticket and issue scope lists (planning commit `2bd19f3`); the actual scope parser now reads all six approved paths. This did not widen scope or change source/test. The final report uses those corrected issue scopes. Source/test remain at the reviewed three-round implementation; no fourth repair is authorized. Status: **blocked**, pending the failed/unknown required gates and independent validation limits disclosed above.

## Fourth/final candidate — owner-authorized additional fixture repair

The historical source ledger above explicitly records three implemented rounds, although they were consolidated into source commit `59311cf`. Round 1 implemented the main ownership fix; round 2 repaired the parent-removal lifecycle edge; round 3 corrected gallery fieldset/CSS lint. The later validation/font-serving commits (`4224035`, `f7566af`, and the equivalent pre-rebase `f8c7cc6`) changed evidence only. Merged fixture `ba23a58` retains test SHA-256 `5f9cf113aeff3f2a141725ac6c14b8fd4b56710519eb1bd34cc3382f6eb9f413`. No earlier additional pass was recorded.

After this audit, root explicitly applied the owner's existing KB FINISH authorization for one additional repair pass to exhausted KB drafts. This follow-up is that fourth and final source candidate; no fifth is authorized or presumed. This later explicit authorization supersedes the older "no fourth repair is authorized" source-freeze report above. Root owns reopening issue #1181, the follow-up draft PR because merged PR #1185 cannot be amended, all broad mandatory gates and remote operations. Only the existing test and this evidence Markdown change; product, configuration, dependencies and contact sheet remain unchanged.

Hosted receipt: KB-71 Test job `119200451115`, run `39593624101`, reported KB-61's 480-second hook timeout with 3454 pass, 3 todo and 1 fail. The retained earlier receipt `/workspace/work/kb-finish/hosted-1158-rebased-failure.log` shows the same KB-61 timeout, `killed 1 dangling process`, and a separate historical KB-67 cleanup failure (3441 pass, 3 todo, 2 fail overall). Root also identified KB-44 job `119189735929`. The old hook wrapped CSS compilation, bundling, browser startup, every case and browser cleanup while buffering child stderr until exit. These receipts establish an unfinished child, not its stalled internal stage; no native-stall root cause is claimed.

Static audit found a concrete leak path: the server was created before browser discovery/launch, while its cleanup block began afterward. A missing executable or rejected launch could bypass server cleanup, set only `process.exitCode = 1`, and leave the parent waiting on a still-live server. Browser cleanup also preceded server stop, and temporary output used a fixed undeleted directory. The repair starts cleanup coverage before imports/build/server/launch and releases server, browser and the unique owned directory independently. Browser discovery now includes already-installed supported Google Chrome/Chromium paths; it still fails explicitly if none exist. There are no browser downloads or new packages.

Child phases now stream immediately to stderr for dependencies, CSS, bundling, server readiness, executable availability, browser launch, each named case and each release. Fresh invocation tokens and one result record prevent another run's output from satisfying a case. Each original parent case retains its exact equality assertion, while a separate lifecycle case requires the exact 21-case set, completed cleanup and authoritative exit 0. A failed callback is recorded by name and causes child exit 1.

The original `beforeAll(..., 480_000)` deadline, all 21 behavioral callbacks/assertions and their existing Playwright waits are preserved. The owned child is cancelled at 479 seconds, reserving the final second of that unchanged hook for process-tree termination/reaping and parent-owned directory removal. Descendants are included even if they created a separate process group. Parent directory release starts independently of termination/reaping. The short controlled hang probe uses the same cancellation path with a five-second process budget; this does not increase any original deadline.

Added lifecycle regressions exercise pending browser release, a controlled setup throw after a real server starts, a controlled browser-close rejection, and a hanging child with a detached descendant. They require real post-stop fetch rejection and directory removal, reject successful-looking records from nonzero exits, reject incomplete cleanup and another invocation's token, and verify cancellation/reaping. These are controlled failures, not claims that the intermittent hosted native stall has reproduced.

Fourth/final candidate validation is retained in `/workspace/work/kb-finish/kb61-final/`:

| Check | Fourth/final local result |
| --- | --- |
| Bun | PASS: 1.3.9 |
| Frozen install | UNKNOWN: exit 124 after the 120-second confirmation bound; only `bun install v1.3.9 (cf6cdbbb)` and `Resolving dependencies` were printed |
| Lint | PASS: exit 0; 5/5 cached tasks; 1.571s; existing warning results retained |
| Typecheck | PASS: exit 0; 5/5 cached tasks; 1.215s |
| `bun test tests/unit/kb-61.test.tsx` under its individual heavy lock | PASS: exit 0; 26 pass, 0 fail, 48 assertions; 228.86s. All 21 original case phases passed, followed by complete server/browser/directory cleanup and the five added lifecycle cases. |
| Full suite, scans/notices, E2E and build | Not rerun individually for the fourth candidate; prior-candidate results are retained above. Final root-owned combined gates are in progress, with the exact source input recorded in docs/kitchen/kb/VALIDATION.md on planning PR #1140. No final pass is claimed. |

The source-preservation check compares the entire original browser case region and original parent case list/equality assertion byte for byte, verifies the existing 480-second hook and compiles TSX syntax. It passes. Root owns full suite, scans/notices, E2E and build; this agent runs focused and light checks only.


Final scoped disposition: the single authorized additional candidate passes focused and light checks. The older full-suite/scans/E2E/build results above belong to prior candidates and were not rerun individually for this fourth candidate. Root-owned combined gates remain in progress. In this run, dependencies, actual PostCSS/Tailwind compilation, Bun bundling and system Chromium launch completed. All 21 original cases passed. Normal child server stop completed at 221859ms, unique directory removal at 221868ms and browser close at 222133ms. These phase timings confirm a successful local path, not the cause of the earlier hosted timeout.

The controlled setup throw and close rejection intentionally printed child errors and exited nonzero; their parent regression cases passed only after checking real post-stop URL rejection, directory removal and rejection of false success. The hanging-child probe reached its real server, was cancelled through the same owned process-tree path, and passed reaping, detached-descendant nonexecution, post-stop URL rejection and parent-directory-removal checks. No original 480-second hang was reproduced, so no native-stall root-cause claim is made.

After proof, no executing processes with this fixture worktree as cwd and no unique fixture directories remained. Two recorded Chromium descendants were already exited PID-1-owned zombies; the cancellation regression separately confirmed its detached descendant was absent or an exited zombie. No executing child/browser job or agent-owned runner remains. No broad suite, remote mutation, package/configuration change or contact-sheet modification was launched by this handoff. This consumes the owner-authorized fourth/final source candidate; no fifth is presumed.

## Review after the fourth candidate

AT — Hosted CI passed for35b1c32, then CodeRabbit4336980389 verified diagnostic error loss: a final process-group kill error can replace an earlier descendant cleanup error. Three ordinary rounds plus the single owner-authorized extra are consumed. The follow-up remains draft pending AT-15; no fifth source edit is made. This documentation-only clarification addresses4336980354 without changing source, tests, assertions, timeouts or the historical validation records. The ongoing combined checkout still uses the exact35b1c32 source/evidence input named in its manifest.


## Overnight authorized error-preservation pass — 2026-10-21

PR open — all 26 existing cases remain, with one added cleanup-error regression. Role: WORKHORSE. The owner's overnight AT-15 authorization permits this scoped pass after the historical hold above. It changes only this test and evidence. Shared prerequisite #1203 is frozen at `2d99c84` on a separate cancellation-proof failure; this consumer remains dependency-blocked.

The unsafe duplicate `Bun.spawn`/`killOwnedGroup` runner is replaced by the shared lifecycle. It streams bounded output, verifies the actual fixture exit separately from the supervisor, and owns cancellation and reaping. Parent directory cleanup stays within the original 480000 ms hook, with its last second reserved for shared and directory cleanup. Browser bundling uses the shared clean-process resolver; exact backend-boundary aliases and the frozen-original proof remain available. The entire original browser-case region, the 21-case parent list/equality assertion, and every existing lifecycle assertion are preserved. The original 480000 ms hook and 30000 ms test deadlines remain.

An additional fresh-child fault injects an error requesting descendant cleanup and a later error terminating the process group. Both operations are attempted and both exact error objects must survive in an AggregateError. Native signaling remains available for real cleanup. The preliminary source `82a4c1f` passed 27 tests, 0 failures and 49 assertions in 34.05 seconds, including this controlled proof. The old conditional descendant-state assertion still permits an absent, fully reaped PID, so runtime assertion totals depend on whether that original branch executes.

Bun 1.3.9. The frozen install stalled in dependency resolution and was stopped with exit 143 after about three minutes; this is UNKNOWN, not a successful install. The lockfile and all workspace manifests were byte-identical to the prepared KB-05 checkout; only ignored dependency directories were copied to allow validation. No manifest, lockfile, package version or configuration changed.

The complete mandatory command sequence ran once in order on `82a4c1f`. It is not represented as validation of a later acceptance-gate correction.

| Check | Result on `82a4c1f` |
| --- | --- |
| Frozen install | UNKNOWN, exit 143 after dependency-resolution stall; exact dependency cache provenance above |
| Lint / typecheck | PASS, exit 0, 5/5 tasks each |
| Full unit suite | INCOMPLETE, cancelled exit 143: observed 1545 pass lines, 2 fail lines and 3 todos; these are not final suite totals |
| Four scans/notices | PASS, exit 0 |
| Exact mandatory E2E under localhost lock | FAIL, exit 1: 27 passed, 1 failed, 89 expected skips, 2.4 minutes; installed Chromium |
| Build | PASS, exit 0, 1/1 shared-cache task, 830 ms |

The full run received all 21 passing browser results, but the KB-61 authoritative-exit case correctly failed: its outer Python supervisor exited with OS code 120, no own fixture-exit receipt, and no stderr EOF. Successful-looking result records were not accepted as success. The later unchanged KB-66 cached child promise exceeded its first original 240000 ms deadline at 240012.53 ms; no descendants remained under that test runner. The entire run was then cancelled rather than repeatedly waiting on the same pending lifecycle. No original timeout or test was changed. The actual cause of the missing KB-61 receipt is UNKNOWN and no shared-harness workaround is made.

E2E's sole failure was unchanged `task-views-core.spec.ts:44`: navigation to `/tasks/priority` exceeded the existing 30000 ms test timeout and ended with `net::ERR_ABORTED`. This is retained as FAIL, not an infrastructure skip or a KB-61 product attribution.

Full-run final 20 lines:

```text

tests/unit/kb-08.test.tsx:
(pass) KB-08 isolated: empty projects offer one deliberate start action [4818.90ms]
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
(fail) load-more view names the currently visible count and preserves LTR numerals [240012.53ms]
  ^ this test timed out after 240000ms.
error: script "test" was terminated by signal SIGTERM (Polite quit request)
```

E2E final 20 lines:

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:200442) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:200657) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (2.4m)
```

## Final acceptance-gate proof

PASS — final source `4a52c9c` checks the collected cleanup errors before timeout or nonzero-exit diagnostics, so the KB-61 acceptance gate itself cannot replace either original error. The controlled fresh-child proof still verifies both actual cleanup attempts preserve their exact error objects; its parent also exercises the real acceptance function with both errors alongside a timed-out/unknown exit and verifies both object references remain in the AggregateError.

Final `bun test tests/unit/kb-61.test.tsx`: **27 passed, 0 failed, 51 assertions, 88.72 seconds**, exit 0. Scoped TypeScript compilation passed, exit 0. Every original browser case, lifecycle case, assertion and deadline remains. This completes the same authorized error-preservation correction; the broader `82a4c1f` receipts above remain explicitly historical and were not rerun on this final gate ordering. Current-head CI and CodeRabbit verification remain required.

Status: blocked by frozen shared prerequisite #1203, current-head gates, the retained full-run lifecycle failure/incompleteness and local task-view E2E failure. Native Hebrew and real-device checks remain pre-production needs; no product, backend, environment, dependency, configuration or deployment changes were made.
