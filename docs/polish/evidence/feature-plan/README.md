# Plan views — controlled fixture evidence

Ticket: #1207 (`TEMPO-FEATURE-PLAN`). Base: `39b564ec329705587df5262ed5a061bbec9a1e8f` on integration. Captured 21 October 2026 with Bun 1.3.9 and local Chromium; no account, hosted backend, model call or preview URL was used.

The mounted proof renders the real PlanScreen, CalendarViews, EventRow, TaskKanbanBoard, LocaleProvider and board primitives. Only Convex/Next boundaries and the existing DayTimeline/TimeBlockDialog are controlled fixtures. The latter two stubs verify date and open callbacks; they do not prove the real timeline or dialog's browser behavior. Existing route wiring tests remain unchanged and require the real timeline to stay visible on initial `/plan`.

The before captures bundle the exact PlanScreen from the base commit under the same boundaries. The after captures show this ticket's components. English/Hebrew, 390/1280 widths, reduced motion and fictional task/event data are covered. Shared source CSS is loaded directly without the complete Next/Tailwind build or remotely loaded fonts; these are component comparisons, not preview or final font screenshots. Browser assertions check one main, one h1, RTL, document overflow and phone view-button targets.

`before-day-{en,he}-{390,1280}.png` shows the previous Plan component. `after-day-*` shows chronological mixed tasks/events; `after-board-*` shows the reused all-task Kanban. The horizontal board has its existing internal scroll; the page does not overflow.

The focused suite also covers half-open local date ranges/DST, same-ID task/event separation, loading/signed-out/empty states, date selection, midnight rollover with Today following the clock, an explicitly selected day staying selected, board persistence/Undo, unassigned task creation, project-board isolation, event editing and failed saves retaining drafts.

## Test results (cloud agent sandbox)

- Bun: 1.3.9.
- Dependency installation was prepared by the lead in this worktree; the lead records its exact install result.
- `bun run lint`: pass, 5/5 jobs, zero errors and nine existing warnings on the initial implementation candidate. Later source changes require the lead's final-head rerun.
- `bun run typecheck`: pass, 5/5 jobs on the initial implementation candidate. An earlier invocation without Bun's directory in PATH could not locate Turbo's package-manager binary; rerunning with the correct PATH passed. Later source changes require the lead's final-head rerun.
- Focused run 1: 12 passed, one failed. The new event-edit test matched two textboxes; it was corrected to the localized Title label.
- Focused run 2: 12 passed, one failed. The new midnight test allowed its clock to advance during page loading; it now pauses before navigation. The product had correctly advanced to the next day. Assertions and time limits were retained.
- `bun test tests/unit/tempo-plan-views.test.tsx` (third focused run): pass, exit 0; 13 child tests, zero failures, 185 assertions; the outer isolation test also passed (one test). Elapsed 102.31 seconds including optional baseline and after captures. See `focused-3.log` for the authoritative output. The first two failure logs are retained as `focused-1.log` and `focused-2.log`.
- `git diff --check`: pass.
- UNKNOWN: final-head mandatory full tests, scans/notices, local route Playwright and build. The lead serializes these across worktrees and records their actual results; fixture success does not substitute for them.
- UNKNOWN: deployed preview behavior, current-head CI, guards and CodeRabbit review until independently verified by the lead. This ticket performs no deployment.

## Reproduction

```sh
TEMPO_PLAN_EVIDENCE_DIR="$PWD/docs/polish/evidence/feature-plan" bun test tests/unit/tempo-plan-views.test.tsx
```

Without that optional evidence directory, the exact same assertions run without screenshots or the baseline bundle. The suite owns an isolated Bun child and closes its browser/server and temporary bundle files.

## Reconciliation

KA-09 (#1102) and the older study work (#1081) may later overlap CalendarViews/PlanScreen. Their branches were not changed. Their eventual reconciliation must retain controlled/embedded defaults, the unified agenda, Today rollover and all existing time-block behavior. Protected #1193 and #1198 were not touched. No schema, route entry, environment, dependency, global CSS or i18n file changed; every product string and token already existed.
