# KB-75 admin approval actions evidence

The existing `/admin/approvals` route mounts `AdminApprovals` inside the Tempo shell. The revised host mounts `AdminStatusSummary` and `ApprovalRowFeedback`. Each row now holds its own synchronous request guard, pending state and safe, attributed result. Starting decisions for Maya and Dana concurrently leaves Dana pending when Maya settles. A rapid second click on one row sends one unchanged `approval:setStatus({ userId, status })` call. The reactive admin query remains authoritative for statuses, order and the count of accounts shown; the backend returns at most 500 live accounts, so the count is explicitly qualified. The admin-only query skip and server authorization remain unchanged.

The upper part of the [contact sheet](./kb-75-admin-approval-actions.jpg) retains the original comparison; the lower part records the 21 October review repair. The original sheet compares the exact original source frozen from integration commit `52bf2803e9105b25c2538aedd81a754a9fbfdedb` before editing with the real mounted current host and the interactive gallery at 390/1280 px, English/Hebrew, light/dark. The baseline screen still displays its original English copy under the Hebrew locale. The fixture uses fictional Maya, Dana and Yoni accounts and stubs only the Convex query/mutation boundary; no live account is read or changed. The current and baseline use real `Button`, `LocaleProvider`, compiled app Tailwind/v3 CSS and the actual component source. The gallery composes the two production view exports; its interactive controls are not a replacement for the mounted host tests.

## Browser findings

- Loading is distinct from zero; an initial non-admin/signed-out state never subscribes to admin rows; empty and loaded counts describe shown rows only. Admin rows have no decision buttons. The fixture verifies exact mutation arguments and reactive status/order after a decision.
- Separate held requests for Maya and Dana preserve independent pending state through Maya success or error. The retry acts on only its original row/status; raw backend text is never rendered. A removed-row response is discarded. Keyboard focus recovers in the changed row after the initiating button disappears, while a reader's move to another control is respected.
- English and Hebrew copy and dates render in en-US/he-IL formats. Names use auto direction; email remains isolated LTR. The 390/1280 light/dark matrix checks one shell main and one h1, 44 px phone actions, large-text containment and no horizontal overflow. Visible keyboard focus and near-zero reduced-motion durations are browser-asserted.

The screenshot sheet is visual evidence only; the clean-child mounted browser tests provide mutation/focus assertions. Device screen-reader results and live admin authorization/writes remain **UNKNOWN**. Hebrew copy is machine-drafted for Amit's native read. Full command results and any failure tails are in draft PR #1179.

## Capture provenance and regression cases

The original source was frozen at 2026-10-19 21:29 UTC before edits. All 24 screenshots were captured during the passing fixture run at 2026-10-19 21:47–21:48 UTC. Current captures use first source head `947e49f1b1bf06f7d63468881e48ce72d1e62b18` plus the explicit `Set<string>` type annotation; this annotation has no runtime effect. The capture-only test timeout adjustment changes no UI behavior. The existing contact sheet was inspected again on 2026-10-20 before the corrective push.

The focused command `bun test tests/unit/kb-75.test.tsx` passed 22 named cases with 23 expectations and zero failures (157.88 seconds; Bun 1.3.9, local Chromium). The source names are:

- dictionary keys match and Hebrew is present
- loading distinct from zero
- non-admin skips list query
- empty list is explained
- pending count is qualified to shown rows
- admin row has no decisions
- exact status mutation arguments
- rapid same-row submit is single call
- different rows remain pending independently
- A success leaves B pending
- A error leaves B pending
- same-row error has reachable retry
- raw backend error never appears
- removed-row completion is discarded
- query controls status and reordering
- focus recovers when initiating button disappears
- late completion never steals moved focus
- English and Hebrew date labels and copy
- long email is isolated and wraps in RTL
- phone and desktop matrix has one main h1 and 44 px actions
- visible focus and reduced motion
- both named views render in interactive gallery


## Historical check results preserved

The following is the prior PR check record at `b9d2b51c48933f4f65772760a6e3477d9eaaa1f5`. Its green hosted results and local failures apply to that source, not the repair below. Earlier TypeScript/build failures, disk errors, timeout failures and command-wrapper failures remain recorded rather than being replaced with the new scoped result.

<details><summary>Original PR test record and failure tails</summary>

## Test results (cloud agent sandbox)

