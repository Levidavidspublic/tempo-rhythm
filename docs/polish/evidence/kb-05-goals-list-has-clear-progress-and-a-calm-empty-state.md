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

## Checks

Bun 1.3.9. Final command outcomes and failure tails are recorded in the draft PR. Local `bun install --frozen-lockfile` remained in dependency resolution and timed out after 150 seconds in this sandbox; the same locked dependency tree had been copied from the prepared integration checkout, and GitHub CI installs and tests passed on the final source commit. The initial local full test ran concurrently with other agents' CPU-heavy checks and had ten unrelated timing/performance failures plus one missing local mobile workspace link. The local links were repaired; a queued repeat was canceled before it acquired the shared validation lock because GitHub's full test job had already passed. The final focused hydrated gallery rerun passed (1 test, 98 assertions), as did all four local scan/notices commands. No test or config baseline was changed.
