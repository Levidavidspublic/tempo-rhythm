---
ticket: TEMPO-B02-02
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/calendar/
depends_on: [TEMPO-B02-01]
contract:
  - api.calendar_events.create(args: {title, startsAtMs}) -> Id<"calendarEvents">
  - api.calendar_events.listInRange(args: {startMs, endMs}) -> CalendarEvent[]
  - api.calendar_events.update(args: {eventId, title?, startsAtMs?}) -> Id<"calendarEvents">
  - api.calendar_events.remove(args: {eventId}) -> {success, undoUntilMs}
  - api.calendar_events.restore(args: {eventId}) -> {success}
  - api.tasks.listDueInRange(args: {startMs, endMs}) -> Task[]
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user planning their day, week or month on /calendar
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §3 "Broken live": "`/calendar` add (event never appears, #527)"; §4.1 A4 "Every control on every signed-in screen works ... with a reload check"; §5 "Unified surface: calendar + tasks + notes"; §5 "Soft delete": "Undo for 5 minutes inside the app".
GOAL: adding an event on /calendar makes it appear in Day, Week and Month views and survive a reload, and each event can be edited or deleted with a 5-minute undo.
SCOPE: apps/web/components/calendar/. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/calendar/CalendarViews.tsx; apps/web/components/calendar/EventRow.tsx (new: edit title/date, delete, undo toast); apps/web/components/calendar/calendarRange.ts (new, only if range helpers must move out); apps/web/components/calendar/CalendarViews.test.ts (new).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code.
2. Reproduce #527: in CalendarViews.tsx the form creates the event at the local midnight of the chosen date, then `setView("day")`. Find why it does not show: compare the event's `startsAtMs` with `getCalendarRangeMs(view, selectedDate)` (day/week/month boundaries, local time vs UTC) and with `hasConvexUser` gating of `listInRange`. Fix the cause; add the failing case to the test first.
3. Make the new event visible immediately after the mutation resolves (Convex live query) and keep the form's date selected. Show the Convex error message in the existing error slot; never swallow it.
4. Create EventRow.tsx: shows title and time; an "Edit" action calling `api.calendar_events.update`; a "Delete" action calling `api.calendar_events.remove`, then a toast "Event removed. Undo" that calls `api.calendar_events.restore` until `undoUntilMs` (5 minutes), after which the toast disappears.
5. Keep showing tasks from `api.tasks.listDueInRange` in the same views (unified surface), as plain read-only rows.
6. Add one test (bun test) for the range/visibility logic: an event created for a given date is inside the Day, Week and Month ranges, including at a UTC offset boundary.
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/calendar` prints all tests passing, including "created event is visible in day, week and month ranges"; lint and typecheck green; in the browser (`bun run dev`, signed in) adding an event shows it at once and after a reload.
EVIDENCE: test output; short note of the root cause of #527; screenshot path kept OUTSIDE the repo (signed-in screenshots never go on GitHub, TRD §7.6).
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't touch the `eventSourceMode="local"` E2E path in apps/web/app/(tempo)/calendar/page.tsx
- don't use shaming copy ("missed", "overdue!")
REPORT: what changed, root cause of #527, what was verified, anything missing from the contract.
