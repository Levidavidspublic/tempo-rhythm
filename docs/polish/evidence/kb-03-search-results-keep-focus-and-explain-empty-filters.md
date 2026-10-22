# KB-03 — search states and focus

The mounted `/search` component keeps the last settled result list visible while a new query is pending. Its separate status region announces the pending state or the newly settled count once. A category with no matches explains that other results remain and offers a clear-filter button that returns focus to the query. The 250 ms debounce, URL `q` parameter and existing search query call remain unchanged.

![Before and after search contact sheet, labelled by width, language, state and theme](kb-03-search-results-keep-focus-and-explain-empty-filters.jpg)

## Capture method and limits

The **before** frames come from the checked-in `SearchScreenBody` and `SearchHeader` rendered *before editing them*, using the original module and its existing `ResultGroup`, `translate` and v3 styles. The baseline source was frozen in ignored `work/before/SearchScreen.tsx` at SHA-256 `ff0b0d55fef523a0f58b9f24c47673395b855459722c9277d7abd7b4c9bae449`; the original HTML was generated before the first implementation edit. The screenshots use that frozen HTML. The input and results are fictional (`Maya`, `Dana`, `Yoni`), and this is an isolated production-component fixture, not an authenticated route capture.

The **after** frames use the actual changed `SearchScreenBody` inside a hydrated loopback browser fixture. A local stub supplies the same fictional results through the unchanged query call. The after frames select the Notes category to show the new filter summary and clear action. The baseline shows all categories, so the sheet compares layout and status treatment, not an identical selected filter. The contact sheet shows 390 and 1280 px, English and Hebrew, light and dark; dark captures wait for the resolved text color. The gallery also captures default results separately in ignored `work/` screenshots.

## Browser interaction findings

- The new `SearchStatus` is a single atomic status announcement, separate from the changing result list. Loading leaves the last settled rows visible until the new result arrives; zero total and zero selected-category states use distinct copy.
- Left/right arrows wrap through the filter radio group and reverse horizontally in Hebrew. Enter from the query focuses the first result. Clearing a filter returns focus to the query.
- The hydrated gallery exercises initial, results, no-match, loading, error, disabled and long-result states, plus language switching and retry. Browser checks cover reduced motion, 44 px phone targets, large text, one `h1`, one `main`, and no viewport overflow at both widths.

The fixture aliases `react-native` to the installed `react-native-web` only for its bundle and replaces backend/navigation imports only inside the loopback harness. Device VoiceOver/TalkBack and authenticated `/search` results remain **UNKNOWN**. Hebrew is machine-drafted and needs Amit's native read.

## Fixture portability review

The test resolves React and the server/client renderers from `apps/web/package.json`, and `react-native-web` from its declaring `apps/mobile/package.json`. The generated browser entry and React-using mocks share the resolved web React entry, so neither isolated nor hoisted installs require a particular nested `node_modules` path. No dependency or configuration changes are needed.

The hydrated checks remain mandatory. They use installed Playwright Chromium or `/usr/bin/chromium` or `/usr/bin/google-chrome`; a missing browser produces the explicit `No Playwright Chromium or system Chromium is installed for KB-03 gallery` failure. Provision a browser before running the suite, as required by the ticket's browser fixture contract and the repository's cloud setup instructions.

## Overnight v3 fixture correction — 2026-10-21

PR open — shared builder adoption passes all 15 checked-in KB-03 cases. Hosted compatibility and final repository gates remain required. Role: WORKHORSE; issue #1157, PR #1162. Amit's overnight v3 authorization supersedes the earlier AT-05 retry hold for this scoped pass.

Source commit: `aed296c`. Prerequisite: shared harness PR #1203 (issue #1202), merged into this PR branch through ordinary merge commits. Target branch integration does not yet contain #1203. Its files remain owned by that shared ticket; target-branch inclusion is required before this PR can pass scope-guard or merge. No force-push or production change was made.

The old fixture built the browser bundle inside the root Bun test process. The new fixture calls `isolatedBrowserBuild`, with exact serializable aliases, separate output directory, workspace React resolution and importer-relative scheduler resolution. The shared runner streams build/exit phases, requires the actual child and supervisor exits, and reaps its descendants. Execution and cleanup fit inside the unchanged 120-second setup hook. Browser launch, case starts and cleanup also emit phase evidence. Independent idempotent cleanup starts browser, server and directory releases together and preserves errors; the existing five-second cleanup deadline stays unchanged.

All 15 test callback bodies and per-case deadlines are byte-for-byte identical to `511578d`; a direct source comparison verified this. The actual source has eight static and seven hydrated cases. The earlier issue comment's 19-case claim does not match this file and is not repeated as a result. No test was weakened, skipped or deleted. Browser absence still fails explicitly; the review suggestion to skip mandatory browser coverage conflicts with Amit's instruction. Bundled Chromium or the existing system Chromium satisfies the fixture's provisioning requirement.

Before: hosted Test on `511578d` failed with scheduler/index.js EISDIR, 3,434 pass / 1 fail / 3 todo (job 119166696931). After: focused local KB-03 passes 15 / 0 with 27 assertions in 8.37 s, shared build child exits 0, supervisor exits 0 and cleanup completes. These are different environments, so the local result does not itself prove hosted EISDIR is fixed.

