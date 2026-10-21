# KB-04 · Journal entries read comfortably and keep their place

Source: `origin/integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The before captures bundled the checked-in original `JournalScreen` with fictional ten-day query results. The after captures bundled the scoped screen on this branch with the same fictional rows and local date. Both used the repository's v3 styles and actual `TpIcon` sprite. The browser fixture uses the real `journalDate`, `promptFor`, and `localIsoDate` helpers; only query/auth, locale context, the fixed clock hook, generated API references, and navigation are substituted. No personal account data or live backend was used.

![Before and after contact sheet](kb-04-journal-entries-read-comfortably-and-keep-their-place.jpg)

The upper part of the sheet retains the original implementation comparison; the lower part records the authorized 21 October review repair. The sheet labels width, locale, state and before/after. It includes 390 and 1280 px, English and Hebrew, light before/after, and dark after. The dark screenshots verify the v3 token switch; the original view has no dark baseline in the sheet.

## Browser and keyboard findings

- `JournalDayHeading` and `JournalLoadMore` are mounted by the real `JournalScreen` used at `/journal`. `Kb04Gallery` uses the same view exports with fictional controlled props.
- Ten days load in the existing bounded query. Activating Load more with Enter mounts the next chunk and focuses its first new h2. An empty next chunk focuses the end status. While a query waits, the button stays focusable and visibly busy. When the reader moves focus elsewhere, the loaded chunk leaves it there. The fixture renders under React StrictMode.
- The standalone gallery exposes default, empty, loading, error, disabled and overflow states. Its retry and pagination callbacks respond to keyboard/click input.
- Browser fixture checks one main and one h1, h2 day titles, LTR date isolates on Hebrew pages, RTL container direction, enlarged text, visible keyboard focus, reduced motion, at least 44 px phone controls, and `document.documentElement.scrollWidth <= innerWidth` at 390 and 1280 px.
- Isolated gallery fixture screenshots: `gallery-{390,1280}-{en,he}-{light,dark}.png` in local test output. The contact sheet includes these default gallery views below the mounted before/after views; separate browser assertions exercise the other controlled states.
- The authenticated live route and device VoiceOver/TalkBack remain **UNKNOWN**. The signed-out local `/journal` route redirects to sign-in; that shell result is not presented as backend verification.

## Test results (cloud agent sandbox, original implementation)

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


## Authorized review repair — 21 October 2026

The owner authorized one additional repair pass after the original attempt limit. CodeRabbit finding [4335140711](https://github.com/Levidavidspublic/tempo-rhythm/pull/1147#discussion_r4335140711) was confirmed against `643bbda9b380b3eb5dd1c224f4ba20aba449f77c`: an untitled row rendered its date in both the h2 and the metadata. `JournalRows` now renders the metadata date only for a titled row. `JournalDayHeading`, tags, query arguments, authentication gates, cursor behavior, and pagination focus behavior are unchanged.

The new regression, **untitled row links announce each date once in English and Hebrew**, checks the hydrated mounted screen and real gallery in both languages. Each untitled link must have exactly one date element and an accessible name equal to that one formatted date; its heading date remains LTR. The same test checks that titled rows retain their heading, metadata date, and Reflection tag. These browser assertions do not claim a physical screen-reader test.

Before editing the mounted module, the existing screenshot checks captured all 390 px mounted combinations and all gallery combinations (390/1280 px, en/he, light/dark). The mounted matrix timed out waiting for its existing h1 hydration check on the first 1280 px view; its four desktop baseline captures are therefore unavailable and labelled UNKNOWN in the new sheet. The historical original before/after sheet is retained above the repair comparison. The repair comparison crops entry details so that the date duplication is visible. The repaired fixture captured all 16 after views and passed both complete matrices; no missing capture is substituted with a different source.

Within the same authorized pass, the hosted full-suite concern showed that same-process Bun browser fixtures can disturb later fixture builds/servers. This file now keeps browser/component imports, bundling, serving, default-timeout setup, real assertions, and cleanup in one clean child process. The parent retains all 17 named cases and propagates a nonzero child exit; its cleanup kills and awaits any surviving child. Existing child assertions, 45s/300s per-case limits, and 120s setup limit remain intact. This worktree does not contain the merged KB-67 test, so that combined hosted sequence still needs validation by the root on the reconciled branch.

Repair source commit: `05193509937d47e388ba8ddf3b33d23446248c8f`.

## Test results (cloud agent sandbox)

Bun: **1.3.9**. Current repair results are separate from the historical implementation results above. `node_modules/.bun` is a real directory within this worktree, and checked workspace package links resolve inside it. No configuration, dependency, timeout, assertion, or skip was weakened.

| Command | Exit | Current repair result |
|---|---:|---|
| `bun --version` | 0 | 1.3.9 |
| `timeout 120 bun install --frozen-lockfile` | 124 | UNKNOWN: resolver remained at “Resolving dependencies”; bounded install stopped at 120s, existing dependencies retained |
| `bun run lint` | 0 | 5/5 tasks; 0 errors, 9 existing web warnings |
| `bun run typecheck` | 0 | 5/5 tasks successful |
| `bun test tests/unit/kb-04.test.tsx --test-name-pattern "mounted screenshots cover\|hydrated gallery works"` (before repair) | 1 | 1 pass, 1 fail, 15 filtered; gallery matrix passed, mounted desktop h1 hydration timed out; 12 captures |
| `bun test tests/unit/kb-04.test.tsx` (after repair) | 0 | Real isolated child: 17 pass, 0 fail, 124 assertions; parent: 17 pass, 0 fail, 17 exit/output checks; child exit 0 propagated. All 16 after captures completed. |
| `bun run test` | — | UNKNOWN: pending root handoff; historical results above are not a rerun on this repair |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | — | UNKNOWN: pending root handoff |
| `CI=1 bunx playwright test --reporter=line` | — | UNKNOWN: pending root handoff; existing /journal smoke is credential-gated in feature-sweep.spec.ts, with no dedicated wiring spec |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | UNKNOWN: pending root handoff |

Logs and exit files: `/workspace/work/kb-finish/kb04-review/`. Each heavy browser/test command acquires `/workspace/work/kb-finish/heavy-check.lock`. Full-suite, scan, E2E, build and remote required checks still need completion by the root; this evidence does not mark the ticket done. Authenticated live route behavior and physical VoiceOver/TalkBack remain UNKNOWN. The worker made no remote change.

Frozen-install output (all available lines):

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
[exit 124 at 120 seconds]
```

