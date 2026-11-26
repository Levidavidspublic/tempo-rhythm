---
ticket: TEMPO-B02-03
batch: B02
type: component
lane: auto
scope:
  - apps/web/components/notes/
  - apps/web/app/(tempo)/notes/[id]/page.tsx
depends_on: [TEMPO-B02-01]
contract:
  - api.notes.getSafe(args: {noteId: string}) -> Note | null
  - api.notes.update(args: {noteId, title?, body?, pinned?, periodType?}) -> Id<"notes">
  - api.notes.togglePin(args: {noteId}) -> {pinned}
  - api.notes.remove(args: {noteId}) -> {success, undoUntilMs}
  - api.notes.restore(args: {noteId}) -> {success}
overlap_test: false
expected_merge: clean
hold: false
---

FOR: a signed-in user opening, editing and deleting one note at /notes/[id]
WHEN: batch B02, after TEMPO-B02-01
WHY: docs/PRD.md §3 "Broken live": "`/notes/[id]` (crash on a bad id, #526, PR #547 open)"; §4.1 A4 "Every control on every signed-in screen works"; §5 "Soft delete": "30-day grace. Undo for 5 minutes inside the app"; §6 "The user never sees JSON, on any screen."
GOAL: /notes/[id] never crashes on a bad, foreign or deleted id (it shows a calm "note not found" card), and a note can be deleted with a 5-minute undo.
SCOPE: apps/web/components/notes/ plus the single file apps/web/app/(tempo)/notes/[id]/page.tsx. Size: about 3 files plus 1 test.
MUTATES: apps/web/components/notes/NotesScreen.tsx (detail part only: lines using `api.notes.get`); apps/web/components/notes/NoteNotFound.tsx (new); apps/web/components/notes/UndoDeleteToast.tsx (new); apps/web/components/notes/noteId.test.ts (new); apps/web/app/(tempo)/notes/[id]/page.tsx (only if the param needs passing differently).
STEPS:
1. Query the Graphify graph (`graphify query/explain/affected`, graphify-out/graph.json) for the MUTATES files and their dependents; adjust the plan to the current code. Read open PR #547 (`gh pr view 547`) and do not duplicate work already there; list overlaps in REPORT.
2. In the detail component replace `api.notes.get` (throws on a malformed id) with `api.notes.getSafe` taking the raw URL string. `undefined` = loading skeleton, `null` = NoteNotFound card with a link back to /notes.
3. Create NoteNotFound.tsx: heading "We couldn't find that note", one sentence, a "Back to notes" link. No error codes, no JSON.
4. Delete: call `api.notes.remove`, navigate to /notes, and show UndoDeleteToast ("Note removed. Undo") until `undoUntilMs`; Undo calls `api.notes.restore` and returns to the note. Keep pin and save controls working (`togglePin`, `update`); save must survive a reload.
5. Add one test (bun test) for the pure id/undo-window helper (e.g. `isUndoActive(undoUntilMs, now)`) and the not-found state mapping.
6. `bun run lint && bun run typecheck && bun run test`.
DONE: `bun test apps/web/components/notes` passes; opening /notes/not-a-real-id in the browser shows the "couldn't find that note" card, not an error page; deleting then undoing restores the note after a reload; lint and typecheck green.
EVIDENCE: test output; note of what #547 already covered; no signed-in screenshots in the PR (keep paths outside the repo).
DO NOT:
- don't change convex/ or the database folder (the data ticket owns it; anything missing goes in REPORT)
- don't change files outside scope (shared hot files, package.json, lockfiles, routes, config)
- don't change .github/, scripts/factory/, .cursor/, AGENTS.md, docs/tickets/, docs/contracts/
- don't touch the notes list part of NotesScreen.tsx beyond what delete/undo needs (TEMPO-B02-04 builds the list in its own folder)
- don't render raw markdown JSON blocks to the user
REPORT: what changed, what was verified, overlap with PR #547, anything missing from the contract.
