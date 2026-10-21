# KB-06 goal detail evidence

Source commits: product `8897308`, corrected test and contact sheet `ae04bf1` (`t/1143-kb-06`). The [contact sheet](kb-06-goal-details-show-milestones-without-crowding.jpg) compares the checked-in `GoalDetailScreen` before and after this change at 390 and 1280 px, English and Hebrew, light and dark. Every screenshot mounts the actual component in an isolated hydrated browser fixture with fictional Maya, Dana and Yoni data. The pure goal status mapping, `StatusBadge`, `TpIcon` and `TpIconSprite` are production modules; Convex reads and writes, locale context, and the Next link are fixture stubs. The standalone CSS fixture uses local font fallback. No real account or backend is exercised. Labels appear only on this evidence sheet.

The original screen showed title, status and the editable “why”, then an empty state for steps. The changed screen keeps those controls and adds the stored progress value with a labelled bar and a plain milestone-empty message. At 390 px the status control fills the available width and tested title/select targets reach 44 px. Long goal text and large text mode have no horizontal overflow. Hebrew follows RTL page direction while user text keeps `dir="auto"`. Light and dark views share the v3 tokens. Both states contain one `main` and one `h1` in the isolated mounted fixture.

The interactive `Kb06Gallery` renders the same production state and progress views with fictional controlled data. In the browser fixture, its Goal, Empty, Loading, Error, Disabled and Long text controls all respond to clicks; English/Hebrew switches direction. Keyboard focus returns to the retry button and Enter invokes its callback once. Retry is disabled in the Disabled state. Focus outline is visible, all gallery buttons measure at least 44 px at 390 px, and the page fits the viewport at both tested widths. Reduced motion was emulated; dark gallery views were captured at both widths and languages. These individual gallery screenshots are temporary fixture output under `/workspace/work/kb-06-capture/after` and are not a product route.

New regression cases in `tests/unit/kb-06.test.tsx`:

1. missing goal shows unavailable and never invents a goal
2. loading has a distinct live status
3. offline explains that a save may need another try
4. long goal text wraps without horizontal overflow
5. keyboard title save keeps the existing update payload
6. why blur keeps the existing description payload
7. status selection maps the real `done` display state to the existing `completed` status payload
8. Hebrew layout is RTL and user text keeps auto direction
9. large text remains readable at phone width
10. real progress is labelled and empty milestones are honest
11. gallery states, language, retry, disabled action and focus work
12. English and Hebrew keys match
13. desktop English and Hebrew remain within viewport
14. dark mode and reduced motion preserve readable gallery controls

## Test results (cloud agent sandbox)

| Check | Exit and result |
|---|---|
| `bun --version` | exit 0; `1.3.9` |
| `bun install --frozen-lockfile` | exit 0 |
| `bun run lint` | exit 0; 5/5 tasks, 0 errors, 9 existing warnings |
| `bun run typecheck` | exit 0; 5/5 tasks |
| `bun test tests/unit/kb-06.test.tsx` | exit 0; corrected mounted fixture 14 pass, 0 fail |
| `bun run test` | exit 1; 3309 pass, 6 fail, 3 todo. Six unrelated timeout/performance cases; their individual causes remain unconfirmed. |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | exit 0; all four OK |
| `CI=1 bunx playwright test --reporter=line` | exit 1; 19 pass, 9 fail, 89 credential-gated skips. The nine failures are in out-of-scope calendar, sign-out, task, coach, habits, billing and templates routes. Shared CPU contention is possible, not established for each failure. |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | exit 0; Turbo 1/1 successful. Turbo lingered after task output and was terminated; the shell wrapper still exited 0. |
| GitHub PR checks on `ae04bf1` | Test, E2E, Build, Lint, Typecheck, scanners and guards pass remotely. This does not erase the local failures above. |

Last 20 lines of the failed local full test:

```text


6 tests failed:
(fail) pageCleanup.runBatch > 12. never hard-deletes inside a window, never leaves a due fragment (table-driven mix) [5950.00ms]
  ^ this test timed out after 5000ms.
(fail) history normalization (synthetic fixtures only) > duplicate identities compare large and deep malformed fields structurally [10650.87ms]
  ^ this test timed out after 5000ms.
(fail) Tempo block codec through the shared module > raw HTML blocks keep fence-looking lines as prose > scans a maximum-size body of unterminated markers without blowing up [6990.50ms]
  ^ this test timed out after 5000ms.
(fail) Tempo block codec through the @tempo/utils public index > raw HTML blocks keep fence-looking lines as prose > scans a maximum-size body of unterminated markers without blowing up [6586.30ms]
  ^ this test timed out after 5000ms.
(fail) pathological bodies stay linear > tagsOpenOnEveryLine [3115.50ms]
(fail) pathological bodies stay linear > closingTagsOpenOnEveryLine [5480.24ms]

 3309 pass
 3 todo
 6 fail
 81056 expect() calls
Ran 3318 tests across 202 files. [456.48s]
error: script "test" exited with code 1
```

Last 20 lines of the failed local E2E run:

```text
    ────────────────────────────────────────────────────────────────────────────────────────────────


[116/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/run/[id] mounts its component
[WebServer] (node:43139) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
[WebServer] (Use `node --trace-warnings ...` to show where the warning was created)

[117/117] [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /onboarding mounts its component
  9 failed
    [chromium] › tests/e2e/calendar-views.spec.ts:7:5 › event created in Day view appears in Week and Month views for that date
    [chromium] › tests/e2e/fix/calendar-add.spec.ts:26:7 › calendar add event › local mode: form renders and adds without a sign-in message
    [chromium] › tests/e2e/screens/sign-out.spec.ts:13:7 › sign out › sign-out button is visible ───
    [chromium] › tests/e2e/task-views-core.spec.ts:14:7 › core task views › today, inbox, project, priority, and energy views share one persisted task record
    [chromium] › tests/e2e/wiring/coach.spec.ts:8:7 › coach wiring › /coach renders dial/panic and proposal markers next to Coach chat
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:8:7 › habits, brain dump and search wiring › /habits mounts the habits screen
    [chromium] › tests/e2e/wiring/habits-braindump-search.spec.ts:14:7 › habits, brain dump and search wiring › /habits/[id] mounts HabitDetail
    [chromium] › tests/e2e/wiring/settings-account.spec.ts:16:9 › settings + account wiring › /billing mounts its component
    [chromium] › tests/e2e/wiring/templates-onboarding.spec.ts:26:9 › templates and onboarding wiring › /templates/editor/[id] mounts its component
  89 skipped
  19 passed (8.3m)
```

Real milestone rows and movement controls remain blocked: the existing goals record has no milestone field or goal-to-task/project relation. This presentation-only ticket cannot add that contract. The Hebrew strings are machine-drafted for Amit’s native review. Device screen-reader results and signed-in backend behavior remain UNKNOWN.

## AWAY — repair draft, validation pending

Exported GoalProgressSummary, retained fractional stored progress with finite/bounds handling, and exposed loading status semantics. Added fractional/nonfinite/partial-completion/null-description regressions. Final focused: 19 pass, 0 fail, 82 assertions. Final lint/typecheck and four scans pass; frozen install UNKNOWN after resolver timeout. Prior setup failures are retained in local logs. Root repaired ignored dependency links/cache without tracked configuration changes. Existing screenshots still represent the unchanged integer-progress appearance.

The lead owns the remaining full unit suite, scan confirmation, local E2E and build commands. They are queued separately under the shared resource lock; no passing result is claimed for an unfinished command. This repair may be pushed as a draft for hosted CI, but is not yet eligible for integration. No assertions, check configuration, timeout or skip conditions were weakened. The lead will append actual outcomes and failure tails before the merge gate.