An initial local launch occurred before the copied verified dependency tree was ready and reported 0 pass / 1 fail / 1 error (`react/jsx-dev-runtime` missing). After the runtime copy completed, the same source passed 15 / 0. Both receipts are retained; the earlier infrastructure failure is not concealed. The exact frozen install also stalled during dependency resolution. The controller attempted cancellation at its intended 120-second bound, but that was not the observed termination time: the retained command completed with exit 0 after 303.72 seconds. The earlier UNKNOWN verdict was provisional and was incorrectly retained after completion. No manifest or lockfile changed.

### Test results (cloud agent sandbox)

Bun 1.3.9. Mandatory sequence against own source `aed296c` and shared helper `1e18455` (before its later central review corrections):

| Command | Result |
|---|---|
| `bun --version` | PASS: 1.3.9 |
| `bun install --frozen-lockfile` | PASS: exit 0, completed after 303.72 seconds; checked 1033 installs across 1079 packages with no changes. The earlier stall/cancellation attempt is retained below; verified dependency trees had been copied locally, no lockfile change |
| `bun run lint` | PASS: 5/5 tasks, zero errors |
| `bun run typecheck` | PASS: 5/5 tasks |
| `bun test tests/unit/kb-03.test.tsx` | PASS: 15/0, 27 assertions, 8.37 seconds |
| `bun run test` | PASS: 3,520/0, 3 todo, 81,590 assertions, 213 files, 355.10 seconds; all 15 KB-03 cases pass in the root process |
| Four scans/notices | PASS: all four commands exit 0 |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: browser unavailable and CDN download blocked 403; actual run 1 pass / 28 launch failures / 88 skips, exit 1 |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS: 1/1 tasks, 29.25 seconds |

The root process no longer reports KB-03 scheduler EISDIR in this local run. Hosted verification remains required. The earlier planning baseline had 20 KB-64 browser-close failures; KB-64 passes here without any KB-64 edit. Do not attribute that intermittent baseline improvement to this scoped change.

Last 20 lines — kb03-focused.log
```text
bun test v1.3.9 (cf6cdbbb)

tests/unit/kb-03.test.tsx:

# Unhandled error between tests
-------------------------------
error: Cannot find module 'react/jsx-dev-runtime' from '/workspace/kb03/apps/web/components/global-search/SearchScreen.tsx'
-------------------------------


 0 pass
 1 fail
 1 error
Ran 1 test across 1 file. [235.00ms]
```

`kb03-install.log` belongs to the same exact `bun install --frozen-lockfile` command, not a separate non-frozen install. The execution session completed with exit 0; the log below records 303.72 seconds. The intended 120-second controller cancellation did not establish a terminated command. This validates the copied dependency tree against the frozen lockfile; it is not a claim of an empty-directory installation.

Last 20 lines — kb03-install.log
```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
Resolved, downloaded and extracted [36]

Checked 1033 installs across 1079 packages (no changes) [303.72s]
```

Last 20 lines — kb03-4.log
```text
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:26:7 › habits, brain dump and search wiring › /search mounts SearchScreen
    [chromium] › tests/e2e/wiring/harness.spec.ts:8:7 › wiring E2E harness › signed-out /plan is not sent to /sign-in under the dev E2E bypass
    [chromium] › tests/e2e/wiring/harness.spec.ts:14:7 › wiring E2E harness › a route outside the wiring list still redirects
    [chromium] › tests/e2e/wiring/plan.spec.ts:9:7 › plan wiring › /plan shows the day timeline and not the scaffold placeholder
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/profile mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /settings/preferences mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:7:7 › settings nags + memory wiring › /settings/nags renders the nags screen and nav links exist
    [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
    [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
  88 skipped
  1 passed (13.9s)
```

### Final shared dependency proof

After merging the central review corrections at shared `4d30965`, source head `83155ef` passes `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-03.test.tsx`: **30 pass / 0 fail, 72 assertions, 10.30 seconds** (15 shared lifecycle cases plus all 15 KB-03 cases). The shared fix covers nested exit receipts, receipt validation after pipe drainage, and missing-supervisor spawn failure without signaling the parent process group. No KB-03 case or product file changed during this dependency update.

The mandatory full-suite receipt above is explicitly for shared `1e18455`; the final combined focused receipt is for shared `4d30965`. Current-head hosted CI and CodeRabbit review remain pending. The PR branch includes #1203, but integration does not yet; scope-guard remains blocked until that prerequisite lands. No merge of KB-03 is claimed. The CodeRabbit browser-availability thread is retained for lead review: mandatory browser coverage and explicit missing-browser failure remain intentional under Amit's no-skip instruction.

### Final shared-source refresh — 2026-10-21

PR open — source `5bed8ebfe24142e8de8f885ff4ade1d95b315c93` includes shared `2d99c84a365c6ead0009715012b0cdd908b570aa` by ordinary merge. `bun test tests/unit/kitchen-fixture.test.ts tests/unit/kb-03.test.tsx` passes **33 / 0, 80 assertions, 15.97 seconds**: 18 shared cases plus all 15 unchanged KB-03 cases. The earlier full-suite and E2E receipts remain on their explicitly named source; they were not rerun for this shared refresh.

Shared #1203 remains blocked: a separate KB-75 combined proof exposed a cleanup race in which the supervisor was killed before the authoritative child receipt, leaving that child exit unknown. This passing KB-03 proof does not erase that failure or clear the shared prerequisite. The lead records the exhausted shared repair budget and remaining owner decision. No merge, skip, timeout relaxation or further local source repair is claimed.
