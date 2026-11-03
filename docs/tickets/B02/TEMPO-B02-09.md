---
ticket: TEMPO-B02-09
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/tasks-checklists/
  - apps/web/app/(tempo)/tasks/checklists/page.tsx
depends_on: [TEMPO-B02-01]
contract:
  - api.tasks.list(args: {status?, search?}) -> Task[]   # rows include checklist?
  - api.tasks.update(args: {taskId, checklist?, ...}) -> Id<"tasks">
  - api.tasks.remove(args: {taskId}) -> {success, undoUntilMs}
  - api.tasks.restore(args: {taskId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user breaking a task into small steps on /tasks/checklists
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §4.1 A4 "Every control on every signed-in screen works ... with a reload check"; §5 "Unified surface: calendar + tasks + notes"; §5 "Soft delete": "Undo for 5 minutes inside the app"; §6 "Never shame".
GOAL: /tasks/checklists shows each open task that has steps with a progress count, lets the user add, tick, rename and remove steps, and keeps them after reload.
SCOPE: apps/web/components/tasks-checklists/ plus the single file apps/web/app/(tempo)/tasks/checklists/page.tsx. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/tasks-checklists/ChecklistBoard.tsx (new); apps/web/components/tasks-checklists/checklistOps.ts (new, pure: `addStep`, `toggleStep`, `renameStep`, `removeStep`, `progress` returning new arrays with stable string ids); apps/web/components/tasks-checklists/checklistOps.test.ts (new); apps/web/app/(tempo)/tasks/checklists/page.tsx (render ChecklistBoard).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read `view="checklists"` in apps/web/components/tasks/TaskViewsScreen.tsx and `convex/lib/taskChecklists.ts` (`normalizeChecklist`) for the item shape `{ id, text, completed }`; do not edit either.
2. checklistOps.ts: pure functions returning new arrays; ids from `crypto.randomUUID()` passed in as a parameter so tests are deterministic; trim text, drop empty text.
3. ChecklistBoard.tsx: `useQuery(api.tasks.list, {})` for open tasks; a task card shows "2 of 5 steps"; add-step input; tick, rename and remove step each call `api.tasks.update` with the full new `checklist`. A "Delete task" action uses `api.tasks.remove` with "Task removed. Undo" until `undoUntilMs`, Undo calls `api.tasks.restore`.
4. Tasks with no steps are listed under "Add steps to a task" so the user can start a checklist from any open task.
5. Wire page.tsx to ChecklistBoard.
6. Add one test for checklistOps (add, toggle, rename, remove, progress, empty text dropped).
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/tasks-checklists` passes; in the browser adding and ticking steps, then reloading /tasks/checklists keeps them; delete + Undo works; lint and typecheck green.
EVIDENCE: test output; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/tasks/ or the /today and /plan screens (other batches)
- don't add AI step generation or templates (other batches)
REPORT: what changed, what was verified, anything missing from the contract.
