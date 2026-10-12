Supersedes open PR #878 (redone 2026-10-12 for the v3 markdown-first run).

# CORE-WEB-NOTES — core note kinds, TODO identity and lifecycle

## Settled by the owner (2026-10-12)

Source: the owner's decisions for the v3 markdown-first rebuild, recorded in `docs/design/v3/OVERNIGHT-RUN.md`, section "Decisions (settled by Amit; do not reopen)", on branch `batch/v3-markdown-first`. This section wins over anything below it. The body was edited in place to match: each changed rule says "Superseded 2026-10-12" or "Settled 2026-10-12".

### Decisions that apply to this contract

| # | Decision (shortened) | Effect here |
|---|---|---|
| 1 | `notes.body` Markdown is the only source of truth. There is no second stored representation. Tempo blocks are fenced `json tempo` blocks inside it, read with the shared codec (`packages/utils/src/blocks.ts`). The JSON is never shown. | NT-01 to NT-05, NT-09. OD-1 is closed. |
| 2 | Saving is byte-exact: an untouched page loads and saves back identical. | A derived-index write never writes `body` (NT-01). |
| 3 | `[[links]]` are live: a picker on `[[`, and "Linked here" backlinks. | NT-08. |
| 4 | `- [ ]` stays a plain Markdown checkbox. It is not a Tempo task block. | NT-06. OD-8 is closed. |
| 6 | One page route: `/notes/[id]`; `/p/[pageId]` redirects to it. Journal, daily, weekly, brain-dump results and templates are Markdown pages (`{{tokens}}` in templates). | NT-07. |

The editor half of decision 2, and decisions 5 (the v3 look) and 7 (menus, copy, RTL), are owned by CORE-WEB-EDITOR-MODES; OD-3 labels follow the v3 design copy where it names them.

### Rules added by the settlement

