---
ticket: TEMPO-B02-04
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/notes-pages/
  - apps/web/app/(tempo)/notes/page.tsx
depends_on: [TEMPO-B02-01]
contract:
  - api.notes.list(args: {search?, pinnedOnly?}) -> Note[]
  - api.notes.create(args: {title, body, pinned?, periodType?}) -> Id<"notes">
  - api.notes.togglePin(args: {noteId}) -> {pinned}
  - api.notes.remove(args: {noteId}) -> {success, undoUntilMs}
  - api.notes.restore(args: {noteId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user browsing their notes and daily, weekly and monthly pages at /notes
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §5 "Unified surface: calendar + tasks + notes over one markdown layer; daily / weekly / monthly pages"; §4.1 A4 "Every control on every signed-in screen works ... with a reload check"; §5 "Soft delete": "Undo for 5 minutes inside the app"; §3 "Working live: `/notes` (create)".
GOAL: /notes lists notes with search, a pinned filter and a Daily / Weekly / Monthly / All page-type filter, and each note can be pinned or deleted with a 5-minute undo.
SCOPE: apps/web/components/notes-pages/ plus the single file apps/web/app/(tempo)/notes/page.tsx. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/notes-pages/NotesList.tsx (new); apps/web/components/notes-pages/PeriodFilter.tsx (new); apps/web/components/notes-pages/filterNotes.ts (new, pure filter by `periodType`); apps/web/components/notes-pages/filterNotes.test.ts (new); apps/web/app/(tempo)/notes/page.tsx (render NotesList instead of the old list; keep the create flow working).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read the list/create part of apps/web/components/notes/NotesScreen.tsx and reuse its look; do not edit that file (TEMPO-B02-03 owns it).
2. filterNotes.ts: pure `filterByPeriod(notes, "all" | "daily" | "weekly" | "monthly")` on `periodType` ("none" counts only under All).
3. PeriodFilter.tsx: accessible tab/segmented control with the four options; remembers the choice in the URL search param `?type=`.
4. NotesList.tsx: `useQuery(api.notes.list, {search, pinnedOnly})`, search box, pinned toggle, create (title + period type) via `api.notes.create`, pin via `api.notes.togglePin`, delete via `api.notes.remove` with "Note removed. Undo" for `undoUntilMs` then `api.notes.restore`. Empty state in a calm voice. Never show the markdown body's JSON blocks: show only the first plain line as a preview.
5. Wire page.tsx to NotesList (keep the "use client" boundary inside the component).
6. Add one test for `filterByPeriod` (all four filters, `none` handling).
7. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/notes-pages` passes; in the browser /notes shows the filter, a created weekly note appears under Weekly after reload, delete + Undo restores it; lint and typecheck green.
EVIDENCE: test output; screenshot path kept outside the repo.
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't edit apps/web/components/notes/ (TEMPO-B02-03) or build templates, the daily-note route or brain dump (other batches)
- don't show JSON to the user
REPORT: what changed, what was verified, anything missing from the contract.
