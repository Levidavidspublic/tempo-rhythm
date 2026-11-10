---
ticket: TEMPO-B02-05
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/tracking/
depends_on: [TEMPO-B02-01]
contract:
  - api.focusBlocks.create(args: {startedAtMs, durationMs, label?, taskId?}) -> Id<"focusBlocks">
  - api.focusBlocks.listInRange(args: {startMs, endMs}) -> FocusBlock[]
  - api.focusBlocks.remove(args: {focusBlockId}) -> {success, undoUntilMs}
  - api.focusBlocks.restore(args: {focusBlockId}) -> {success}
  - api.streaks.getCurrent(args: {}) -> streak summary
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user logging focus blocks and watching habit streaks on /tracking
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §3 "Broken live": "`/tracking` (focus blocks lost on reload)"; §4.1 A4 "with a reload check"; §6 "Never shame. ... Streaks are dosing data, never pressure."; §5 "Soft delete": "Undo for 5 minutes inside the app".
GOAL: focus blocks logged on /tracking are saved in Convex, are still there after a reload or on another device, and can be removed with a 5-minute undo.
SCOPE: apps/web/components/tracking/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/tracking/TrackingDashboard.tsx (replace the localStorage log with Convex); apps/web/components/tracking/focusBlockStats.ts (new, pure: totals per local day, last-7-days series); apps/web/components/tracking/focusBlockStats.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Read how TrackingDashboard.tsx stores logs today (`trackingLogsStorageKey`, `parseTrackingLogs`, `localStorage`). Replace reads with `useQuery(api.focusBlocks.listInRange, {startMs, endMs})` for the last 7 local days (compute the window from the user's local day, not UTC) and writes with `api.focusBlocks.create`. Remove the localStorage persistence.
3. One-time migration: if localStorage still has old logs for the user, import them via `api.focusBlocks.create` once, then clear that key. Make it idempotent (clear only after all creates succeed).
4. focusBlockStats.ts: pure functions for minutes per local day and the 7-day chart series; the chart reads these.
5. Delete a block with `api.focusBlocks.remove`, toast "Focus block removed. Undo" until `undoUntilMs`, Undo calls `api.focusBlocks.restore`.
6. Keep the habit-streak card on `api.streaks.getCurrent`; copy stays neutral ("Streaks are information, not pressure").
7. Add one test for `focusBlockStats` (day bucketing across local midnight, empty input).
8. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/tracking` passes; in the browser log a focus block, reload /tracking, the block and chart are still there; delete + Undo works; lint and typecheck green.
EVIDENCE: test output; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/app/(tempo)/tracking/page.tsx
- don't add streak-loss or "you failed" copy
REPORT: what changed, what was verified, anything missing from the contract.