Bun `1.3.9` (`cf6cdbbb`). All mandatory commands were attempted in AGENTS order. A first inherited wrapper returned exit 127 without executing its commands because a login shell dropped Bun from PATH. The corrected run started during disk exhaustion; generated cache cleanup restored 14 GB. Lint/typecheck and the affected full unit run were retried under the shared validation lock. Earlier failures remain below. Passing commands were not repeated.

| Command | Actual local result |
| --- | --- |
| `bun --version` | PASS: `1.3.9` |
| `bun install --frozen-lockfile` | PASS exit 0: checked 1033 installs across 1079 packages, no changes |
| Scoped Biome formatting/check (three implementation files) | PASS: 3 checked, 2 formatted, no errors |
| Clean-child bundle smoke | PASS: `{"bundle":{"pass":true}}` |
| Focused mounted browser/capture fixture `bun test tests/unit/kb-75.test.tsx` | PASS: 22 pass, 0 fail, 23 expectations; 157.88 seconds |
| `bun run lint` | PASS exit 0 after disk repair; original ENOSPC exit 1 preserved |
| `bun run typecheck` | PASS exit 0, 5/5 tasks after disk repair; original ENOSPC exit 1 preserved |
| `bun run test` | FAIL after disk repair: 3321 pass, 3 todo, 2 fail; earlier history timeouts passed this time; current failures are unchanged page-summary dashes/backslashes performance assertions; both runs retained below |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | PASS exit 0: all four OK, 66 notices entries |
| `CI=1 bunx playwright test --reporter=line` | FAIL exit 1: 27 passed, 89 skipped, 1 failed (4.3 minutes); unchanged task-view navigation timed out at `/tasks/energy` |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS exit 0, 1/1 build task |

The build used tool-only `TURBO_CACHE=local:r` to avoid packaging a large cache archive; the exact build command above ran. Browser/build checks were serialized using the shared locks. No test configuration, baseline, route, shared Button, backend, package or lockfile changed.

Local gate status: **blocked**. The full unit rerun still fails two unchanged performance assertions in `packages/utils/src/page-summary.test.ts:1204` (dashes 6494.84 ms and backslashes 3017.13 ms against a 3000 ms ceiling), while both original history UTF-8 cases now pass. All 22 KB-75 cases pass in both full runs. The local task-view E2E navigation timeout is also unresolved. No further source attempt or broad rerun is made.

## Current-head GitHub checks

All five required checks are **green on this head**: `ci`, `e2e-preview`, `secret-scan`, `config-guard`, `scope-guard`. [CI run 39351570233](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39351570233): Typecheck 5/5; Build 1/1; Test **3323 pass, 3 todo, 0 fail** across 202 files (57.23 seconds); E2E **28 pass, 89 skip** (52.2 seconds); lint/scans/notices pass. [Preview smoke](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39351570129): **4 passed** (8.0 seconds). GitHub results do not erase the local E2E timeout above.

The mounted KB-75 fixture verifies exact mutation arguments, one call for rapid repeat submission, independent deferred A/B requests through success/error, retry, safe messages, discarded removed-row responses, query-driven status/order, focus recovery without late theft, one main/h1, 44 px targets, no overflow, RTL/email isolation, explicit localized dates and reduced motion. The existing wiring tests also ran unchanged in the full local E2E command. The two named production views are counted separately from the gallery/helpers; this is narrow admin residual polish, not a complete inventory audit.

UNKNOWN: device screen-reader behavior; live admin authorization/writes; Amit’s native Hebrew review. No live account was read/changed, and no merge or deployment to live was performed.

## Earlier failures retained

First head: Typecheck failed at 4/5 tasks on `AdminApprovals.tsx` lines 127 and 130 (`string` versus `Id<"users">`); Build failed on the same typed-set mismatch, `ci` failed and preview waiting reported a failed Vercel deployment. The explicit set element type is corrected and all these checks pass on the current head.

<details><summary>First-head Typecheck: actual last 20 log lines</summary>

