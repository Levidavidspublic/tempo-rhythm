---
ticket: TEMPO-B01-04
batch: B01
type: component
lane: auto
scope:
  - apps/web/components/day-timeline/
depends_on: [TEMPO-B01-01]
contract:
  - api.timeBlocks.listForDate(args: { localDate }) -> TimeBlock[]
  - api.timeBlocks.setStatus(args: { timeBlockId, status }) -> Id<"timeBlocks">
  - api.calendar_events.listInRange(args: { startMs, endMs }) -> CalendarEvent[]
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in person looking at their day on `/plan`
WHEN: batch B01, after TEMPO-B01-01
WHY: docs/PRD.md §4.1 "(… time blocks …)"; docs/APP-FLOW.md §5 step 2: "Time blocks on a timeline for the local day (`/plan` Day view); tick a block done or let it go ('skipped' is neutral)." Today `/plan` is a placeholder ("Continue" / "Review" do nothing).
GOAL: a `DayTimeline` component draws the local day's time blocks and calendar events on an hour timeline, with a "now" marker and done / let-go actions per block.
SCOPE: apps/web/components/day-timeline/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/day-timeline/DayTimeline.tsx (new, exports `DayTimeline` with optional props `localDate?: string`, `onSelectBlock?: (block) => void`, `onCreateAt?: (startMinute: number) => void`), apps/web/components/day-timeline/timelineLayout.ts (new, pure: `layoutItems(items)` assigns top, height and overlap column from `startMinute`/`durationMinutes`), apps/web/components/day-timeline/timelineLayout.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for `apps/web/components/today/TodayAgenda.tsx`, `apps/web/lib/todayAgenda.ts` and `apps/web/components/calendar/CalendarViews.tsx`; adjust to the current code (read-only reuse of `mapCalendarEventsToAgenda` is fine).
2. timelineLayout.ts: map blocks and events to `{ id, kind, startMinute, durationMinutes, column, columns }`; clamp to 0–1440; minimum rendered height 15 minutes; overlapping items share columns.
3. DayTimeline.tsx (`"use client"`): subscribe to `api.timeBlocks.listForDate` and `api.calendar_events.listInRange` for the local day from `useLocalDayBounds()` (gated on auth and `api.users.getProfile`). Render hour rows 06:00–22:00 scrollable to the full day, blocks as cards (title, time range, kind tint), calendar events as read-only lighter cards, a "now" line that updates each minute.
4. Each block has two buttons: "Done" and "Let it go" calling `api.timeBlocks.setStatus` with `done` / `skipped`, plus "Undo" back to `planned`. A skipped block is shown muted with the neutral label "Let go", never red. Clicking empty space calls `onCreateAt`; clicking a block calls `onSelectBlock` (the form is another ticket).
5. Empty state: "Nothing planned yet. Click a time to add a block." Keyboard: blocks are buttons with accessible names including the time.
6. Add timelineLayout.test.ts: single block, overlap into 2 columns, clamp at midnight.
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/day-timeline/timelineLayout.test.ts` passes; lint, typecheck and test green; only contract function names are used.
EVIDENCE: test output; screenshot path of the timeline with 3 blocks, one skipped.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config), including `plan/page.tsx` and the calendar components
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't build week or month views, calendar event editing, or the block create/edit form (other tickets/batches own them)
REPORT: what changed, what was verified, anything missing from the contract.
