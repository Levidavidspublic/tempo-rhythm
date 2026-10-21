---
ticket: TEMPO-FEATURE-PAGE-RECOVERY
batch: FEATURE
type: component
lane: sol
wave: 3
browser_test: true
scope:
  - apps/web/components/notes/NotesScreen.tsx
  - tests/unit/tempo-page-error-recovery.test.tsx
  - docs/polish/evidence/feature-page-recovery/
depends_on: []
overlap_test: false
expected_merge: small-conflict
hold: false
---

# [TEMPO-FEATURE-PAGE-RECOVERY] Failed page actions show recovery and keep the draft

FOR: tempo-rhythm, Lane 2 Tempo features, WORKHORSE; mounted Notes page UI. One file plus one test and evidence; no backend changes.
WHEN: A worktree is available within the shared four-worktree cap. Start from current integration. No active KB PR owns NotesScreen.tsx, and protected #1193/#1198 do not touch it. KA-08/#1101 expressly excludes it. Older overlapping #1053/#1081 and held migration proposals #795/#805 remain untouched and require later reconciliation; they are not dependencies of this narrow error repair. Do not edit PageEditorView.tsx, the shared checkbox editor, or held #1110/#1112/#1129 files.
WHY: Amit's 21 October steer requires editable pages and fixes for page errors. HARD_RULES sections 1, 7, 8 and 11; DESIGN v3 sections 6 and 13. Source inspection shows failed autosave leaves Saving indefinitely, and pin/delete handlers reject uncaught. This is not proof of the specific preview three-error badge; its exact cause remains UNKNOWN.
GOAL:
- Failed save, pin or confirmed delete shows a short accessible inline error and an explicit retry, retaining the person's draft.
- Only a successful removal changes the URL and starts the existing five-minute Undo. An unresolved pin/delete operation is submitted once.
- Late results cannot mark a newer draft saved or change another note's visible state.
SCOPE: apps/web/components/notes/NotesScreen.tsx (NotePage implementation only, existing NotesList/exports preserved); new tests/unit/tempo-page-error-recovery.test.tsx; docs/polish/evidence/feature-page-recovery/ only. Reuse existing translated notes.error, notes.pinError and coachChat.retry copy and existing token classes; no new strings, stylesheet, dependency, route or configuration.
MUTATES: UI only, existing notes mutation calls and arguments preserved. No schema, environment, provider, model or deployment change.
CONTRACT:
- notes.getSafe({noteId:string}) -> owned live note or null.
- notes.update({noteId:Id<"notes">,title?:string,body?:string,pinned?:boolean,periodType?:"daily"|"weekly"|"monthly"|"none"}) -> Id<"notes">. Keep the actual generated validator/caller types; do not introduce new arguments. notePatch sends only dirty title/body fields and preserves body bytes.
- notes.togglePin({noteId:Id<"notes">}) -> {pinned:boolean}.
- notes.remove({noteId:Id<"notes">}) -> {success:true,undoUntilMs:number}; notes.restore({noteId:Id<"notes">}) -> {success:boolean}.
- Page coach flush still rejects when save fails, so no chat uses unsaved content. Retry must not create a coach/model request.
STEPS:
1. Read NotePage, notePatch, shouldAdoptRemoteTitle, PageEditorView save-state rendering, CoachPage registration, UndoDeleteToast, existing note-sync and page tests, and convex/notes.ts validators read-only. Capture original mounted failure behavior using fictional notes before editing. Recheck active ownership.
2. Add local operation/error state with exact note/revision ownership. Keep the 500ms debounce and dirty-field semantics. Preserve PageEditorView existing SaveState union: use idle with separate error UI after failure, never add an unsupported error prop value. A failed timer or visibility/pagehide save shows an inline role=alert and explicit Retry; keep title/body intact. No false Saved label from an older request. A subsequent successful current save clears its own error. Preserve coach flush rejection.
3. Catch pin and confirmed-delete failures at the actual action boundary. Use synchronous in-flight guards to reject duplicate submission; clear guards on settlement. Keep editor, confirmation and URL after failure. Before removal, flush every unsaved field even if a previous failed save has already cleared its timer. Never remove if that flush rejects. Never show Undo until successful removal. Preserve Undo behavior and confirmed deletion intent; no automatic retry of destructive actions.
4. Render error/retry without adding h1/main or altering the real editor shell, shared CSS, routes or codec. Existing translated copy only, visible focus and existing minimum touch targets; EN/HE RTL. Do not display raw server payloads or suppress global error reporting. Do not broaden into wiki-link creation, sidebar blocks or cleanup/unmount redesign.
5. New focused test file mounts actual NotePage/editor with synthetic query/mutation/auth/router boundaries, isolated processes if necessary; no globally leaked module mocks. Mutation functions and query snapshots must remain stable across renders; mount CoachPageProvider and an actual useFlushCoachPage probe for the flush contract. At least 10 named cases: save failure retains title/body; current retry succeeds; later draft is not falsely saved; wrong-note stale completion ignored; pin failure/retry and duplicate suppression; pre-delete dirty flush failure makes zero remove calls; failed remove causes zero URL/Undo changes; successful confirmed remove retains Undo; coach flush rejection; visibility/pagehide recovery; EN/HE keyboard recovery. Include plain/daily/weekly/project/template bodies in the edit matrix. No claim of authenticated E2E from fixtures. Capture before/after 390/1280 EN/HE light/dark, reduced motion, no horizontal overflow and no unhandled page error in caught paths. Do not assume the unmerged checkbox fix exists.
6. Run mandatory AGENTS commands in order with Bun1.3.9, reporting every exit and failure tail. Coordinate the single browser/full-suite/build slot with the lead. Three total implementation/review candidates, no check weakening. Open one draft PR into integration with actual evidence; no merge by worker.
DONE: Focused cases pass with actual mutation counts and retained draft assertions; bun run lint zero errors, typecheck5/5, full bun run test zero fail, four scans/notices OK, local CI=1 bunx playwright test --reporter=line and placeholder-Convex build recorded. Current CI, addressed actual CodeRabbit and all guards required before integration merge. All failures and unavailable checks remain explicit.
EVIDENCE: Scoped README command/result table, source/evidence commits, exact failure tails, fictional screenshots and actual test output. State explicitly that preview badge origin, authenticated persistence and real-device screen-reader behavior are UNKNOWN. Hebrew is existing machine-drafted copy for Amit's native read before production.
DO NOT: No changes outside scope, especially Convex, routes, package/lock/config, PageEditorView, live-preview, i18n/global CSS or e2eWiringRoutes. No new packages, paid calls, secrets, env writes, deployment, direct default-branch push, labels or bot commands. No product policy inventions, claim of sidebar support, fake chat/cancel control or preview-completion claim. No edits to protected PRs or another writer's files.
REPORT: AGENTS status/ticket/evidence/changed/unknowns/notes format on the one draft PR; lead maintains STATUS.md and OVERNIGHT-REPORT.md. User's current CodeRabbit gate supersedes stale Bugbot prose.
