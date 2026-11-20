---
ticket: TEMPO-B02-08
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/tasks-energy/
  - apps/web/app/(tempo)/tasks/energy/page.tsx
depends_on: [TEMPO-B02-01]
contract:
  - api.tasks.list(args: {status?, energy?, search?}) -> Task[]
  - api.tasks.update(args: {taskId, energy?, ...}) -> Id<"tasks">
  - api.tasks.toggleCompletion(args: see convex/tasks.ts) -> see file
  - api.tasks.remove(args: {taskId}) -> {success, undoUntilMs}
  - api.tasks.restore(args: {taskId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user choosing tasks that match the energy they have right now, on /tasks/energy
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §4.1 A4 "Every control on every signed-in screen works ... with a reload check"; §5 "Unified surface: calendar + tasks + notes"; §3 "Working live: `/tasks` (all four views)"; §5 "Soft delete": "Undo for 5 minutes inside the app"; §6 "Never shame".
GOAL: /tasks/energy groups open tasks into Low, Medium and High energy columns, lets the user change a task's energy, complete it or delete it with a 5-minute undo, and keeps all of it after reload.
SCOPE: apps/web/components/tasks-energy/ plus the single file apps/web/app/(tempo)/tasks/energy/page.tsx. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/tasks-energy/EnergyBoard.tsx (new); apps/web/components/tasks-energy/groupByEnergy.ts (new, pure: absent `energy` = medium; sorts by priority then `dueAt`); apps/web/components/tasks-energy/groupByEnergy.test.ts (new); apps/web/app/(tempo)/tasks/energy/page.tsx (render EnergyBoard).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read how `view="energy"` renders in apps/web/components/tasks/TaskViewsScreen.tsx for style; do not edit it.
2. groupByEnergy.ts: pure grouping of open tasks (todo, in_progress) into `{ low, medium, high }`.
3. EnergyBoard.tsx: `useQuery(api.tasks.list, {})`, three labelled columns with counts, a "Right now I have..." selector that highlights one column (stored in the URL `?now=`, no server state). Each card: energy select (`api.tasks.update`), complete checkbox (`api.tasks.toggleCompletion`), delete with "Task removed. Undo" (`api.tasks.remove` then `api.tasks.restore` until `undoUntilMs`).
4. Empty column copy is calm ("Nothing here right now"). No "overdue" wording.
5. Wire page.tsx to EnergyBoard.
6. Add one test for groupByEnergy (missing energy, ordering, done tasks excluded).
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/tasks-energy` passes; in the browser changing a task's energy and reloading /tasks/energy keeps it in the new column; delete + Undo works; lint and typecheck green.
EVIDENCE: test output; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/tasks/ or the /today and /plan screens (other batches)
- don't add AI energy detection or a coach prompt
REPORT: what changed, what was verified, anything missing from the contract.
