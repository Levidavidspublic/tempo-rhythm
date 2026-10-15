---
ticket: TEMPO-B03-02
batch: B03
type: component
lane: auto
scope:
  - apps/web/components/brain-dump/
depends_on: [TEMPO-B03-01]
contract:
  - api.brain_dump.prioritize(args: {rawText: string}) -> {summary: string, priorities: {title, reason, urgency}[]}   # EXISTING
  - api.brain_dump.acceptPlan(args: {items: {title: string, urgency: "now"|"soon"|"later"}[]}) -> {created: number, taskIds: Id<"tasks">[]}
  - api.crisis.check(args: {text: string}) -> {isCrisis: boolean}
  - api.crisis.resourcesCard(args: {}) -> {title, body, resources: {label, detail}[]}
overlap_test: true
expected_merge: clean
hold: false
---

<!-- overlap: overlap pair with TEMPO-B03-05 (crisis API) -->

FOR: Tempo Flow users who need to empty a crowded head and get an order back
WHEN: batch B03, after TEMPO-B03-01 (data ticket)
WHY: docs/PRD.md §5 "Adaptive coach ... Accept / reject is law"; §6 "the model proposes, the user accepts, code writes. The model never writes to the database." and "Crisis words return a fixed resources card, with no model call."; §4.1 A6 "AI actions answer"; §11 Q6 "Is a brain dump kept as a page after its plan is accepted?" (UNKNOWN: do not keep it).
GOAL: On /brain-dump the user types or pastes a messy dump, sees a prioritised preview, accepts or rejects each item, and only accepted items become tasks.
SCOPE: apps/web/components/brain-dump/ (a new folder owned only by this ticket). Size: about 3 files plus 1 test.
MUTATES: new apps/web/components/brain-dump/BrainDumpScreen.tsx (client component: textarea, "Sort it" button, preview grouped by urgency with Accept / Reject per item, "Add accepted", empty / loading / error states); new apps/web/components/brain-dump/brainDumpState.ts (pure: submit guard, selection state, group by urgency); new apps/web/components/brain-dump/brainDumpState.test.ts
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read docs/contracts/B03.md and apps/web/components/today/TodayBrainDumpPanel.tsx and apps/web/lib/brainDumpPrioritizer.ts (read only) for the existing pattern; use `api` from `@/convex/_generated/api` and `@/components/ui/*`.
2. `brainDumpState.ts`: `canSubmit(raw)` (non-empty after trim), `toggleItem(selection, index)`, `acceptedItems(plan, selection)` returning `{title, urgency}[]` capped at 6, `groupByUrgency(plan)` in the order now, soon, later.
3. `BrainDumpScreen.tsx`: before calling `prioritize`, query `api.crisis.check` with the text (`useConvex().query`). If `isCrisis`, fetch `api.crisis.resourcesCard`, show only that card and do NOT call `prioritize`. Otherwise call `useAction(api.brain_dump.prioritize)` and show the plan with the model's reasons. On error show the thrown friendly message and keep the typed text.
4. Each preview item has Accept and Reject; all start unchosen and nothing is saved yet. "Add accepted" calls `api.brain_dump.acceptPlan` with only the accepted items, then shows "N added to your tasks" and clears the dump. Reject only hides the item.
5. Copy is plain and calm; urgency labels "Now", "Soon", "Later". Do not show the dump back as a saved page.
6. Put the pure logic in the `.ts` file with the test beside it, so the test runs without a browser.
7. `bun test apps/web/components/brain-dump` then `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/brain-dump` passes; on the preview a dump with no accepted items creates zero tasks and accepting 2 of 4 items creates exactly 2; crisis text shows the fixed card and makes no `prioritize` call; lint and typecheck green.
EVIDENCE: the `bun test` output, plus a screenshot path of the preview and of the crisis card, pasted in the PR.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- no shame copy, no emoji, no JSON shown to the user (PRD §6)
- don't edit apps/web/app/(tempo)/brain-dump/page.tsx; the merge agent wires `BrainDumpScreen` in (contract: hot files)
REPORT: what changed, what was verified, anything missing from the contract (as `blocked: missing backend <function>`), and any UNKNOWN.
