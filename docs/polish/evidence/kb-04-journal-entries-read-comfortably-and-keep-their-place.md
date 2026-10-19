# KB-04 · Journal entries read comfortably and keep their place

Source: `origin/integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The before captures bundled the checked-in original `JournalScreen` with fictional ten-day query results. The after captures bundled the scoped screen on this branch with the same fictional rows and local date. Both used the repository's v3 styles and actual `TpIcon` sprite. The browser fixture uses the real `journalDate`, `promptFor`, and `localIsoDate` helpers; only query/auth, locale context, the fixed clock hook, generated API references, and navigation are substituted. No personal account data or live backend was used.

![Before and after contact sheet](kb-04-journal-entries-read-comfortably-and-keep-their-place.jpg)

The sheet labels width, locale, state and before/after. It includes 390 and 1280 px, English and Hebrew, light before/after, and dark after. The dark screenshots verify the v3 token switch; the original view has no dark baseline in the sheet.

## Browser and keyboard findings

- `JournalDayHeading` and `JournalLoadMore` are mounted by the real `JournalScreen` used at `/journal`. `Kb04Gallery` uses the same view exports with fictional controlled props.
- Ten days load in the existing bounded query. Activating Load more with Enter mounts the next chunk and focuses its first new h2. An empty next chunk focuses the end status. While a query waits, the button stays focusable and visibly busy. When the reader moves focus elsewhere, the loaded chunk leaves it there. The fixture renders under React StrictMode.
- The standalone gallery exposes default, empty, loading, error, disabled and overflow states. Its retry and pagination callbacks respond to keyboard/click input.
- Browser fixture checks one main and one h1, h2 day titles, LTR date isolates on Hebrew pages, RTL container direction, enlarged text, visible keyboard focus, reduced motion, at least 44 px phone controls, and `document.documentElement.scrollWidth <= innerWidth` at 390 and 1280 px.
- Isolated gallery fixture screenshots: `gallery-{390,1280}-{en,he}-{light,dark}.png` in local test output. The contact sheet includes these default gallery views below the mounted before/after views; separate browser assertions exercise the other controlled states.
- The authenticated live route and device VoiceOver/TalkBack remain **UNKNOWN**. The signed-out local `/journal` route redirects to sign-in; that shell result is not presented as backend verification.

## Test results (cloud agent sandbox)

Bun: **1.3.9**. The initial frozen install attempt stalled at “Resolving dependencies” and timed out at 180 seconds. A retry passed in 41.42 seconds after the shared Bun cache warmed; no dependency or lockfile changed.

| Command | Exit | Result |
|---|---:|---|
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 0 on retry | 1033 installs across 1079 packages, no changes; initial attempt timed out at 180s |
| `bun run lint` | 0 | 0 errors; repository pre-existing warnings |
| `bun run typecheck` | 0 | 5/5 tasks successful |
| `bun run test` | 1 | 3315 pass, 3 todo, 2 fail across 3320 tests; all 16 KB-04 cases pass. Failures: unrelated history-normalization 5s timeout under shared CPU load; `packages/utils/src/blocks.test.ts` browser-target bundle reports `EISDIR` reading the regular local `zod/index.js` file. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | All four OK |
| `CI=1 bunx playwright test --reporter=line` | 1 | 25 passed, 89 skipped, 3 failed across 117 cases in 5.4 minutes. Existing sign-out and `/brain-dump` wiring cases timed out after 30s; the task-views-core case could not find the `Today` heading. No `/journal` case failed. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | 0 | 1/1 task successful; web production build and TypeScript completed in 2m11.505s |

Focused fixture tests include: no entries, one day, multiple chunks, full-chunk end state, delayed chunk focus under StrictMode, focus moved away during loading, distinct loading state, Hebrew dates, large text, long-title overflow, gallery states and callback, gallery focus, key parity, visual matrix and reduced motion. The original long-tag overflow failure was fixed inside `kb-04.css`; its focused rerun passed (1 pass, 0 fail).

Source commits: `010ad4c`, `23c0c4c`, `884a155`, `5af0b9b`. This evidence document and contact sheet are committed on the same branch.

The full-test failure tail (20 lines) is retained below. The two failing cases are outside this ticket's source scope; no shared test or package file was edited.

The Playwright failure tail (20 lines) is retained below. This branch changes neither sign-out, task views nor brain dump. The signed-in and credential-gated cases skipped in this sandbox; this run is not live authenticated evidence.

```text
[110/117] [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
[111/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates mounts its component
[112/117] [chromium] › tests/e2e/wiring/today.spec.ts:10:7 › today wiring › /today mounts habit check-in and day plan markers
[113/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder mounts its component
[114/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/builder?from=<id> mounts its component
[115/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
[WebServer] (node:74326) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:74472) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  3 failed
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:20:7 › habits, brain dump and search wiring › /brain-dump mounts BrainDumpScreen
  89 skipped
  25 passed (5.4m)
```

The codec case's earlier error line was `error: EISDIR reading file: "/workspace/work/kb-04/node_modules/.bun/zod@4.3.6/node_modules/zod/index.js"`.

The latest GitHub CI Test job on `5af0b9b` reported **3316 pass, 3 todo, 1 fail**. Its only failure was the same shared-codec browser bundle `EISDIR`; all 16 KB-04 cases passed there as well. The local run additionally hit the history-normalization timeout while the shared four-CPU sandbox was busy. This ticket remains **stuck** after three CI attempts under `AGENTS.md`'s attempt limit; no shared-codec or history test file was changed.

```text
CI Test failure (job 118272797032):
error: EISDIR reading file: "/home/runner/work/tempo-rhythm/tempo-rhythm/node_modules/.bun/zod@4.3.6/node_modules/zod/index.js"
    at /home/runner/work/tempo-rhythm/tempo-rhythm/node_modules/.bun/zod@4.3.6/node_modules/zod/index.js
(fail) shared codec is browser-safe > a browser-target bundle of the public entry reaches no Convex, Node or external module [14.00ms]
3316 pass · 3 todo · 1 fail
```

```text
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.39ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.47ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages

2 tests failed:
(fail) history normalization (synthetic fixtures only) > duplicate identities compare large and deep malformed fields structurally [11664.23ms]
  ^ this test timed out after 5000ms.
(fail) shared codec is browser-safe > a browser-target bundle of the public entry reaches no Convex, Node or external module [8.18ms]

 3315 pass
 3 todo
 2 fail
 80940 expect() calls
Ran 3320 tests across 202 files. [126.70s]
error: script "test" exited with code 1
```
