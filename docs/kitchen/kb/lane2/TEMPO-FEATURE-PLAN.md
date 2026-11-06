---
ticket: TEMPO-FEATURE-PLAN
batch: FEATURE
type: component
lane: astra
wave: 1
browser_test: true
scope:
  - apps/web/app/(tempo)/plan/PlanScreen.tsx
  - apps/web/components/calendar/CalendarViews.tsx
  - apps/web/components/tasks/TaskKanbanBoard.tsx
  - tests/unit/tempo-plan-views.test.tsx
  - docs/polish/evidence/feature-plan/
depends_on: []
overlap_test: false
expected_merge: small-conflict
hold: false
---

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE.
WHEN: Amit's 21 October feature steer. Independent of Lane 1 test/helper/editor writers. KA-09 #1102 and older study #1081 touch CalendarViews/PlanScreen; leave their PRs untouched, record reconciliation, never assign overlapping writers. Protected #1193/#1198 are untouched.
WHY: docs/design/v3/DESIGN.md, docs/HARD_RULES.md; requested Plan Kanban and day/week/month views showing tasks and calendar events together.
GOAL: /plan offers keyboard-accessible Board, Day, Week and Month views; date views show real due tasks with real calendar events in chronological day groups; Board reuses existing persisted task movement and Undo. Existing time-block creation/editing remains reachable.
SCOPE: Exactly three existing component files, one mounted regression test and evidence. PlanScreen.tsx is a component, not a Next route entry; page.tsx/layout.tsx remain untouched.
MUTATES: UI only; existing user-initiated task/event mutations. No backend, schema, routes, environment or dependency changes.
CONTRACT: Preserve existing typed calls already made by CalendarViews and TaskKanbanBoard: api.tasks.list({}), api.tasks.listDueInRange({startMs,endMs}), api.calendar_events.listInRange({startMs,endMs}), api.tasks.update({taskId,status}), existing event CRUD and Undo. Read validators and current callers for exact shapes before using them; do not invent an endpoint or cast around a mismatch. Add optional presentation props only; retain all existing callers and project-specific filtering.
STEPS:
1. Code map: PlanScreen, DayTimeline, TimeBlockDialog, CalendarViews range math/queries/EventRow, TaskKanbanBoard/BoardContent/tasksForProject/groupBoard and existing calendar/Kanban tests. Read validators in convex/tasks.ts and convex/calendar_events.ts without editing.
2. Add Plan view navigation using existing localized keys and tokens. Extend existing component props for embedding/all-task board while retaining standalone and project modes. One h1/main, correct RTL and visible keyboard focus.
3. Reuse real queries and mutation semantics. Group/sort tasks and events by local calendar day with deterministic tie order; preserve UTC/local-day/DST bounds. Distinguish task/event IDs and retain event editing, task navigation, loading/error/empty states and five-minute Undo. No simulated persistence or AI mutation.
4. Mounted regression covers all four views, mixed task/event days, boundary dates, project-mode isolation, task move/Undo, keyboard navigation, en/he and phone/desktop overflow. Preserve existing tests and deadlines. Capture fictional before/after evidence.
5. Run Bun1.3.9 and all mandatory AGENTS commands in order; report exact failures and UNKNOWN. Lead serializes browser/build jobs across four worktrees.
DONE: Focused tests pass; lint0errors, typecheck5/5, test0fail, four scans/notices, local Playwright and build results reported; current-head CI, addressed CodeRabbit review and all guards required before integration queue. Preview proof is separate from fixtures and merge.
EVIDENCE: docs/polish/evidence/feature-plan/ contains source commit, command results/failure tails, screenshots390/1280 en/he and mounted test counts. No real account data.
DO NOT: No Convex edits, hot config/package/lock/route entry edits, new packages, paid calls, keys/env, production/default push or deployment. Never weaken/remove/skip tests. No editing Lane 1 files or protected PRs. No duplicate Kanban implementation or orphan components. No raw colors/px outside tokens. Keep English/Hebrew, non-shaming copy,44px phone targets and reduced motion.
REPORT: One draft PR into integration with Closes issue reference and AGENTS report. Lead updates shared OVERNIGHT-REPORT.md.