```text
2026-10-19T21:40:21.8605704Z   Time:    23.535s
2026-10-19T21:40:21.8606167Z Failed:    tempo-rhythm-web#typecheck
2026-10-19T21:40:21.8606454Z
2026-10-19T21:40:21.8645391Z ##[error]Process completed with exit code 2.
2026-10-19T21:40:21.8787688Z Post job cleanup.
2026-10-19T21:40:21.9656849Z [command]/usr/bin/git version
2026-10-19T21:40:21.9698890Z git version 2.55.0
2026-10-19T21:40:21.9737028Z Temporarily overriding HOME='/home/runner/work/_temp/9fbdfecb-7891-419b-aed0-821df8dbd552' before making global git config changes
2026-10-19T21:40:21.9739039Z Adding repository directory to the temporary git global config as a safe directory
2026-10-19T21:40:21.9742642Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/tempo-rhythm/tempo-rhythm
2026-10-19T21:40:21.9783644Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-10-19T21:40:21.9819553Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-10-19T21:40:22.0099324Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-10-19T21:40:22.0128334Z http.https://github.com/.extraheader
2026-10-19T21:40:22.0139540Z [command]/usr/bin/git config --local --unset-all http.https://github.com/.extraheader
2026-10-19T21:40:22.0178902Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-10-19T21:40:22.0462823Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-10-19T21:40:22.0505285Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-10-19T21:40:22.0974018Z Cleaning up orphan processes
2026-10-19T21:40:22.1281427Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
```
</details>

<details><summary>First-head Build: actual last 20 log lines</summary>

```text
2026-10-19T21:40:17.7488359Z  ERROR  tempo-rhythm-web#build: command (/home/runner/work/tempo-rhythm/tempo-rhythm/apps/web) /home/runner/.bun/bin/bun run build exited (1)
2026-10-19T21:40:17.7504704Z  ERROR  run failed: command  exited (1)
2026-10-19T21:40:17.7580054Z error: script "build" exited with code 1
2026-10-19T21:40:17.7589066Z ##[error]Process completed with exit code 1.
2026-10-19T21:40:17.7679085Z Post job cleanup.
2026-10-19T21:40:17.8221159Z [command]/usr/bin/git version
2026-10-19T21:40:17.8251629Z git version 2.55.0
2026-10-19T21:40:17.8273240Z Temporarily overriding HOME='/home/runner/work/_temp/4820f558-a59d-406d-b090-bee5374d7169' before making global git config changes
2026-10-19T21:40:17.8274182Z Adding repository directory to the temporary git global config as a safe directory
2026-10-19T21:40:17.8276496Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/tempo-rhythm/tempo-rhythm
2026-10-19T21:40:17.8307051Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-10-19T21:40:17.8333959Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-10-19T21:40:17.8545541Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-10-19T21:40:17.8561598Z http.https://github.com/.extraheader
2026-10-19T21:40:17.8569866Z [command]/usr/bin/git config --local --unset-all http.https://github.com/.extraheader
2026-10-19T21:40:17.8599588Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-10-19T21:40:17.8798253Z [command]/usr/bin/git config --local --name-only --get-regexp ^includeIf\.gitdir:
2026-10-19T21:40:17.8833188Z [command]/usr/bin/git submodule foreach --recursive git config --local --show-origin --name-only --get-regexp remote.origin.url
2026-10-19T21:40:17.9131522Z Cleaning up orphan processes
2026-10-19T21:40:17.9325241Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
```
</details>

<details><summary>First-head preview: actual last 20 log lines</summary>

```text
2026-10-19T21:39:53.2411346Z env:
2026-10-19T21:39:53.2414665Z   GH_TOKEN: ***
2026-10-19T21:39:53.2415045Z   HEAD_SHA: 947e49f1b1bf06f7d63468881e48ce72d1e62b18
2026-10-19T21:39:53.2415472Z   PREVIEW_ENVIRONMENT:
2026-10-19T21:39:53.2415811Z   PREVIEW_STATUS_CONTEXT:
2026-10-19T21:39:53.2416149Z ##[endgroup]
2026-10-19T21:40:14.5995041Z FAIL: Vercel deployment Preview is failure: https://tempo-66cxc6nls-amit-levins-projects.vercel.app
2026-10-19T21:40:14.6057279Z ##[error]Process completed with exit code 1.
2026-10-19T21:40:14.6268783Z Post job cleanup.
2026-10-19T21:40:14.7229952Z [command]/usr/bin/git version
2026-10-19T21:40:14.7283668Z git version 2.55.0
2026-10-19T21:40:14.7333594Z Temporarily overriding HOME='/home/runner/work/_temp/4de7a4fd-4694-4e9d-b9d1-abc6ad2f39e5' before making global git config changes
2026-10-19T21:40:14.7335373Z Adding repository directory to the temporary git global config as a safe directory
2026-10-19T21:40:14.7339819Z [command]/usr/bin/git config --global --add safe.directory /home/runner/work/tempo-rhythm/tempo-rhythm
2026-10-19T21:40:14.7396358Z [command]/usr/bin/git config --local --name-only --get-regexp core\.sshCommand
2026-10-19T21:40:14.7443636Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'core\.sshCommand' && git config --local --unset-all 'core.sshCommand' || :"
2026-10-19T21:40:14.7725709Z [command]/usr/bin/git config --local --name-only --get-regexp http\.https\:\/\/github\.com\/\.extraheader
2026-10-19T21:40:14.7767905Z [command]/usr/bin/git submodule foreach --recursive sh -c "git config --local --name-only --get-regexp 'http\.https\:\/\/github\.com\/\.extraheader' && git config --local --unset-all 'http.https://github.com/.extraheader' || :"
2026-10-19T21:40:14.8280318Z Cleaning up orphan processes
2026-10-19T21:40:14.8594006Z ##[warning]Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955, actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
```
</details>

