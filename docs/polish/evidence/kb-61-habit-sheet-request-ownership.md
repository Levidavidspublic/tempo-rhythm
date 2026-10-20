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

The Browser plugin skill is listed, but its required JavaScript runtime tool is not callable in this tool inventory. The approved ticket explicitly permits the isolated Playwright/installed Chromium fixture used here. It runs on an ephemeral 127.0.0.1 port with fictional data, actual compiled CSS and **system fallback fonts**. The requested files `/fonts/source-sans-3/SourceSans3-latin.woff2` , `/fonts/assistant/Assistant-latin.woff2` and `/fonts/assistant/Assistant-hebrew.woff2` are absent (`apps/web/public/fonts` does not exist). The fixture returns its HTML fallback at these URLs; Chromium reports `Failed to decode downloaded font` for these named paths and `OTS parsing error: invalid sfntVersion: 1008821359`. An additional strict console diagnostic consequently failed; the full messages remain in ignored logs. Do not interpret the fixture as a completely clean console or proof of production-font geometry. This proves local UI behavior; deployed persistence, native screen readers and Hebrew native review remain UNKNOWN. Referenced root `RULES.md` is absent from this integration snapshot; AGENTS, SLOTS, HARD_RULES and the cited design/product sections were read.

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
