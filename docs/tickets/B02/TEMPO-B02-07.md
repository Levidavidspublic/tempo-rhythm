---
ticket: TEMPO-B02-07
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/tasks-priority/
  - apps/web/app/(tempo)/tasks/priority/page.tsx
depends_on: [TEMPO-B02-01]
contract:
  - api.tasks.list(args: {status?, priority?, search?}) -> Task[]   # rows include flexibility?
  - api.tasks.update(args: {taskId, priority?, flexibility?, timeEstimate?, ...}) -> Id<"tasks">
  - api.tasks.remove(args: {taskId}) -> {success, undoUntilMs}
  - api.tasks.restore(args: {taskId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user deciding what is fixed and what can move, on /tasks/priority
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §5 "Priority calibration: inelastic vs elastic items — Elastic items reflow around fixed ones."; §4.1 A4 "Every control on every signed-in screen works"; §5 "Soft delete": "Undo for 5 minutes inside the app"; §6 "Never shame".
GOAL: /tasks/priority lets the user mark each open task Fixed (inelastic) or Flexible (elastic) and set its priority, and shows fixed tasks first with flexible tasks listed around them; changes persist after reload.
SCOPE: apps/web/components/tasks-priority/ plus the single file apps/web/app/(tempo)/tasks/priority/page.tsx. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/tasks-priority/PriorityBoard.tsx (new); apps/web/components/tasks-priority/calibrate.ts (new, pure: `splitByFlexibility(tasks)` and `reflowElastic(fixed, elastic)` ordering: fixed tasks keep their `dueAt` order; elastic tasks are ordered by priority then `dueAt` and listed after/around them; absent flexibility = elastic); apps/web/components/tasks-priority/calibrate.test.ts (new); apps/web/app/(tempo)/tasks/priority/page.tsx (render PriorityBoard).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read how `view="priority"` renders in apps/web/components/tasks/TaskViewsScreen.tsx for style; do not edit it.
2. calibrate.ts: implement the two pure functions above with no I/O.
3. PriorityBoard.tsx: `useQuery(api.tasks.list, {})` filtered to status todo/in_progress; two sections "Fixed (can't move)" and "Flexible (can move)". Each card has a Fixed/Flexible toggle (`api.tasks.update` `flexibility`), a priority select (`priority`), and Delete with "Task removed. Undo" until `undoUntilMs` (`api.tasks.remove` / `api.tasks.restore`).
4. Show a one-line explanation: "Fixed items stay where they are. Flexible items move around them."
5. Wire page.tsx to PriorityBoard.
6. Add one test for calibrate.ts (fixed order kept, elastic reordered by priority, missing flexibility treated as elastic).
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/tasks-priority` passes; in the browser toggling Fixed/Flexible and reloading /tasks/priority keeps the change; delete + Undo restores the task; lint and typecheck green.
EVIDENCE: test output; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/tasks/ or the /today and /plan screens (other batches)
- don't auto-reschedule tasks on the server or call a model; reflow is display ordering only
REPORT: what changed, what was verified, anything missing from the contract.
