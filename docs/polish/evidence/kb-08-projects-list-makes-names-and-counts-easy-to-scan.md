# KB-08 projects list evidence

The existing `/projects` screen groups tasks by `projectId`. This change leaves its query, filter, creation callback, and route destinations intact. Each project now mounts a `ProjectSummaryRow` with a wrapping name, a readable completion count, and separate labelled project and board links. `ProjectListState` supplies the mounted loading, empty, filtered, offline, and error views. A standalone `Kb08Gallery` renders the same exports with fictional Maya, Dana, and Yoni data.

The [contact sheet](./kb-08-projects-list-makes-names-and-counts-easy-to-scan.jpg) was recaptured on 21 October at 390 and 1280 px in English and Hebrew, light and dark. Both sides hydrate the actual `ProjectsScreen` with its real locale provider, icon sprite, grouping, and list wrapper. The before module comes from integration commit `52bf2803`; the after module is the repair source committed with this evidence, on parent `ca120ce`. Only auth/query values and router writes are controlled, using fictional Maya, Dana, and Yoni tasks. This comparison does not claim live account or backend verification.

## Browser findings

- Hydrated gallery and actual mounted screen rendered one `h1` and one `main` at both widths.
- The mounted regression first failed at 1280 px: the production `tp-cards` wrapper retained multiple columns while the gallery used one. The repair sets a single explicit column and shares the list classes between screen and gallery. The regression checks all three mounted rows fill the list width and stack vertically in both locales at 390 and 1280 px.
- Empty and error gallery actions return localized feedback in English and Hebrew; browser assertions exercise both callbacks.
- Project and board links are separate keyboard stops. Enter activates the project callback; clicking the board link activates the board callback. Focus remains visible, and Shift+Tab returns to the prior link.
- Empty, loading, error, disabled, overflow, and offline controls changed the mounted views. Disabled rows contain no navigable anchor.
- Hebrew sets `dir=rtl` on the gallery; project names retain `dir=auto`; numeric fragments use LTR isolates. The count sentence follows the selected language direction.
- At 390 px, controls and links were at least 44 px in both dimensions. The document did not scroll horizontally at 390 or 1280 px in either locale or theme. Reduced motion was enabled in the browser run.

## Verification

The complete command table and failure tails are in the draft PR body. The focused `tests/unit/kb-08.test.tsx` includes 13 tests: empty projects, one project, count labels including 0/1, long name, no nested controls, disabled navigation, Hebrew count, offline state, filtered state, error/loading state, gallery landmark/render, en/he key parity, and a hydrated browser test for keyboard, responsive behavior, localized callbacks, and actual mounted list geometry.

Device screen-reader results remain **UNKNOWN** until tested on a device. This sandbox fixture does not verify live account data or backend behavior.

## Review follow-up, 21 October

CodeRabbit's gallery feedback finding is fixed: empty and error callbacks use the selected language's gallery label, and the hydrated test checks both languages. Its standard-test browser provisioning concern is covered by the existing executable lookup (Playwright cache, `/usr/bin/chromium`, then `/usr/bin/google-chrome`) and the hosted Ubuntu image's installed Chrome. The [exact-parent Test job](https://github.com/Levidavidspublic/tempo-rhythm/actions/runs/39315747770/job/118276641678) passed with the browser test enabled. Detailed hosted logs remain **UNKNOWN** because downloading them returned HTTP 403. No browser test was skipped or weakened, and no workflow was changed.

Repair validation uses Bun `1.3.9`, local workspace package links, and shared third-party dependencies. Heavy browser/unit/E2E/build work uses a shared lock. Standard local Playwright uses the preinstalled Chromium through `PLAYWRIGHT_BROWSERS_PATH=/workspace/work/kb/browsers`; it never targets a preview URL.

## Test results (cloud agent sandbox), repair pass

Bun: `1.3.9`. The following results cover the repair source committed with this evidence; earlier broad results in the PR predate the repair.

| Command | Exit | Result |
| --- | --- | --- |
| `bun install --frozen-lockfile` (60-second bounded retry) | 124 | UNKNOWN: resolver stalled; byte-identical lock and all eight manifests verified before reusing dependencies |
| `bun run lint` | 0 | 5/5 tasks; existing warnings |
| `bun run typecheck` | 0 | 5/5 tasks |
| `bun test tests/unit/kb-08.test.tsx` | 0 | 13 pass, 0 fail, including actual mounted geometry and localized gallery callbacks |
| `bun run test` | 1 | 3313 pass, 3 todo, 1 fail across 202 files; unchanged account-lifecycle test exceeded its existing 5000 ms timeout |
| four scan/notices commands | 0 | 4/4 OK; 66 documented dependencies |
| `CI=1 bunx playwright test --reporter=line` | — | UNKNOWN for this repair pass; coordinator continues the serialized gates |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | — | UNKNOWN for this repair pass; coordinator continues the serialized gates |

The mounted-layout regression failed against the old CSS before the repair, then passed after the explicit single-column template. The full unit run retained the enabled KB-08 browser test and its 13 passing cases. Its sole failure was outside the ticket's changed files; no timeout or test was weakened. Final 20 lines:

```text
(pass) json-render 0.21.0 behaviour that makes validateBlockSpec necessary > it does reject an element type outside the catalog [0.60ms]
(pass) module boundary > imports only the pinned json-render entry points, the shared codec, zod and the catalog [0.45ms]
(pass) module boundary > does not load React, a renderer, state adapters, storage or the network [0.76ms]

3 tests todo:
(todo) Agent component under Bun: unresolved coverage > scheduler-driven deletion (deleteAllForThreadIdAsync) under Bun fake timers
(todo) Agent component under Bun: unresolved coverage > streaming deltas, abort and timeout cleanup (streams.*)
(todo) Agent component under Bun: unresolved coverage > vector and text search over saved messages


1 tests failed:
(fail) account lifecycle coverage is derived from the schema > every owned fixture is deleted, isolated from a second user, and idempotent [8494.81ms]
  ^ this test timed out after 5000ms.

 3313 pass
 3 todo
 1 fail
 81031 expect() calls
Ran 3317 tests across 202 files. [161.37s]
error: script "test" exited with code 1
```
