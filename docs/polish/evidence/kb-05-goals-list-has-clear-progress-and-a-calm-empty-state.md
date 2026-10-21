# KB-05 goals list evidence

Source baseline: `origin/integration` at `52bf2803e9105b25c2538aedd81a754a9fbfdedb`. The original mounted `GoalsScreen.tsx` was saved before editing. The controlled before/after capture loads that exact original module and the changed module with the same fictional goal rows; query, locale, icon and navigation adapters are stubbed in the temporary loopback harness. The images show sandbox rendering, not an authenticated account or a live deployment. The new progress element was genuinely absent from the baseline card; the prior empty branch used the shared `StateEmpty` view.

The contact sheet `kb-05-goals-list-has-clear-progress-and-a-calm-empty-state.jpg` labels locale, width, state, theme and before/after. Captures use 390 and 1280 px, English and Hebrew, fictional reading/rest goals, light list and empty states, and dark empty states. Captures are generated from the saved baseline and this branch with the same data. Its final four panels show hydrated gallery captures for English 390 default/light, Hebrew 390 empty/dark, English 1280 empty/light, and Hebrew 1280 default/light. The implementation and test source commit is `268d130`.

## Hydrated gallery findings

`Kb05Gallery` imports the actual `GoalProgressLabel`, `GoalEmptyState`, and production `GoalNameForm`; its callbacks are local and make no backend calls. English and Hebrew were exercised at 390 and 1280 px with reduced motion. The gallery has one `main` and one `h1`; Hebrew uses `dir=rtl`, user input uses `dir=auto`, and the viewport does not overflow horizontally. Buttons visible in those scenarios measure at least 44 px high. The name field receives focus when opened. Submitting it empty sets `aria-invalid`, associates the hint through `aria-describedby`, and keeps focus in the field. Escape closes the form and returns focus to its trigger. State buttons, retry, overflow and disabled presentations are interactive in the gallery; the gallery's saved state uses fictional data. Device screen-reader results are UNKNOWN until tested on a device.

## New regression cases

- Empty list has a calm next step.
- Zero progress has words and a zero-valued meter.
- Partial progress is numbered and named.
- Complete goal has an explicit completion word.
- Completed status does not invent full progress.
- Resting goal has a word even at partial progress.
- Out-of-range values are bounded for a truthful meter.
- Disabled empty action remains visible but unavailable.
- Hebrew long text has direction and a bounded card layout.
- Production name form has a labelled field.
- English and Hebrew keys stay paired.
- Hydrated gallery exercises the real name form, focus return, RTL, and 44 px actions.
- Production GoalsScreen focuses the newly created goal after the query includes it.

## Checks

Bun 1.3.9. Final command outcomes and failure tails are recorded in the draft PR. Local `bun install --frozen-lockfile` remained in dependency resolution and timed out after 150 seconds in this sandbox; the same locked dependency tree had been copied from the prepared integration checkout, and GitHub CI installs and tests passed on the final source commit. The initial local full test ran concurrently with other agents' CPU-heavy checks and had ten unrelated timing/performance failures plus one missing local mobile workspace link. The missing ignored workspace dependency links were repaired without changing tracked source, config or dependency versions. The completed full-suite retry passed 3313 tests with 3 existing todos, 0 failures and 81192 assertions across 202 files in 81.20 seconds; the earlier failure is retained in the PR for provenance. The final focused hydrated gallery rerun passed (1 test, 98 assertions), as did all four local scan/notices commands. No test or config baseline was changed.


## Review follow-up: production create focus

The review has one body nitpick and no inline threads. Its successful-create example corresponds to the existing `GoalsScreen.test.tsx`, which is outside this ticket's scope. The scoped KB-05 test now adds a hydrated `GoalsScreen` regression instead. Only the Convex React boundary is stubbed; the real locale provider, shared controls, name form, mutation handler, goal card and focus effect run in Chromium. English and Hebrew each submit a padded goal name, verify the exact trimmed create argument and pending submit state, insert the newly created goal into the query result before resolving the deferred mutation, and assert the actual new goal link receives focus. Starting with the completed filter also verifies creation reveals the active new goal and clears the filter. The gallery remains a separate behavioral test. No production behavior or check configuration changed.

Review-follow-up test source: `fa1dd4c424df085b2d4a40413614f113c64bb1fc`. Bun 1.3.9 and installed system Chromium were used. The new fixture uses a unique directory under ignored `work/`, removed in `finally`; React, the React DOM client and both JSX runtimes resolve from the web workspace's installed packages.

| Command | Exit | Pass / fail / filtered | Assertions | Result |
| --- | --- | --- | --- | --- |
| `bun test tests/unit/kb-05.test.tsx` (initial fixture at `9438a5d`) | 1 | 12 / 1 / 0 | 174 | Existing cases passed; new fixture could not resolve JSX runtime before product behavior ran. |
| `bun test tests/unit/kb-05.test.tsx -t 'production GoalsScreen'` (repaired fixture) | 0 | 1 / 0 / 12 | 20 | Production create focus passed in English and Hebrew; 17.61 seconds total. |

The filtered diagnostic selects only the new case; all existing tests remain enabled under the standard command. The full required gate sequence for this source is still pending root-owned validation. Earlier results above describe the preceding source revision only. No timeout, configuration, assertion or test-skip change was used.