Before-repair browser failure tail (last 20 lines):

```text
70 |   const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
71 |   page.on("pageerror", error => console.error("KB-04 fixture page error:", error.message));
72 |   await page.goto(`${origin}/?${params}`, { waitUntil: "commit", timeout: 60_000 });
73 |   try { await page.locator("h1").waitFor({ state: "attached", timeout: 15_000 }); }
74 |   catch (error) { throw new Error(`KB-04 fixture did not hydrate: ${(await page.content()).slice(0, 1000)}; ${String(error)}`); }
                                 ^
error: KB-04 fixture did not hydrate: <!DOCTYPE html><html lang="en" dir="ltr" data-text-size="m" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/entry.css"></head><body><div id="root"><svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display: none;"><symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></symbol><symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path></symbol><symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"></path></symbol><symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></symbol><symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4.5 4.5"></path></symbol><symbol id="i-si; TimeoutError: waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('h1')[22m

      at open (/workspace/work/kb-04/tests/unit/kb-04.test.tsx:74:29)
      at async <anonymous> (/workspace/work/kb-04/tests/unit/kb-04.test.tsx:242:26)
(fail) KB-04 mounted journal and gallery > mounted screenshots cover 390/1280, en/he and light/dark [41871.18ms]
(pass) KB-04 mounted journal and gallery > hydrated gallery works at phone and desktop widths in both locales and themes [90092.25ms]

 1 pass
 15 filtered out
 1 fail
 48 expect() calls
Ran 2 tests across 1 file. [139.62s]
```


After-repair isolated child result:

```text
17 pass
0 fail
124 expect() calls
Ran 17 tests across 1 file. [105.98s]
```

Parent result (the same child assertions are not counted twice):

```text
17 pass
0 fail
17 expect() calls
Ran 17 tests across 1 file. [106.24s]
```


## Overnight v3 committed-signal repair — 21 October 2026

The authorized AT-08 timing repair passes its focused checks and hosted CI. Local full-suite completion remains UNKNOWN after an environment interruption; its observed failures are preserved below. This pass makes no product or screenshot change.

Source: `ae4caffd638f40966868c989dab5af40d3790c74`, following a normal merge of integration `39b564ec329705587df5262ed5a061bbec9a1e8f`. No shared-harness dependency was added. The existing clean-child fixture is retained.

The mounted next-day heading, end message, and gallery heading now wait for `document.activeElement` to match the expected focus before each original assertion. The negative-focus check waits for `.kb04-more-wrap > button` to detach after `onReady` commits, then asserts that focus stayed on the original link. This stable button selector matters: the accessible name changes from Load more to Loading before the focus decision, so waiting for the old name to disappear would finish too early. The fixed 50 ms sleep is removed.

All 17 existing case names, all 47 assertion source lines, and all original timeout/deadline declarations are unchanged. The child still uses the original 45-second default, 120-second setup, and 300-second matrix limits; parent cases retain 300 seconds. The authorized pass contains one source candidate. Before this pass, the historical focused run was 17/0 but both verified timing review findings remained open. After the repair, all 17 child cases pass with 124 assertions; all 17 parent cases pass with 17 output/exit checks. Parent and child counts describe the same cases and are not added together.

### Test results (cloud agent sandbox)

All commands below ran on source `ae4caff`; no dependencies, configuration, product paths, assertions or deadlines changed. Required checks ran in order. An environment refresh ended the local full-suite process without a final aggregate or retained exit status; remaining scans, E2E and build resumed afterward. The unchanged full suite was not retried to obtain green.