<details><summary>Local lint during disk exhaustion: actual last 20 lines</summary>

```text
$ turbo run lint
• turbo 2.9.6

   • Packages in scope: @tempo/config, @tempo/types, @tempo/ui, @tempo/utils, tempo-rhythm-mobile, tempo-rhythm-web
   • Running lint in 6 packages
   • Remote caching disabled, using shared worktree cache

@tempo/utils:lint: cache miss, executing 7bb9c6ffbbcaf7f7
@tempo/types:lint: cache miss, executing 6f069e4050d2348a
 WARNING  error creating log file directory: Custom { kind: StorageFull, error: Error { kind: CreateDir, source: Os { code: 28, kind: StorageFull, message: "No space left on device" }, path: "/workspace/work/kb-75/packages/utils/.turbo" } }
 WARNING  error creating log file directory: Custom { kind: StorageFull, error: Error { kind: CreateDir, source: Os { code: 28, kind: StorageFull, message: "No space left on device" }, path: "/workspace/work/kb-75/packages/types/.turbo" } }
  x Internal errors encountered: error with cache: Failed to replay logs:
  | Cannot write logs: failed to create directory `/workspace/work/kb-75/
  | packages/types/.turbo`,error with cache: Failed to replay logs: Cannot
  | write logs: failed to create directory `/workspace/work/kb-75/packages/
  | utils/.turbo`

error: script "lint" exited with code 1
```
</details>

<details><summary>Local typecheck during disk exhaustion: actual last 20 lines</summary>

```text
$ turbo run typecheck
• turbo 2.9.6

   • Packages in scope: @tempo/config, @tempo/types, @tempo/ui, @tempo/utils, tempo-rhythm-mobile, tempo-rhythm-web
   • Running typecheck in 6 packages
   • Remote caching disabled, using shared worktree cache

@tempo/utils:typecheck: cache miss, executing 69682310453edbda
@tempo/types:typecheck: cache miss, executing c33422a84068a5ff
 WARNING  error creating log file directory: Custom { kind: StorageFull, error: Error { kind: CreateDir, source: Os { code: 28, kind: StorageFull, message: "No space left on device" }, path: "/workspace/work/kb-75/packages/utils/.turbo" } }
  x Internal errors encountered: error with cache: Failed to replay logs:
  | Cannot write logs: failed to create directory `/workspace/work/kb-75/
  | packages/utils/.turbo`

error: script "typecheck" exited with code 1
```
</details>

<details><summary>First local full test: actual last 20 lines (3321 pass, 3 todo, 2 fail)</summary>

```text
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.46ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


2 tests failed:
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "😀" [19700.83ms]
  ^ this test timed out after 5000ms.
(fail) history normalization (synthetic fixtures only) > UTF-8 cap exact/over including isolated surrogates "\ud800" [5372.33ms]
  ^ this test timed out after 5000ms.

 3321 pass
 3 todo
 2 fail
 81041 expect() calls
Ran 3326 tests across 202 files. [171.13s]
error: script "test" exited with code 1
```
</details>

<details><summary>Second local full test after disk repair: actual last 20 lines (3321 pass, 3 todo, 2 fail)</summary>

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.43ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.70ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.65ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