Initial fixture failure tail (preserved in the root validation log):

```text
error: Could not resolve: "react/jsx-dev-runtime". Maybe you need to "bun install"?
    at /tmp/tempo-kb05-create-7t2EJG/entry.tsx
(fail) production GoalsScreen focuses the newly created goal after the query includes it [42.91ms]

 12 pass
 1 fail
 174 expect() calls
Ran 13 tests across 1 file. [32.92s]
```


## Overnight shared fixture pass — 2026-10-21

PR open — both scoped browser cases pass with isolated builds; current hosted checks and CodeRabbit review remain required. Role: WORKHORSE. Prerequisite: shared harness #1203 (source `4d30965`). The previous hosted Test on `2e87b65` had 3411 passes, 3 todos and 2 failures from Bun EISDIR/Unseekable module resolution.

Both browser entrypoints now build through `isolatedBrowserBuild` in fresh supervised Bun processes. The adapter preserves the existing backend-boundary aliases and requires authoritative child success plus emitted JavaScript. Build time comes from the original case deadline, with bounded cleanup reserved inside it. Browser/server/directory cleanup uses the shared aggregate cleanup helper, and gallery focus waits on the committed active element before the original assertion. Phase evidence streams during build, server start, browser launch and cleanup. Product files and the existing contact sheet are unchanged.

All 13 case names and all 58 original `expect` statements remain byte-for-byte identical. The original 240000 ms gallery timeout, 30000 ms production timeout and 30000 ms cleanup hook remain. Focused validation before the shared review correction: `bun test tests/unit/kb-05.test.tsx` exited 0 with 13 passes, 0 failures and 194 assertions in 20.34 seconds. The subsequent shared correction affects receipt drain and failed spawn handling; full validation below uses that correction.

Implementation source: `87aa138`. Bun 1.3.9; frozen installation passed with 2000 packages in 4.67 seconds. The complete mandatory sequence ran once in the prescribed order. The E2E command held the shared localhost lock and used installed Chromium 151 through a runtime cache link prepared by the lead; no tracked configuration changed.

| Check | Result |
| --- | --- |
| `bun run lint` | PASS, exit 0, 5/5 tasks |
| `bun run typecheck` | PASS, exit 0, 5/5 tasks |
| `bun run test` | FAIL, exit 1: 3479 passed, 22 failed, 3 todos, 81578 assertions; 3504 tests across 213 files in 684.70 seconds |
| Four scan/notices commands | PASS, exit 0 |
| `CI=1 bunx playwright test --reporter=line` | PASS, exit 0: 28 passed, 89 expected skips, 1.4 minutes |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | PASS, exit 0: 1/1 task, fresh build, 44.168 seconds |

The full run passed all 13 KB-05 cases and all 15 shared-harness cases. Its 22 failures were 21 unchanged KB-64 browser-close cases and one unchanged KB-61 hook timeout at 480000.52 ms. During that wait, the KB-61 child was a zombie still parented to the Bun test runner; the original hook deadline was allowed to expire and the suite then completed. This is observed lifecycle evidence, not an attribution to product code. The prior planning baseline also had KB-64 browser-close failures (20). After the suite, only the specifically inventoried browser group left by KB-64 was stopped. KB-05's own browser/server/directory cleanup completed in both cases.

Hosted EISDIR disappearance on the new branch head remains UNKNOWN until current CI finishes. The focused and complete local runs contain zero KB-05 failures after the two hosted fixture failures before adoption. No test was skipped, removed, weakened or given a larger timeout. Hebrew native review and real-device checks remain pre-production needs and do not block preview work.

Full test failure tail:

```text
(fail) KB64 Undo recovery > changed deadline fences an old rejection without leaking error or busy state [16.06ms]
(fail) KB64 Undo recovery > changed deadline fences an old fulfilled request after the old deadline [16.05ms]
(fail) KB64 Undo recovery > new inline callback identities do not reset an active request [16.04ms]
(fail) KB64 Undo recovery > Hebrew recovery has RTL direction and localized action copy [16.01ms]
(fail) KB64 Undo recovery > an immediate fulfillment crossing the deadline still schedules post-commit expiry [16.03ms]
(fail) KB64 Undo recovery > late successful real detail restoration keeps the parent navigation authoritative [16.06ms]
(fail) KB64 Undo recovery > real NotesScreen list callback contains rejection and retries the same note [16.03ms]
(fail) KB64 Undo recovery > real NotesScreen page callback contains rejection and leaves false fulfillment neutral [16.10ms]
(fail) KB64 Undo recovery > gallery reuses the notice and supports reject retry expiration and language [15.99ms]
(fail) KB64 Undo recovery > real caller and gallery fit both widths languages and themes with 44px controls [16.02ms]
(fail) KB64 Undo recovery > large text wraps and reduced motion has no toast animation [16.03ms]
(fail) (unnamed) [480000.52ms]
  ^ a beforeEach/afterEach hook timed out for this test.

 3479 pass
 3 todo
 22 fail
 81578 expect() calls
Ran 3504 tests across 213 files. [684.70s]
error: script "test" exited with code 1
```