| Command | Exit | Result |
|---|---:|---|
| `bun --version` | 0 | 1.3.9 |
| `bun install --frozen-lockfile` | 0 | PASS: 2,000 packages installed, 302.95 s; initial Resolving dependencies phase eventually completed |
| `bun test tests/unit/kb-04.test.tsx` | 0 | PASS: child 17/0, 124 assertions, 20.89 s; parent 17/0, 17 checks, 21.00 s |
| `bun run lint` | 0 | PASS: 5/5 tasks, 0 errors |
| `bun run typecheck` | 0 | PASS: 5/5 tasks |
| `bun run test` | UNKNOWN | INCOMPLETE: environment interruption; 2,860 observed pass lines, 20 fail lines, 3 todo lines, **not final totals**. All failures observed were unchanged KB64 browser-closed cases. KB04 child 17/0 in 19.89 s and all 17 parent cases passed in this run. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0 | PASS: all four checks |
| `CI=1 bunx playwright test --reporter=line` | 0 | PASS: 28 passed, 89 expected credential-gated skips, 58.5 s; serialized with the shared port lock, installed system Chromium |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | 0 | PASS: 1/1 task, uncached, 29.892 s |

Hosted [CI run 39669386749](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39669386749), on the same source, completed successfully. [Test job 119462894925](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39669386749/job/119462894925) reports **3,510 pass, 0 fail, 3 todo; 3,513 tests across 212 files, 192.90 s**. Hosted lint, typecheck, scans, notices, E2E and build also passed. Security and e2e-preview succeeded. These hosted receipts do not erase the interrupted local result. Evidence-only head checks and current review coverage remain required before integration.

The two timing threads were answered and resolved with source and focused evidence: `PRRT_kwDORjuLB86uutg6` and `PRRT_kwDORjuLB86uuthC`. At the worker's latest check, no inline review finding remained unresolved. Root coordinates current CodeRabbit coverage and integration gates. No merge or production action was performed.

Logs remain outside the repository under `/workspace/kb-run-logs/kb04-*.log`, with retained exit files for completed commands. No final local `kb04-test.exit` exists. Historical missing desktop baseline captures, authenticated live behavior, Hebrew native read and physical-device accessibility remain as previously disclosed; the latter two happen before production and do not block preview work.

First observed local full-suite failure, final 20 lines at that failure:

```text
(pass) KB64 Undo recovery > a synchronously thrown callback also returns a safe retry [1344.60ms]
(pass) KB64 Undo recovery > pointer retry calls once more and keeps the original deadline [1106.85ms]
(pass) KB64 Undo recovery > keyboard retry is reachable and has a visible focus ring [1427.80ms]
142 |       errors.push(error.message);
143 |       console.error("KB64 pageerror", error.message);
144 |     });
145 |     await page.clock.install({ time: 1_800_000_000_000 });
146 |     await page.goto(`${origin}/?${params}`, { waitUntil: "load" });
147 |     await page.locator("h1").waitFor();
                                   ^
error: waitFor: Target page, context or browser has been closed
Call log:
  - waiting for locator('h1') to be visible

 log: [ "  - waiting for locator('h1') to be visible" ],

      at open (/workspace/kb04/tests/unit/kb-64.test.tsx:147:30)
      at /workspace/kb04/tests/unit/kb-64.test.tsx:356:20
      at processTicksAndRejections (native:7:39)
(fail) KB64 Undo recovery > same-tick duplicate activation starts one callback [1035.46ms]
```

Interrupted local full-suite log, final 20 retained lines (no aggregate or authoritative exit):

```text
(pass) pickNextBlocks > respects the limit (default 3) [0.05ms]
(pass) pickNextBlocks > does not mutate its input [0.02ms]
(pass) pickNextBlocks > returns an empty list when nothing is left [0.01ms]
(pass) planProgress > counts done top tasks [0.02ms]
(pass) planProgress > handles no tasks

apps/web/components/notes/NotesScreen.test.tsx:
(pass) notes views inside the shell > the list, with notes: no <main> of its own [1.74ms]
(pass) notes views inside the shell > the list, with notes: the Hebrew render has no Latin label besides the user's text [0.67ms]
(pass) notes views inside the shell > the list, empty: no <main> of its own [0.18ms]
(pass) notes views inside the shell > the list, empty: the Hebrew render has no Latin label besides the user's text [0.19ms]
(pass) notes views inside the shell > the list, loading: no <main> of its own [0.14ms]
(pass) notes views inside the shell > the list, loading: the Hebrew render has no Latin label besides the user's text [0.13ms]
(pass) notes views inside the shell > a note, loading: no <main> of its own [0.41ms]
(pass) notes views inside the shell > a note, loading: the Hebrew render has no Latin label besides the user's text [0.12ms]
(pass) notes views inside the shell > a note, not found: no <main> of its own [0.22ms]
(pass) notes views inside the shell > a note, not found: the Hebrew render has no Latin label besides the user's text [0.11ms]
(pass) notes views inside the shell > English copy is unchanged [0.50ms]
(pass) a waiting save is sent when the page goes away > pagehide sends it once with the latest text; the timer and unmount don't send it again [739.39ms]
(pass) a waiting save is sent when the page goes away > the tab going hidden sends it once; going visible doesn't, and a later pagehide adds nothing [710.57ms]
```
