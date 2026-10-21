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


## 2026-10-21 — v3 AT-10 shared fixture continuation

PR open — the shared isolation harness in #1203 now builds this fixture in a fresh process. All 19 existing cases, assertions, per-case 60,000 ms deadlines and the 60,000 ms setup hook remain intact. The complete case block was compared byte-for-byte with source `931d987`; product files and screenshots are unchanged.

WORKHORSE source `441370c1f8d61cb89d4cc0da57b105780c2c2f97` includes shared `4d30965` and current integration by ordinary merges. The shared child emits build phases, preserves the authoritative child outcome, and bounds execution plus cleanup inside the existing setup deadline. Browser, loopback server and temporary directory clean up independently under the existing 5,000 ms teardown budget. Case-start and teardown phases stream as they happen. No fixed sleep, skipped case, weakened expectation, new dependency or configuration change was introduced.

Before: hosted Test on `931d987` reported 3426 pass / 1 fail / 3 todo, with scheduler EISDIR/Unseekable during fixture setup. After: the corrected local focused command `bun test tests/unit/kb-06.test.tsx` exits 0, 19 pass / 0 fail, 82 assertions, 21.88 s. These are separate environments; current-head hosted CI remains authoritative for hosted validation.

First adoption attempt `f911522` reported 0 pass / 1 setup failure. The shared resolver needed an explicit existing alias for `@/convex/lib/softDelete`; the fixture now points to the actual repository module according to the existing web tsconfig, preserving the real constant and production semantics. There is no backend edit or replacement stub. The complete failure tail is retained:

```text
tests/unit/kb-06.test.tsx:
[kitchen-fixture] KB-06 fixture files
[kitchen-fixture] start pid=70651
[kitchen-fixture] build start
error: ResolveMessage: Cannot find module '/workspace/kb06/apps/web/convex/lib/softDelete' from '/workspace/kb06/apps/web'
    at /workspace/kb06/apps/web/components/goals/shared.tsx:0

Bun v1.3.9 (Linux x64)
KITCHEN_CHILD_EXIT={"token": "<synthetic receipt identifier>", "code": 1}
[kitchen-fixture] supervisor reaped all descendants
[kitchen-fixture] stderr EOF pid=70651 exit-observed=false
[kitchen-fixture] stdout EOF pid=70651 exit-observed=false
[kitchen-fixture] exit pid=70651 code=0 signal=none
(fail) (unnamed) [194.95ms]
[kitchen-fixture] KB-06 cleanup start
[kitchen-fixture] KB-06 cleanup complete

 0 pass
 1 fail
Ran 1 test across 1 file. [957.00ms]
```

Bun is 1.3.9. `bun install --frozen-lockfile` remained at dependency resolution for 120 s and was bounded externally (exit 124), so installation is UNKNOWN. Local checks use the verified installed dependency tree copied from the preceding KB-03 worktree with workspace-relative links preserved. No manifest or lockfile changed.

```text
bun install v1.3.9 (cf6cdbbb)
Resolving dependencies
```

Mandatory checks on source `441370c` and shared `4d30965`, in required order:

| Command | Exit / result |
|---|---|
| `bun --version` | 0; 1.3.9 |
| `bun install --frozen-lockfile` | 124; UNKNOWN after external 120 s bound at dependency resolution |
| `bun run lint` | 0; PASS, 5/5 tasks |
| `bun run typecheck` | 0; PASS, 5/5 tasks |
| `bun run test` | 143; incomplete, externally cancelled after unchanged KB-66 timed out at its original 240,000 ms deadline; observed 1556 pass / 1 fail / 3 todo, not final suite totals |
| `bun run scan:forbidden-tech && bun run scan:ram-only-audit && bun run scan:design-tokens && bun run check:notices` | 0; PASS, all four |
| `CI=1 bunx playwright test --reporter=line` | 0; PASS, 28 pass / 89 credential-gated skips, 1.6 min; serialized with the shared browser lock |
| `NEXT_PUBLIC_CONVEX_URL=https://example.convex.cloud bun run build` | 0; PASS, 1/1 tasks |

All 19 KB-06 cases passed in the full root process and its teardown completed. The separate unchanged KB-66 wrapper buffered a child that was already defunct; it timed out on the first original 240,000 ms deadline and subsequent cases awaited the same cached pending promise. The lead authorized external cancellation rather than waiting through repeated identical deadlines. This is an incomplete run, not a passing broad gate. One old KB-66 defunct child was adopted by PID 1 after cancellation and cannot be reaped by this worker; it was not a running server/browser. The new KB-06 shared builder separately reported its descendant reap and successful teardown.

Last 20 lines of the incomplete full-unit command:

```text
(pass) KB-08 isolated: empty projects offer one deliberate start action [5985.31ms]
(pass) KB-08 isolated: one project renders a named summary with distinct safe destinations [0.01ms]
(pass) KB-08 isolated: count labels distinguish 0/1, 1/1 and multiple tasks
(pass) KB-08 isolated: long user names retain auto direction and a wrapping class
(pass) KB-08 isolated: actions are peers, never nested interactive controls
(pass) KB-08 isolated: disabled navigation has no href or keyboard target
(pass) KB-08 isolated: Hebrew count has RTL copy and isolated LTR digits
(pass) KB-08 isolated: offline state stays a notice and does not create a project
(pass) KB-08 isolated: filtered state only exposes the supplied reset callback
(pass) KB-08 isolated: error and loading states render separately
(pass) KB-08 isolated: gallery renders the real exported row and owns one h1 and one main
(pass) KB-08 isolated: English and Hebrew dictionaries have exact key parity
(pass) KB-08 isolated: hydrated gallery and mounted projects: keyboard, callbacks, RTL and full-width rows

tests/unit/kb-66.test.tsx:
killed 1 dangling process
(fail) load-more view names the currently visible count and preserves LTR numerals [240031.33ms]
  ^ this test timed out after 240000ms.
error: script "test" was terminated by signal SIGTERM (Polite quit request)
Terminated
```

The exact E2E command uses the installed system Chromium through the local Playwright cache fallback established by the lead, as allowed by AGENTS.md. No repository or browser configuration was edited.

 Shared #1203, current-head CI, repository guards and CodeRabbit clearance remain merge prerequisites. Hebrew native reading and real-device checks are required before production and do not block preview.