| ID | Rule |
|---|---|
| NT-01 | **The body is the truth.** `notes.body` is the only source of truth for a page's content, every Tempo block included. Every typed row or field derived from a body is a disposable derived index: `noteBlocks`, a `tasks` row linked to a block, a tag index, a backlink index, `notes.preview`, and `notes.pageType`, `notes.date` and `notes.isTemplate` (which mirror the page-meta block, NT-07). The body writer writes them in the same transaction as the body. They are rebuilt from the body, never authoritative, and never the source of a body write. Deleting every derived row of a note and rebuilding it from the body must lose nothing. |
| NT-02 | **A task block is the task.** A `json tempo` task block is the task's content: `title`, `status` (`now`, `later`, `done`), `durationMin`, `scheduledAt`, `inelastic`, `order`, `reason`, `doneAt`. A `tasks` row that carries `sourceNoteId` and `sourceBlockId` is a derived index of that block, so Today, the planner, MCP and coach proposals keep pointing at an `Id<"tasks">`. It is upserted by its key `(userId, sourceNoteId, sourceBlockId)` on each body write, so its `_id` stays the same while the block exists (EXTRAPOLATED mechanism). A change to a linked task made outside the page (a tick in Today, MCP `task_update`, the planner, the coach) is a write to the block in `notes.body` through the page writer (#787 `patchBlock`), after which the row is re-derived. It never changes the row alone. Fields a block cannot carry (priority, energy, project, checklist, repeat) are not stored for a linked task: the derived row holds the `createTaskForUser` defaults, and a write of those fields to a linked task is refused until a codec change adds them to the block (EXTRAPOLATED; section 14, item 19). Which task blocks get a derived row depends on the body alone, so a rebuild loses nothing. Default here (EXTRAPOLATED; section 14, item 18): every valid task block of a page, up to `MAX_LINKED_TASKS_PER_NOTE` (50) in body order; a block past that bound stays page-local. Typed tasks with no block (created in `/tasks`, by MCP `task_create`, by brain-dump accept or by quick add) are not derived rows and keep today's behaviour. |
| NT-03 | **Derived status.** Block `done` gives row `done`, with `completedAt` from `doneAt`. `now` and `later` give `todo`. A linked task cannot be `in_progress` or `cancelled`, because no block value says so; such a write to a linked task is refused (EXTRAPOLATED). |
| NT-04 | **A block's row follows the block.** When a block leaves the body, its derived row is soft-deleted in the same transaction. When the block comes back (page Undo, note restore), the row is re-derived and revived by its key, with the same `_id`. `tasks.remove` on a linked task removes its block through the page writer. `tasks.restore` on a linked row whose block is not in the body returns `{ success: false }` (the existing shape); the row comes back only with its block. |
| NT-05 | **Tags live in the body.** A page's tags are `page-meta.data.tags` (at most 100 strings of at most 200 characters each, `packages/utils/src/blocks.ts:24-30`). A tag table may mirror them as a derived index for lookup, rebuilt from bodies. Attach, detach and rename are body writes of the page-meta block through the page writer, never row-only writes. The §10.1 normalisation applies to each tag string. The §10 hierarchy (`parentId`, move, promotion on remove, renaming on restore) is held, because a flat string list has no agreed way to write nesting: UNKNOWN until the owner picks one (section 14, item 21). |
| NT-06 | **`- [ ]` is prose.** Nothing parses a Markdown checkbox into a task, a block or a row (OD-8, decision 4). |
| NT-07 | **Page kinds are pages.** Daily, weekly, journal, brain-dump results and templates are Markdown pages in `notes`, told apart by `pageType` (plus `date` for a dated page), and all open at `/notes/[id]` (`/p/[pageId]` redirects). A template is a page with `pageType: "template"` whose body carries `{{tokens}}`. The page-meta block's `pageType` and `date` are the truth, and `notes.pageType`, `notes.date` and `isTemplate` (AE-18) mirror them. Gap: `notes.pageType` (`convex/schema.ts:342-350`) and the codec's `pageType` (`packages/utils/src/blocks.ts:15`) hold only `daily`, `weekly`, `project`, `plain` and `template`, so journal and brain-dump values need a codec change and a schema change (section 14, item 20). `kind` (`quick`, `note`, `todo`, AE-1) stays a separate field. |
| NT-08 | **Backlinks come from bodies.** "Linked here" lists the owner's live pages whose bodies contain a `[[link]]` to this page. A link index, if one is built, is a derived index rebuilt from bodies. Its schema and owner are not specified here (UNKNOWN). Resolution rules are in CORE-WEB-EDITOR-MODES ED-05. |
| NT-09 | **Derived-index lookups and restore (fixes the open Codex P1s on #878).** (a) Live-row index: `noteBlocks` gains `.index("by_userId_noteId_deletedAt_blockId", ["userId", "noteId", "deletedAt", "blockId"])` (§8.7). Every block lookup (the task rebuild, `note_tasks.*`, `source.state`) reads `eq(userId).eq(noteId, n).eq(deletedAt, undefined).eq(blockId, b)` with `take(2)`, and two live rows for one key are corrupt data that fail the call. The existing `by_userId_noteId_blockId` has no `deletedAt` and is never used for a live lookup. (b) Restore rebuilds: `notes.restore`, including a Trash restore after account deletion, rebuilds the note's derived rows from the restored body in the same transaction: `noteBlocks` rows, linked task rows, and tag and link index rows. Sign-in restore still revives only the user row (`convex/auth.ts:106-115`); a note's derived rows come back when that note is restored. #842's `notes.restore` calls #787's rebuild helper and waits for it (section 14, item 22). |
| NT-10 | **`search.all` without pagination (fixes the open Codex P2 on #878).** A caller that omits `notesPage` gets today's behaviour: every live note is scanned, matches are cut to `GROUP_LIMIT`, and there is no cursor, so `SearchScreen`'s `{ query }` call keeps working whatever order #849 and #850 land in. Pagination is opt-in: only a caller that passes `notesPage` gets the bounded window, the `notesPage` result and the split protocol (§9.4). The legacy path stays listed in §11.2 as an unbounded reader until #850 moves the caller to `notesPage`. |

### Owner decisions, now closed

| OD | Status | Settled answer |
|---|---|---|
| OD-1 | DECIDED (decision 1) | The block in `notes.body` is the truth for a page task. A linked `tasks` row is its derived index, which keeps `Id<"tasks">` usable by Today, the planner and MCP (NT-02). Typed tasks with no block are unchanged. Nothing is migrated or retired. |
| OD-2 | Default adopted | Archiving or trashing a note does not change its linked tasks. They stay live in Today, the planner, Tasks and TODO, with a provenance label. |
| OD-3 | Default adopted | Stored `quick`, `note`, `todo`; labels "Quick note", "Note", "To-do", unless the v3 design copy names them otherwise (decision 5). The Hebrew strings are the owner's. |
| OD-4 | Default adopted | "You can restore this until [date]. After that it can't be restored from here." Never "permanently deleted" or "erased". No empty-trash. |
| OD-5 | Default adopted | Rows soft-deleted by account deletion show as trashed notes, with no special UI and no claim that account restore brings data back. Restoring one rebuilds its derived rows (NT-09). |
| OD-6 | Default adopted | Child tags move up to the deleted tag's parent, with no cascade. It applies once a nesting representation exists (NT-05). |
| OD-7 | Default adopted | Selecting a tag shows only notes tagged with exactly that tag. |
| OD-8 | DECIDED (decision 4) | No. `- [ ] item` stays plain text (NT-06). |

### Superseded by the settlement

| Rule | Replacement |
|---|---|
| §0.2, out-of-scope list (journal model, backlinks) | Journal is a Markdown page (NT-07), and backlinks are computed from bodies (NT-08). |
| AE-5, §5.2 | A page task's identity is its block, `(noteId, blockId)`. The linked `tasks` row is the block's derived index (NT-02). |
| AE-6, §5.5 | The block is authoritative for every field it can carry. Typed-form writes to a linked task go to the block, and body edits propagate to the row (NT-02). |
| AE-7: L5 and L6 | A block's row is soft-deleted when the block leaves the body and comes back only with it (NT-04). L1 to L4 and L7 to L11 stand as index invariants. |
| AE-8, §5.6, §9.2 `note_tasks.link` | Rows are derived from task blocks automatically (NT-02). Attaching an existing typed row to a block is not offered, because the row would become a second truth. `addTask` and `captureTodo` write a block, and the row is derived in the same transaction. |
| AE-12, AE-20, §8.3, §9.3, §10 | Tags live in `page-meta.data.tags` (NT-05). Tag tables may only mirror them, tag writes are body writes, and the hierarchy is held. `linkedAt` order is best-effort, because a rebuild resets it (EXTRAPOLATED). |
| AE-11, §9.4, §11.2 (`search.all`), SR-01, SR-02 | Pagination is opt-in, and a call without `notesPage` keeps today's behaviour (NT-10). |
| §5.8, first alternative | Partly adopted: the block is the truth, and typed rows stay as its derived index (no retirement, no migration). |
| §5.10 | A derived row carries only block-derived fields and defaults, so it is inside the caps by construction. The `note_tasks.link` admission check goes with `link`. |
| §6.2 Restore row, §6.5 | `notes.restore` also rebuilds the note's derived rows (NT-09). |
| §7.2, "Active, block gone" row; `source.state` `block_missing` | A row whose block is gone is soft-deleted, not shown (NT-04). |
| §9.2 `link` block lookup | It uses the live-row index of §8.7 (NT-09). |
| §10.6, first bullet | `page-meta.data.tags` is the tag store (NT-05). |
| §12.3 TK-02 to TK-05, TK-08, TK-11, TK-13, TK-15, TK-23, the link-admission cases of TK-24; §12.4 TG-05 to TG-07, TG-11, TG-12, TG-19 to TG-22 | Replaced by TK-25 to TK-29 and NB-01 (§12.3) and the note at the top of §12.4. |
| §14, item 5 | Answered: page-meta tags are the store. |
| §1 index, OD-1 to OD-8 | Closed, as in the table above. |

### Open Codex findings on #878, fixed in this redo

1. P1, `noteBlocks` has no live-row index for block lookup: NT-09(a) and §8.7 require `by_userId_noteId_deletedAt_blockId`.
2. P1, restoring an account-deleted note leaves its `noteBlocks` rows tombstoned: NT-09(b) makes `notes.restore` rebuild the derived rows from the restored body.
3. P2, `search.all` changes behaviour for callers that do not paginate: NT-10 keeps the old behaviour when `notesPage` is absent.

| | |
|---|---|
| Ticket | #837 `TEMPO-CORE-CONTRACT-01`, batch CORE-WEB. Held. Document only. |
| Status | **PROPOSAL**, except the owner settlement above (2026-10-12), which is decided. Nothing else here is adopted until the coordinator records adoption on #837. This file changes no schema, API, retention rule, privacy rule, UI or deployment, and starts no work. |
| Baseline | `integration` @ `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79` (fetched 2026-10-11; first drafted at `704bd0832fe9c490a0d5b68d7e1cc7c23b178c58`, re-pinned in fix round 1). Every `path:line` below is a line in the 9cf7985 tree. Merged since 704bd08 and now part of the baseline: #807 (chat state: `chatRequests`, four `conversations` lifecycle fields, a `memories` index, and account-deletion enrollment of `noteBlocks` and `chatRequests`; PR #877), #815 (Agent component tests under Bun, the first test that imports `convex-test`; PR #876) and the shared block codec (branch `t/802-shared-block-codec`; PR #879, which moved the codec from `convex/lib/blocks.ts` to `packages/utils/src/blocks.ts`). #826 (the page/block foundation of ticket #786) was already merged. `convex/notes.ts`, `convex/tasks.ts`, `convex/lib/softDelete.ts`, `convex/search.ts`, `convex/templates.ts` and `docs/contracts/B02.md` are identical to `0c5b4279847b8f21c1bafff9813fe55a1770fe30`, the SHA #837 cites for the restore clocks (`git diff --stat` empty, 2026-10-11). `convex/lib/accountDeletion.ts` is not (#807 added two tables to it), so its citations, and those to `convex/schema.ts` and the block codec, are re-pinned to 9cf7985. Redo 2026-10-12: this file was copied from PR #878's head onto `integration` at `e150542953319ecfcdd2ae0496af36beb02b3274`. Since `9cf7985`, `convex/schema.ts` gained `notes.revision` and three inactive page-operation tables (#882), `convex/lib/accountDeletion.ts` gained their enrolment (#882, #886), and `convex/_generated/api.d.ts` changed (#889). So citations into those three files are stale by a few to about 180 lines (for example `notes` is now `convex/schema.ts:331-367`, `noteBlocks` `:369-470`, and `noteBlocks` sits in `USER_OWNED_TABLES` at `convex/lib/accountDeletion.ts:37`). They were re-checked only where the settlement relies on them; the rest were not re-pinned (UNKNOWN). Every other cited file is unchanged since `9cf7985`. |
| Not baseline | Everything still open on GitHub (#787, #808, #828, #831, #803, #804, #792, #840 and the rest of #838–#866) is a **proposal, not an API**. This file says what it needs from each and marks the need UNKNOWN until merged code can be read. #807 is no longer on that list: it is merged (Baseline row). #803 is PR #884, open at head `924c51c`; its file was read there, not on integration: `packages/utils/src/page-summary.ts` exports `projectPageText(body, { summaryChars?, searchChars? })`, which returns `{ summary, searchText, truncated, omittedBlocks }` (defaults 140 and 20,000 characters, hard cap 100,000). Integration has also moved since 9cf7985 (this branch merged it in fix round 2): among other changes it now holds #828's inactive page-operation schema (PR #882, including an optional `notes.revision`) and #880. This file's statements about #828 were written against 9cf7985 and were not re-read against that schema: UNKNOWN whether any needs revising. Re-read for the settlement on 2026-10-12: `notes.revision` exists, optional, with no writer (`convex/schema.ts:354-358`), which matches what §3 and §4.2 expect. The operation tables were not re-read against §9.2 (UNKNOWN). |
| Source order | (0) the owner settlement of 2026-10-12 (top section); (1) code at the baseline; (2) `docs/HARD_RULES.md` > ticket > `docs/PRD.md` (`docs/PRD.md:6`); (3) owner doc pack of 2026-10-10, Part A (decisions newer than the repo docs) over Part B (repo docs). Part A holds no decision on note kinds, TODO identity or lifecycle. Its one relevant line is the 10 Oct note that Blinko is a one-to-one comparator, used here as a behaviour reference only (§0.3). |

## 0. How to read this file

### 0.1 Labels

| Label | Meaning |
|---|---|
| **ADOPTED-ENGINEERING** (`AE-n`) | An ordinary technical choice. This file records it so the coordinator can adopt it. It needs no owner input. |
| **OWNER-DECISION** (`OD-n`) | A product, privacy or retention choice that belongs to Amit. Each has a recommended default. **A default is not adopted until Amit confirms it.** Every AE rule in this file is written to hold under the recommended defaults. |
| EXTRAPOLATED | The author's inference (a number, a name, a mechanism) with no source. Replace it freely. |
| UNKNOWN | Not verifiable from the sources read. Nothing downstream may treat it as true. |

### 0.2 What this file covers

It names the exact fields, indexes, API arguments, results and errors proposed for each downstream slice, so no slice has to guess.

| Slice | Ticket | Files it will own (from the ticket) | This file's section |
|---|---|---|---|
| Note kind, archive and task-link schema (inactive) | #841 | `convex/schema.ts`, `convex/MIGRATIONS.md`, `convex/note_lifecycle_schema.test.ts` | §8, §4 |
| Bounded lifecycle and feed queries | #842 | `convex/notes.ts`, `convex/_generated/api.d.ts`, `convex/notes.test.ts` | §9.1, §6, §7 |
| Note ↔ task adapter | #856 | `convex/note_tasks.ts`, `convex/tasks.ts`, `convex/_generated/api.d.ts`, `convex/note_tasks.test.ts` | §5, §9.2 |
| Nested-tag schema with account lifecycle | #846 | `convex/schema.ts`, `convex/lib/accountDeletion.ts`, `convex/MIGRATIONS.md`, `convex/lib/accountDeletion.test.ts` | §8.3, §10 |
| Nested-tag API | #847 | `convex/note_tags.ts`, `convex/_generated/api.d.ts`, `convex/note_tags.test.ts` | §9.3, §10 |
| Keyword search filters | #849 | `convex/search.ts`, `convex/_generated/api.d.ts`, `convex/search.test.ts` | §9.4 |
| UI consumers | #843, #844, #845, #848, #850, #857 | `apps/web/components/workspace/*`, route files, e2e specs | §9.5 |

Out of scope, and unadopted here: resources and attachments (#838), note versions and history (#839), Markdown mode and the editor framework (#840), voice, the journal model (#739, #270), folders and projects (#260), backlinks, scoped RAG, any migration or backfill. Superseded 2026-10-12: the journal is a Markdown page (NT-07), and backlinks are computed from bodies (NT-08).

### 0.3 Third-party note

"Blinko" appears in the tickets as a comparator (owner pack Part A, 10 Oct). Nothing in this file copies its code or schema. Its licence was not checked by the author (UNKNOWN); `docs/HARD_RULES.md:41-43` already forbids committing code whose licence is not verified, and #444 says not to change licences or substitute a GPL fork. The three kinds below are the author's reading of the "Blinko/Note/TODO" wording in #841 and #843–#845 (EXTRAPOLATED). The owner's inventory file (`Tempo-Flow-Blinko-Ticket-Inventory-2026-10-09.md`, Library `libfile_23df3ad6ba9c8191a8ee8be9a355e50d`) was not available to the author (UNKNOWN); if it names different kinds, §4 changes and nothing else does.

## 1. Decision index

| ID | Decision | Label | Recommended default / status |
|---|---|---|---|
| AE-1 | Note kind is an optional stored literal `quick` or `todo`; an absent value means `note`. Kind is independent of `periodType` and `pageType`. | ADOPTED-ENGINEERING | §4 |
| AE-2 | Lifecycle is `deletedAt` (existing, trash) plus a new optional `archivedAt`. Trash outranks archive. Restoring from trash returns the note to its earlier archived or active state. | ADOPTED-ENGINEERING | §6 |
| AE-3 | Three new owner-scoped `notes` indexes (two feed, one trash) serve every feed view without a scan. The kind filter is index-backed in the Active view only. | ADOPTED-ENGINEERING | §8.1 |
| AE-4 | Feeds page with Convex `paginate`, default and maximum 20 per page (a To-do card may read up to six linked task rows, AE-22), and return safe summaries, never `body`. No counts API. The page read is byte-bounded as well (AE-21) and split-aware (AE-23). | ADOPTED-ENGINEERING | §9.1, §11.1 |
| AE-5 | Superseded 2026-10-12 (NT-02): a page task is its block. The typed `tasks` row linked to it is a derived index, keyed by two optional fields on `tasks` plus one index. No new table. | ADOPTED-ENGINEERING; OD-1 settled | §5 |
| AE-6 | Superseded 2026-10-12 (NT-01, NT-02): for a linked task the block is authoritative and the row is derived from it. A write to a linked task's content is a block write, and body edits propagate to the row. | ADOPTED-ENGINEERING | §5.5 |
| AE-7 | Link invariants: at most one live row per `(note, block)`, at most 50 live links per note, a block's row follows the block (superseded 2026-10-12, NT-04: no dangling link, and `tasks.restore` never revives a row without its block), repeat occurrences are new unlinked tasks, there is no unlink in v1. | ADOPTED-ENGINEERING | §5.4 |
| AE-8 | Superseded 2026-10-12 (NT-02): every task block a body write leaves in a page (up to 50, in body order) gets a derived row in the same transaction, whoever wrote it: the editor, "+ Task", the To-do composer, a Markdown edit or MCP. `note_tasks.link` is not offered. | ADOPTED-ENGINEERING | §5.6 |
| AE-9 | New mutations validate first, write last, and return `{ ok:false, code }` for expected failures. Existing functions keep their shapes; they only gain optional result fields. | ADOPTED-ENGINEERING | §9.0 |
| AE-10 | Hard gate: no row may carry a link until both strict task return validators accept it. Today they already disagree with each other. | ADOPTED-ENGINEERING | §5.9 |
| AE-11 | Search stays bounded: a fixed, byte-bounded scan window per call, continued and split with Convex's own cursors (AE-23), and every match in a window is returned. A `searchIndex` is a named alternative that needs a schema owner. Settled 2026-10-12 (NT-10): only a caller that passes `notesPage` gets the window; a call without it keeps today's behaviour. | ADOPTED-ENGINEERING | §9.4 |
| AE-12 | Superseded 2026-10-12 (NT-05): tags are `page-meta.data.tags` in the body, and `noteTags` and `noteTagLinks` may exist only as a derived index of them. Was: tags are relational: `noteTags` plus `noteTagLinks`, both enrolled in account deletion in the same slice. Limits, normalization, duplicate, cycle, idempotency and deletion rules are fixed in §10. Every write that adds live children to a parent (create, move, restore, and the promotion in remove) checks the parent's resulting child count before it writes. | ADOPTED-ENGINEERING | §10 |
| AE-13 | Only new Convex modules touch `convex/_generated/api.d.ts`. No ticket here runs codegen. | ADOPTED-ENGINEERING | §11.3 |
| AE-14 | Kind, archive, template and link fields need no new account-deletion enrollment. The two tag tables do. `noteBlocks` was already enrolled by #807 (merged). | ADOPTED-ENGINEERING | §6.5 |
| AE-15 | Tests must apply `args`/`returns` validators, multi-field index ranges and pagination. The current fake context cannot. | ADOPTED-ENGINEERING | §12.1 |
| AE-16 | No new unbounded read of a user-owned table. Existing ones are listed with an owner and stay as they are until that owner acts. | ADOPTED-ENGINEERING | §11.2 |
| AE-17 | The Trash view takes the client clock (`nowMs`), hides rows older than the 30-day restore window, and does not erase them. | ADOPTED-ENGINEERING | §6.3 |
| AE-18 | Template pages are kept out of every feed and Trash range by a stored `isTemplate` discriminator in the index prefix, never by a filter after the index. | ADOPTED-ENGINEERING | §8.1 |
| AE-19 | Every bounded read of a note's linked tasks fixes `deletedAt` in the index prefix: the task-link index carries `deletedAt` before `sourceBlockId`, so soft-deleted links never enter a live read. | ADOPTED-ENGINEERING | §5.3, §8.2 |
| AE-20 | A tag link carries `linkedAt`, set on insert and reset on revival, and `notesByTag` orders by it. Settled 2026-10-12: best-effort, because a rebuild from bodies resets it (NT-05). | ADOPTED-ENGINEERING | §8.3, §10.4 |
| AE-21 | A page of notes never reads an unbounded number of bytes. Convex reads whole documents, so the returned card being small does not make the read small. Every paginated read of `notes` carries server-set `maximumRowsRead` and `maximumBytesRead`; the card's `preview` is a stored derived field written with every body write (rows without one are projected on read); only single-note views read `body` into a response. | ADOPTED-ENGINEERING | §8.6, §11.1 |
| AE-22 | Every row that carries a task link is size-capped: `note_tasks.link` admits an existing task only within the caps, and `updateTaskForUser` enforces them on linked rows. Readers of linked rows (`taskPreview`, `listForNote`, the L1/L6/L8 checks) use `take(n)`, which has no byte option, so the caps are what bound their bytes. Unlinked and legacy rows are not capped and are never read by those readers. Settled 2026-10-12: the `link` admission goes away with `link`, and derived rows are bounded by the codec (§5.10). | ADOPTED-ENGINEERING | §5.10 |
| AE-23 | Every paginated API that sets `maximumRowsRead`/`maximumBytesRead` (`notes.feed` in all three views, `note_tags.notesByTag`, `note_tasks.list`, the `search.all` note scan) accepts `endCursor` and returns `continueCursor`, `isDone`, `splitCursor` and `pageStatus` unchanged. A `SplitRequired` result carries no items, and the caller replaces it with the two split ranges. | ADOPTED-ENGINEERING | §11.1 |
| OD-1 | Is the typed `tasks` row the canonical TODO identity for core web, or do typed tasks later retire into blocks (the 20 Sep design)? | OWNER-DECISION, **DECIDED 2026-10-12 (decision 1)** | The block in `notes.body` is the truth, and a linked `tasks` row is its derived index (NT-02). Nothing is retired or migrated. |
| OD-2 | Does archiving or trashing a note change its linked tasks? | OWNER-DECISION, **default adopted 2026-10-12** | No. The tasks stay live in Today, the planner, Tasks and TODO, with a provenance label. |
| OD-3 | User-facing names for the kinds, and whether a separate quick kind exists. | OWNER-DECISION, **default adopted 2026-10-12** | Stored `quick`/`note`/`todo`; labels "Quick note", "Note", "To-do", unless the v3 design copy names them otherwise. Hebrew strings are the owner's. |
| OD-4 | What the Trash UI may promise. | OWNER-DECISION, **default adopted 2026-10-12** | "You can restore this until [date]. After that it can't be restored from here." Never "permanently deleted" or "erased". No empty-trash. |
| OD-5 | Rows soft-deleted by account deletion look like trashed notes after a sign-in restore. Show them as they are? | OWNER-DECISION, **default adopted 2026-10-12** | Yes, no special UI, no claim that account restore brings data back. Restoring one rebuilds its derived rows (NT-09). |
| OD-6 | What happens to child tags when a parent tag is deleted? | OWNER-DECISION, **default adopted 2026-10-12** | Children move up to the deleted tag's parent. No cascade in v1. It applies once a nesting representation exists (NT-05). |
| OD-7 | Does selecting a parent tag also show notes tagged only with its children? | OWNER-DECISION, **default adopted 2026-10-12** | No. Exact tag only in v1. |
| OD-8 | Does typing `- [ ] item` in Markdown create a task? | OWNER-DECISION, **DECIDED 2026-10-12 (decision 4)** | No. It stays plain text (NT-06). |

Not decided here and explicitly unadopted: §13.2.

## 2. Baseline: what exists today

### 2.1 Tables

`notes` (`convex/schema.ts:331-362`)

| Field | Type | Note |
|---|---|---|
| `userId` | `Id<"users">` | |
| `title`, `body` | `string` | No length bound in `notes.create`/`notes.update` (`convex/notes.ts:100-120`, `:144-167`). MCP caps `body` at 100000 (`convex/lib/mcp/tools.ts:112`, `:127`). |
| `pinned` | `boolean`, required | |
| `periodType` | `daily \| weekly \| monthly \| none`, required | |
| `pageType?` | `daily \| weekly \| project \| plain \| template` | Added by #826 (merged). No writer sets it yet. |
| `date?` | `string` (local `YYYY-MM-DD`) | Added by #826. |
| `aiGenerated?` | `boolean` | |
| `createdAt`, `updatedAt` | `number` | |
| `deletedAt?` | `number` | Soft delete. |

Indexes: `by_userId`, `by_userId_pinned`, `by_userId_updatedAt`, `by_userId_deletedAt`, `by_userId_deletedAt_pageType_date` (`convex/schema.ts:358-362`).

There is **no** `kind`, `archivedAt`, `isTemplate`, `revision`, tag, or task link on `notes` (`convex/schema.ts:331-362`). (Since this baseline, #882 added `revision` as an optional field with no writer, now `convex/schema.ts:354-358`.)

`noteBlocks` (`convex/schema.ts:365-465`) is the derived index of `json tempo` blocks added by #826. It has no writer and no reader at the baseline: `grep noteBlocks` finds only the schema and the account-deletion files, and `parseTempoBlocks` (`packages/utils/src/blocks.ts:201`, re-exported by `convex/lib/blocks.ts`) has no caller outside tests and that re-export. #807 (merged) put it in `USER_OWNED_TABLES` (`convex/lib/accountDeletion.ts:12-29`), so account deletion soft-deletes its rows. Since this baseline, #886 added read-only guards in `convex/lib/pagePrivacy.ts` that read its live rows through `by_userId_noteId_deletedAt_position`. There is still no writer, and no index on `(userId, noteId, deletedAt, blockId)` (NT-09, §8.7).

`tasks` (`convex/schema.ts:214-260`): `title`, `description?`, `status` (`todo | in_progress | done | cancelled`), `priority`, `energy?`, `timeEstimate?` (ms, `:228-229`), `flexibility?` (`fixed | elastic`, absent = elastic, `:230-231`), `repeatCfgId?`, `parentTaskId?`, `projectId?`, `projectName?`, `dueAt?`, `completedAt?` (`:240-241`), `checklist?` (sub-steps inside one task, `:242-251`), `createdAt`, `updatedAt`, `deletedAt?`. Indexes `by_userId`, `by_userId_status`, `by_userId_dueAt`, `by_userId_projectId`, `by_userId_deletedAt` (`:256-260`). There is no source-note or source-block field.

`Id<"tasks">` is already the identity everything else points at: `focusBlocks.taskId` (`:323`), `dayPlans.topTaskIds` (`:503`), `timeBlocks.taskId` (`:534`), `coachProposals.taskIds` (`:645`), `tasks.parentTaskId` (`:235`).

The block codec's task block is `{ title, durationMin, status: now | later | done, order, inelastic, reason?, scheduledAt?, doneAt? }`, built with `.strict()` (`packages/utils/src/blocks.ts:32-43`, `:58-62`). It has no task id field. Adding one is a codec change (the codec is #786's, moved to `@tempo/utils` by the shared-codec ticket) and belongs to a codec ticket, not here.

### 2.2 Current notes API (`convex/notes.ts`)

| Function | Lines | Behaviour that matters |
|---|---|---|
| `notes.list` / `listNotesForUser` | `:12-48` | `collect()` of every row of the owner via `by_userId_updatedAt` (`:29-33`), then filters `deletedAt === undefined` (`:35`), `pinnedOnly`, and a case-insensitive substring match on `title` and `body` in memory (`:40-46`). Returns full rows including `body`. Unbounded. No `returns` validator. |
| `notes.get` | `:50-60` | Returns `null` for foreign or soft-deleted (`:55`). Throws on a malformed id. |
| `notes.getSafe` | `:62-75` | Any string in; `null` for bad id, foreign or soft-deleted (`:67-71`). |
| `notes.create` / `createNoteForUser` | `:77-120` | Inserts with `pinned` default false and `periodType` default `none` (`:111-119`). |
| `notes.update` / `updateNoteForUser` | `:122-167` | Throws `Note not found` for foreign or soft-deleted (`:156-158`); patches title, body, pinned, periodType (`:159-165`). Archived-state does not exist yet. |
| `notes.togglePin` | `:169-184` | Same not-found rule. |
| `notes.remove` | `:186-198` | Sets `deletedAt` and `updatedAt` (`:195`); returns `{ success: true, undoUntilMs }` (`:196`). |
| `notes.restore` | `:200-215` | Foreign or missing → throws (`:205-207`). Not restorable → `{ success: false }` (`:209-211`). Else clears `deletedAt`, bumps `updatedAt` (`:212`). The same `{ success: false }` is returned for a live note and for an expired one. |

### 2.3 Every reader and writer of `notes` rows

| Where | Direction | Filter today | Bounded | Exposes raw `body` |
|---|---|---|---|---|
| `convex/notes.ts:24-48` `listNotesForUser` → `notes.list` | read | `deletedAt` only | no | yes |
| same helper → MCP `notes_list` (`convex/mcpTools.ts:80-85`; tool def `convex/lib/mcp/tools.ts:84-101`) | read | `deletedAt` only; `limit` default 50 applied after the full read (`convex/mcpTools.ts:56`, `:84`) | no | yes (`noteView`, `:41-49`) |
| `convex/notes.ts:50-75` `get`, `getSafe` | read by id | `deletedAt` | yes | yes |
| `convex/notes.ts:77-120` `create`, `convex/mcpTools.ts:160-167` `note_create` | write (insert) | n/a | n/a | n/a |
| `convex/notes.ts:122-167` `update`, `convex/mcpTools.ts:168-179` `note_update` | write (body, title, pin) | `deletedAt` | n/a | n/a |
| `convex/notes.ts:169-184` `togglePin` | write | `deletedAt` | n/a | n/a |
| `convex/notes.ts:186-215` `remove`, `restore` | write | see §2.2 | n/a | n/a |
| `convex/templates.ts:158-179` `applyToNote` (`ctx.db.insert("notes", …)` at `:169`) | write (insert with template body) | n/a | n/a | n/a |
| `convex/search.ts:80-83`, `:99-109` `search.all` notes group | read | `deletedAt` only | no (`collect()` of every note and task, habit, goal) | snippet cut from raw `body` (`:57-68`, `:108`) |
| `convex/activity.ts:42-110` `listActivityForUser` (`:48`, `:68-75`) | read | `deletedAt` only | no | no |
| `convex/analytics.ts:123-148` `overview` (notes at `:128-131`) with `computeOverview` (`:41-83`) | read | **none**: neither the handler nor `computeOverview` mentions `deletedAt` (`grep deletedAt convex/analytics.ts` is empty), so trashed notes and tasks are counted | no | no |
| `convex/lib/accountDeletion.ts:81-104`, `:186-205` | write (soft delete) | live rows only | no (`collect()`) | no |
| Web: `apps/web/components/notes-pages/NotesList.tsx:28-32` (list, create, togglePin, remove, restore; preview at `:214`), `apps/web/components/notes/NotesScreen.tsx:71-74`, `:216-222` (list, getSafe, update, togglePin, remove, restore; `snippet(body)` at `:43-47`), `apps/web/components/global-search/SearchScreen.tsx:38`, `apps/web/app/(tempo)/activity/page.tsx:27`, `apps/web/components/template-run/TemplateRun.tsx:130` | callers | | | NotesList and NotesScreen render slices of raw `body` |

`api.analytics.overview` has no web caller (`grep api.analytics apps` finds only `insightsSummary`, `apps/web/components/insights/InsightsScreen.tsx:185`), so the miscount is dormant.

There is no data-export function in `convex/` (no `dsr.ts`, no `requestDataExport`), although `docs/HARD_RULES.md:235-236` describes one. Export of kinds, tags and links is therefore owned by #273 and is UNKNOWN here.

`apps/mobile/app/(tempo)/(tabs)/notes.tsx:13` renders an empty state and reads nothing.

### 2.4 Every reference to a task that matters for identity

| Where | What |
|---|---|
| `convex/tasks.ts:173-195` `createTaskForUser` | The single insert helper for typed tasks. Defaults: `status todo`, `priority medium`, `energy medium` (`:183-185`). Used by `tasks.create` and MCP `task_create`. |
| `convex/tasks.ts:320-351` `createQuick` | Separate insert; truncates a title over 280 to `…` (`:317`, `:335-336`). |
| `convex/brain_dump.ts:134-164` `acceptPlanForUser` | Inserts tasks directly (`:153`). |
| `convex/tasks.ts:405-455` `spawnRepeatAfterCompletion` | On completion of a repeating task, inserts a new `tasks` row with an explicit field list (`:427-450`). It copies no unknown field, so a link would not be inherited (verified by reading; must be kept true and tested, §12). |
| `convex/tasks.ts:284-315` `remove`, `restore` | Soft delete / restore; `restore` has a strict `returns: v.object({ success })` (`:301`). |
| `convex/tasks.ts:354-376` `listToday`; `:121-135` `listDueInRange`; `:53-69` `list` | Return full rows through the strict `taskReturnValidator` (`:29-51`, used at `:64`, `:126`, `:359`). Each starts from a `collect()` of all live tasks (`:87-90`, `:129-132`, `:368-371`). |
| `convex/dayPlans.ts:29-64` `taskValidator`, used by `listCarryOver` (`:189-208`, `returns` at `:191`) | A second strict copy of the task shape. It is **already out of step**: `taskReturnValidator` has `flexibility` (`convex/tasks.ts:39`), `taskValidator` does not (`convex/dayPlans.ts:30-64`). |
| `convex/dayPlans.ts:86-96` `assertOwnedTasks`, `:210-225` `moveTaskToDay` | The planner references tasks by `Id<"tasks">` and only patches `dueAt`. |
| `convex/coach.ts:141-146`, `:302-306` | Reads tasks by status index. `convex/coach.ts:238` returns `{ taskId, title, minutes }` per proposal task. |
| `convex/mcpTools.ts:27-39` `taskView`, `:94-123` `today_plan_get`, `:135-159` `task_create`/`task_update` | Explicit field lists; a new field does not leak or break them. |
| `convex/search.ts:85-88`, `convex/activity.ts:47`, `convex/analytics.ts:124-127`, `:204-208` | Whole-collection reads. |
| Web: Today, tasks, planner, brain dump, coach proposal components | Call `api.tasks.*`, `api.dayPlans.*`, `api.timeBlocks.*` (e.g. `apps/web/components/today/TodayTaskList.tsx`, `apps/web/components/tasks/TaskViewsScreen.tsx`, `apps/web/components/day-plan-panel/DayPlanPanel.tsx`) | |

### 2.5 Lifecycle facts

| Fact | Source |
|---|---|
| UI Undo window: 5 minutes. `undoUntil(deletedAt) = deletedAt + 300000`. | `convex/lib/softDelete.ts:1-2`, `:7-9`; returned by `notes.remove` (`convex/notes.ts:196`); consumed by `apps/web/components/notes/UndoDeleteToast.tsx:5-7`, `:23-29` |
| Server restore eligibility: 30 days, **inclusive**: `now - deletedAt <= GRACE_MS`. | `convex/lib/softDelete.ts:4-5`, `:11-14`; boundary tests `convex/softDelete.test.ts:14-22` |
| The two clocks are different constants and different consumers. The toast deadline is never the server deadline. | `convex/lib/softDelete.ts:2` vs `:5`; `docs/contracts/B02.md:5-7` |
| Account deletion soft-deletes every live row of `USER_OWNED_TABLES` (tasks, notes, habits, … notifications) with one `deletedAt`/`updatedAt` and skips rows that already have `deletedAt`. | `convex/lib/accountDeletion.ts:12-29`, `:102-104`, `:186-205` (skip at `:199`) |
| Sign-in restore patches only the **user** row when the account was deleted within 30 days. Owned rows keep their `deletedAt`. | `convex/auth.ts:106-115`; `convex/lib/accountDeletion.ts:48-62` |
| An inactive account cannot call any `requireUser` function. | `convex/lib/requireUser.ts:64-66`; MCP checks the same (`convex/mcp.ts:120`) |
| No scheduled job hard-deletes anything. `convex/` has no `crons.ts` and no `cron` use. `docs/HARD_RULES.md:237` describes a post-30-day hard delete; it does not exist. | `ls convex`; `grep -ri cron convex` |
| This source evidence does not guarantee physical deletion at 30 days, indefinite retention, account restoration, or that the deployed backend matches this revision. | #837 clarification of 2026-10-09 |

### 2.6 What does not exist at the baseline

Note kinds; archive; note revisions or a page-operation ledger (#831 is a proposal; #828's inactive schema merged after this baseline as #882, with no writer); `notes.save`, `getOrCreateToday`, `patchBlock`, `undo` (#787 is a proposal); the safe text projection (#803, #804 are held); any tag; any link between a block and a task; any pagination in `convex/` (`grep paginate` is empty), although `.paginate()` and `paginationOptsValidator` exist in the installed `convex` 1.32.0 typings; any `searchIndex`; any `ConvexError` use. `convex-test` 0.0.38 is pinned by #827 (`package.json:45`) and is imported by exactly one test, `convex/lib/agentComponent.test.ts:7` (#815), which runs the Agent component's functions under `bun test` and calls no Tempo function (§12.1). `grep paginate convex` is still empty: that test only passes `paginationOpts` to the component's own paginated queries.

## 3. Prerequisites and write order

These paths are shared. Writers run **serially**, in the order below. Admission must re-check each path is free.

| Path | Serial writers, in order |
|---|---|
| `convex/schema.ts` | #826 (merged) → #807 (merged) → #828 (merged, #882) → **#841** (also adds `notes.isTemplate`, the `tasks` link fields and indexes, and the `noteBlocks` live-row index of §8.7) → #846 |
| `convex/MIGRATIONS.md` | same chain |
| `convex/lib/accountDeletion.ts` + test | #807 (merged) → #828 (merged, #882) → #808 (guards merged, #886) → #846 |
| `convex/notes.ts` | #787 → **#842** |
| `convex/tasks.ts` | validator-parity slice (§5.9) → **#856** |
| `convex/dayPlans.ts` | validator-parity slice (§5.9). No ticket owns it today. |
| `convex/search.ts` | #804 → #849 |
| `convex/_generated/api.d.ts` | whoever adds a new module (§11.3) |

Other CORE-WEB schema writers (#851 resources, #860 voice) are ordered by the coordinator; this contract does not rank them.

What this contract needs that does not exist yet (every item UNKNOWN until merged code is read):

| Need | From | Used for |
|---|---|---|
| Block insertion and body write with revision and receipt | #787 (`notes.save`, `patchBlock`, `undo`), #828 D1–D3 | `note_tasks.addTask`, `captureTodo`, `undoCreate` |
| `requestId` format `req_` + 26-character ULID and the receipt rule "same id and digest returns the original receipt" | #828 D2–D3 | the same three functions. This file adds no second ledger. |
| Safe text projection (prose plus permitted block fields, never raw fences): `projectPageText` | #803 (PR #884, open) | the stored `notes.preview` behind `NoteCard.preview` (§8.6), search snippets |
| `noteBlocks` rows, linked task rows and the other derived indexes maintained atomically with `body`, plus a rebuild helper (NT-01, NT-09) | #787 | the task rebuild, `notes.restore`, `source.state` |
| Account-lifecycle enrollment of the operation tables (`noteBlocks` itself was enrolled by #807, merged) | #828, #808 | not repeated here |
| Test runtime that applies validators and models index ranges | #827 pins `convex-test`; #815 runs the Agent component under `bun test`; Tempo's own modules, `returns` validators and multi-field index ranges UNKNOWN | §12.1 |

If a merged shape differs from what is written here, this file is revised before the dependent slice is admitted. It does not bend the other ticket.

## 4. Note kinds

### 4.1 Definition (AE-1)

| API value | Stored as | Meaning (EXTRAPOLATED from #841, #843–#845) |
|---|---|---|
| `note` | field absent | Long-form Markdown page. Every existing row. |
| `quick` | `"quick"` | Short capture shown as a card. May have an empty `title`; the card shows the safe preview. |
| `todo` | `"todo"` | A note whose purpose is task items. It may hold zero or more linked task blocks (§5). Zero is valid. |

- Schema: `kind: v.optional(v.union(v.literal("quick"), v.literal("todo")))`.
- The API accepts and returns all three values. Writing `note` stores nothing (`kind: undefined`), the same pattern `deletedAt` and `flexibility` already use (`convex/lib/softDelete.ts:12-14`, `convex/schema.ts:230-231`). That keeps legacy rows valid with no backfill and lets "kind is `note`" be an index equality on `undefined`, which the repo already relies on (`convex/tasks.ts:89`).
- Storage names are neutral. The name "Blinko" is never stored (OD-3 owns user-facing labels).
- `kind` is independent of `periodType` (what period a page covers, `convex/schema.ts:336-341`) and `pageType` (what a page is for, `:342-350`). A Today page is expected to be `pageType: daily` with `kind` absent (EXTRAPOLATED; #787 decides how it is created).
- Pages with `pageType: "template"` (TRD module pages, `docs/TRD.md:92`) are not user notes. The feed (every view), Trash and search exclude them **by an index prefix, not by a filter after the index**: a stored `isTemplate` discriminator (§8.1) is `true` exactly when `pageType` is `template` and absent otherwise, and every feed and Trash range fixes `isTemplate = undefined`. No writer sets `pageType` at the baseline (`grep pageType convex` finds only the schema and the codec), so the rule is vacuous until one does.

### 4.2 Legacy defaults

| Field | Absent means | Backfill |
|---|---|---|
| `kind` | `note` | none |
| `archivedAt` | not archived | none |
| `pageType`, `date` | not a structured page | none (#826) |
| `isTemplate` | not a template page | none. Written only together with `pageType` (§8.1). |
| `notes.revision` | revision 0 (#828 D1; merged as #882, optional, no writer) | none. **Not added by this contract.** |
| `tasks.sourceNoteId`, `tasks.sourceBlockId` | task has no note anchor | none |

### 4.3 Conversion

`notes.setKind` (§9.1) changes `kind` and `updatedAt` only. It never changes `body`, `title`, `pinned`, `periodType`, tag memberships, linked tasks or `createdAt`, and never creates, deletes or links a task. Converting to `todo` does not turn text into tasks; converting away from `todo` does not remove tasks. Converting to the same kind is a no-op: no write, no `updatedAt` change.

### 4.4 Composer gating

A composer shows a kind only when the API behind it exists (#843 step 2). `quick` and `note` are available with #842. `todo` capture with a task is available only with `note_tasks.captureTodo` (#856). Until then the To-do option is hidden, not faked.

## 5. TODO identity

### 5.1 The problem in the sources

Three stores describe a task today or in the plan:

1. The typed `tasks` row (§2.1). Today, the planner, MCP, coach proposals and `/tasks` all use it.
2. The task block inside `notes.body` (PRD F-02, F-05: `docs/PRD.md:91`, `:94`; TRD `docs/TRD.md:83-86`). The block exists as a codec but nothing writes it (§2.1).
3. The "retire typed tasks into blocks" direction (`docs/BACKEND-SCHEMA.md:74-85`), with the open question recorded at `docs/BACKEND-SCHEMA.md:126-` ("Which is the long-term model: UNKNOWN. Amit decides").

#792 mounts the Today page above the unchanged typed Today strips and says old tasks do not synchronise into blocks. #787's DONE says no duplicate task row is created. #452 requires "the same item remains the same ID in TODO, Today and planner after reload". The planner references `Id<"tasks">` (§2.1), so only a typed row can satisfy #452 without rewriting every planner table.

### 5.2 Decision (AE-5, conditional on OD-1)

> **The TODO identity is `tasks._id`.** A task block in a note is an anchor to that row. A block that is not anchored is a page-local item and is not a TODO in the sense of #452.

> **Superseded 2026-10-12 (NT-02):** a page task is its block. The linked `tasks._id` is the stable id of the block's derived row, which is what keeps #452's "same ID in TODO, Today and planner" true.

OD-1 was settled on 2026-10-12 (decision 1): the block is the truth and the row is derived (NT-02). §5.3 and §8.2 stand as the shape of that index; the rules in §5.4 to §5.6 that made the row authoritative are superseded where marked.

### 5.3 The link (two fields, one index, no table)

```ts
// convex/schema.ts — tasks (PROPOSED, added by #841)
sourceNoteId: v.optional(v.id("notes")),
sourceBlockId: v.optional(v.string()),   // "blk_" + 26-char ULID, validated by the writer
// index: deletedAt BEFORE sourceBlockId (binding order, §8.2)
.index("by_userId_sourceNoteId_deletedAt_sourceBlockId",
       ["userId", "sourceNoteId", "deletedAt", "sourceBlockId"])
```

- Soft-deleted tasks keep their link fields (`tasks.remove` does not clear them), so a removed task can be drawn as a ghost and `tasks.restore` can re-attach it (L6). Settled 2026-10-12: a removed row comes back only with its block (NT-04). That is why the index carries `deletedAt`, and carries it **before** `sourceBlockId`: every bounded read of a note's links fixes `deletedAt` (live: `undefined`; removed: `>= 0`), so a note with many removed linked tasks never inflates a live read. An index without `deletedAt` (the earlier `["userId", "sourceNoteId", "sourceBlockId"]`) cannot give a bounded, correct live read. This is a schema requirement for #841.
- Both fields are set together or both absent. Only the derived-index step of the body writer writes them (settled 2026-10-12, NT-02). `tasks.create`, `tasks.update`, `createQuick`, MCP and the coach never accept them (a client cannot forge a link).
- A task has at most one source note and block (v1). A block has at most one task.
- The block id is stable and never reused within a note (`docs/BACKEND-SCHEMA.md:68-73`; codec `blockId` regex `packages/utils/src/blocks.ts:22`). Undoing a block removal brings back the same id, so the link re-attaches by itself.
- The key is `(noteId, blockId)`. Copying a block's text into another note, or duplicating a note, produces blocks in a different note, which no row points at. They are page-local. Settled 2026-10-12: under NT-02 such a block gets its own derived row in that note, keyed by that note.

### 5.4 Invariants (AE-7)

| # | Invariant | How it holds |
|---|---|---|
| L1 | At most one **live** row (`deletedAt` undefined) has a given `(userId, sourceNoteId, sourceBlockId)`. | Checked inside the creating transaction on `by_userId_sourceNoteId_deletedAt_sourceBlockId`, range `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined).eq(sourceBlockId, b)`, read with `take(2)` (two rows is corrupt data and fails the call). Convex indexes are not unique; the check and the insert are one transaction. |
| L2 | A live row has both link fields or neither. | The only writers set both. A test reads every inserted and patched row. |
| L3 | A link never crosses owners. | Every lookup starts with `userId`; a foreign `noteId` or `taskId` is reported as not found, never as foreign. |
| L4 | Retrying any link operation does not create a second row. | Natural key `(noteId, blockId)` for row-only operations; `requestId` receipts for operations that also write the body (§9.2). |
| L5 | Superseded 2026-10-12 (NT-04): when a block leaves the body, its row is soft-deleted in the same transaction, and it is revived with the same `_id` when the block comes back. A trashed note keeps its rows live (OD-2) and reports `source.state = note_trashed`. Was: a dangling link is allowed, and deleting a line of Markdown never deletes a task. | The body writer's derived-index step. |
| L6 | Superseded 2026-10-12 (NT-04): `tasks.restore` on a linked row whose block is not in the body returns `{ success: false }`; the row comes back only with its block. Was: `tasks.restore` never revives a link that was taken meanwhile, and never revives one past L8. | Was (superseded): a restored row with link fields is checked before the patch, in this order: (1) another live row now holds the same `(note, block)` (the same live-prefix read as L1, `take(2)`); (2) the note already has `MAX_LINKED_TASKS_PER_NOTE` live links (the L8 read, `take(51)`; the row being restored is not live yet, so it is not counted). If either holds, the restore still succeeds but writes `sourceNoteId` and `sourceBlockId` as `undefined` in the same patch and returns `linkCleared: true` with `linkClearedReason: "block_taken"` or `"note_task_limit"`. The task comes back unlinked; its block stays in the body as a page-local item. Restore never fails because of a link. |
| L7 | A repeat occurrence is a new logical task and carries no link. | `spawnRepeatAfterCompletion` copies an explicit field list (`convex/tasks.ts:427-450`) and must keep doing so. The original stays linked, done. |
| L8 | **Live** linked tasks per note are bounded. | `MAX_LINKED_TASKS_PER_NOTE = 50` (EXTRAPOLATED). The check is `take(51)` on `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined)` of the L1 index, so removed rows are neither read nor counted, and a note may carry any number of removed linked tasks. The 51st live link is `NOTE_TASK_LIMIT`. Every path that makes a link live runs this check: `link`, `addTask`, `captureTodo` (a new note, so it always passes) and `tasks.restore` (L6, which clears the link instead of failing). Removed rows are read only by `listForNote`, under their own cap (§9.2). Settled 2026-10-12: the derived-index step applies the bound in body order (NT-02). |
| L9 | No unlink in v1. | To detach, delete the task or remove the block. Unlink would need a body write to refresh the snapshot; it is unadopted (§13.2). |
| L10 | Archived notes accept link operations. Trashed notes do not. | Same rule as `updateNoteForUser` (`convex/notes.ts:156`), extended by AE-2. |
| L11 | Every row that carries link fields, live or removed, is within the linked-task caps. | Settled 2026-10-12: derived rows hold only block-derived fields and defaults (§5.10). Was: admission in `note_tasks.link` and the cap check in `updateTaskForUser` (§5.10, AE-22). No row carries link fields at the baseline (§4.2), so there is no legacy linked row to grandfather. |

### 5.5 Field authority and state mapping (AE-6)

Superseded 2026-10-12 (NT-01 to NT-03): the **block** is the truth for every field it can carry (title, done-ness, open bucket, due, estimate, fixed or elastic, order, reason), and the row is derived from it. Fields only a row can hold (priority, energy, project, checklist, repeat) take the `createTaskForUser` defaults for a linked task and cannot be written to it (NT-02). `cancelled` and `in_progress` are refused for a linked task (NT-03). The table below is kept as the field mapping: where its Authority column says "row", read "block". Was: after a link exists, the row is the truth for everything it can represent.

| Concept | Row | Block (`data.*`) | Authority | Rule |
|---|---|---|---|---|
| Title | `title` | `title` | row | Block is a snapshot taken at link time. A new linked title is 1–280 code units after trim (the stricter existing bound: `convex/tasks.ts:317`, `convex/lib/mcp/tools.ts:58`). A block title of 281–500 is rejected with `TITLE_INVALID`, never truncated. |
| Done-ness | `status`, `completedAt` | `status: "done"`, `doneAt` | row | Block value is a snapshot. |
| Open sub-state | `todo`, `in_progress` | `now`, `later` | row for open/done/cancelled; **body** for the `now`/`later` bucket | `now`/`later` is page pacing. It is never copied to the row and means something only while the row is open. |
| Cancelled | `cancelled` | no equivalent | row | Rendered as a cancelled item. |
| Due | `dueAt` | `scheduledAt` (ISO with offset) | row | |
| Estimate | `timeEstimate` (ms) | `durationMin` (minutes) | row | `durationMin × 60000` at link time. |
| Fixed or elastic | `flexibility` | `inelastic` | row | `inelastic: true` ↔ `fixed`. |
| Position in the page | none | `order` | body | |
| Reason | none | `reason` | body | Not mapped. |
| Priority, energy, project, checklist, repeat | row | none | row | A block cannot say them. |

Rules:

- **Readers read the block.** Settled 2026-10-12: anything that shows a linked block takes its values from the block, and the row, re-derived on each body write, agrees with it. Was: readers overlay the row.
- **Typed-form writes go to the block.** Settled 2026-10-12 (NT-02): `tasks.update`, `toggleCompletion`, `moveTaskToDay`, MCP `task_update` and the coach, on a linked task, write its block through the page writer (#787 `patchBlock`), with a body revision and a receipt, and the row is re-derived. Was: **typed-form writes never rewrite a body.** `tasks.update`, `toggleCompletion`, `moveTaskToDay`, MCP `task_update` and the coach change the row only. No body revision, no operation receipt, no Undo entry. A tick made inside a note on a linked block is the same call, `tasks.toggleCompletion`. Its undo is ticking again.
- **Body edits propagate.** Settled 2026-10-12: a body save, an MCP `note_update` or a Markdown edit that changes a linked block's `data` re-derives the row in the same transaction. Was: they left the row alone.
- **Known limitation.** Superseded 2026-10-12: there is no snapshot to go stale, because the row is derived from the block. Was: the body keeps the link-time title, so text exported from the body or matched by note search shows that title. Task search matches the row. Refreshing snapshots would need the page ledger to participate and is unadopted (§13.2).
- **Deriving a row from a block** (settled 2026-10-12; was "promoting an existing block" through `note_tasks.link`) maps: title → `title`; `status: done` → `done` with `completedAt` = parsed `doneAt` or now, otherwise `todo`; `scheduledAt` → `dueAt`; `durationMin` → `timeEstimate`; `inelastic` → `flexibility`. Priority and energy take the `createTaskForUser` defaults (`convex/tasks.ts:183-185`).

### 5.6 Operations (AE-8)

Superseded 2026-10-12 (NT-02, NT-04): rows are derived from blocks, so "Make a page-local block a TODO" and "Attach an existing task" (`note_tasks.link`) are not offered. On a linked task, "Tick, untick, rename, reschedule" and "Delete, restore a task" write its block. "Delete a line of Markdown that holds a block" soft-deletes the block's row. "Undo an add or a capture" is the page Undo, and the row follows the block.

| Action | Entry point | Row | Body | Atomic | Idempotent by |
|---|---|---|---|---|---|
| Add a new linked task to a page | `note_tasks.addTask` | insert, linked (through `createTaskForUser`) | insert block (via #787) | yes | `requestId` |
| Capture a To-do note | `note_tasks.captureTodo` | insert, linked | create note with one block | yes | `requestId` |
| Make a page-local block a TODO | `note_tasks.link` without `taskId` | insert, linked | none | yes | `(noteId, blockId)` |
| Attach an existing task to a page-local block | `note_tasks.link` with `taskId` | patch link fields | none | yes | `(noteId, blockId)` |
| Tick, untick, rename, reschedule | existing `tasks.*`, `dayPlans.moveTaskToDay` | patch | none | n/a | existing |
| Delete, restore a task | `tasks.remove`, `tasks.restore` (+ hook, L6, which also applies L8) | soft delete / restore; restore may clear the link | none | n/a | existing |
| Change note kind | `notes.setKind` | none | none | n/a | same-kind no-op |
| Delete a line of Markdown that holds a block | `notes.update` / #787 | none | change | n/a | n/a. Link dangles (L5). |
| Undo an add or a capture | `note_tasks.undoCreate` | soft-delete the created row | page undo or note removal | yes | `requestId` |
| Complete a repeating linked task | existing | new **unlinked** row (L7) | none | n/a | existing |

Requirement behind `undoCreate`: undoing an add or a capture must not leave a live linked task without its block, or a live task whose only source was the undone capture. If #787's undo cannot be combined with a row change in one transaction, `addTask` and `captureTodo` are blocked, not shipped without Undo.

Page-local blocks remain legitimate (#792, #787). Settled 2026-10-12: a valid task block is page-local only past the 50-block bound (NT-02). The UI must label them honestly and must not claim they appear in Today or the planner (#792 step 3).

### 5.7 Interactions

| Feature | Effect of the link |
|---|---|
| Today (`tasks.listToday`), planner (`dayPlans.topTaskIds`, `timeBlocks.taskId`, `focusBlocks.taskId`), coach proposals | None. They already hold `Id<"tasks">`. This is the point of AE-5. |
| MCP `task_update`, `task_create` | `task_update` on a linked task changes the row, so every view agrees. `task_create` makes an unlinked task. Neither gains link arguments. |
| AI-created tasks | Still go through confirm / edit / reject (`docs/HARD_RULES.md:13`, `:132`; #857 step 2). The public `note_tasks.*` mutations are direct-user actions. The proposal flow (#793) calls the same internal helper after confirmation. Out of scope here. |
| `tasks.checklist` | Sub-steps inside one task. It is not a list of TODO items and is not mapped to blocks. |
| Repeat | L7. No new recurrence engine (#856 DO NOT). |

### 5.8 Alternatives considered

| Alternative | Why not |
|---|---|
| Block is the identity; typed tasks retire into blocks (20 Sep design) | Every planner table and MCP tool points at `Id<"tasks">` (§2.4). It needs a data migration, which #787 and #856 forbid, and it is the open question OD-1. Settled 2026-10-12: partly adopted. The block is the truth (decision 1), and typed rows stay as its derived index, so nothing is migrated. |
| Note-level pointer, `notes.taskId` (one task per To-do note) | Cannot hold several items in one note or in a Today page. Block-level anchors cover it. |
| New relation table `noteTaskLinks` | Works, supports one task in many notes, and leaves `tasks` rows untouched, so it avoids the validator gate in §5.9. It costs a new table with account-lifecycle enrollment and a longer serial schema chain, and #841 says to stop for a separate ticket if a table is needed. Kept as the fallback if the owner wants one task in several notes or the validator gate proves hard. |
| Link id stored inside the block (`data.taskId`) | Changes the strict codec (`packages/utils/src/blocks.ts:32-43`), copies with the Markdown to other notes, and puts an id of another table into user text. |
| Parse `- [ ]` Markdown checkboxes as tasks | A second parser and a second canonical form. See OD-8 (decided 2026-10-12: no). |

### 5.9 Hard gate: strict return validators (AE-10)

`tasks.list`, `listDueInRange` and `listToday` return whole rows through `taskReturnValidator` (`convex/tasks.ts:29-51`). `dayPlans.listCarryOver` does the same through its own copy (`convex/dayPlans.ts:30-64`). A strict `v.object` return validator does not accept a field it does not list (vendor behaviour, not executed in this worktree; the repo's own rule below assumes it), so the first row that carries `sourceNoteId` would make those four queries fail, and Today would break. The repo already documents the rule ("the strict return validator must change in the same PR", `docs/BACKEND-SCHEMA.md:54`) and already shows the drift: `dayPlans.taskValidator` is missing `flexibility` (compare `convex/tasks.ts:39` with `convex/dayPlans.ts:30-64`). Whether any stored row has `flexibility` set is UNKNOWN; the validators disagree either way.

Gate: **before any code path can write `sourceNoteId`, both validators accept `sourceNoteId` and `sourceBlockId`, and the `dayPlans` copy also accepts `flexibility`.** The `tasks.ts` half fits #856's scope (`convex/tasks.ts`). The `dayPlans.ts` half does not fit any listed ticket, so a one-file slice is needed before #856 is admitted (name proposed: `TEMPO-CORE-TASK-VALIDATOR-PARITY`, EXTRAPOLATED; no issue exists). If it is not created, #856 stops with `blocked: scope overflow`. The same slice should make `dayPlans` import one shared validator, so the drift cannot recur.

`tasks.restore` also has a strict `returns` (`convex/tasks.ts:301`). Settled 2026-10-12: with L6 superseded (NT-04), it keeps `v.object({ success: v.boolean() })`. Was: the `linkCleared` and `linkClearedReason` fields in L6 change it to `v.object({ success: v.boolean(), linkCleared: v.optional(v.boolean()), linkClearedReason: v.optional(v.union(v.literal("block_taken"), v.literal("note_task_limit"))) })`, inside #856's scope.

### 5.10 Linked-task size caps (AE-22)

Settled 2026-10-12: a derived row holds only fields derived from its block, which the codec bounds (a task `title` is at most 500 characters, `packages/utils/src/blocks.ts:13`, `:34`), plus defaults, so it stays far inside `LINKED_TASK_MAX_BYTES`. For a derived row the `title` cap is the codec's 500, not 280 (EXTRAPOLATED). The `note_tasks.link` admission check goes away with `link` (NT-02).

**Why.** Every reader of linked rows reads whole task documents with `take(n)`: `taskPreview` (6 per To-do card, §9.1), `listForNote` (51 live and 21 removed), and the L1, L6 and L8 checks (2 and 51). `take(n)` has only a count (installed `convex` 1.32.0: `take(n: number)` is `limit(n).collect()`, `dist/esm/server/impl/query_impl.js`); `maximumBytesRead` is a `PaginationOptions` field, honoured only by `paginate`. And a task document has no size bound today: `tasks.create` and `tasks.update` accept a `title`, `description`, `projectId` and `projectName` of any length (`convex/tasks.ts:137-156`, `:173-195`, `:197-217`, `:247-250`, `:265-270`), and `normalizeChecklist` caps a checklist at 20 items (`convex/lib/taskChecklists.ts:3`, `:69`) but not the length of an item's `text` or `id`. So 51 rows could be 51 times the vendor's per-document ceiling (about 1 MiB, UK-5), and a single To-do card could exhaust a function.

**The caps** (UTF-16 code units of the value as stored, the unit `String.length` counts):

| Field | Cap | Source |
|---|---|---|
| `title` | 1–280 | existing bounds: `createQuick` (`convex/tasks.ts:317`), MCP `task_create`/`task_update` (`convex/lib/mcp/tools.ts:58`, `:77`); §5.5 |
| `description` | ≤ 10,000 | existing MCP bound on `notes`, which maps to `description` (`convex/lib/mcp/tools.ts:59`, `:78`; `convex/mcpTools.ts:138`, `:153`) |
| `checklist` | ≤ 20 items (existing `MAX_CHECKLIST_ITEMS`); each `text` ≤ 280, each `id` ≤ 64 | item caps EXTRAPOLATED; generated ids are `check-<index>-<slug of ≤ 24>` (`convex/lib/taskChecklists.ts:25-28`) |
| `projectId`, `projectName` | ≤ 200 each | EXTRAPOLATED |
| `timeSpentOnDay` | absent, or `JSON.stringify` of it ≤ 2,000 | EXTRAPOLATED. `v.any()` (`convex/schema.ts:233`) and no writer at the baseline (`grep timeSpentOnDay convex` finds only the schema and the two return validators); whoever adds a writer must keep linked rows inside this cap |

Every other field is an id, a number, a boolean or a literal. A row inside every cap holds at most 280 + 10,000 + 20 × (280 + 64) + 2 × 200 + 2,000 = 19,560 UTF-16 units, at most 3 UTF-8 bytes each, plus under 2 KiB of fixed fields: `LINKED_TASK_MAX_BYTES` ≈ 60 KiB (EXTRAPOLATED; how Convex counts a document's bytes is UNKNOWN, UK-13). The read budgets in §8.6 use that figure.

**Which rows are capped.** Only rows that carry link fields (L11). Capping every task would change today's `tasks.create` and `tasks.update` for no reader in this contract: unlinked rows are read only by `note_tasks.list`, which pages under `maximumBytesRead` (§8.6 R2), and by the existing unbounded readers (§11.2), which already read everything.

**Who enforces it.** Every writer of `tasks`, with what it must do:

| Writer | Lines | Can it write a linked row? | Rule |
|---|---|---|---|
| `note_tasks.link` with `taskId` (#856) | new | it creates the link | Admission: reads the stored row and checks every cap above. Any field over → `{ ok:false, code:"TASK_TOO_LARGE" }`, nothing written. |
| `note_tasks.link` without `taskId`, `addTask`, `captureTodo` (#856) | new | yes, as an insert through `createTaskForUser` | Title 1–280 (`TITLE_INVALID`); they write no other capped field. |
| `createTaskForUser` (`tasks.create`; MCP `task_create`, `convex/mcpTools.ts:136`) | `convex/tasks.ts:173-195` | only when `note_tasks` passes link fields | With link fields, the caller has checked the caps first. Without them: unchanged. |
| `updateTaskForUser` (`tasks.update`; MCP `task_update`, `convex/mcpTools.ts:150`) | `convex/tasks.ts:235-282` | yes | When the stored row has `sourceNoteId`, every capped field the call writes is checked before the patch; one over → throws `Task text too long`, nothing written. Unlinked rows: unchanged. A call that writes no capped field is not checked. |
| `createQuick` | `convex/tasks.ts:320-351` | no (never links, §5.3) | unchanged; it already shortens a title over 280 (`:335-336`) |
| `spawnRepeatAfterCompletion` | `convex/tasks.ts:405-455` | no (L7) | unchanged; it copies stored values and never truncates them |
| `acceptPlanForUser` (brain dump) | `convex/brain_dump.ts:134-164` | no | unchanged; title already ≤ 200 (`:112`, `:143`) |
| `toggleCompletion`, `remove`, `restore`, `setTaskRepeatCfg` (`convex/tasks.ts:379-403`, `:284-315`, `:551-575`); `dayPlans.moveTaskToDay` (`convex/dayPlans.ts:219`); coach accept (`convex/coach.ts:357`); account deletion | as cited | yes | They write no capped field (`restore` may clear link fields, L6). Nothing to check. |

**Owner.** #856. Every writer that can put a capped field on a linked row is in `convex/tasks.ts` or in `convex/note_tasks.ts`, both in #856's scope; MCP reaches tasks only through the two `convex/tasks.ts` helpers, and the writers in other files (last row above) touch no capped field. The caps ship in the same PR as the first link writer, so no link is ever live without them. No other slice changes.

**Legacy and oversized rows.** No row carries link fields at the baseline (§4.2), so there is no linked row to grandfather. A row over a cap stays exactly as it is (never truncated) and cannot be linked until the user shortens it: `TASK_TOO_LARGE` names the reason (copy is #857's, under OD-3). A removed linked row cannot be edited (`updateTaskForUser` refuses removed rows, `convex/tasks.ts:242`), so ghosts stay inside the caps too.

## 6. Lifecycle

### 6.1 States (AE-2)

| State | Stored as | Precedence |
|---|---|---|
| Trashed | `deletedAt` set | highest |
| Archived | `deletedAt` unset, `archivedAt` set | |
| Active | both unset | |

`archivedAt` is kept while a note is trashed, so restoring from trash returns it to Archived if it was archived. Pinning is unrelated to archive: archiving leaves `pinned` alone, and an archived pinned note is simply not in the Active view.

### 6.2 Transitions

| Operation | From → to | API | Writes | Result |
|---|---|---|---|---|
| Create | → Active | `notes.create` (+ optional `kind`) | insert | `Id<"notes">` (unchanged) |
| Archive | Active → Archived | `notes.archive` (new) | `archivedAt = now`, `updatedAt = now` | `{ ok:true, archivedAt, changed }`. Already archived: `changed:false`, no write. Trashed or foreign or missing: `{ ok:false, code:"NOTE_NOT_FOUND" }`. |
| Unarchive | Archived → Active | `notes.unarchive` (new) | `archivedAt = undefined`, `updatedAt = now` | `{ ok:true, changed }` |
| Remove | Active or Archived → Trashed | `notes.remove` (existing) | `deletedAt = now`, `updatedAt = now` | `{ success:true, undoUntilMs, restorableUntilMs }`. `restorableUntilMs` is new and additive. Foreign, missing or already trashed: throws `Note not found` (`convex/notes.ts:191-193`). |
| Restore | Trashed → earlier state | `notes.restore` (existing) | `deletedAt = undefined`, `updatedAt = now`; rebuilds the note's derived rows from the restored body in the same transaction (NT-09, settled 2026-10-12) | `{ success:true, restoredTo:"active" \| "archived" }`; expired `{ success:false, reason:"expired" }`; live `{ success:false, reason:"not_in_trash" }`; foreign or missing throws (`:205-207`). `reason` and `restoredTo` are additive. |
| Pin | Active or Archived | `notes.togglePin` (existing) | `pinned`, `updatedAt` | unchanged |
| Change kind | Active or Archived | `notes.setKind` (new) | `kind`, `updatedAt` | §4.3 |
| Edit | Active or Archived | `notes.update`, #787 | per owner | unchanged. Archived notes stay editable. |

Every metadata mutation bumps `updatedAt` (`docs/HARD_RULES.md:105`), so an unarchived or restored note appears at the top of its view.

### 6.3 Two clocks (AE-17)

| | UI Undo | Server restore eligibility |
|---|---|---|
| Constant | `UNDO_WINDOW_MS = 300000` | `GRACE_MS = 30 × 86400000` |
| Deadline | `undoUntilMs = deletedAt + 300000` | `restorableUntilMs = deletedAt + GRACE_MS`; eligible while `now - deletedAt <= GRACE_MS` (inclusive) |
| Owner of the check | the toast, as a convenience | `notes.restore`, on the server clock (`Date.now()` at `convex/notes.ts:208`) |
| Meaning | how long the toast shows | how long `notes.restore` will succeed |

Rules:

- The toast deadline is never reused as the server deadline. A restore after the toast has expired and inside 30 days succeeds.
- Exposing Trash uses the existing 30-day eligibility. **No new duration is decided or needed.**
- Queries must not read the clock (`docs/BACKEND-SCHEMA.md:19`). The Trash view takes `nowMs` from the client and shows rows with `deletedAt >= nowMs - GRACE_MS`, which is the same inclusive boundary as `isRestorable`. A wrong `nowMs` only changes the caller's own listing; `notes.restore` is the authority. A client that passes its raw clock creates a new subscription on every render, so it passes the time rounded **up** to a coarse step (EXTRAPOLATED: 5 minutes). Rounding up can hide a row a few minutes early; it can never show a row that is already past the window.
- Rows older than the window are **hidden from Trash, not erased**. They are still in the database; there is no purge (§2.5). Nothing in the UI, the docs or an export statement may say they are deleted forever.

### 6.4 What Trash may truthfully say (OD-4)

Allowed: the date until which restore works (`restorableUntilMs`), that restore keeps the note's earlier archived or active state, and that an expired item can no longer be restored from the app.
Not allowed: "permanently deleted", "erased", "gone for good", any statement about physical deletion or backups, any statement that deleted accounts' data returns on sign-in, an empty-trash or "delete forever" control.

### 6.5 Account deletion (AE-14, OD-5)

- Existing `notes` and `tasks` are already in `USER_OWNED_TABLES` (`convex/lib/accountDeletion.ts:12-29`). New fields on them (`kind`, `archivedAt`, `isTemplate`, `sourceNoteId`, `sourceBlockId`) need no change to account deletion.
- The two new tag tables (§8.3) are enrolled in the same slice that creates them (#846), with `by_userId` and `deletedAt`/`updatedAt`, as `softDeleteRowsByUserId` requires (`convex/lib/accountDeletion.ts:186-205`).
- `noteBlocks` is enrolled (#807, merged): it is in `USER_OWNED_TABLES` (`convex/lib/accountDeletion.ts:12-29`), so account deletion soft-deletes its rows like any other owned table. The sweep still reads each owned table with an unpaginated `collect()` (`convex/MIGRATIONS.md`, #807 entry, "Activation gates still open"); chunking it is #808's, not this contract's.
- Account soft-deletion stamps every live note and task with one `deletedAt`. A later sign-in restore revives only the user row (`convex/auth.ts:106-115`). The notes then sit in the data as soft-deleted rows inside their own 30-day window, so they appear in Trash and each can be restored one by one. Restoring one rebuilds its derived rows from its body, so its `noteBlocks` and linked task rows are live again (NT-09, settled 2026-10-12; fixes the open Codex P1 on #878). There is no field that distinguishes "I trashed this" from "account deletion trashed this". OD-5 default: accept this, add no special UI, and make no claim that account restore brings data back (#837 and #808 both warn against that claim).

### 6.6 Unadopted

Changing the 30-day eligibility, version or attachment retention, permanent cleanup or an empty-trash control, and account restoration of owned rows remain unadopted (§13.2).

## 7. Visibility matrix

### 7.1 Note state × consumer

`show` = returned or allowed. `hide` = not returned. `REQ` = change required in the named slice. Every column assumes an active account. Every function listed needs `requireUser`; an inactive account gets `This account is not active` from all of them (`convex/lib/requireUser.ts:64-66`).

| Consumer | Active | Archived | Trashed ≤ 30 d | Trashed > 30 d |
|---|---|---|---|---|
| `notes.feed` Active view | show | hide | hide | hide |
| `notes.feed` Archived view | hide | show (ordered by `archivedAt`, newest first) | hide | hide |
| `notes.feed` Trash view | hide | hide | show, with `restorableUntilMs` | hide (not erased) |
| `notes.get`, `notes.getSafe` | show | show | hide (`null`, `convex/notes.ts:55`, `:70`) | hide |
| `notes.list` (legacy) and MCP `notes_list` | show | **hide — REQ #842** (one change in `listNotesForUser`, `convex/notes.ts:35`, covers both) | hide | hide |
| `search.all` notes group | show | hide by default; `archived: "include"`/`"only"` opt in (#849) | hide | hide |
| Tag views, attach, detach | show | allowed; listed only in the Archived view | hide; attach/detach → `NOTE_NOT_FOUND`; link rows untouched | same |
| `notes.update`, `togglePin`, `setKind`, `archive`, MCP `note_update` | allowed | allowed (`unarchive` only for this state) | `NOTE_NOT_FOUND` / throws | same |
| `notes.restore` | `reason:"not_in_trash"` | `reason:"not_in_trash"` | success | `reason:"expired"` |
| Linked tasks in Today, planner, Tasks, TODO | show | show (OD-2) | show (OD-2), `source.state = note_trashed` | same |
| `activity.list` | show | show (unchanged, not in any CORE-WEB ticket) | hide | hide |
| `analytics.overview` | counted | counted | **counted today (defect, §2.3)** | counted |
| Account deletion sweep | soft-deleted | soft-deleted | skipped, timestamp kept (`convex/lib/accountDeletion.ts:199`) | skipped |

### 7.2 Linked task × note state (OD-2 default)

| Note state | Task in Today / planner / Tasks | Task in TODO workspace | Tick, edit, delete | `source.state` |
|---|---|---|---|---|
| Active, block present | show | show | allowed | `ok` |
| Active, block gone | hide (row soft-deleted, NT-04, settled 2026-10-12) | hide | not applicable | none |
| Archived | show | show | allowed | `ok` |
| Trashed | show | show | allowed | `note_trashed` |

If Amit rules that archiving or trashing a note should hide or remove its tasks (OD-2 alternative), only this table and the `note_tasks.list` source filter change.

When a note with open linked tasks is removed, the removal toast should say how many tasks stay on the user's lists (copy is OD-4 territory). Tasks are removed only by an explicit `tasks.remove`.

### 7.3 Existing readers that must change, and who changes them

| Reader | Required change | Owner |
|---|---|---|
| `listNotesForUser` (`convex/notes.ts:24-48`) | exclude `archivedAt !== undefined` | #842 |
| `search.all` notes group (`convex/search.ts:99-109`) | same default; safe snippet instead of raw `body` | #804, #849 |
| MCP `noteView` (`convex/mcpTools.ts:41-49`) | returns raw `body` including any fenced blocks | UNKNOWN owner. #803 covers projection for UI readers only. Reported in §14. |
| `analytics.overview` | stop counting soft-deleted rows | no ticket in this batch. Reported in §14. |
| NotesList / NotesScreen previews (`apps/web/components/notes-pages/NotesList.tsx:214`, `apps/web/components/notes/NotesScreen.tsx:43-47`, `:160`) | use the safe projection | #805 (held) |

## 8. Schema (slice #841, plus tags for #846)

Everything is additive and optional. No backfill, no data migration, no new table in #841. Every name below is proposed; the existing naming rule is `by_userId_deletedAt_<field>` (`docs/BACKEND-SCHEMA.md:16`).

### 8.1 `notes`

```ts
kind: v.optional(v.union(v.literal("quick"), v.literal("todo"))),   // absent = "note"
archivedAt: v.optional(v.number()),                                  // epoch ms
isTemplate: v.optional(v.literal(true)),                             // absent = not a template page
preview: v.optional(v.string()),                                     // derived card text, ≤ 280 UTF-16 units (§8.6); absent on legacy rows
// new indexes (existing ones stay)
.index("by_userId_deletedAt_isTemplate_archivedAt_pinned_updatedAt",
       ["userId", "deletedAt", "isTemplate", "archivedAt", "pinned", "updatedAt"])
.index("by_userId_deletedAt_isTemplate_archivedAt_kind_pinned_updatedAt",
       ["userId", "deletedAt", "isTemplate", "archivedAt", "kind", "pinned", "updatedAt"])
.index("by_userId_isTemplate_deletedAt", ["userId", "isTemplate", "deletedAt"])
```

Index names are 58, 63 and 30 characters (the Convex name-length limit was not checked here: UNKNOWN). The **field order** of each index is binding; if the 63-character name is refused, #841 may shorten it.

**Template discriminator (AE-18).** `isTemplate` is derived from `pageType`: it is `true` exactly when `pageType` is `"template"` and **absent** otherwise. The validator is `v.literal(true)`, so `false` cannot be stored, "not a template" has one stored form, and `eq(isTemplate, undefined)` is the whole ordinary range. Whatever writes `pageType` sets or clears `isTemplate` in the same patch, and nothing else writes it; a test reads every inserted and patched row (as L2 does for links). No writer of `pageType` exists at the baseline, so no row carries either field and nothing is backfilled. A `filter` on `pageType` after the index is not allowed: in index order `pageType` sorts `undefined`, `daily`, `plain`, `project`, `template`, `weekly`, so "everything but template" is not one range, and a filter after the index would have to read every template row that precedes the first ordinary note.

How each view reads (all bounded by `paginate`; Convex appends `_creationTime` to every index as a tie-breaker, so order is total). Every range fixes `isTemplate = undefined`, so template pages are never read, however many exist:

| View | Index | Range | Order |
|---|---|---|---|
| Active | first | `eq(userId).eq(deletedAt, undefined).eq(isTemplate, undefined).eq(archivedAt, undefined)` | `desc`: pinned first, then `updatedAt` newest first |
| Active + kind | second | the same four equalities, then `eq(kind, v)`; for `note` use `eq(kind, undefined)` | `desc`: pinned, `updatedAt` |
| Archived | first | `eq(userId).eq(deletedAt, undefined).eq(isTemplate, undefined).gte(archivedAt, 0)` (`undefined` sorts before numbers, as `convex/dayPlans.ts:194` already relies on) | `desc`: newest `archivedAt` first |
| Trash | third | `eq(userId).eq(isTemplate, undefined).gte(deletedAt, nowMs - GRACE_MS)` | `desc`: newest `deletedAt` first |

The existing `by_userId_deletedAt` index no longer serves the Trash view (it cannot fix `isTemplate`); it stays for its other readers.

A kind filter in the Archived and Trash views is **not** offered (it would be a post-index filter over an unbounded range).

`notes.revision`, `pageType` changes and any search field are not part of #841.

### 8.2 `tasks` (gated by §5.9; MUTATES wording of #841 must be amended, §14)

```ts
sourceNoteId: v.optional(v.id("notes")),
sourceBlockId: v.optional(v.string()),
.index("by_userId_sourceNoteId_deletedAt_sourceBlockId",
       ["userId", "sourceNoteId", "deletedAt", "sourceBlockId"])                               // 46 chars
.index("by_userId_deletedAt_status_dueAt", ["userId", "deletedAt", "status", "dueAt"])        // 32 chars
```

The first index is the only link index (AE-19). Its field order is binding, with `deletedAt` before `sourceBlockId`; the name is a proposal. Because `tasks.remove` preserves the source fields, the index holds removed rows too, and every read fixes `deletedAt`:

| Read | Range | Bound |
|---|---|---|
| Live links of a note (L8, L6, `listForNote`) | `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined)` | `take(MAX_LINKED_TASKS_PER_NOTE + 1)`; ordered by `sourceBlockId` |
| A To-do card's preview (`taskPreview`, §9.1) | the same | `take(TASK_PREVIEW_ITEMS + 1)` = `take(6)` |
| The live link of one block (L1, L6) | the same, then `eq(sourceBlockId, b)` | `take(2)` |
| Removed links of a note (ghosts, `listForNote` only) | `eq(userId).eq(sourceNoteId, n).gte(deletedAt, 0)`, `.order("desc")` | `take(MAX_REMOVED_SHOWN + 1)`; newest removal first |

None of them reads a soft-deleted row when it wants a live one, and every row any of them reads carries link fields, so it is inside the linked-task caps (L11, §5.10). **Schema requirement for #841:** without `deletedAt` in the index prefix, a note with more than 50 removed linked tasks could not give a bounded, correct live read (`take(51)` would fill with removed rows, or a post-limit filter would drop live ones).

The second index serves the TODO list (`note_tasks.list`, §9.2) without scanning every task: `eq(userId).eq(deletedAt, undefined).eq(status, s)` returns undated items first, then by `dueAt` ascending. The existing task readers keep their `collect()` (§11.2); the TODO list must not reuse them.

### 8.3 Tag tables (slice #846)

Settled 2026-10-12 (NT-05): if these tables are built, they are a derived index of `page-meta.data.tags`, rebuilt from bodies. `noteTags.parentId` stays unused until a nesting representation is chosen.

```ts
noteTags: defineTable({
  userId: v.id("users"),
  name: v.string(),                       // display; normalised per §10.1
  nameKey: v.string(),                    // uniqueness key; normalised per §10.1
  parentId: v.optional(v.id("noteTags")), // absent = root
  createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_deletedAt", ["userId", "deletedAt"])
  .index("by_userId_deletedAt_parentId_nameKey", ["userId", "deletedAt", "parentId", "nameKey"]),

noteTagLinks: defineTable({
  userId: v.id("users"),
  noteId: v.id("notes"),
  tagId: v.id("noteTags"),
  linkedAt: v.number(),                   // when the pair last became live; set on insert, reset on revival (§10.4)
  createdAt: v.number(), updatedAt: v.number(), deletedAt: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_noteId_tagId", ["userId", "noteId", "tagId"])
  .index("by_userId_noteId_deletedAt", ["userId", "noteId", "deletedAt"])
  .index("by_userId_tagId_deletedAt_linkedAt", ["userId", "tagId", "deletedAt", "linkedAt"]),   // 34 chars
```

`linkedAt` is the only ordering key of `notesByTag` (AE-20). `createdAt` is when the pair was first linked and never changes; `updatedAt` is bumped by every write to the row and is not used for ordering.

Both tables join `USER_OWNED_TABLES` in the same slice (`convex/lib/accountDeletion.ts:12-29`).

### 8.4 `MIGRATIONS.md` entry for #841 (text to use)

> **TEMPO-CORE-NOTE-SCHEMA-01 — note kind, archive and task link (inactive).** Additive only; no backfill. `notes` gains optional `kind` (`quick` or `todo`; absent means note), optional `archivedAt` and optional `isTemplate` (`true` only; absent means not a template) and optional `preview` (derived card text of at most 280 UTF-16 units, written by body writers, absent on legacy rows), with three indexes (two feed, one trash). `tasks` gains optional `sourceNoteId` and `sourceBlockId`, with `by_userId_sourceNoteId_deletedAt_sourceBlockId` and `by_userId_deletedAt_status_dueAt`; `noteBlocks` gains `by_userId_noteId_deletedAt_blockId` (§8.7, settled 2026-10-12). No writer is activated. Deployed to: **not deployed by this authoring ticket**; the integration TEST deployment is separate; live is not touched.

### 8.5 What #841's test must prove

Nonzero cases for: a legacy note row with none of the new fields; each kind; archived and not archived; an invalid `kind` literal, `isTemplate: false` and an invalid `sourceNoteId` rejected by the validator; `isTemplate: true` accepted; `preview` optional (a legacy row without it validates, a string validates, a non-string is rejected); the exact index field order (read from the schema definition), including `isTemplate` before `archivedAt` in the two feed indexes `deletedAt` before `sourceBlockId` in the link index, and `deletedAt` before `blockId` in the `noteBlocks` live-row index (§8.7); the new `tasks` fields optional; all existing indexes still present.

### 8.6 Bounded note reads (AE-21): schema requirement for #841, rules for #842, #847, #849 and #856

**Why a small card is not enough.** A Convex query reads whole documents; there is no column projection. `paginate` over `notes` therefore loads every row's full `body` into the function, however small the returned `NoteCard` is. Bodies have no length bound at the baseline (§2.1; the only ceiling is the vendor's per-document limit of about 1 MiB, not verified here: UNKNOWN), and one function may read only a limited volume (about 16 MiB; UK-5). A page of large but valid bodies could fail the feed. #803's projection makes what is *returned* safe; it does not make what is *read* smaller. Three rules follow.

**R1. A stored, bounded card text (schema requirement for #841).**

- `notes.preview: v.optional(v.string())`, at most 280 UTF-16 units. It is derived data: `projectPageText(body, { summaryChars: 280 }).summary` from `@tempo/utils` (`packages/utils/src/page-summary.ts`, #803, PR #884). It is never a raw slice of `body`, so it holds no fence text, JSON or block id. The projection's longer `searchText` is not stored (a second copy of private text; see the §9.4 alternative).
- Every writer of `body` sets or recomputes `preview` in the same insert or patch, as `isTemplate` follows `pageType` (AE-18). At the baseline the writers are `createNoteForUser` and `updateNoteForUser` (`convex/notes.ts:100`, `:144`; both also serve MCP `note_create` and `note_update`, `convex/mcpTools.ts:161`, `:171`), which are in #842's file, and `templates.applyToNote` (`convex/templates.ts:169`), which is in no slice's scope (§14). Later writers (#787) must do the same. A writer that patches other fields leaves `preview` alone. A test reads every inserted and patched row (NL-25).
- A row without `preview` (a legacy row, or a row from a writer not yet updated) is valid. `notes.feed` then projects its `body` with the same function and the same 280 limit; it never slices raw text. No backfill (UA-9).
- R1 saves the projection's CPU time on every read and keeps cards stable between reads. It does **not** shrink the bytes read, because the row is read whole. R2 does that.

**R2. A byte bound on every paginated read (#842, #847, #849, #856).**

- `notes.feed` (all three views), `note_tags.notesByTag`, `note_tasks.list` and the `search.all` note scan take the caller's pagination options, clamp `numItems` to their ceiling (below) and overwrite `maximumRowsRead` and `maximumBytesRead` with server constants; `cursor`, `endCursor` and `id` pass through as given. A caller can neither raise nor remove the bounds, and a caller-supplied value is replaced, not compared. Each returns Convex's split metadata unchanged, and a `SplitRequired` result carries no items (§11.1, AE-23).

| Constant | Value | Meaning |
|---|---|---|
| `FEED_PAGE_MAX` | 20 | `numItems` ceiling, and default, of `notes.feed` (§11.1). It also caps the To-do cards on a page, so `taskPreview` reads at most 20 × 6 task rows |
| `FEED_MAX_ROWS_READ` | 40 | rows entering the query, twice the feed ceiling (EXTRAPOLATED); every API in this list uses it |
| `FEED_MAX_BYTES_READ` | 4 MiB (4,194,304) | byte bound of the feed, `notesByTag` and the search scan; a quarter of the vendor read limit, the rest left for task-preview and by-id reads (EXTRAPOLATED) |
| `TAGGED_PAGE_MAX` | 8 | `numItems` ceiling of readers that fetch notes by id (below): `notesByTag`, search with `tagId`, `note_tasks.list`; 8 × the 1 MiB document ceiling is half the vendor read limit (EXTRAPOLATED) |
| `TODO_MAX_BYTES_READ` | 2 MiB (2,097,152) | byte bound of `note_tasks.list`'s task page, lower than the feed's because that page also reads up to 8 notes by id (EXTRAPOLATED) |
| `SEARCH_SCAN_NOTES` | 25 | `numItems` of the search note scan without `tagId` (§9.4, EXTRAPOLATED) |

Every byte bound is at least twice the vendor's per-document ceiling, so no single document is larger than a bound on its own.

**Read budget per call** (worst case, EXTRAPOLATED; vendor limit about 16 MiB per function, UK-5; `LINKED_TASK_MAX_BYTES` ≈ 60 KiB, §5.10; a page under a byte bound can read one more row than the bound allows, the row that crosses it):

| Function | Reads at most | Worst case |
|---|---|---|
| `notes.feed` | note rows under `FEED_MAX_BYTES_READ`; `taskPreview` for ≤ 20 To-do cards × 6 linked task rows | 4 + 1 + 120 × 60 KiB ≈ 12 MiB |
| `note_tags.notesByTag` | ≤ 40 link rows (each well under 1 KiB); 8 notes by id; `taskPreview` for ≤ 8 cards × 6 linked task rows | 8 + 48 × 60 KiB ≈ 11 MiB |
| `search.all` note scan | without `tagId`: note rows under `FEED_MAX_BYTES_READ`; with `tagId`: ≤ 40 link rows and 8 notes by id | 5 MiB; 8 MiB. The task, habit and goal groups keep today's `collect()` (§9.4, §11.2) and are not counted |
| `note_tasks.list` | task rows under `TODO_MAX_BYTES_READ` (unlinked and legacy rows are uncapped, up to the 1 MiB ceiling); ≤ 8 source notes by id; ≤ 8 `noteBlocks` rows (a block is at most 65,536 characters, `packages/utils/src/blocks.ts:5`) | 2 + 1 + 8 + 8 × 192 KiB ≈ 12.5 MiB |
| `note_tasks.listForNote` | one note; 51 live and 21 removed linked task rows | 1 + 72 × 60 KiB ≈ 5.2 MiB |
| `note_tasks.link`, `addTask`, `tasks.restore` | one note, one block row, the task being linked or restored (unlinked, so up to 1 MiB), `take(2)` and `take(51)` of linked rows | ≈ 5.3 MiB |

- The installed `convex` 1.32.0 types document both options (`node_modules/convex/dist/esm-types/server/pagination.d.ts`, `PaginationOptions`): they limit rows and bytes "entering the query pipeline", and when the byte limit is reached "the query may return an incomplete page and require a page split". The installed `paginate` forwards `cursor`, `endCursor`, `maximumRowsRead` and `maximumBytesRead` to the backend and returns `page`, `isDone`, `continueCursor`, `splitCursor` and `pageStatus` (`dist/esm/server/impl/query_impl.js`). Convex's pagination guide says a page that would exceed either value "will return a status forcing the client to split the pages" (docs.convex.dev/database/pagination, read through Context7 on 2026-10-11), and the open-source backend sets `SplitRequired` when a row or byte limit, built-in or caller-set, is hit while a page is read (`crates/isolate/src/environment/udf/async_syscall.rs`, `read_page_from_query`, same source). A page may therefore be shorter than `numItems`, and a `SplitRequired` page may be incomplete; §11.1 says what callers do.
- **Runtime behaviour is still UNKNOWN in this repo** (UK-11). No merged Tempo code passes either option, and nothing read says whether a cut page always holds at least one row, whether a `SplitRequired` result always carries a `splitCursor`, or how a document's bytes are counted. #842 must show the bound in a harness that applies it (NL-24) or report UNKNOWN; an option that is not shown to cut the page is not a bound, and the feed does not ship on it.
- **Readers that fetch notes by id** (`note_tags.notesByTag` and search with `tagId` page link rows, then read each note; `note_tasks.list` pages tasks, then reads each linked item's source note) are not covered by `maximumBytesRead`, which sees only the paginated table. Their page ceiling is `TAGGED_PAGE_MAX`, set so that even a ceiling-sized body per row stays inside the vendor limit.
- **Task rows.** Readers of linked rows (`taskPreview`, `listForNote`, the L1, L6 and L8 checks) use `take(n)`, which has no byte option; their bytes are bounded by the linked-task caps (§5.10, AE-22), which every row they can read satisfies (L11). `note_tasks.list` is the one paginated reader of `tasks`; it also reads unlinked and legacy rows, which are not capped, so it carries this rule's byte bound (`TODO_MAX_BYTES_READ`).
- **Alternative, not proposed:** a separate 1:1 summary table that holds only card fields and carries the feed indexes, so a feed page never reads a body at all. It needs a schema owner, a backfill of every legacy note (reversing UA-9) and every note writer to keep it in step inside one transaction. If NL-24 cannot be shown, or Amit prefers it, #842 stops and a schema slice is raised first. This is the same choice the §9.4 `searchIndex` alternative describes.

**R3. Bodies reach a response only from single-note views.** `notes.get`, `notes.getSafe`, the editor and MCP `noteView` (one id) may return `body`. No feed, Archived, Trash, tag or search-card path does. Search reads bodies to build `searchText` (it cannot use the 280-unit `preview`), which is why its scan carries R2 and returns snippets only (§9.4). The legacy `notes.list` and MCP `notes_list` stay unbounded and are listed in §11.2.

### 8.7 `noteBlocks` live-row index (schema requirement, settled 2026-10-12)

```ts
// convex/schema.ts — noteBlocks (PROPOSED, NT-09)
.index("by_userId_noteId_deletedAt_blockId", ["userId", "noteId", "deletedAt", "blockId"])   // 34 chars
```

- **Why.** The derived-index writer may soft-delete a row and insert a new one for the same stable block id (an edit, a removal and its Undo, a restore). The existing `by_userId_noteId_blockId` (`convex/schema.ts:470`) has no `deletedAt`, so a lookup on it cannot pick the live row in a bounded read: `unique()` fails on the duplicates, `first()` can return a tombstone, and a filter before `first()` scans the whole edit history. With `deletedAt` before `blockId`, the range `eq(userId).eq(noteId, n).eq(deletedAt, undefined).eq(blockId, b)` holds only live rows. It is read with `take(2)`, and two live rows for one key are corrupt data that fail the call.
- Where it can, the writer also patches the existing live row of a key in place instead of soft-deleting it and inserting a new one, so the history stays short (EXTRAPOLATED). The index is required either way.
- Owner: the single schema lane (§3), with #841 as the proposed slice. After it lands, no live lookup reads `by_userId_noteId_blockId`.

## 9. API proposals per slice

### 9.0 Conventions (AE-9)

- Identity comes from `requireUser`; `userId` is never an argument (`docs/BACKEND-SCHEMA.md:13`).
- **Validate everything, then write.** A mutation that returns normally commits its writes, so an expected failure returns `{ ok:false, code }` only before any write. A failure after a write throws, and Convex rolls the whole transaction back.
- Foreign, missing and soft-deleted rows give the same `*_NOT_FOUND` code (no enumeration).
- Existing functions keep their argument and result shapes. They gain optional result fields only. Their `throws "Note not found"` behaviour stays (`convex/notes.ts:156`, `:191`).
- Page arguments use `paginationOptsValidator` and page results use `paginationResultValidator(item)` from `convex/server` (installed 1.32.0: the first carries `endCursor`, `id`, `maximumRowsRead` and `maximumBytesRead`, the second `splitCursor` and `pageStatus`). `numItems` is clamped to 1 and the API's ceiling (§11.1), not rejected. Every paginated API here overwrites `maximumRowsRead` and `maximumBytesRead` with server constants (§8.6 R2) and follows the split protocol (§11.1, AE-23).
- Types used below:

```ts
type NoteKind = "quick" | "note" | "todo";
type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type Fail<C extends string> = { ok: false; code: C };
```

### 9.1 `convex/notes.ts` (#842)

**`notes.feed`** — query

```ts
args: {
  view: "active" | "archived" | "trash",
  kind?: NoteKind,            // active view only; any other view throws "kind filter needs the active view"
  nowMs?: number,             // required iff view === "trash" (finite integer ≥ 0); else throws "nowMs required"
  paginationOpts: PaginationOptions,   // numItems clamped to 1–FEED_PAGE_MAX (20); cursor, endCursor, id passed through; row and byte bounds set by the server
}
returns: {                    // paginationResultValidator(noteCard)
  page: NoteCard[];           // [] when pageStatus is "SplitRequired"
  isDone: boolean;
  continueCursor: string;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
}

type NoteCard = {
  _id: Id<"notes">; kind: NoteKind; title: string;
  preview: string;                 // stored notes.preview (§8.6 R1), or the same #803 projection of body when the row has none; ≤ 280 UTF-16 units; never body, never fence or JSON text
  pinned: boolean; pageType?: "daily"|"weekly"|"project"|"plain"|"template"; date?: string;
  createdAt: number; updatedAt: number;
  archivedAt?: number;
  deletedAt?: number; restorableUntilMs?: number;   // trash view only: deletedAt + GRACE_MS
  taskPreview?: {                                   // kind === "todo" only
    items: { taskId: Id<"tasks">; title: string; status: TaskStatus }[];   // ≤ TASK_PREVIEW_ITEMS (5)
    truncated: boolean;                             // a sixth live linked task exists
  };
}
```

- Reads: the index and range in §8.1. Every range fixes `isTemplate = undefined`, so template pages are excluded by the index prefix, not by a `filter` before `paginate`; the number of template pages does not change the reads per page (NL-23).
- `taskPreview` reads `by_userId_sourceNoteId_deletedAt_sourceBlockId` with `eq(userId).eq(sourceNoteId, noteId).eq(deletedAt, undefined)` and `take(TASK_PREVIEW_ITEMS + 1)` = `take(6)` per To-do card, so removed tasks are never read. `items` are the first five in index order (`sourceBlockId`, a ULID, so roughly the order the blocks were created, not their order in the page); `truncated` says a sixth exists. No `total` or `open` count is returned: counting needs the whole live range (up to 51 rows), and no count API is adopted (UA-8). The editor and #857 get the full list from `note_tasks.listForNote`.
- **Task bytes.** Every row `taskPreview` reads carries link fields, so it is inside the linked-task caps (L11, §5.10): at most 6 × `LINKED_TASK_MAX_BYTES` (≈ 360 KiB) per card, and at most 20 To-do cards per page (`FEED_PAGE_MAX`), so at most 120 task rows (≈ 7 MiB) per page. A legacy or oversized task cannot be linked (`TASK_TOO_LARGE`), so it never reaches this read. The budget for the whole call is in §8.6 R2.
- Blocked until #803's projection is merged (the stored `preview` is written with it). The feed has no raw-body fallback: a row without a stored `preview` is projected with the same function, never sliced.
- Byte-bounded (§8.6 R2) and split-aware (§11.1): a page can be shorter than `numItems`; `continueCursor`, `isDone`, `splitCursor` and `pageStatus` are Convex's, unchanged. On `pageStatus: "SplitRequired"` the page may be incomplete, so the feed returns `page: []` and hydrates no `taskPreview` for it; the caller replaces it with the two split ranges. All three views (Active, Archived, Trash) follow this.
- The card is built from the row's `preview` and metadata; `body` is read into the function (Convex reads whole rows) and never copied to the result.

**`notes.create`** — existing; adds `kind?: NoteKind`. Returns `Id<"notes">` as today. `kind: "todo"` through this call creates a To-do note with no tasks.

**`notes.setKind`** — mutation

```ts
args: { noteId: Id<"notes">, kind: NoteKind }
returns: { ok: true; kind: NoteKind; changed: boolean } | Fail<"NOTE_NOT_FOUND">
```

**`notes.archive`** / **`notes.unarchive`** — mutations

```ts
args: { noteId: Id<"notes"> }
archive   returns: { ok: true; archivedAt: number; changed: boolean } | Fail<"NOTE_NOT_FOUND">
unarchive returns: { ok: true; changed: boolean }                      | Fail<"NOTE_NOT_FOUND">
```

**Changed existing functions** (additive only)

| Function | Change |
|---|---|
| `notes.remove` | result gains `restorableUntilMs` |
| `notes.restore` | result gains optional `reason` and `restoredTo`; `{ success }` keeps its meaning (callers read only `success`: `apps/web/components/notes-pages/NotesList.tsx:174`, `apps/web/components/notes/NotesScreen.tsx:300`) |
| `notes.list` / `listNotesForUser` | excludes archived rows |
| `notes.get`, `getSafe`, `update`, `togglePin` | unchanged. Archived notes stay readable by id and editable. |

`notes.update` does not accept `kind` or `archivedAt`. #842 adds no new way to write `body`: `createNoteForUser` and `updateNoteForUser` keep their existing body writes and set `preview` in the same insert or patch (§8.6 R1); any future body change goes through #787's ledger.

No count API is proposed. A count needs a scan or a maintained counter; neither is adopted.

### 9.2 `convex/note_tasks.ts` (#856; new module)

Everything touching the body depends on #787 and #828 (UNKNOWN shapes, §3).

Settled 2026-10-12 (NT-02, NT-04, NT-09): `note_tasks.link` is not offered, because rows are derived from task blocks. Its row below is kept only as the record of the block lookup, which now reads the live-row index of §8.7. `addTask` and `captureTodo` write a block and derive its row in the same transaction. `TASK_ALREADY_LINKED`, `BLOCK_ALREADY_LINKED`, `TASK_TOO_LARGE` and `source.state` `block_missing` cannot occur.

```ts
type LinkCode =
  | "NOTE_NOT_FOUND" | "TASK_NOT_FOUND" | "BLOCK_NOT_FOUND" | "BLOCK_NOT_TASK" | "BLOCK_BROKEN"
  | "TASK_ALREADY_LINKED" | "BLOCK_ALREADY_LINKED" | "NOTE_TASK_LIMIT" | "TITLE_INVALID"
  | "TASK_TOO_LARGE" | "REVISION_CONFLICT" | "REQUEST_ID_INVALID" | "REQUEST_ID_REUSED";
type SourceState = "ok" | "block_missing" | "note_trashed";
```

| Function | Kind | Args | Returns |
|---|---|---|---|
| `note_tasks.link` | mutation | `{ noteId, blockId: string, taskId?: Id<"tasks"> }` | Superseded 2026-10-12: not offered (NT-02). Was: `{ ok:true; taskId; created: boolean } \| Fail<LinkCode>`. No `taskId`: create a row from the block (§5.5 mapping). With `taskId`: attach the existing row, after the admission check (§5.10): a stored field over its cap → `TASK_TOO_LARGE`, nothing written. Both paths check L1 and L8 first. A second call for the same `(noteId, blockId)` returns the same `taskId` with `created:false`. Block lookup (settled 2026-10-12, NT-09): `noteBlocks.by_userId_noteId_deletedAt_blockId` with `deletedAt` fixed to `undefined`, `take(2)`; type `task` → ok; type `broken` → `BLOCK_BROKEN`; other type → `BLOCK_NOT_TASK`; none → `BLOCK_NOT_FOUND`. |
| `note_tasks.addTask` | mutation | `{ noteId, requestId, expectedRevision: number, title: string, afterBlockId?: string, dueAt?: number }` | `{ ok:true; taskId; blockId; noteRevision: number; operationId; undoUntilMs } \| Fail<LinkCode>`. Row insert, block insert, receipt, and link in one transaction. Title 1–280. |
| `note_tasks.captureTodo` | mutation | `{ requestId, text: string, title?: string }` | `{ ok:true; noteId; taskId; blockId } \| Fail<LinkCode>`. Creates a `todo` note whose body holds one block, and the linked row. |
| `note_tasks.undoCreate` | mutation | `{ requestId }` | `{ ok:true } \| Fail<"REQUEST_ID_INVALID" \| "UNDO_EXPIRED" \| "UNDO_CONFLICT" \| "NOTE_NOT_FOUND">`. Within the 5-minute window, removes what the add or capture created and soft-deletes the created row, in one transaction. Never touches work done after the create. Shape follows #787/#828. |
| `note_tasks.listForNote` | query | `{ noteId }` | `{ ok:true; items: { blockId; taskId; title; status: TaskStatus; completedAt?: number; dueAt?: number; deletedAt?: number; restorableUntilMs?: number }[]; truncated: boolean; removedTruncated: boolean } \| Fail<"NOTE_NOT_FOUND">`. Two bounded reads on the link index (§8.2). Live: `eq(userId).eq(sourceNoteId, noteId).eq(deletedAt, undefined)`, `take(51)`; the first 50 are returned and `truncated` is true when a 51st exists. Removed: `eq(userId).eq(sourceNoteId, noteId).gte(deletedAt, 0)`, `.order("desc")`, `take(MAX_REMOVED_SHOWN + 1)` with `MAX_REMOVED_SHOWN = 20` (EXTRAPOLATED); the newest 20 are appended with `deletedAt` and `restorableUntilMs` so the editor can draw a "removed task" ghost, and `removedTruncated` is true when older removals exist. A removed row whose `blockId` already has a live row in the result is dropped. The live read never touches a soft-deleted row, so any number of removed tasks leaves it bounded and correct. |
| `note_tasks.list` | query | `{ status: TaskStatus, paginationOpts }` | `PaginationResult<TodoItem>` (`paginationResultValidator`), with `continueCursor`, `isDone`, `splitCursor` and `pageStatus` passed through and `page: []` on `SplitRequired` (§11.1). Index `by_userId_deletedAt_status_dueAt`: ascending (undated first) for `todo` and `in_progress`, descending for `done` and `cancelled`. `numItems` is clamped to 1–`TAGGED_PAGE_MAX` (8), because each item may read its source note by id; `maximumRowsRead` = `FEED_MAX_ROWS_READ` and `maximumBytesRead` = `TODO_MAX_BYTES_READ`, set by the server (§8.6 R2). This is the one paginated reader of `tasks`, and it reads unlinked and legacy rows, which are not capped. |

```ts
type TodoItem = {
  taskId: Id<"tasks">; title: string; status: TaskStatus; priority: "low"|"medium"|"high";
  dueAt?: number; completedAt?: number;
  source?: { noteId: Id<"notes">; blockId: string; noteTitle: string; state: SourceState };
};
```

`source` costs one note read (deduplicated by `noteId` within the call) and one `noteBlocks` lookup per linked item: at most 8 notes and 8 block rows per page, inside the §8.6 read budget.

Narrow hooks in `convex/tasks.ts` (inside #856's scope):

| Hook | Reason |
|---|---|
| `taskReturnValidator` gains `sourceNoteId?` and `sourceBlockId?` | §5.9 |
| `createTaskForUser` accepts server-set link fields | so rows keep one insert helper and its defaults (`:173-195`) |
| `updateTaskForUser`, on a row that has `sourceNoteId`, writes the block through the page writer instead of patching the row, and refuses fields a block cannot carry (NT-02, settled 2026-10-12). Was: it checked the linked-task caps before its patch | §5.10, L11 |
| Superseded 2026-10-12 (NT-04): `tasks.restore` on a linked row whose block is not in the body returns `{ success: false }`. Was: it cleared a link that was taken or that would be the note's 51st live link, and returned `linkCleared` and `linkClearedReason` | L6, L8 |
| nothing else | `spawnRepeatAfterCompletion`, `createQuick` and every other writer are left alone (L7, §5.10) |

### 9.3 `convex/note_tags.ts` (#847; new module)

Superseded 2026-10-12 (NT-05): tags live in `page-meta.data.tags`. `attach`, `detach` and `rename` become body writes of the page-meta block through the page writer, and the tag tables are a derived index. `create`, `move`, `remove` and `restore` of tag rows, and the hierarchy, are held until a nesting representation is chosen. The read APIs (`list`, `forNotes`, `notesByTag`) may read the derived index.

```ts
type TagCode =
  | "TAG_NAME_INVALID" | "TAG_NAME_TAKEN" | "TAG_NOT_FOUND" | "TAG_PARENT_NOT_FOUND"
  | "TAG_DEPTH_EXCEEDED" | "TAG_CYCLE" | "TAG_CORRUPT_HIERARCHY" | "TAG_LIMIT"
  | "NOTE_TAG_LIMIT" | "NOTE_NOT_FOUND" | "TAG_RESTORE_EXPIRED";
```

| Function | Kind | Args | Returns |
|---|---|---|---|
| `note_tags.list` | query | `{}` | `{ tags: { _id; name; parentId?: Id<"noteTags">; createdAt: number }[]; truncated: boolean }`. All live tags, `take(TAG_MAX_PER_USER + 1)`; `truncated` should never be true if the limit holds. |
| `note_tags.create` | mutation | `{ name, parentId?: Id<"noteTags"> }` | `{ ok:true; tagId } \| Fail<TagCode>`. `TAG_NAME_TAKEN` carries `existingTagId` so a composer can reuse it. |
| `note_tags.rename` | mutation | `{ tagId, name }` | `{ ok:true; changed: boolean } \| Fail<TagCode>` |
| `note_tags.move` | mutation | `{ tagId, parentId: Id<"noteTags"> \| null }` | `{ ok:true; changed: boolean } \| Fail<TagCode>`. `TAG_LIMIT` when the new parent already has `TAG_MAX_CHILDREN` live children (§10.2). |
| `note_tags.remove` | mutation | `{ tagId }` | `{ ok:true; restorableUntilMs: number; childrenMovedTo: Id<"noteTags"> \| null } \| Fail<TagCode>` (OD-6 default). `TAG_LIMIT` when promoting the children would leave the destination with more than `TAG_MAX_CHILDREN` live children; `TAG_NAME_TAKEN` (with `childTagId`) on a name collision there. Both are preflighted before any write (§10.5). |
| `note_tags.restore` | mutation | `{ tagId }` | `{ ok:true; reparentedToRoot: boolean; renamedTo?: string } \| Fail<TagCode>`. Eligible while `now - deletedAt <= GRACE_MS`, the same rule as notes. Children that moved up are not moved back. A name that a live sibling now holds is not an error: the tag comes back as `Name (2)`, `Name (3)`, … and `renamedTo` says so (§10.5). `TAG_NAME_TAKEN` only when all 21 candidates are taken. `TAG_LIMIT` when the user already has `TAG_MAX_PER_USER` live tags or the target parent has `TAG_MAX_CHILDREN`; `TAG_DEPTH_EXCEEDED` when the old parent now sits at `TAG_MAX_DEPTH`. Nothing is written on any failure. |
| `note_tags.attach` | mutation | `{ noteId, tagId }` | `{ ok:true; attached: boolean } \| Fail<TagCode>`. `attached:false` when the pair is already live. |
| `note_tags.detach` | mutation | `{ noteId, tagId }` | `{ ok:true; detached: boolean } \| Fail<TagCode>` |
| `note_tags.forNotes` | query | `{ noteIds: Id<"notes">[] }` (≤ 50) | `{ byNote: Record<string, Id<"noteTags">[]> }`. Only live links to live tags, ≤ 20 per note. |
| `note_tags.notesByTag` | query | `{ tagId, view: "active" \| "archived", paginationOpts }` | `PaginationResult<NoteCard>` (`paginationResultValidator`, split fields passed through, `page: []` on `SplitRequired`, §11.1), ordered by `linkedAt`, the time the pair last became live (newest first; a re-attach moves the note to the top, §10.4). Index `by_userId_tagId_deletedAt_linkedAt`, range `eq(userId).eq(tagId, t).eq(deletedAt, undefined)`, `.order("desc")`; each note is read and filtered by state (live, the requested archive state, not a template). Short pages are possible; `isDone` and the cursor are truthful. `numItems` is clamped to 1–`TAGGED_PAGE_MAX` (8): the notes are fetched by id, which `maximumBytesRead` does not see (§8.6 R2); `maximumRowsRead` and `maximumBytesRead` on the link page are set by the server. A To-do card's `taskPreview` is read as in §9.1. |

Ordering by the note's own `updatedAt` is not offered: it would need a denormalised timestamp on every link row, kept in step with every note write.

### 9.4 `convex/search.ts` (#849)

Additive over today's `{ query } → { notes, tasks, habits, goals }` (`convex/search.ts:70-139`; the strict `searchResultValidator` at `:15-42` changes in the same PR).

```ts
args: {
  query: string,
  filters?: {
    kinds?: NoteKind[],                         // ≤ 3
    tagId?: Id<"noteTags">,
    createdFrom?: number, createdTo?: number,   // finite, from < to
    archived?: "exclude" | "only" | "include",  // default "exclude"
  },
  notesPage?: PaginationOptions,                // paginationOptsValidator; absent = today's unpaginated behaviour (NT-10)
}
returns: today's four groups + notesPage?: {   // present only when the caller passed notesPage (NT-10)
  continueCursor: string;                       // Convex's, unchanged
  isDone: boolean;
  splitCursor?: string | null;
  pageStatus?: "SplitRecommended" | "SplitRequired" | null;
  scanned: number;                              // rows in the window; 0 on "SplitRequired"
}
```

`notesPage` replaces the earlier draft's `cursor`/`nextCursor` pair, which could not carry a split. The server treats it as R2 says (§8.6): `numItems` is clamped to 1–`SEARCH_SCAN_NOTES` (25), or 1–`TAGGED_PAGE_MAX` (8) with `tagId`; `maximumRowsRead` and `maximumBytesRead` are overwritten; `cursor`, `endCursor` and `id` pass through. The four group arrays keep their names and item shapes; only the notes group's length rule changes (below).

Behaviour (AE-11):

- **Without `notesPage`** (settled 2026-10-12, NT-10; fixes the open Codex P2 on #878): the notes group keeps today's result shape and completeness. Every live note is scanned (`convex/search.ts:80-83`), archived notes are excluded by default, matches are cut to `GROUP_LIMIT`, and no `notesPage` is returned; snippets still follow #804's safe projection. Existing callers, such as `SearchScreen`'s `{ query }` call (`apps/web/components/global-search/SearchScreen.tsx:38`), are unchanged whatever order #849 and #850 land in. Everything below applies only when the caller passes `notesPage`.
- Notes are scanned in feed order, **at most `SEARCH_SCAN_NOTES = 25` per call** (EXTRAPOLATED), through the first feed index (Active or Archived range, `isTemplate` fixed to `undefined`, so template pages are never scanned), and **every** match in the window is returned, at most `SEARCH_SCAN_NOTES` because a match is a scanned row. The existing `GROUP_LIMIT` of 8 (`convex/search.ts:6`) no longer cuts the notes group: a match dropped from a window the cursor has already passed could never be found again. It still applies to tasks, habits and goals. `continueCursor` continues the scan. A user may need "search older notes". With `notesPage`, this replaces today's `collect()` of every note, task, habit and goal (`:80-97`).
- Matching and snippets use the safe projection (#803/#804), never raw `body`.
- With `tagId`, iteration runs over `noteTagLinks` for that tag, not over the feed, through the same `notesPage` options and the same split protocol. The notes are then fetched by id, so the scan is at most `TAGGED_PAGE_MAX = 8` notes per call (§8.6 R2). A cursor belongs to one query, so changing `tagId` or any filter starts again from `cursor: null`.
- `createdFrom/To` filters inside the scan window (no `createdAt` index is proposed).
- **Split-aware (AE-23, §11.1).** The note scan is a Convex `paginate` under a byte bound, so a window can come back `SplitRequired`, meaning it may be incomplete. The server then returns `notes: []` for that call (no partial matches) with Convex's `splitCursor`, `continueCursor` and `pageStatus`, and the caller replaces the window with the two split ranges, as §11.1 says. `search.all` returns four groups, not a `PaginationResult`, so `usePaginatedQuery` cannot drive it; #850 implements the §11.1 rules itself. With them, no window is skipped, and a match is never lost to a split or to a group limit.
- Why 25: bodies are unbounded today (§2.1) and one function may read only a limited volume (Convex documents about 16 MiB and 32,000 documents per function; vendor figure, not verified here, UNKNOWN). #828 D4 proposes a 128 KiB body cap for the new paths. Until a body cap exists on every writer, the window size is a guess to be validated. What protects the read is not the 25 but the byte bound (§8.6 R2: server-set `maximumRowsRead` and `maximumBytesRead` on the feed-order scan), so a call may scan fewer than 25 notes; `scanned` says how many, and `continueCursor`, `isDone` and the split fields say where to go next.
- Alternative: a Convex `searchIndex` on a derived plain-text field. It needs a schema owner and a field written by every body writer, and it stores a second copy of private text; and `maximumRowsRead`/`maximumBytesRead` are "not enforced for search queries" (installed `PaginationOptions`), so it would need a different read bound (the scan above uses `withIndex`, not a search index, so the options apply to it). Not proposed here. If chosen, #849 stops and a schema slice is raised first.
- Resource search stays gated until a resources API exists (#849 step 2).
- Tasks, habits and goals groups keep their current behaviour; making them bounded is outside this contract (listed in §11.2).

### 9.5 What UI tickets may call

| Ticket | May call | May not |
|---|---|---|
| #843 composer | `notes.create` (+`kind`), `note_tasks.captureTodo` once it exists, `note_tags.attach` after create | write `localStorage` as content; show a kind whose API is missing; parse `#tag` or `- [ ]` from text (OD-8) |
| #844 feed | `notes.feed` (active) through `usePaginatedQuery`, `notes.togglePin`, `note_tags.forNotes` | read `body`; count rows; scan; page by hand without the §11.1 split rules |
| #845 archive and trash | `notes.feed` (archived, trash) through `usePaginatedQuery`, `archive`, `unarchive`, `remove`, `restore` | show a delete-forever or empty-trash control; promise anything beyond OD-4; page by hand without the §11.1 split rules |
| #848 tags UI | `note_tags.*` (`notesByTag` through `usePaginatedQuery`) | build its own hierarchy rules |
| #850 search UI | `search.all` (+filters, `notesPage`), following the §11.1 split rules | collect locally; show a `SplitRequired` window's matches; say "no results" before the scan is done |
| #857 TODO view | `note_tasks.list` through `usePaginatedQuery`, `listForNote`, existing `tasks.toggleCompletion`, `tasks.remove`, `tasks.restore` (showing `{ success: false }` honestly for a linked row whose block is gone, NT-04) | create a task by viewing a note; invent a second task identity, Kanban or recurrence |

## 10. Nested tags

Superseded 2026-10-12 (NT-05): a page's tags are `page-meta.data.tags` in its body. The tables and rules below may be built only as a derived index of those strings, rebuilt from bodies. The §10.1 normalisation and the §10.2 limits apply to the strings. The hierarchy (§10.3, §10.5, `parentId`) is held until a nesting representation in tag strings is chosen (UNKNOWN).

### 10.1 Name normalisation and duplicates (AE-12)

`normalizeTagName(input)` is a pure function used by every tag writer.

1. Remove U+200E, U+200F, U+061C, U+200B, U+FEFF and U+2060 (bidi marks and zero-width characters often pasted from Hebrew and Arabic text).
2. `NFC`-normalise. Treat every Unicode whitespace character (tabs and line breaks included) as a space, trim both ends, collapse inner runs to one space. The result is `name` (display).
3. Reject (`TAG_NAME_INVALID`) any remaining Unicode control (Cc) or format (Cf) character other than U+200C and U+200D.
4. Length 1–64 Unicode code points (`Array.from(name).length`; a surrogate pair counts once).
5. Reject `/`, `\`, `#` and `,` (kept free for path, hashtag and list representations).
6. `nameKey = NFKC(caseFold(NFKC(name)))` (locale-independent). `caseFold` is Unicode **default case folding**: the full folding of `CaseFolding.txt`, statuses C and F, never T. It is not `toLowerCase()`: `Σ`, `σ` and `ς` fold to one letter (`σ`), but `toLowerCase()` leaves `ς` apart from `σ`; `ß`, `ẞ` and `SS` fold to `ss`, but `toLowerCase()` leaves `ß` alone. `toLowerCase()`, `toLocaleLowerCase()` and `toUpperCase()` must not stand in for it. The key is the Unicode default caseless-matching recipe, not `NFKC_Casefold` itself: `NFKC_Casefold` also deletes every Default_Ignorable_Code_Point, which would merge names that differ only by U+200C or U+200D, characters step 3 keeps on purpose (they carry meaning in Persian and in emoji sequences).

Duplicate policy: among **live** tags with the same `parentId` (roots share `parentId: undefined`), `nameKey` is unique. Different parents may reuse a name. Names differing only by case (Unicode folding, step 6), width, compatibility form, composition or an inner bidi mark are duplicates. Hebrew niqqud points are **not** stripped, so a pointed and an unpointed spelling are different tags (UNKNOWN whether the owner wants them merged; not decided). A soft-deleted tag does not block its name, so a restore can meet a live tag with the same name; §10.5 resolves that by renaming, not by failing.

**Where `caseFold` comes from.** JavaScript has no case-folding function. #847 chooses one of two sources and says which in its PR: a dependency (its licence and `bun run scan:forbidden-tech` result are unchecked here: UNKNOWN), or a checked-in table of the C and F foldings of one named Unicode version, whose header names that version and which a test compares entry by entry with that version's `CaseFolding.txt`. `nameKey` is stored, so changing the table or the version changes keys; that is a migration with its own `MIGRATIONS.md` entry, never a silent change.

**Known limits of the equivalence** (it is exactly the key's, no more): no Turkish or Azeri rules, so `İ`, `I`/`i` and `ı` are three different tags where a Turkish reader would join some of them; no confusable matching across scripts, so Cyrillic `а` and Latin `a` differ; names that differ only by U+200C or U+200D differ; a character unassigned in the pinned Unicode version folds to itself.

### 10.2 Limits (EXTRAPOLATED numbers, enforced by bounded reads)

| Constant | Value | Check |
|---|---|---|
| `TAG_NAME_MAX` | 64 code points | §10.1 |
| `TAG_MAX_DEPTH` | 5 (a root is depth 1) | walk up from the parent, at most 5 steps |
| `TAG_MAX_PER_USER` | 500 live tags | `take(501)` on `by_userId_deletedAt` before create and before restore |
| `TAG_MAX_CHILDREN` | 100 live children per parent; the root counts as a parent (`parentId` absent), so at most 100 root tags | `take(101)` on `by_userId_deletedAt_parentId_nameKey` with `deletedAt` undefined and `parentId` fixed, before every write that adds live children to that parent: create, move, restore, and the promotion in remove (§10.3, §10.5) |
| `NOTE_MAX_TAGS` | 20 live links per note | `take(21)` on `by_userId_noteId_deletedAt` |

Exceeding returns `TAG_LIMIT` or `NOTE_TAG_LIMIT`, before any write. No limit check scans an unbounded range. Every write that makes a tag live (create, restore) checks `TAG_MAX_PER_USER`.

### 10.3 Hierarchy, cycles, moves

- `move(tag, newParent)`: reject `newParent == tag` and any newParent whose ancestor chain contains `tag` (`TAG_CYCLE`). The chain walk stops after `TAG_MAX_DEPTH + 1` steps; a longer chain means stored data is already corrupt and returns `TAG_CORRUPT_HIERARCHY` instead of looping.
- The new depth is `depth(newParent) + 1 + height(subtree of tag)`. The subtree is read level by level, at most `TAG_MAX_DEPTH` levels, `take(TAG_MAX_CHILDREN + 1)` per level, never more than `TAG_MAX_PER_USER` rows in total. A result above `TAG_MAX_DEPTH` is `TAG_DEPTH_EXCEEDED`.
- `parentId` must belong to the same owner and be live (`TAG_PARENT_NOT_FOUND`).
- Capacity: a move to a different parent first reads the new parent's live children (`take(TAG_MAX_CHILDREN + 1)`); if there are already `TAG_MAX_CHILDREN`, the move returns `TAG_LIMIT` and writes nothing. A move within the same parent (`changed:false`) adds no child and is not checked.
- No `depth` is stored. It is derived on demand, so a move never rewrites descendants.
- Two concurrent conflicting renames or moves: the sibling-name check reads the index range that the other writer inserts into, so Convex's optimistic concurrency control retries one of them and it then sees the other (vendor behaviour, EXTRAPOLATED; to be shown by TG-14 in §12.4, or reported UNKNOWN if the harness cannot run two transactions).

### 10.4 Membership

- One `noteTagLinks` row per `(userId, noteId, tagId)` ever. `attach` finds the pair through `by_userId_noteId_tagId`: live → `attached:false`; soft-deleted → revive it (clear `deletedAt`, set `linkedAt = now`, bump `updatedAt`); absent → insert with `linkedAt = createdAt = now`. `detach` soft-deletes a live row and returns `detached:false` otherwise. Both are idempotent and neither leaves a second row.
- Revival resets `linkedAt`, the ordering key of `notesByTag` (AE-20), so a note that is detached and re-attached moves to the top of that tag's list exactly like a first attach. `createdAt` keeps the first attach time. Ordering by `createdAt` or by `updatedAt` is not used: the first would leave a re-attached note in its old place, and the second would move a note whenever any future write touched the row.
- The note must be live (not trashed); the tag must be live; both owned. Archived notes accept attach and detach.
- A link is visible only if the link is live **and** the tag is live **and** the note is in the requested view.

### 10.5 Deleting a tag

- `remove` soft-deletes the tag only. It does not write any link row, so it is O(children) and unbounded cascades cannot happen. Links to a deleted tag simply stop being visible.
- Children move to the removed tag's parent, the destination `D` (the root when the tag is a root; OD-6 default). Remove is validate-first (AE-9): every check below runs before any write, in this order, and any failure returns its code with nothing written.
  1. The tag is owned and live, else `TAG_NOT_FOUND`.
  2. Read the tag's live children: `take(TAG_MAX_CHILDREN + 1)` on `by_userId_deletedAt_parentId_nameKey` with `parentId` = the tag. A 101st row means the limit was broken in stored data: `TAG_CORRUPT_HIERARCHY`.
  3. **Capacity.** Read `D`'s live children the same way; that count includes the tag itself. The result after the remove is `count(D) − 1 + count(children)`. Above `TAG_MAX_CHILDREN` → `TAG_LIMIT`. Example: `D` holds the tag and 99 siblings (100) and the tag has 2 children → 101 → `TAG_LIMIT`; with 1 child → 100 → allowed.
  4. **Names.** For each child, one point read of its `nameKey` among `D`'s live children (at most 100 reads). A hit on any tag other than the one being removed → `TAG_NAME_TAKEN` with `childTagId`. A hit on the tag being removed is not a collision: it is deleted in the same transaction (a child may share its parent's name, §10.1; §10.5 restore handles the return).
  5. Then, in the same transaction, the tag gets `deletedAt` and `updatedAt`, and each child gets `parentId` = `D` and `updatedAt`. A concurrent create or move into `D` reads the same index range, so Convex's optimistic concurrency control retries one of them and the cap holds (vendor behaviour, EXTRAPOLATED; TG-14).
- `restore` returns `TAG_RESTORE_EXPIRED` after 30 days. Otherwise it brings the tag back under its old parent if that parent is live, otherwise under the root (`reparentedToRoot:true`). Before any write it checks, in order: `TAG_MAX_PER_USER` (`take(501)` on `by_userId_deletedAt`; already 500 live → `TAG_LIMIT`), depth (the restored tag has no children, because removal promoted them, so its depth is `depth(target) + 1`; above `TAG_MAX_DEPTH` → `TAG_DEPTH_EXCEEDED`, which can happen when the old parent was moved deeper meanwhile), and the target's capacity (already `TAG_MAX_CHILDREN` live children → `TAG_LIMIT`). There is no fallback to another parent: the user can make room and restore again inside the 30 days. It does not fail because a live tag holds the name, and that matters because removal can cause it: a tag and its child may share a name (different parents, §10.1), and removing the parent promotes the child into the parent's own sibling set, where it collides with nothing because the parent is gone; restoring the parent would then collide with it. The name is resolved deterministically:
  - Candidate 1 is the stored `name`. Candidate k, for k = 2 … 21, is that name followed by `" (k)"`; the name is first cut at a code-point boundary to `TAG_NAME_MAX` minus the suffix length and trimmed at the end, so every candidate satisfies §10.1 steps 1–5. The digits make the suffix language-neutral (no English word is written into a Hebrew or Arabic name).
  - Each candidate's `nameKey` is computed by §10.1 step 6. The first candidate whose `nameKey` no live tag under the target parent holds is the restored name. Each check is one point read on `by_userId_deletedAt_parentId_nameKey` with all four fields fixed, so at most 21 reads.
  - The patch clears `deletedAt` and sets `parentId`, `name`, `nameKey` and `updatedAt` together. `renamedTo` is in the result only when the name changed, so the UI can say so (copy is OD-3 territory). Children that moved up are not moved back, and the live sibling is not touched.
  - If all 21 candidates are held, the result is `TAG_NAME_TAKEN` (with `existingTagId` of the holder of candidate 1) and nothing is written.
  - Why not the alternatives: moving the promoted child back under the restored tag needs a record of which children removal moved (a new field) and would undo any move the user made since; refusing the removal because a later restore might collide would block a legitimate delete. Neither is adopted. Removal is refused only when the promotion itself would break a rule (a name collision or `TAG_LIMIT` in step 3 or 4 above).
- No physical deletion. Membership rows follow account soft deletion with the tables.

### 10.6 Relationship to other tag-like things

- Superseded 2026-10-12 (NT-05): `page-meta.data.tags: string[]` in the block codec (`packages/utils/src/blocks.ts:24-30`) **is** the tag store. There is still one store, because the tag tables only mirror it (#837 DO NOT). Was: it was not the tag store, and tag APIs neither read nor wrote it.
- Inline `#word` text is plain text. The composer may offer autocompletion that calls `attach` on an explicit user choice; nothing parses the body.
- Folders and projects (#260) are separate. #837 asks that their semantics not be copied unchecked. Checked: no projects or folders table exists; `tasks.projectId` and `projectName` are free strings kept "until a projects table exists" (`convex/schema.ts:236-238`) and carry no hierarchy, uniqueness or deletion rules. Nothing is borrowed from them.

## 11. Paging, boundedness, generated API

### 11.1 Paging and the split protocol (AE-4, AE-23)

- Argument `paginationOpts` (`paginationOptsValidator`: `numItems`, `cursor`, optional `endCursor`, `id`, `maximumRowsRead`, `maximumBytesRead`); result `page`, `isDone`, `continueCursor`, optional `splitCursor` and `pageStatus` (`paginationResultValidator`). Both validators come from `convex/server` (installed 1.32.0, `dist/esm-types/server/pagination.d.ts`), so a strict `returns` cannot drop the split fields. Search carries the same options and fields inside `notesPage` (§9.4).
- Every paginated API in this contract, with its server-set values (constants in §8.6 R2; all EXTRAPOLATED):

| API | Slice | Paginated table | `numItems` | `maximumRowsRead` | `maximumBytesRead` |
|---|---|---|---|---|---|
| `notes.feed`, Active, Archived and Trash views | #842 | `notes` | 1–20, default 20 (`FEED_PAGE_MAX`) | `FEED_MAX_ROWS_READ` (40) | `FEED_MAX_BYTES_READ` (4 MiB) |
| `note_tags.notesByTag` | #847 | `noteTagLinks` | 1–8 (`TAGGED_PAGE_MAX`) | 40 | 4 MiB |
| `note_tasks.list` | #856 | `tasks` | 1–8 | 40 | `TODO_MAX_BYTES_READ` (2 MiB) |
| `search.all` `notesPage`, no `tagId` | #849 | `notes` | 1–25 (`SEARCH_SCAN_NOTES`) | 40 | 4 MiB |
| `search.all` `notesPage`, with `tagId` | #849 | `noteTagLinks` | 1–8 | 40 | 4 MiB |

- `cursor`, `endCursor` and `id` pass through unchanged; `continueCursor`, `isDone`, `splitCursor` and `pageStatus` are returned unchanged. The server never invents, drops or rewrites a cursor. A `SplitRequired` result carries no items (`page: []`, or `notes: []` in search), because its page may be incomplete.
- **The caller's rules** (verified against the installed `convex/react` `usePaginatedQuery`, `dist/esm/react/use_paginated_query.js`, which does exactly this; the web feed, Archive, Trash, tag and TODO views use that hook; anything else, including #850's search, tests and scripts, applies the rules itself):
  1. `pageStatus === "SplitRequired"`: the result for range `(cursor, continueCursor]` is not used. The caller asks for `(cursor, splitCursor]` with `{ cursor, endCursor: splitCursor }` and for `(splitCursor, continueCursor]` with `{ cursor: splitCursor, endCursor: continueCursor }`, keeps `numItems`, and applies these rules to each answer (either may split again). Their items, in that order, replace the range.
  2. `pageStatus === "SplitRecommended"`: the page is complete and is used. A reactive caller may split it the same way to keep later re-runs small; a one-shot caller need not.
  3. Otherwise the page is used, and the next page starts at `{ cursor: continueCursor }` with no `endCursor`, until `isDone` is true. Only `isDone` ends the list; a short or empty page does not.
  4. `SplitRequired` without a `splitCursor` is not something the sources say can happen (UNKNOWN, UK-11). A caller that meets it reports the list or search as incomplete ("some notes could not be loaded") and never shows it as finished or as "no results".
- Order is total: index fields then `_creationTime`. The feed's order is pinned first, then newest `updatedAt`.
- "Stable paging without duplicates" (#844) is a property of the order **and** of the client keeping loaded pages pinned (`usePaginatedQuery`). A repeated one-shot call with an old cursor can repeat or skip a note whose `updatedAt` changed between calls. #844's test has to show it, not assume it.
- Paged results carry safe summaries only. `body` and fence text never appear in a page.
- Byte bound (AE-21, §8.6 R2): a page can be shorter than `numItems`, and a `SplitRequired` page is empty by the rule above.

### 11.2 Boundedness rule and the legacy exceptions (AE-16)

A reader introduced or changed by these slices must: start from an index prefix that fixes `userId` and the lifecycle fields; read with `paginate` or `take(N)` where N is a named constant; and never `collect()` a user-owned table unless an enforced limit proves the size. Review rejects anything else, and rejects any second task store.

Existing unbounded readers stay as they are until their owner acts:

| Reader | Lines | Owner |
|---|---|---|
| `listNotesForUser` / `notes.list` / MCP `notes_list` | `convex/notes.ts:29-33` | #842 keeps the shape, adds the archive filter. Boundedness: UI moves to `notes.feed` (#844, #805); then the legacy list can be capped. UNKNOWN date. |
| `search.all` | `convex/search.ts:80-97` | #849 bounds it for callers that pass `notesPage`. The call without it stays unbounded until #850 moves `SearchScreen` to `notesPage` (NT-10). |
| `tasks.list`, `listDueInRange`, `listToday` | `convex/tasks.ts:87-90`, `:129-132`, `:368-371` | no CORE-WEB owner. The TODO list uses its own index (§8.2). |
| `dayPlans.listCarryOver` | `convex/dayPlans.ts:195-201` | none |
| `activity.list`, `analytics.overview`, `insightsSummary` | `convex/activity.ts:46-54`, `convex/analytics.ts:123-148`, `:204-217` | none |
| account deletion sweep | `convex/lib/accountDeletion.ts:186-205` | #808 |

### 11.3 Generated API ownership (AE-13)

- `convex/_generated/api.d.ts` lists every module by import and by an `ApiFromModules` entry (`convex/_generated/api.d.ts:10-75`, `:83-`). A function added to an existing module (`notes`, `tasks`, `search`) changes its type through `typeof module` and needs **no** edit to that file. A new module (`note_tasks`, `note_tags`) needs one import and one entry.
- So #842 and #849 list the file in their scope but should not need to change it. #847 and #856 each add exactly their own module line. Serial order: #856 and #847 in either order, never in parallel.
- No ticket here runs `convex codegen`, `convex dev` or any `convex:*` script. Codegen can call credentialed start-push and stage backend state (#837 safety gate). The approved generation route is UNKNOWN; a hand edit in the exact generated format is allowed only if the coordinator authorises it, and is then counted in scope. `dataModel.d.ts` derives from `typeof schema` and needs nothing.
- No `CONVEX_VERBOSE`, debug or raw-response logging.

## 12. Synthetic acceptance coverage

All fixtures are synthetic. Two users, A and B. Fixed clock `NOW = 1_800_000_000_000`, `DAY = 86_400_000`, `GRACE = 30 × DAY`, `UNDO = 300_000`. Counts go in the PR as pass, fail, skip.

### 12.1 Harness requirements (AE-15)

- The helper `run()` calls `fn._handler(ctx, args)` directly (`convex/lib/testFakeCtx.ts:71`), which **skips `args` and `returns` validation**. It cannot show that a strict return validator accepts a linked row (TK-14). Tests must run the function through a runtime that applies validators, or call the validator explicitly.
- The fake contexts in `convex/lib/testFakeCtx.ts:19-52` and `convex/notes.test.ts:20-89` model one `eq` (or `eq`/`gte`/`lt` in the shared one), no `take`, no `paginate`, and no multi-field index semantics. They cannot show indexed paging or boundedness.
- `convex-test` 0.0.38 is pinned (`package.json:45`). One test uses it, `convex/lib/agentComponent.test.ts` (#815; 21 pass, 3 todo when run on 2026-10-11), which runs the Agent component's own functions under `bun test` through explicit module maps; per its header it proves argument validation (a malformed thread id is rejected) and a `paginationOpts` query inside that component. It calls no Tempo function, so whether Tempo's modules (`requireUser`, `notes`, `tasks`) load under it, whether `returns` validators are applied to them, and whether multi-field index ranges behave as in production are UNKNOWN. If no harness can apply validators, model index ranges and paginate, the affected case is reported UNKNOWN, never skipped silently or replaced by a mock that passes.
- Root `bun run test` is `bun test convex apps/web/lib tests/unit packages` (`package.json:18`; `packages` was added by #872). New test files under other folders need an explicit command.

### 12.2 Notes: kinds, lifecycle, feed

| ID | Case | Expected |
|---|---|---|
| NL-01 | Legacy row with no `kind`, no `archivedAt` | in Active feed as `kind:"note"`; `kind:"note"` filter includes it; `quick` and `todo` exclude it |
| NL-02 | Create each kind; read back; create with `kind:"blinko"` | all three round-trip; the invalid literal is rejected by the validator |
| NL-03 | `setKind` quick → note | field removed (reads as absent); body, title, pinned, tags, links byte-identical before and after |
| NL-04 | `setKind` to the same kind | `changed:false`; `updatedAt` unchanged |
| NL-05 | Archive; read Active, Archived | gone from Active, first in Archived; archive twice → `changed:false`, `archivedAt` unchanged |
| NL-06 | Unarchive | back in Active; `archivedAt` absent |
| NL-07 | Archive / setKind on trashed note; on A's note as B | `{ok:false,"NOTE_NOT_FOUND"}`, identical for both |
| NL-08 | Remove | `undoUntilMs = deletedAt + 300000`, `restorableUntilMs = deletedAt + GRACE`; the two differ |
| NL-09 | Restore at `deletedAt + UNDO + 1` | success (toast expired, server window open) |
| NL-10 | Restore at `deletedAt + GRACE`; at `+ GRACE + 1` | success; `{success:false, reason:"expired"}` |
| NL-11 | Trash view with `nowMs` such that `deletedAt = nowMs - GRACE`; and `nowMs - GRACE - 1` | included; excluded. Excluded row still exists in the table |
| NL-12 | Archive then remove then restore | `restoredTo:"archived"`; appears in Archived, not Active |
| NL-13 | Restore a live note | `{success:false, reason:"not_in_trash"}` |
| NL-14 | B calls every function against A's notes | nothing visible or changed; restore throws |
| NL-15 | 120 notes, `numItems` 0, 1, 20, 21, 50, 1000, `NaN` | clamped to 1–20 or rejected as specified; walking all pages returns each note once; pinned first; equal `updatedAt` ordered deterministically |
| NL-16 | Instrumented context during `feed` | reads go through the §8.1 index and range; no `collect()` of `notes`; `notes` documents read ≤ page size + small constant; `tasks` documents read ≤ 6 per To-do card (NL-27) |
| NL-17 | Legacy `notes.list` and MCP `notes_list` with an archived note | excluded |
| NL-18 | Inactive account (`deletedAt` set) | every function throws `This account is not active` |
| NL-19 | `pageType:"template"` note (stored with `isTemplate:true`) | never in any feed view, Trash or search |
| NL-20 | Note with a valid fence, a malformed fence and an unclosed fence | `preview` contains neither fence text nor `"type":`; the card has no `body` key |
| NL-21 | `kind` filter with view `archived`/`trash`; `nowMs` missing for trash | throws the specified message |
| NL-22 | Account deletion with live, archived, already-trashed notes | live and archived get the account `deletedAt`; the already-trashed keeps its older one |
| NL-23 | Instrumented context: 200 template notes (`isTemplate:true`) that sort ahead of 30 ordinary notes in every index order, in Active, Archived and Trash; `isTemplate:false` written directly | the first page of each view holds ordinary notes only; documents read ≤ page size + small constant, the same as with no templates; no `filter` on `pageType`; `isTemplate:false` rejected by the validator |
| NL-24 | Byte bound (§8.6 R2), in a harness that applies `maximumBytesRead`: 50 notes whose bodies are each about 900 KiB (under the vendor document ceiling, UNKNOWN); default page; then caller `paginationOpts` carrying `maximumBytesRead` of 1e12 and of 1; then walk the whole list with the §11.1 rules | bytes read per call ≤ `FEED_MAX_BYTES_READ` plus one document; a call that hits the bound returns `pageStatus:"SplitRequired"`, `page: []`, a `splitCursor` and `isDone:false`; the caller's byte and row values change nothing (replaced by the server constants); the walk, splits included, returns each of the 50 notes exactly once and ends with `isDone:true`; no card has a `body` key. If no harness can apply the option, UNKNOWN (UK-11), never a mock that passes; the feed then does not ship on it (§8.6) |
| NL-25 | Preview writers (§8.6 R1): `createNoteForUser` and `updateNoteForUser`, also through MCP `note_create` and `note_update`, with a valid, a malformed and an unclosed fence, and with a body over 1 MiB; a pin toggle; a legacy row with no `preview` | the stored `preview` equals `projectPageText(body, { summaryChars: 280 }).summary`, is ≤ 280 UTF-16 units and holds no fence text, JSON or block id; an update that changes `body` changes `preview` in the same patch; a pin toggle leaves it; every inserted and patched row is read, none holds a `preview` that disagrees with its `body`; the legacy row appears in the feed with a projected preview and no `body` key |
| NL-26 | Split protocol (§11.1) in the Active, Archived and Trash views, in a harness that applies the byte bound: large bodies as in NL-24; a call with `endCursor`; the `returns` validator | `endCursor` is honoured (the call returns exactly `(cursor, endCursor]`); `continueCursor`, `isDone`, `splitCursor` and `pageStatus` equal what `paginate` returned; a `SplitRequired` call returns `page: []` and reads no `tasks` row (instrumented); the validator is `paginationResultValidator` and accepts both split fields. UNKNOWN (UK-11) without such a harness |
| NL-27 | `taskPreview` bound (§9.1, §5.10): 20 To-do notes, each with 50 live linked tasks at every cap; one To-do note with 5 live linked tasks; default page, then `numItems` 50 | each full card has 5 items and `truncated:true`; the 5-task card has `truncated:false`; no card has `total` or `open`; `tasks` documents read per call ≤ 120 (instrumented); `numItems` 50 returns at most 20 cards |
| NL-28 | Restore after account deletion (NT-09b): a note with task blocks and a page-meta block; account deletion; sign-in restore; then `notes.restore` of that note from Trash | before the note restore, its `noteBlocks` and linked task rows are soft-deleted; after it, they are live again, rebuilt from the body, with the task rows' `_id`s unchanged; `note_tasks.listForNote` lists the blocks; nothing reports `block_missing` or `BLOCK_NOT_FOUND` |

### 12.3 TODO identity

Superseded 2026-10-12: TK-02 to TK-05 (`link`), TK-08 (a tick leaves the body unchanged), TK-11 and TK-23 (restore clears a link), TK-13 (`block_missing`), TK-15 (body edits do not propagate) and the `link` admission cases of TK-24 test rules that NT-02 and NT-04 replace. TK-25 to TK-29 and NB-01 below replace them.

| ID | Case | Expected |
|---|---|---|
| TK-01 | `captureTodo` twice with one `requestId` | one note, one row, one block; second call returns the same ids |
| TK-02 | `link` the same block twice | one row; `created:false` the second time |
| TK-03 | `link` on B's note; with A's `taskId` as B | `NOTE_NOT_FOUND`; `TASK_NOT_FOUND` |
| TK-04 | `link` to a broken block, a non-task block, a missing block | `BLOCK_BROKEN`, `BLOCK_NOT_TASK`, `BLOCK_NOT_FOUND`; no write |
| TK-05 | `link` with a `taskId` already linked elsewhere; a block already linked to another row | `TASK_ALREADY_LINKED`; `BLOCK_ALREADY_LINKED` |
| TK-06 | Block title of 281 and of 280 code units | `TITLE_INVALID`; ok |
| TK-07 | 50th and 51st **live** linked task in one note, with 0 and with 120 removed linked tasks on that note | ok; `NOTE_TASK_LIMIT`, identical in both fixtures |
| TK-08 | Tick through `tasks.toggleCompletion` | `listForNote` shows done; `notes.body` byte-identical; no revision or receipt written |
| TK-09 | The same row via `listToday`, a `dayPlans` top task and `listForNote` after reload | one `_id` |
| TK-10 | Complete a repeating linked task | two rows; the new one has no link fields; the original keeps its link |
| TK-11 | `tasks.remove` then `tasks.restore` | link intact; then: remove, link a new row to the same block, restore the old row → success with `linkCleared:true`, `linkClearedReason:"block_taken"`, exactly one live row linked |
| TK-12 | Trash the note | tasks stay live; `source.state = "note_trashed"`; restore the note → `ok` |
| TK-13 | Remove the block from the body | task untouched; `block_missing` |
| TK-14 | With a linked row present, call `tasks.list`, `listDueInRange`, `listToday` and `dayPlans.listCarryOver` through validators | none throws a return-validation error (and `dayPlans` accepts `flexibility`) |
| TK-15 | Body save or MCP `note_update` that edits a linked block's `data` | row unchanged |
| TK-16 | MCP `task_update completed:true` on a linked task | overlay shows done |
| TK-17 | `undoCreate` after `addTask` and after `captureTodo`; again after the window; after an unrelated later edit | row and block gone; `UNDO_EXPIRED`; `UNDO_CONFLICT` without deleting the later work |
| TK-18 | Forged link: `tasks.create`/`update`/MCP with `sourceNoteId` | rejected by the validator or ignored; no link written |
| TK-19 | `note_tasks.list` for each status; `numItems` 50; 30 unlinked tasks whose `description` is about 900 KiB each (written directly, as legacy rows) | correct order (undated first for open), no deleted or foreign row; at most 8 items per page; the result validator accepts `splitCursor` and `pageStatus`; bytes read per call ≤ `TODO_MAX_BYTES_READ` plus one document, and at most 8 notes read by id; walking with the §11.1 rules returns each task exactly once. UNKNOWN (UK-11) without a harness that applies the byte bound |
| TK-20 | Two concurrent `link` calls for one block | one row. UNKNOWN if the harness cannot run two transactions |
| TK-21 | `captureTodo` / `addTask` when the body write is rejected (stale revision, oversized body) | no row exists afterwards |
| TK-22 | Note with 120 removed linked tasks and 3 live ones; `listForNote`, `taskPreview`, then one more `link` | the live read returns exactly the 3 live rows, `truncated:false`, and its documents read stay ≤ 3 + small constant (instrumented); the removed read returns the 20 newest removals with `removedTruncated:true`; the extra link is ok; a removed row whose block has a live row is not shown as a ghost |
| TK-23 | Restore against L8 (L6): note N with 50 live linked tasks; remove one (49 live); link a new task to another block (50 live); restore the removed one. Then the same with 49 live after the removal. Then a removed task whose block is taken **and** whose note is full | the first restore succeeds with `linkCleared:true`, `linkClearedReason:"note_task_limit"`; the restored row has neither link field; N still has exactly 50 live linked rows; the old block reads as page-local. The second keeps its link, no `linkCleared`. The third reports `"block_taken"` (checked first). Nothing throws |
| TK-24 | Linked-task caps (§5.10): `link` with `taskId` of rows stored directly with a `description` of 10,001 units, a 281-unit `title`, a checklist item `text` of 281, a `projectName` of 201, a `timeSpentOnDay` whose JSON is over 2,000; the same rows exactly at every cap; on a linked row, `tasks.update` and MCP `task_update` with a 10,001-unit `description`; on an unlinked row, the same update; `createQuick`, brain dump and `tasks.create` with long text | `TASK_TOO_LARGE` and no write for each over-cap row; ok at the caps; the linked-row updates throw `Task text too long` and leave the row unchanged; the unlinked update is accepted as today; the three creators behave as today and produce unlinked rows |
| TK-25 | Rebuild (NT-01): a note with 3 valid task blocks, a page-meta block with 2 tags and one broken block; soft-delete every derived row of the note, then rebuild from the body | every `noteBlocks` row, task row and tag index row equals its value before, field for field; the task rows keep their `_id` (revived by key); `notes.body` is byte-identical, and nothing writes `body` |
| TK-26 | Typed-form write (NT-02): tick a linked task in Today (`tasks.toggleCompletion`); MCP `task_update` of its title; `tasks.update` of its `priority` | the body differs only inside that block's bytes; the row is re-derived (`done`, then the new title); a body revision and receipt are written; the `priority` write is refused and nothing changes |
| TK-27 | Block removal and return (NT-04): remove a task block from the body; page Undo; then `tasks.remove` on the linked task; then `tasks.restore` | the row is soft-deleted with the body write and revived with the same `_id` by the Undo; `tasks.remove` removes the block from the body; `tasks.restore` returns `{ success: false }` while the block is absent |
| TK-28 | Bound (NT-02): a body with 60 valid task blocks | the first 50 in body order have derived rows and the last 10 are page-local; moving a block within the body changes which are indexed only as that rule says |
| TK-29 | Prose checkboxes (NT-06): a body with `- [ ] buy milk` and `- [x] done` lines | no task row, no block and no `noteBlocks` row |
| NB-01 | Live-row index (NT-09a, §8.7): one key `(user, note, blk_X)` with 30 soft-deleted `noteBlocks` rows and 1 live row; then the same with 2 live rows | the lookup reads only the live row (documents read ≤ 2, instrumented); with 2 live rows the call fails as corrupt data; the schema has `deletedAt` before `blockId` in that index |

### 12.4 Tags

Superseded 2026-10-12 (NT-05): TG-05 to TG-07, TG-11, TG-12 and TG-19 to TG-22 test the held hierarchy and do not apply until a nesting representation is chosen. The other cases apply to the tag strings in `page-meta.data.tags` and to the derived index; attach and detach are body writes, and a rebuild from bodies gives the same index (TK-25).

| ID | Case | Expected |
|---|---|---|
| TG-01 | NFC vs NFD spelling; full-width vs ASCII; mixed case | one tag, `TAG_NAME_TAKEN` on the second |
| TG-02 | Hebrew name with a trailing RLM; with niqqud vs without | RLM stripped, same tag; niqqud spellings are different tags |
| TG-03 | Empty after trim; 65 code points; 64 code points with astral characters; `/`, `\`, `#`, `,`; a control character | invalid; invalid; valid; invalid ×4 |
| TG-04 | Same name under two parents; after soft-deleting the first | allowed; allowed |
| TG-05 | Create at depth 5; at depth 6; move a subtree so it would exceed 5 | ok; `TAG_DEPTH_EXCEEDED`; `TAG_DEPTH_EXCEEDED` |
| TG-06 | Move a tag under itself and under a descendant | `TAG_CYCLE` |
| TG-07 | Fixture with a hand-made cycle in stored parents | `TAG_CORRUPT_HIERARCHY`, terminates |
| TG-08 | 501st tag; 101st child; 21st link on a note | `TAG_LIMIT`; `TAG_LIMIT`; `NOTE_TAG_LIMIT` |
| TG-09 | Attach twice; detach twice; attach after detach | `attached:false`; `detached:false`; the same link row revived with `linkedAt` reset to the re-attach time and `createdAt` unchanged; never two rows for the pair |
| TG-10 | Attach A's note with B's tag; B's note as A; trashed note; deleted tag | `TAG_NOT_FOUND`; `NOTE_NOT_FOUND`; `NOTE_NOT_FOUND`; `TAG_NOT_FOUND` |
| TG-11 | Remove a tag with children | children under the grandparent; links untouched; `notesByTag` for it → `TAG_NOT_FOUND`; a child name collision → `TAG_NAME_TAKEN`, nothing changed |
| TG-12 | Restore at `GRACE` and `GRACE + 1`; restore with a live same-name sibling; with a deleted parent | ok; `TAG_RESTORE_EXPIRED`; ok, restored as `Name (2)` with `renamedTo` (TG-19, TG-20); `reparentedToRoot:true` |
| TG-13 | Account deletion | both tag tables soft-deleted (schema-derived exhaustive coverage), foreign rows untouched, earlier timestamps kept |
| TG-14 | Two concurrent conflicting renames or moves | exactly one succeeds. UNKNOWN if the harness cannot run two transactions |
| TG-15 | `notesByTag` paging with archived and trashed notes mixed in; `numItems` 50; a call with `endCursor` | only notes in the requested view; each once; truthful `isDone`; at most 8 items per page; `endCursor` honoured; `splitCursor` and `pageStatus` passed through, `page: []` on `SplitRequired` |
| TG-16 | Attach tag T to note X, then to note Y; detach X and attach it again | `notesByTag(T)` order is Y, X before the re-attach and X, Y after it; X's link row is the same row, `createdAt` unchanged |
| TG-17 | Case folding at one parent: `Σ`, `σ`, `ς`; `ß`, `ẞ`, `SS`, `ss`; `ſ`, `s` | within each group the second spelling gets `TAG_NAME_TAKEN` with `existingTagId`; the three groups are three tags; the same spelling under another parent is allowed. A `NFKC(name).toLowerCase()` key would accept `Σ`/`ς` and `ß`/`SS`, so this case fails it |
| TG-18 | The documented limits of the key: `İ`, `I`/`i` and `ı`; Cyrillic `а` and Latin `a`; `ab` and `a` + U+200C + `b` | `I` and `i` are one tag; every other pair is two tags, each accepted (the key's equivalence is not wider than §10.1) |
| TG-19 | Create `Work` at the root and a child `Work` under it; remove the parent; restore the parent | ok; the parent returns to the root as `Work (2)` with `renamedTo:"Work (2)"`; the promoted child is still `Work`, still at the root and not written; both are live |
| TG-20 | Restore a removed `Work` into a target parent that already holds live: (a) `Work`; (b) `Work` and `Work (2)`; (c) `Work` and `Work (2)` … `Work (21)`; (d) a removed 64-code-point name whose target already holds the same name; (e) a name nothing holds | (a) `Work (2)`; (b) `Work (3)`; (c) `TAG_NAME_TAKEN`, nothing written, the tag stays removed; (d) the candidate is cut to exactly 64 code points and is unique; (e) the stored name is kept and `renamedTo` is absent. Point reads ≤ 21 in every case |
| TG-21 | Remove capacity (§10.5 step 3): parent P holds tag T and 99 sibling tags; T has 2 children. Then T has 1 child. Then the same with T a root among 100 roots. Then T's 2 children where one also collides by name at P | `TAG_LIMIT` with nothing written: T still live, both children still under T, no `updatedAt` changed; with 1 child the remove succeeds and P has exactly 100 live children; the root case behaves the same; `TAG_LIMIT` is returned before the name check |
| TG-22 | Other writes that add a child or a live tag: move a tag into a parent with 100 live children; restore a tag whose target has 100 live children; restore when the user has 500 live tags; restore under a live old parent that was moved to depth 5 | `TAG_LIMIT`; `TAG_LIMIT`; `TAG_LIMIT`; `TAG_DEPTH_EXCEEDED`; nothing written in each; a move within the same parent is `changed:false` and not refused |

### 12.5 Search

| ID | Case | Expected |
|---|---|---|
| SR-01 | Old caller `{ query }` with no `notesPage` (NT-10): 60 notes, a match only in the oldest | same four groups; archived and trashed notes absent; the match is found in one call; no `notesPage` in the result; the notes group is cut to `GROUP_LIMIT` as today |
| SR-02 | With `notesPage`: 60 notes, match only in the oldest | first call returns `notesPage` with `isDone:false` and a `continueCursor`, not an empty "no results"; continuing finds it |
| SR-03 | Valid, malformed and unclosed fence in a body | snippet has no fence text or JSON keys |
| SR-04 | `kinds`, `tagId`, date range, `archived` modes; `createdFrom > createdTo`; unknown `tagId` | filters applied; invalid input rejected |
| SR-05 | B's data | never returned |
| SR-06 | Split protocol (§9.4, §11.1), in a harness that applies the byte bound: 25 notes of about 900 KiB, the query matching the 3rd, 12th and 24th; caller `notesPage` with `maximumBytesRead` 1e12; then the same with `tagId` | a call that hits the bound returns `notes: []`, `pageStatus:"SplitRequired"`, a `splitCursor`, `scanned: 0`; following the §11.1 rules finds all three matches, each once, and no window is skipped; the caller's byte value is replaced; with `tagId` the same holds with at most 8 notes per call. UNKNOWN (UK-11) without such a harness |
| SR-07 | 25 small notes in one window, 12 of them matching | all 12 are returned in that window (the notes group is not cut to `GROUP_LIMIT`); tasks, habits and goals are still cut to 8 |

## 13. Unresolved decisions

### 13.1 Owner decisions (defaults are not adopted until Amit confirms)

See the index in §1: OD-1 to OD-8, all closed on 2026-10-12 (top section). In addition, one owner input is outstanding on a file: the inventory file named in §0.3.

### 13.2 Explicitly unadopted

| # | Item | Why it is listed |
|---|---|---|
| UA-1 | Any change to the 30-day restore eligibility, in either direction | #837 DONE |
| UA-2 | Version or history retention (#839); reuse of expiring Undo fragments (#828 D5) as history | #837 DONE |
| UA-3 | Permanent cleanup, purge job, empty-trash, "delete forever" | #837 DONE; no job exists (§2.5) |
| UA-4 | Account restoration of owned rows | #808, #837 |
| UA-5 | Resource and attachment storage and retention (#838) | |
| UA-6 | The journal model (#739), #270, beyond NT-07 (settled 2026-10-12: the journal is a Markdown page) | #837 DO NOT |
| UA-7 | Unlinking a task from a block; refreshing block snapshots; a task in several notes | §5.4 L9, §5.5 |
| UA-8 | Count APIs and aggregates | §9.1 |
| UA-9 | Backfill or migration of any legacy row | all slices |
| UA-10 | Tag subtree filter, tag cascade delete, tag sharing | OD-6, OD-7 |
| UA-11 | Hebrew niqqud-insensitive tag matching, Turkish case rules and cross-script confusable matching | §10.1 |
| UA-12 | A separate 1:1 note-card summary table that would carry the feed indexes | §8.6 alternative; needs a schema owner and a backfill |
| UA-13 | Size caps on unlinked task rows; `total`/`open` counts on a To-do card | §5.10 caps linked rows only; §9.1 returns five items and `truncated` (UA-8) |

### 13.3 UNKNOWN

| # | Item |
|---|---|
| UK-1 | The merged shape of #787, #828, #831, #803, #804, #808. Every dependency in §3. |
| UK-2 | The owner's Blinko/Note/TODO inventory file (§0.3). |
| UK-3 | Whether `convex-test` runs Tempo's own modules under `bun test`, applies their `returns` validators and models multi-field index ranges. #815 shows it runs the Agent component (`convex/lib/agentComponent.test.ts`). |
| UK-4 | Whether any stored task has `flexibility` set (the `dayPlans` validator drift, §5.9). |
| UK-5 | Convex per-function read limits (about 16 MiB, 32,000 documents) and the per-document ceiling (about 1 MiB) are the vendor's published figures and were not verified in this worktree; they set the search window, the §8.6 constants and read budgets, and the §5.10 caps. |
| UK-6 | Whether the deployed backend matches this revision (#837). |
| UK-7 | Whether concurrent-transaction behaviour can be tested in the chosen harness. |
| UK-8 | Which route generates `api.d.ts` for new modules (§11.3). |
| UK-9 | Owner of the MCP raw-`body` exposure and of the `analytics.overview` count (§7.3). |
| UK-10 | Export of kinds, tags and links (#273). |
| UK-11 | How `maximumRowsRead` and `maximumBytesRead` behave at runtime (§8.6 R2, §11.1). Read: the installed `convex` 1.32.0 types, `paginate` (`dist/esm/server/impl/query_impl.js`) and `usePaginatedQuery` (`dist/esm/react/use_paginated_query.js`); the Convex pagination guide and the backend's `read_page_from_query` through Context7 on 2026-10-11. Not shown: whether a cut page always holds at least one row; whether `SplitRequired` always carries a `splitCursor`; whether one function may call `paginate` more than once (no function in this contract does). No Tempo code passes either option. |
| UK-12 | Which `caseFold` source #847 uses (a dependency or a pinned table), and its licence (§10.1). |
| UK-14 | Which task blocks get a derived row. NT-02's default (every valid task block, up to 50 in body order) is EXTRAPOLATED. |
| UK-15 | How nested tags are written in `page-meta.data.tags` strings (NT-05). |
| UK-13 | How Convex counts a document's bytes against `maximumBytesRead` and the function limit (UTF-8 string length is assumed). `LINKED_TASK_MAX_BYTES` ≈ 60 KiB and every §8.6 read budget rest on that assumption (§5.10). |

## 14. Notes for ticket sync

Follow-ups for the coordinator. This file edits no ticket.

1. **#841 MUTATES says "existing notes schema only"**, but the link fields and two indexes live on `tasks` (§8.2). Amend the wording, or move §8.2 to a separate schema owner. #856 requires the link to exist "under #841 or a separately approved schema owner".
2. **A validator-parity slice is needed before #856** (§5.9): `convex/dayPlans.ts` plus a test, one file. It also fixes the existing `flexibility` omission. No ticket owns `dayPlans.ts`.
3. **#842 and #849 list `convex/_generated/api.d.ts`** but add functions to existing modules, which needs no edit to it (§11.3). Only #847 and #856 add modules.
4. **#842 needs #803's projection** (`projectPageText`, PR #884) for the stored `notes.preview` and for rows that lack one; the feed must not ship with a raw-body fallback, and must not ship until the §8.6 byte bound is shown (NL-24).
5. **`page-meta.tags` in the codec** (`packages/utils/src/blocks.ts:24-30`, from #786) is a second tag list. Decide whether it is retired or stays unread, before #846. Answered 2026-10-12: it is the tag store (NT-05).
6. **MCP `notes_list` and `note_update` return and accept raw bodies** (`convex/mcpTools.ts:41-49`); archived rows leave with the shared helper, but raw fences still appear. Nobody in this batch owns it.
7. **`analytics.overview` counts soft-deleted notes and tasks** (`convex/analytics.ts:123-148`, `:41-83`). No web caller today; fix before one appears.
8. **#843 step 2 gating**: To-do capture waits for `note_tasks.captureTodo` (#856). Until then only quick and note kinds appear.
9. **#857** should read `note_tasks.list` and `listForNote`; it must not use `tasks.list`.
10. **#845 and #837 clocks**: the Trash UI must show `restorableUntilMs`, not `undoUntilMs`.
11. **Open PRs that may touch task readers** (by title only; their file lists were not read): #756 (Today task list) and #730 (`/tasks/energy`). Re-check path ownership at admission.
12. **No ticket owns two editor-side changes** this contract relies on: making "+ Task" call `note_tasks.addTask`, and a "make this a to-do" action that calls `note_tasks.link`. #788–#792 build the editor; #857 only lists. Until someone owns them, editor blocks stay page-local (§5.6). Settled 2026-10-12: the second is not needed, because rows are derived from blocks (NT-02).
13. **Fix round 1 widens #841 and #846.** #841 also adds `notes.isTemplate` and three `notes` indexes (§8.1), and its `tasks` link index carries `deletedAt` before `sourceBlockId` (§8.2); #846's `noteTagLinks` carries `linkedAt` (§8.3). Any writer of `notes.pageType` (none today; #787 and the editor tickets are the likely ones) must set or clear `isTemplate` in the same patch, and no ticket says so yet. #842's feed, #849's search scan and #856's readers must use these ranges.
14. **Guard note for this PR**: `docs/contracts/**` may change only in a PR that changes nothing else, carries the `config` label added by `Division6066`, and links no ticket (`scripts/factory/config-guard.mjs:14-16`, `:61-66`; `scope-guard` accepts a `config` PR with no ticket, `scripts/factory/scope-guard.mjs:3-4`). The PR therefore cannot go green on `config-guard` and `scope-guard` until that label is applied, which the author did not do.
15. **Fix round 2 widens #841, #842, #847 and #849 again.** #841 also adds `notes.preview` (§8.1, §8.6 R1). #842's `createNoteForUser` and `updateNoteForUser` set it with every body write; #842, #847 and #849 overwrite the pagination byte options on every page that reads notes (§8.6 R2). `templates.applyToNote` (`convex/templates.ts:169`) inserts note bodies and is in no slice's scope, and #787's writers are not built: until someone owns them their rows carry no `preview` and the feed projects those on read. R1 saves CPU only and R2 is the bound, so a writer that is not updated costs a projection on read, not a failure. MCP `note_create` and `note_update` need nothing extra: they go through the two `convex/notes.ts` helpers.
16. **#847 picks the `caseFold` source** for `nameKey` (§10.1) and records it in its PR; no dependency or Unicode table was chosen or licence-checked here. A key change later is a migration.
17. **Fix round 3 widens #842, #847, #849 and #856.** #856: the linked-task caps in `updateTaskForUser` and the admission check in `note_tasks.link` (`TASK_TOO_LARGE`), shipped with the first link writer (§5.10); `tasks.restore` also applies L8 and returns `linkClearedReason` (L6); `note_tasks.list` pages at most 8 items under its own byte bound and passes the split fields through. #842: the feed page ceiling drops from 50 to 20, `taskPreview` reads six rows and loses `total`/`open`, and a `SplitRequired` page is returned empty. #849: `search.all` takes and returns `notesPage` (Convex's pagination options and split fields) instead of `cursor`/`nextCursor`, and the notes group is no longer cut to 8. #847: `remove`, `move` and `restore` check child capacity (and `restore` the per-user limit and depth) before any write. UI: #844, #845, #848 and #857 read pages through `usePaginatedQuery`; #850 implements the §11.1 split rules itself. Nobody owns telling the user, in the web task editor, that a linked task's text is capped (§5.10); until someone does, an over-cap edit of a linked task fails with an error.
18. **NT-02, which blocks are indexed.** Which task blocks get a derived row must depend on the body alone. The default here (every valid task block, up to 50 in body order) is EXTRAPOLATED: confirm it, or define a marker in the block (a codec change).
19. **NT-02, row-only fields.** Priority, energy, project, checklist and repeat cannot be stored for a linked task until the codec's task block carries them (`packages/utils/src/blocks.ts:32-43`). Either a codec ticket adds them, or linked tasks keep the defaults.
20. **NT-07, page types.** Journal and brain-dump `pageType` values exist in neither `notes.pageType` (`convex/schema.ts:342-350`) nor the codec (`packages/utils/src/blocks.ts:15`). That needs the schema lane and a codec ticket. Decision 6 also moves brain-dump results into pages, while `acceptPlanForUser` (`convex/brain_dump.ts:134-164`) inserts typed tasks today; whoever moves brain dump into pages decides what happens to those rows.
21. **NT-05, nested tags.** No way to write nesting in `page-meta.data.tags` strings is chosen (§10.1 keeps `/` free for one). The hierarchy parts of #846 and #847 are held until the owner picks one.
22. **NT-09, restore.** #842's `notes.restore` needs #787's derived-index rebuild helper. #842 waits for it, or the restore of a page that holds blocks stays unshipped.
23. **NT-09, live-row index.** The `noteBlocks` index of §8.7 is a schema-lane change (#841 proposed). The #787 writer must use it.
24. **NT-10, search order.** `search.all` keeps the call without `notesPage` on today's behaviour, so #849 and #850 may land in either order. Once #850 moves `SearchScreen` to `notesPage`, the legacy path can be bounded.
25. **NT-02, existing tasks.** Moving an existing typed task (one with no block) into a page is not offered. Whether the owner wants it is UNKNOWN.
26. **NT-01, mirrored page fields.** `notes.pageType`, `notes.date` and `isTemplate` mirror the page-meta block, so every body writer sets them from it in the same patch (#787 and the editor tickets).

## 15. Verification record

Document-only change. One file: `docs/contracts/CORE-WEB-NOTES.md`.

| Check | Result |
|---|---|
| DONE clause: exact fields, indexes, API arguments, results, errors per slice | §8, §9, §10 |
| DONE clause: every existing reader and writer identified | §2.3, §2.4 |
| DONE clause: state and consumer visibility matrix | §7 |
| DONE clause: TODO identity, and lifecycle enrollment of any new table | §5, §6.5, §8.3 |
| DONE clause: unresolved-decisions section | §13 |
| DONE clause: existing 30-day restore kept, duration/version/purge unadopted | §6.3, §6.6, §13.2 |
| DONE clause: conflicting task stores and unbounded scans rejected by rule | §5.8, §11.2 |
| Tag contract coverage | §10 |
| Citation check: every `path:line` resolves in the baseline tree | fix round 1 re-pinned every `convex/schema.ts`, `convex/lib/accountDeletion.ts` and block-codec citation to 9cf7985; the result is recorded in the PR body |
| Review rounds | round 1 (Codex, links, templates, tag order): §5.3, §8.1–§8.3, §10.4. Round 2 (Codex on `236043f`): bounded note reads §8.6 and AE-21; restore-name resolution §10.5, TG-19, TG-20; Unicode case folding §10.1, TG-17, TG-18. Round 3 (Codex on `de1bdfd`): linked-task size caps §5.10, AE-22, L11, the `taskPreview` read cut to six rows and the feed page to 20, read budgets §8.6 R2, TK-24, NL-27; the split protocol for every byte-bounded paginated API §11.1, AE-23, search's `notesPage` and the end of the notes `GROUP_LIMIT` §9.4, NL-26, TK-19, TG-15, SR-06, SR-07; restore against L8 L6, TK-23; tag child capacity on remove, move and restore §10.2, §10.3, §10.5, TG-21, TG-22. Nothing was run against Convex: the byte-bound behaviour is UNKNOWN (UK-11, UK-13). |
| Path ownership of `docs/contracts/CORE-WEB-NOTES.md` | absent at the baseline. No open PR title in the 50 most recent suggests it. PR file lists were not read: UNKNOWN. |
| Repository checks | recorded in the PR body with the head SHA: `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun run test`, the four scans/notices, local Playwright, build |
| Redo 2026-10-12 | Copied from PR #878's head (`t/837-core-web-notes-contract`) onto `integration` at `e150542` on branch `v3/contracts`, and edited for the owner settlement. Bun 1.3.9: `bun run scan:forbidden-tech` PASS; `git diff --check` on the staged files clean. Nothing else was run for this redo (UNKNOWN), and nothing was run against Convex. |
| Preview evidence | none. This is a contract, not a feature; nothing is coded, locally tested or preview-proven. |