2 tests failed:
(fail) pathological bodies stay linear > dashes [6528.39ms]
(fail) pathological bodies stay linear > backslashes [3048.69ms]

 3321 pass
 3 todo
 2 fail
 81041 expect() calls
Ran 3326 tests across 202 files. [172.38s]
error: script "test" exited with code 1
```
</details>

<details><summary>Local E2E: actual last 20 lines</summary>

```text
[108/117] [chromium] › tests/e2e/wiring/settings-nags-memory.spec.ts:15:7 › settings nags + memory wiring › /settings/memory renders the memory screen
[109/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /notifications mounts its component
[110/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[111/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[112/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[113/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:179031) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:179092) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  1 failed
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
  89 skipped
  27 passed (4.3m)
```
</details>

<details><summary>Local E2E failure context</summary>

```text
  1) [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record

    Test timeout of 30000ms exceeded.

    Tearing down "context" exceeded the test timeout of 30000ms.

    Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
    Call log:
      - navigating to "http://localhost:3000/tasks/energy", waiting until "load"


      48 |     await expect(page.getByText("Done")).toBeVisible();
      49 |
    > 50 |     await page.goto("/tasks/energy");
         |                ^
      51 |     await expect(main.getByRole("heading", { name: "Energy", exact: true })).toBeVisible();
      52 |     await expect(main.getByRole("heading", { name: "Low energy" })).toBeVisible();
      53 |     await expect(page.getByText(updatedTitle)).toBeVisible();
        at /workspace/work/kb-75/tests/e2e/task-views-core.spec.ts:50:16

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/task-views-core-core-task--ccb5c-e-one-persisted-task-record-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context:
```
</details>

<details><summary>Inherited wrapper command failure (one-line tails; six commands exited 127)</summary>

```text
lint/typecheck/test/scans: bash: line 1: bun: command not found
e2e: env: ‘bunx’: No such file or directory
build: env: ‘bun’: No such file or directory
```
</details>



</details>


## Review repair — 21 October 2026

Verified CodeRabbit findings [4335106299](https://github.com/Levidavidspublic/tempo-rhythm/pull/1179#discussion_r4335106299) and [4335106347](https://github.com/Levidavidspublic/tempo-rhythm/pull/1179#discussion_r4335106347) against the checked-in source. The gallery's inactive endonym inherited the page language; each endonym now has its own `lang="en"` or `lang="he"` span. The conditional language switch and existing labels are preserved. The fixture now resolves `postcss` and `@tailwindcss/postcss` through `Bun.resolveSync(name, web)` from the declaring `apps/web` workspace, supporting both local and hoisted layouts without dependency/configuration edits.

The new hydrated case, **language endonyms declare their own language through both switches**, verifies the Hebrew label's language before switching to Hebrew, the gallery language after that switch, the English label's language, and the return to English. All 22 existing cases and assertions remain. PostCSS and Tailwind still compile the real application styles, and the existing size/focus/RTL matrix still tests real shared Button output.

This fixture already executes bundling, serving, browser imports and checks only in `KB75_FIXTURE_CHILD`. The parent still rejects any nonzero child exit and checks every named result; added cleanup kills and awaits a surviving child. The existing 240s/480s setup limits and all browser assertions are unchanged. The merged KB-67 sequence is absent from this worktree and remains for root validation after reconciliation.

The review baseline host was frozen at `b9d2b51c48933f4f65772760a6e3477d9eaaa1f5` before the endonym edit. The lower contact sheet pairs this exact mounted host and gallery with the repaired views at 390/1280 px, en/he, light/dark. Captures use the same fictional accounts, real components, LocaleProvider and compiled v3/Tailwind styles. Language attributes are verified by browser assertions; their pronunciation on physical screen readers remains UNKNOWN.

Repair source commit: `a67d8d12fd396940a75b8447ed501e2be39d0336`.

## Test results (cloud agent sandbox, review repair)

Bun **1.3.9**. The checked `.bun` directory is real and local to this worktree; workspace package links remain local. No production environment, backend, shared Button, configuration, dependency or lockfile changed. `RULES.md` referenced in the ticket is absent from this checkout; current AGENTS/HARD_RULES/SLOTS were followed.

| Command | Exit | Current repair result |
|---|---:|---|
| `bun --version` | 0 | 1.3.9 |
| `timeout -k 5 120 bun install --frozen-lockfile` | 124 | UNKNOWN: resolver remained at “Resolving dependencies”; stopped at the authorized 120s bound |
| `bun test tests/unit/kb-75.test.tsx` (before endonym repair) | 1 | 22 pass, 1 fail, 24 expectations; only the new language-span regression failed as expected. All 16 pre-edit host/gallery captures completed. |
| `bun run lint` | 0 | 5/5 tasks; 0 errors, 9 existing web warnings |
| `bun run typecheck` | 0 | 5/5 tasks successful |
| `bun test tests/unit/kb-75.test.tsx` (after repair) | 0 | 23 pass, 0 fail, 24 expectations in 113.46s; new switch regression and all 22 existing cases pass. All 16 after captures completed. |
| `bun run test` | — | UNKNOWN: pending root handoff |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | — | UNKNOWN: pending root handoff |
| `CI=1 bunx playwright test --reporter=line` | — | UNKNOWN: pending root handoff; no dedicated /admin/approvals wiring spec was found |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | UNKNOWN: pending root handoff |

Heavy commands each acquire `/workspace/work/kb-finish/heavy-check.lock`. Logs and exit files are under `/workspace/work/kb-finish/kb75-review/`. Full-suite compatibility with the reconciled tree, remaining mandatory gates and remote checks are root-owned; scoped fixture evidence does not mark the ticket done or prove live admin changes. Physical VoiceOver/TalkBack and native Hebrew review remain UNKNOWN.

Frozen-install output (all available lines):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
[exit 124 at the 120-second bound]
```


Before-repair regression failure tail (last 20 lines):

```text
+ Call log:
+   - Expect "to.have.attribute.value" with timeout 5000ms
+   - waiting for getByRole('button', { name: 'עברית', exact: true }).locator('span')
+ "
+ ,
+   "pass": false,
  }

- Expected  - 1
+ Received  + 14

(fail) KB-75 mounted admin approvals > language endonyms declare their own language through both switches [1.19ms]

1 tests failed:
(fail) KB-75 mounted admin approvals > language endonyms declare their own language through both switches [1.19ms]

 22 pass
 1 fail
 24 expect() calls
Ran 23 tests across 1 file. [173.43s]
```


Review capture timing: before 2026-10-21 11:06:37 UTC to 2026-10-21 11:07:58 UTC; after 2026-10-21 11:16:59 UTC to 2026-10-21 11:17:44 UTC. All 16 expected files exist in each phase; the retained historical sheet uses the earlier provenance above.

After-repair focused result:

```text
23 pass
0 fail
24 expect() calls
Ran 23 tests across 1 file. [113.46s]
```


## Single owner-authorized extra pass — UTC fixture dates, 21 Oct 2026

Test source commit: `7f928273de78fe0814c2666a10294c5c435bad50`, based on `f35d7ac416b2538764bf5c5647b7be10ad6f5772`. This pass changes only the scoped test and this evidence. Production `Intl.DateTimeFormat` behavior and all implementation files are unchanged. The root-owned consolidated checkout remains untouched.

### Attempt ledger

| Candidate | Source receipt | Scope |
| --- | --- | --- |
| Normal 1 | Original `947e49f1b1bf06f7d63468881e48ce72d1e62b18`, now rebased as `4b28e41` | Initial row-owned approval behavior and fixture |
| Normal 2 | Original `b9d2b51c48933f4f65772760a6e3477d9eaaa1f5`, now `b0b3055`; `/workspace/work/kb-finish/kb75-review/pr-body-before.md:7` explicitly records attempt 2 | Visible-row ID type correction and initial capture completion |
| Normal 3 | Original `a67d8d12fd396940a75b8447ed501e2be39d0336`, now `8477103`; review `handoff.md` and `summary.json` retain the source/result receipt | Endonym language declarations, fixture dependency resolution and child cleanup |
| Single extra, fourth/final | `7f928273de78fe0814c2666a10294c5c435bad50` | Browser timezone pin and assertions below |

The owner's existing one-extra-pass authorization applies here and root explicitly assigned it after the read-only audit established three normal candidates and no previous extra use. The evidence-only commits do not consume repair rounds. Wrapper/disk/install command failures on an unchanged candidate are retained historical outcomes, not separate source candidates. This consumes KB-75's sole extra; no fifth source/test candidate is authorized.

### Verified finding and bounded repair

[CodeRabbit 4336897182](https://github.com/Levidavidspublic/tempo-rhythm/pull/1179#discussion_r4336897182) is valid: production formats join dates in the browser's default time zone, while the fixture uses a UTC-midnight timestamp and requires exact 19 October strings. An unpinned west-of-UTC browser can instead show 18 October. The fixture now supplies `timezoneId: "UTC"` in its existing `browser.newPage` call. The existing English/Hebrew date case additionally checks each actual browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` equals `UTC`, while retaining the exact `10/19/2024` and `19.10.2024` assertions.

All 23 named cases, their existing assertions, the 240-second normal setup limit and the 480-second optional-capture limit remain unchanged. No case, timeout, configuration, skip, production date policy, dependency or backend was changed. No pre-repair fixture rerun was performed in this pass. The historical contact sheet remains applicable because this is test-environment determinism and introduces no rendered product change.

### Test results (cloud agent sandbox)

The source/test hash set was frozen before the focused run and checked afterward. The scoped command uses Bun **1.3.9**, an installed Chromium and the existing real local dependency cache/workspace links. It holds `/workspace/work/kb-finish/heavy-check.lock` separately from root's other commands. Parent-zone preflight actually resolved `America/Los_Angeles`; the entire fixture command runs under that same non-UTC parent `TZ`, while each browser page is explicitly UTC.

| Command | Fresh result |
| --- | --- |
| `bun --version` | PASS, exit 0: `1.3.9` |
| `TZ=America/Los_Angeles bun -e 'const zone=Intl.DateTimeFormat().resolvedOptions().timeZone; console.log(JSON.stringify({parentTimezone:zone})); if(zone!=="America/Los_Angeles")process.exit(1)'` | PASS, exit 0: `{"parentTimezone":"America/Los_Angeles"}` |
| `TZ=America/Los_Angeles bun test tests/unit/kb-75.test.tsx` | FAIL, exit 1: 0 pass / 2 hook failures, 245.95s; no named browser results reported (tail below) |
| `bun install --frozen-lockfile` | UNKNOWN: not rerun in this scoped pass; prior resolver timeout remains above; root owns final validation |
| `bun run lint` | UNKNOWN: not rerun in this test-only pass; root owns consolidated validation |
| `bun run typecheck` | UNKNOWN: not rerun in this test-only pass; root owns consolidated validation |
| `bun run test` | UNKNOWN for this input: root owns consolidated validation and exact compatible input commits |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | UNKNOWN: not rerun in this scoped pass; root owns consolidated validation |
| `CI=1 bunx playwright test --reporter=line` | UNKNOWN: root owns the complete E2E gate |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | UNKNOWN: root owns the build gate |

The 23 Bun cases comprise the dictionary case and 22 named browser-result reports. The Bun expectation count is the parent’s dictionary/report assertions; the two new Playwright timezone assertions execute inside the existing browser date case. `work/kb75-extra/preservation.json` records unchanged browser case names, exact date assertions and deadline literals, plus byte-identical production files.

Frozen SHA-256 receipts (including unchanged implementation files):

```text
f65f6f3b4e44ff0a73ab5f4c8ae44b01ac07f2e32948217760ee371ae2dcc37c  apps/web/components/approval/AdminApprovals.tsx
a5be0cde0a73c99885a5ce6f730cc036b2c0aeaaf438cd870633e5e2d65ad8ae  apps/web/lib/i18n-groups/kb-75.ts
b500c602978a968299e1fbb10320329ab5bd4c4e89d00fa844616e98dd496ba7  apps/web/app/v3/kb-75.css
323dd41c9eed4d1508869af9ed3d09b1541992fed84006cfdfdcb02426605587  tests/unit/kb-75.test.tsx
```

Fresh logs are `/workspace/work/kb-finish/kb75-extra/version.log`, `parent-zone.log`, and `focused.log`; the frozen baseline and hash receipts remain in ignored `work/kb75-extra/`. Historical failed/unknown gates and tails remain above. Root owns rebases, remote checks/review/queue, push and merge. No deployment, live-account write, physical screen-reader or native Hebrew validation is claimed.


Final local outcome for the frozen extra-pass candidate:

```text
bun test v1.3.9 (cf6cdbbb)

tests/unit/kb-75.test.tsx:
killed 1 dangling process
(fail) (unnamed) [240028.44ms]
  ^ a beforeEach/afterEach hook timed out for this test.
(fail) (unnamed) [5028.86ms]
  ^ a beforeEach/afterEach hook timed out for this test.

 0 pass
 2 fail
Ran 2 tests across 1 file. [245.95s]
```

This is all available local output. Setup hit its existing 240-second deadline, then cleanup hit its existing five-second deadline. The fixture buffers child stdout/stderr and exit before parsing results; no named browser results were reported. It is UNKNOWN which child phase was waiting or whether individual browser cases executed. The parent-process non-UTC preflight passed, but the actual browser UTC assertions and exact-date checks were not proven by this local invocation. No retry or source/test repair followed. Root holds the local gate pending a scoped diagnostic; KB-75's sole extra remains consumed.

After the runner ended, an owned child was briefly observed as PID 140695, PPID 1, PGID 121772. A subsequent exact-PID inspection found it exited before any cleanup signal was sent. Final `/proc` inspection reports that PID as zombie state `Z`, empty command line, and no live scoped Bun/flock processes (`/workspace/work/kb-finish/kb75-extra/cleanup-final.json`). No worker runner remains active. The unknown waiting phase is not inferred from the timeout.

Root separately reported current-source hosted CI **PASS** for `7f928273de78fe0814c2666a10294c5c435bad50`, [run 39607557790](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39607557790). This hosted result is separate evidence and does not replace the failed local non-UTC focused gate or establish that the hosted environment used a non-UTC parent. Remote review/queue and final validation remain root-owned.


## Overnight v3 shared-harness adoption — 2026-10-21

PR open — the owner authorized AT-16's scoped shared-harness adoption in the overnight v3 instruction. Role: WORKHORSE. This continues issue #1178 and draft #1179, preserves the prior exhausted-pass ledger and failure receipts, and brings in shared #1202/#1203 at `4d30965` through an ordinary merge.

The parent uses the shared bounded child runner with cancellation, streaming phase evidence, actual child and supervisor exit validation, and owned-process reaping. Fresh build isolation resolves packages independently of the full Bun suite. The child owns a unique temporary directory; independent server/browser/directory cleanup begins even after setup failure and is used for normal exit and cancellation. The existing 240-second normal setup, 480-second optional capture, default five-second cleanup and every browser wait/assertion deadline remain unchanged. No fixed sleep was added.

All 23 existing parent cases remain: the dictionary case plus 22 named browser cases. A comparison with original branch head `b7196b6` found identical 22 browser case names, all 38 browser-expect-bearing lines and all three parent-expect-bearing lines. Exact date and browser UTC assertions remain. Product component, dictionary, CSS and contact sheet are byte-identical to that original head.

Non-UTC focused proof: `TZ=America/Los_Angeles bun test tests/unit/kb-75.test.tsx` → exit 0, **23 pass / 0 fail**, 24 parent assertions, 25.83 seconds. A separate parent preflight resolved `America/Los_Angeles`. The unchanged date case proved both browser pages resolve `UTC` and retain the exact English/Hebrew date strings. Streamed phases reached every named case and completed cleanup; actual child exit 0, supervisor exit 0, all 22 browser results returned. Both recorded runner PIDs were absent after completion and no unique `work/kb75-fixture-*` directory remained.

Before: retained historical non-UTC run above reported zero named results and two hook failures at 240 seconds and five seconds (245.95 seconds total). After: all 23 cases pass in 25.83 seconds. This proves the new invocation completed, not the precise phase in which the old buffered invocation stalled.

Bun 1.3.9. Frozen install remained at Resolving dependencies and reached the external 120-second bound, exit 124: UNKNOWN. Its bun.lock SHA256 matches the successfully installed shared worktree (`35da413125508b8d1fbbaff0fc48b01dd8db7a437dd3439dc7d2f2edfbfcd1f7`); installed trees were copied locally with workspace links preserved. No manifest/lockfile/environment/configuration changed. Mandatory lint/typecheck/full suite/scans/E2E/build are running in order, with E2E serialized under the shared browser lock.

Logs are `/workspace/kb-run-logs/kb75-install.log`, `kb75-parent-zone.log`, `kb75-focused.log`, `kb75-0.log` through `kb75-5.log` and `kb75-results.json`. Final command results follow below. The required PR attachment tool call was attempted separately, but host completion is UNKNOWN after it hung. Live administrative writes, native Hebrew and physical-device checks remain UNKNOWN.
