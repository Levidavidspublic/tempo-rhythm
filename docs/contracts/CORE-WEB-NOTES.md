# CORE-WEB-NOTES — core note kinds, TODO identity and lifecycle

| | |
|---|---|
| Ticket | #837 `TEMPO-CORE-CONTRACT-01`, batch CORE-WEB. Held. Document only. |
| Status | **PROPOSAL.** Nothing here is adopted until the coordinator records adoption on #837. This file changes no schema, API, retention rule, privacy rule, UI or deployment, and starts no work. |
| Baseline | `integration` @ `9cf7985c6cc9a7b78dc9a805f832bc9bdab2ba79` (fetched 2026-10-11; first drafted at `704bd0832fe9c490a0d5b68d7e1cc7c23b178c58`, re-pinned in fix round 1). Every `path:line` below is a line in the 9cf7985 tree. Merged since 704bd08 and now part of the baseline: #807 (chat state: `chatRequests`, four `conversations` lifecycle fields, a `memories` index, and account-deletion enrollment of `noteBlocks` and `chatRequests`; PR #877), #815 (Agent component tests under Bun, the first test that imports `convex-test`; PR #876) and the shared block codec (branch `t/802-shared-block-codec`; PR #879, which moved the codec from `convex/lib/blocks.ts` to `packages/utils/src/blocks.ts`). #826 (the page/block foundation of ticket #786) was already merged. `convex/notes.ts`, `convex/tasks.ts`, `convex/lib/softDelete.ts`, `convex/search.ts`, `convex/templates.ts` and `docs/contracts/B02.md` are identical to `0c5b4279847b8f21c1bafff9813fe55a1770fe30`, the SHA #837 cites for the restore clocks (`git diff --stat` empty, 2026-10-11). `convex/lib/accountDeletion.ts` is not (#807 added two tables to it), so its citations, and those to `convex/schema.ts` and the block codec, are re-pinned to 9cf7985. |
| Not baseline | Everything still open on GitHub (#787, #808, #828, #831, #803, #804, #792, #840 and the rest of #838–#866) is a **proposal, not an API**. This file says what it needs from each and marks the need UNKNOWN until merged code can be read. #807 is no longer on that list: it is merged (Baseline row). |
| Source order | (1) code at the baseline; (2) `docs/HARD_RULES.md` > ticket > `docs/PRD.md` (`docs/PRD.md:6`); (3) owner doc pack of 2026-10-10, Part A (decisions newer than the repo docs) over Part B (repo docs). Part A holds no decision on note kinds, TODO identity or lifecycle. Its one relevant line is the 10 Oct note that Blinko is a one-to-one comparator, used here as a behaviour reference only (§0.3). |

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

Out of scope, and unadopted here: resources and attachments (#838), note versions and history (#839), Markdown mode and the editor framework (#840), voice, the journal model (#739, #270), folders and projects (#260), backlinks, scoped RAG, any migration or backfill.

### 0.3 Third-party note

"Blinko" appears in the tickets as a comparator (owner pack Part A, 10 Oct). Nothing in this file copies its code or schema. Its licence was not checked by the author (UNKNOWN); `docs/HARD_RULES.md:41-43` already forbids committing code whose licence is not verified, and #444 says not to change licences or substitute a GPL fork. The three kinds below are the author's reading of the "Blinko/Note/TODO" wording in #841 and #843–#845 (EXTRAPOLATED). The owner's inventory file (`Tempo-Flow-Blinko-Ticket-Inventory-2026-10-09.md`, Library `libfile_23df3ad6ba9c8191a8ee8be9a355e50d`) was not available to the author (UNKNOWN); if it names different kinds, §4 changes and nothing else does.

## 1. Decision index

| ID | Decision | Label | Recommended default / status |
|---|---|---|---|
| AE-1 | Note kind is an optional stored literal `quick` or `todo`; an absent value means `note`. Kind is independent of `periodType` and `pageType`. | ADOPTED-ENGINEERING | §4 |
| AE-2 | Lifecycle is `deletedAt` (existing, trash) plus a new optional `archivedAt`. Trash outranks archive. Restoring from trash returns the note to its earlier archived or active state. | ADOPTED-ENGINEERING | §6 |
| AE-3 | Three new owner-scoped `notes` indexes (two feed, one trash) serve every feed view without a scan. The kind filter is index-backed in the Active view only. | ADOPTED-ENGINEERING | §8.1 |
| AE-4 | Feeds page with Convex `paginate`, default 20 and maximum 50 per page, and return safe summaries, never `body`. No counts API. | ADOPTED-ENGINEERING | §9.1, §11.1 |
| AE-5 | The one TODO identity is the typed `tasks._id`. A task block in a note is an anchor to it. The link is two optional fields on `tasks` plus one index. No new table. | ADOPTED-ENGINEERING, conditional on OD-1 | §5 |
| AE-6 | For a linked task the row is authoritative; the block is an anchor plus a snapshot; readers overlay the row; writes to the typed form never rewrite note bodies. | ADOPTED-ENGINEERING | §5.5 |
| AE-7 | Link invariants: at most one live row per `(note, block)`, a dangling link is tolerated, `tasks.restore` clears a link that was taken meanwhile, repeat occurrences are new unlinked tasks, there is no unlink in v1. | ADOPTED-ENGINEERING | §5.4 |
| AE-8 | Once #856 exists and the editor and composer call it, "+ Task" in a page and the To-do composer create linked tasks. Until then, and for Markdown edits, MCP and the coach, blocks are page-local. No ticket owns the editor change yet (§14). | ADOPTED-ENGINEERING | §5.6 |
| AE-9 | New mutations validate first, write last, and return `{ ok:false, code }` for expected failures. Existing functions keep their shapes; they only gain optional result fields. | ADOPTED-ENGINEERING | §9.0 |
| AE-10 | Hard gate: no row may carry a link until both strict task return validators accept it. Today they already disagree with each other. | ADOPTED-ENGINEERING | §5.9 |
| AE-11 | Search stays bounded: a fixed scan window per call plus a continuation cursor. A `searchIndex` is a named alternative that needs a schema owner. | ADOPTED-ENGINEERING | §9.4 |
| AE-12 | Tags are relational: `noteTags` plus `noteTagLinks`, both enrolled in account deletion in the same slice. Limits, normalization, duplicate, cycle, idempotency and deletion rules are fixed in §10. | ADOPTED-ENGINEERING | §10 |
| AE-13 | Only new Convex modules touch `convex/_generated/api.d.ts`. No ticket here runs codegen. | ADOPTED-ENGINEERING | §11.3 |
| AE-14 | Kind, archive, template and link fields need no new account-deletion enrollment. The two tag tables do. `noteBlocks` was already enrolled by #807 (merged). | ADOPTED-ENGINEERING | §6.5 |
| AE-15 | Tests must apply `args`/`returns` validators, multi-field index ranges and pagination. The current fake context cannot. | ADOPTED-ENGINEERING | §12.1 |
| AE-16 | No new unbounded read of a user-owned table. Existing ones are listed with an owner and stay as they are until that owner acts. | ADOPTED-ENGINEERING | §11.2 |
| AE-17 | The Trash view takes the client clock (`nowMs`), hides rows older than the 30-day restore window, and does not erase them. | ADOPTED-ENGINEERING | §6.3 |
| AE-18 | Template pages are kept out of every feed and Trash range by a stored `isTemplate` discriminator in the index prefix, never by a filter after the index. | ADOPTED-ENGINEERING | §8.1 |
| AE-19 | Every bounded read of a note's linked tasks fixes `deletedAt` in the index prefix: the task-link index carries `deletedAt` before `sourceBlockId`, so soft-deleted links never enter a live read. | ADOPTED-ENGINEERING | §5.3, §8.2 |
| AE-20 | A tag link carries `linkedAt`, set on insert and reset on revival, and `notesByTag` orders by it. | ADOPTED-ENGINEERING | §8.3, §10.4 |
| OD-1 | Is the typed `tasks` row the canonical TODO identity for core web, or do typed tasks later retire into blocks (the 20 Sep design)? | OWNER-DECISION | Default: typed `tasks._id` is canonical for core web. Retiring typed tasks stays unadopted. |
| OD-2 | Does archiving or trashing a note change its linked tasks? | OWNER-DECISION | Default: no. The tasks stay live in Today, the planner, Tasks and TODO, with a provenance label. |
| OD-3 | User-facing names for the kinds, and whether a separate quick kind exists. | OWNER-DECISION | Default: stored `quick`/`note`/`todo`; labels "Quick note", "Note", "To-do". Hebrew strings are the owner's. |
| OD-4 | What the Trash UI may promise. | OWNER-DECISION | Default: "You can restore this until [date]. After that it can't be restored from here." Never "permanently deleted" or "erased". No empty-trash. |
| OD-5 | Rows soft-deleted by account deletion look like trashed notes after a sign-in restore. Show them as they are? | OWNER-DECISION | Default: yes, no special UI, no claim that account restore brings data back. |
| OD-6 | What happens to child tags when a parent tag is deleted? | OWNER-DECISION | Default: children move up to the deleted tag's parent. No cascade in v1. |
| OD-7 | Does selecting a parent tag also show notes tagged only with its children? | OWNER-DECISION | Default: no. Exact tag only in v1. |
| OD-8 | Does typing `- [ ] item` in Markdown create a task? | OWNER-DECISION | Default: no. It stays plain text. A task is made only by an explicit action. Coordinate with #840. |

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

There is **no** `kind`, `archivedAt`, `isTemplate`, `revision`, tag, or task link on `notes` (`convex/schema.ts:331-362`).

`noteBlocks` (`convex/schema.ts:365-465`) is the derived index of `json tempo` blocks added by #826. It has no writer and no reader at the baseline: `grep noteBlocks` finds only the schema and the account-deletion files, and `parseTempoBlocks` (`packages/utils/src/blocks.ts:201`, re-exported by `convex/lib/blocks.ts`) has no caller outside tests and that re-export. #807 (merged) put it in `USER_OWNED_TABLES` (`convex/lib/accountDeletion.ts:12-29`), so account deletion soft-deletes its rows.

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

Note kinds; archive; note revisions or a page-operation ledger (#828, #831 are proposals); `notes.save`, `getOrCreateToday`, `patchBlock`, `undo` (#787 is a proposal); the safe text projection (#803, #804 are held); any tag; any link between a block and a task; any pagination in `convex/` (`grep paginate` is empty), although `.paginate()` and `paginationOptsValidator` exist in the installed `convex` 1.32.0 typings; any `searchIndex`; any `ConvexError` use. `convex-test` 0.0.38 is pinned by #827 (`package.json:45`) and is imported by exactly one test, `convex/lib/agentComponent.test.ts:7` (#815), which runs the Agent component's functions under `bun test` and calls no Tempo function (§12.1). `grep paginate convex` is still empty: that test only passes `paginationOpts` to the component's own paginated queries.

## 3. Prerequisites and write order

These paths are shared. Writers run **serially**, in the order below. Admission must re-check each path is free.

| Path | Serial writers, in order |
|---|---|
| `convex/schema.ts` | #826 (merged) → #807 (merged) → #828 → **#841** (also adds `notes.isTemplate` and the `tasks` link fields and indexes) → #846 |
| `convex/MIGRATIONS.md` | same chain |
| `convex/lib/accountDeletion.ts` + test | #807 (merged) → #828 → #808 → #846 |
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
| Safe text projection (prose plus permitted block fields, never raw fences) | #803 | `NoteCard.preview`, search snippets |
| `noteBlocks` rows maintained atomically with `body` | #787 | block existence checks in `note_tasks.link` |
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
| `notes.revision` | revision 0 (#828 D1, proposal) | none. **Not added by this contract.** |
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

OD-1 default: typed `tasks._id` is canonical for core web. If Amit instead rules for retiring typed tasks into blocks, §5 and §8.2 are void and a different contract is needed; §4, §6, §7 and §10 are unaffected.

### 5.3 The link (two fields, one index, no table)

```ts
// convex/schema.ts — tasks (PROPOSED, added by #841)
sourceNoteId: v.optional(v.id("notes")),
sourceBlockId: v.optional(v.string()),   // "blk_" + 26-char ULID, validated by the writer
// index: deletedAt BEFORE sourceBlockId (binding order, §8.2)
.index("by_userId_sourceNoteId_deletedAt_sourceBlockId",
       ["userId", "sourceNoteId", "deletedAt", "sourceBlockId"])
```

- Soft-deleted tasks keep their link fields (`tasks.remove` does not clear them), so a removed task can be drawn as a ghost and `tasks.restore` can re-attach it (L6). That is why the index carries `deletedAt`, and carries it **before** `sourceBlockId`: every bounded read of a note's links fixes `deletedAt` (live: `undefined`; removed: `>= 0`), so a note with many removed linked tasks never inflates a live read. An index without `deletedAt` (the earlier `["userId", "sourceNoteId", "sourceBlockId"]`) cannot give a bounded, correct live read. This is a schema requirement for #841.
- Both fields are set together or both absent. Only `note_tasks.*` writes them. `tasks.create`, `tasks.update`, `createQuick`, MCP and the coach never accept them (a client cannot forge a link).
- A task has at most one source note and block (v1). A block has at most one task.
- The block id is stable and never reused within a note (`docs/BACKEND-SCHEMA.md:68-73`; codec `blockId` regex `packages/utils/src/blocks.ts:22`). Undoing a block removal brings back the same id, so the link re-attaches by itself.
- The key is `(noteId, blockId)`. Copying a block's text into another note, or duplicating a note, produces blocks in a different note, which no row points at. They are page-local.

### 5.4 Invariants (AE-7)

| # | Invariant | How it holds |
|---|---|---|
| L1 | At most one **live** row (`deletedAt` undefined) has a given `(userId, sourceNoteId, sourceBlockId)`. | Checked inside the creating transaction on `by_userId_sourceNoteId_deletedAt_sourceBlockId`, range `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined).eq(sourceBlockId, b)`, read with `take(2)` (two rows is corrupt data and fails the call). Convex indexes are not unique; the check and the insert are one transaction. |
| L2 | A live row has both link fields or neither. | The only writers set both. A test reads every inserted and patched row. |
| L3 | A link never crosses owners. | Every lookup starts with `userId`; a foreign `noteId` or `taskId` is reported as not found, never as foreign. |
| L4 | Retrying any link operation does not create a second row. | Natural key `(noteId, blockId)` for row-only operations; `requestId` receipts for operations that also write the body (§9.2). |
| L5 | A dangling link is allowed. If the block is no longer in the body, or the note is trashed, the task stays exactly as it is and reports `source.state` (`block_missing`, `note_trashed`). Deleting a line of Markdown never deletes a task. | Detection by lookup, never by cascade. |
| L6 | `tasks.restore` never revives a link that was taken meanwhile. | If another live row now holds the same `(note, block)` (the same live-prefix read as L1), the restore succeeds but clears the restored row's link fields and returns `linkCleared: true`. |
| L7 | A repeat occurrence is a new logical task and carries no link. | `spawnRepeatAfterCompletion` copies an explicit field list (`convex/tasks.ts:427-450`) and must keep doing so. The original stays linked, done. |
| L8 | **Live** linked tasks per note are bounded. | `MAX_LINKED_TASKS_PER_NOTE = 50` (EXTRAPOLATED). The check is `take(51)` on `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined)` of the L1 index, so removed rows are neither read nor counted, and a note may carry any number of removed linked tasks. The 51st live link is `NOTE_TASK_LIMIT`. Removed rows are read only by `listForNote`, under their own cap (§9.2). |
| L9 | No unlink in v1. | To detach, delete the task or remove the block. Unlink would need a body write to refresh the snapshot; it is unadopted (§13.2). |
| L10 | Archived notes accept link operations. Trashed notes do not. | Same rule as `updateNoteForUser` (`convex/notes.ts:156`), extended by AE-2. |

### 5.5 Field authority and state mapping (AE-6)

After a link exists, the **row** is the truth for everything it can represent. The block keeps what only a page can say.

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

- **Readers overlay.** Anything that shows a linked block (the editor, a card, a TODO row) takes done-ness, title and due from the row, read through `note_tasks.listForNote` (§9.2). The block's own values are used only when the block is page-local.
- **Typed-form writes never rewrite a body.** `tasks.update`, `toggleCompletion`, `moveTaskToDay`, MCP `task_update` and the coach change the row only. No body revision, no operation receipt, no Undo entry. A tick made inside a note on a linked block is the same call, `tasks.toggleCompletion`. Its undo is ticking again.
- **Body edits of a linked block do not propagate.** A body save, an MCP `note_update` or a Markdown-mode edit that changes a linked block's `data` leaves the row alone.
- **Known limitation (not a decision).** The body keeps the link-time title, so text exported from the body or matched by note search shows that title. Task search matches the row. Refreshing snapshots would need the page ledger to participate and is unadopted (§13.2).
- **Promoting an existing block** (`note_tasks.link` with no `taskId`) maps: title → `title`; `status: done` → `done` with `completedAt` = parsed `doneAt` or now, otherwise `todo`; `scheduledAt` → `dueAt`; `durationMin` → `timeEstimate`; `inelastic` → `flexibility`. Priority and energy take the `createTaskForUser` defaults (`convex/tasks.ts:183-185`).

### 5.6 Operations (AE-8)

| Action | Entry point | Row | Body | Atomic | Idempotent by |
|---|---|---|---|---|---|
| Add a new linked task to a page | `note_tasks.addTask` | insert, linked (through `createTaskForUser`) | insert block (via #787) | yes | `requestId` |
| Capture a To-do note | `note_tasks.captureTodo` | insert, linked | create note with one block | yes | `requestId` |
| Make a page-local block a TODO | `note_tasks.link` without `taskId` | insert, linked | none | yes | `(noteId, blockId)` |
| Attach an existing task to a page-local block | `note_tasks.link` with `taskId` | patch link fields | none | yes | `(noteId, blockId)` |
| Tick, untick, rename, reschedule | existing `tasks.*`, `dayPlans.moveTaskToDay` | patch | none | n/a | existing |
| Delete, restore a task | `tasks.remove`, `tasks.restore` (+ hook, L6) | soft delete / restore | none | n/a | existing |
| Change note kind | `notes.setKind` | none | none | n/a | same-kind no-op |
| Delete a line of Markdown that holds a block | `notes.update` / #787 | none | change | n/a | n/a. Link dangles (L5). |
| Undo an add or a capture | `note_tasks.undoCreate` | soft-delete the created row | page undo or note removal | yes | `requestId` |
| Complete a repeating linked task | existing | new **unlinked** row (L7) | none | n/a | existing |

Requirement behind `undoCreate`: undoing an add or a capture must not leave a live linked task without its block, or a live task whose only source was the undone capture. If #787's undo cannot be combined with a row change in one transaction, `addTask` and `captureTodo` are blocked, not shipped without Undo.

Page-local blocks remain legitimate (#792, #787). The UI must label them honestly and must not claim they appear in Today or the planner (#792 step 3).

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
| Block is the identity; typed tasks retire into blocks (20 Sep design) | Every planner table and MCP tool points at `Id<"tasks">` (§2.4). It needs a data migration, which #787 and #856 forbid, and it is the open question OD-1. |
| Note-level pointer, `notes.taskId` (one task per To-do note) | Cannot hold several items in one note or in a Today page. Block-level anchors cover it. |
| New relation table `noteTaskLinks` | Works, supports one task in many notes, and leaves `tasks` rows untouched, so it avoids the validator gate in §5.9. It costs a new table with account-lifecycle enrollment and a longer serial schema chain, and #841 says to stop for a separate ticket if a table is needed. Kept as the fallback if the owner wants one task in several notes or the validator gate proves hard. |
| Link id stored inside the block (`data.taskId`) | Changes the strict codec (`packages/utils/src/blocks.ts:32-43`), copies with the Markdown to other notes, and puts an id of another table into user text. |
| Parse `- [ ]` Markdown checkboxes as tasks | A second parser and a second canonical form. See OD-8. |

### 5.9 Hard gate: strict return validators (AE-10)

`tasks.list`, `listDueInRange` and `listToday` return whole rows through `taskReturnValidator` (`convex/tasks.ts:29-51`). `dayPlans.listCarryOver` does the same through its own copy (`convex/dayPlans.ts:30-64`). A strict `v.object` return validator does not accept a field it does not list (vendor behaviour, not executed in this worktree; the repo's own rule below assumes it), so the first row that carries `sourceNoteId` would make those four queries fail, and Today would break. The repo already documents the rule ("the strict return validator must change in the same PR", `docs/BACKEND-SCHEMA.md:54`) and already shows the drift: `dayPlans.taskValidator` is missing `flexibility` (compare `convex/tasks.ts:39` with `convex/dayPlans.ts:30-64`). Whether any stored row has `flexibility` set is UNKNOWN; the validators disagree either way.

Gate: **before any code path can write `sourceNoteId`, both validators accept `sourceNoteId` and `sourceBlockId`, and the `dayPlans` copy also accepts `flexibility`.** The `tasks.ts` half fits #856's scope (`convex/tasks.ts`). The `dayPlans.ts` half does not fit any listed ticket, so a one-file slice is needed before #856 is admitted (name proposed: `TEMPO-CORE-TASK-VALIDATOR-PARITY`, EXTRAPOLATED; no issue exists). If it is not created, #856 stops with `blocked: scope overflow`. The same slice should make `dayPlans` import one shared validator, so the drift cannot recur.

`tasks.restore` also has a strict `returns` (`convex/tasks.ts:301`); the `linkCleared` field in L6 changes it, inside #856's scope.

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
| Restore | Trashed → earlier state | `notes.restore` (existing) | `deletedAt = undefined`, `updatedAt = now` | `{ success:true, restoredTo:"active" \| "archived" }`; expired `{ success:false, reason:"expired" }`; live `{ success:false, reason:"not_in_trash" }`; foreign or missing throws (`:205-207`). `reason` and `restoredTo` are additive. |
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
- Account soft-deletion stamps every live note and task with one `deletedAt`. A later sign-in restore revives only the user row (`convex/auth.ts:106-115`). The notes then sit in the data as soft-deleted rows inside their own 30-day window, so they appear in Trash and each can be restored one by one. There is no field that distinguishes "I trashed this" from "account deletion trashed this". OD-5 default: accept this, add no special UI, and make no claim that account restore brings data back (#837 and #808 both warn against that claim).

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
| Active, block gone | show | show | allowed | `block_missing` |
| Archived | show | show | allowed | `ok` (or `block_missing`) |
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
| Live links of a note (L8, `taskPreview`, `listForNote`) | `eq(userId).eq(sourceNoteId, n).eq(deletedAt, undefined)` | `take(MAX_LINKED_TASKS_PER_NOTE + 1)`; ordered by `sourceBlockId` |
| The live link of one block (L1, L6) | the same, then `eq(sourceBlockId, b)` | `take(2)` |
| Removed links of a note (ghosts, `listForNote` only) | `eq(userId).eq(sourceNoteId, n).gte(deletedAt, 0)`, `.order("desc")` | `take(MAX_REMOVED_SHOWN + 1)`; newest removal first |

None of them reads a soft-deleted row when it wants a live one. **Schema requirement for #841:** without `deletedAt` in the index prefix, a note with more than 50 removed linked tasks could not give a bounded, correct live read (`take(51)` would fill with removed rows, or a post-limit filter would drop live ones).

The second index serves the TODO list (`note_tasks.list`, §9.2) without scanning every task: `eq(userId).eq(deletedAt, undefined).eq(status, s)` returns undated items first, then by `dueAt` ascending. The existing task readers keep their `collect()` (§11.2); the TODO list must not reuse them.

### 8.3 Tag tables (slice #846)

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

> **TEMPO-CORE-NOTE-SCHEMA-01 — note kind, archive and task link (inactive).** Additive only; no backfill. `notes` gains optional `kind` (`quick` or `todo`; absent means note), optional `archivedAt` and optional `isTemplate` (`true` only; absent means not a template), with three indexes (two feed, one trash). `tasks` gains optional `sourceNoteId` and `sourceBlockId`, with `by_userId_sourceNoteId_deletedAt_sourceBlockId` and `by_userId_deletedAt_status_dueAt`. No writer is activated. Deployed to: **not deployed by this authoring ticket**; the integration TEST deployment is separate; live is not touched.

### 8.5 What #841's test must prove

Nonzero cases for: a legacy note row with none of the new fields; each kind; archived and not archived; an invalid `kind` literal, `isTemplate: false` and an invalid `sourceNoteId` rejected by the validator; `isTemplate: true` accepted; the exact index field order (read from the schema definition), including `isTemplate` before `archivedAt` in the two feed indexes and `deletedAt` before `sourceBlockId` in the link index; the new `tasks` fields optional; all existing indexes still present.

## 9. API proposals per slice

### 9.0 Conventions (AE-9)

- Identity comes from `requireUser`; `userId` is never an argument (`docs/BACKEND-SCHEMA.md:13`).
- **Validate everything, then write.** A mutation that returns normally commits its writes, so an expected failure returns `{ ok:false, code }` only before any write. A failure after a write throws, and Convex rolls the whole transaction back.
- Foreign, missing and soft-deleted rows give the same `*_NOT_FOUND` code (no enumeration).
- Existing functions keep their argument and result shapes. They gain optional result fields only. Their `throws "Note not found"` behaviour stays (`convex/notes.ts:156`, `:191`).
- Page arguments use `paginationOptsValidator`. `numItems` is clamped to 1–50 (default 20), not rejected.
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
  paginationOpts: PaginationOptions,
}
returns: { page: NoteCard[]; isDone: boolean; continueCursor: string /* + Convex split fields */ }

type NoteCard = {
  _id: Id<"notes">; kind: NoteKind; title: string;
  preview: string;                 // safe projection (#803), ≤ 280 UTF-16 units; never body, never fence or JSON text
  pinned: boolean; pageType?: "daily"|"weekly"|"project"|"plain"|"template"; date?: string;
  createdAt: number; updatedAt: number;
  archivedAt?: number;
  deletedAt?: number; restorableUntilMs?: number;   // trash view only: deletedAt + GRACE_MS
  taskPreview?: {                                   // kind === "todo" only
    total: number; open: number; truncated: boolean;
    items: { taskId: Id<"tasks">; title: string; status: TaskStatus }[];   // ≤ 5
  };
}
```

- Reads: the index and range in §8.1. Every range fixes `isTemplate = undefined`, so template pages are excluded by the index prefix, not by a `filter` before `paginate`; the number of template pages does not change the reads per page (NL-23).
- `taskPreview` reads `by_userId_sourceNoteId_deletedAt_sourceBlockId` with `eq(userId).eq(sourceNoteId, noteId).eq(deletedAt, undefined)` and `take(MAX_LINKED_TASKS_PER_NOTE + 1)` per To-do card, so removed tasks are never read. The cost is page size × 51 reads at most.
- Blocked until #803's projection exists. The feed does not ship with a raw-body fallback.

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

`notes.update` does not accept `kind` or `archivedAt`. #842 never writes `body`; any future body change goes through #787's ledger.

No count API is proposed. A count needs a scan or a maintained counter; neither is adopted.

### 9.2 `convex/note_tasks.ts` (#856; new module)

Everything touching the body depends on #787 and #828 (UNKNOWN shapes, §3).

```ts
type LinkCode =
  | "NOTE_NOT_FOUND" | "TASK_NOT_FOUND" | "BLOCK_NOT_FOUND" | "BLOCK_NOT_TASK" | "BLOCK_BROKEN"
  | "TASK_ALREADY_LINKED" | "BLOCK_ALREADY_LINKED" | "NOTE_TASK_LIMIT" | "TITLE_INVALID"
  | "REVISION_CONFLICT" | "REQUEST_ID_INVALID" | "REQUEST_ID_REUSED";
type SourceState = "ok" | "block_missing" | "note_trashed";
```

| Function | Kind | Args | Returns |
|---|---|---|---|
| `note_tasks.link` | mutation | `{ noteId, blockId: string, taskId?: Id<"tasks"> }` | `{ ok:true; taskId; created: boolean } \| Fail<LinkCode>`. No `taskId`: create a row from the block (§5.5 mapping). With `taskId`: attach the existing row. A second call for the same `(noteId, blockId)` returns the same `taskId` with `created:false`. Block lookup: `noteBlocks.by_userId_noteId_blockId`; type `task` and not deleted → ok; type `broken` → `BLOCK_BROKEN`; other type → `BLOCK_NOT_TASK`; none → `BLOCK_NOT_FOUND`. |
| `note_tasks.addTask` | mutation | `{ noteId, requestId, expectedRevision: number, title: string, afterBlockId?: string, dueAt?: number }` | `{ ok:true; taskId; blockId; noteRevision: number; operationId; undoUntilMs } \| Fail<LinkCode>`. Row insert, block insert, receipt, and link in one transaction. Title 1–280. |
| `note_tasks.captureTodo` | mutation | `{ requestId, text: string, title?: string }` | `{ ok:true; noteId; taskId; blockId } \| Fail<LinkCode>`. Creates a `todo` note whose body holds one block, and the linked row. |
| `note_tasks.undoCreate` | mutation | `{ requestId }` | `{ ok:true } \| Fail<"REQUEST_ID_INVALID" \| "UNDO_EXPIRED" \| "UNDO_CONFLICT" \| "NOTE_NOT_FOUND">`. Within the 5-minute window, removes what the add or capture created and soft-deletes the created row, in one transaction. Never touches work done after the create. Shape follows #787/#828. |
| `note_tasks.listForNote` | query | `{ noteId }` | `{ ok:true; items: { blockId; taskId; title; status: TaskStatus; completedAt?: number; dueAt?: number; deletedAt?: number; restorableUntilMs?: number }[]; truncated: boolean; removedTruncated: boolean } \| Fail<"NOTE_NOT_FOUND">`. Two bounded reads on the link index (§8.2). Live: `eq(userId).eq(sourceNoteId, noteId).eq(deletedAt, undefined)`, `take(51)`; the first 50 are returned and `truncated` is true when a 51st exists. Removed: `eq(userId).eq(sourceNoteId, noteId).gte(deletedAt, 0)`, `.order("desc")`, `take(MAX_REMOVED_SHOWN + 1)` with `MAX_REMOVED_SHOWN = 20` (EXTRAPOLATED); the newest 20 are appended with `deletedAt` and `restorableUntilMs` so the editor can draw a "removed task" ghost, and `removedTruncated` is true when older removals exist. A removed row whose `blockId` already has a live row in the result is dropped. The live read never touches a soft-deleted row, so any number of removed tasks leaves it bounded and correct. |
| `note_tasks.list` | query | `{ status: TaskStatus, paginationOpts }` | page of `TodoItem`, below. Index `by_userId_deletedAt_status_dueAt`: ascending (undated first) for `todo` and `in_progress`, descending for `done` and `cancelled`. Page ≤ 50. |

```ts
type TodoItem = {
  taskId: Id<"tasks">; title: string; status: TaskStatus; priority: "low"|"medium"|"high";
  dueAt?: number; completedAt?: number;
  source?: { noteId: Id<"notes">; blockId: string; noteTitle: string; state: SourceState };
};
```

`source.state` costs one note read and one `noteBlocks` lookup per item, at most 100 extra reads per page.

Narrow hooks in `convex/tasks.ts` (inside #856's scope):

| Hook | Reason |
|---|---|
| `taskReturnValidator` gains `sourceNoteId?` and `sourceBlockId?` | §5.9 |
| `createTaskForUser` accepts server-set link fields | so rows keep one insert helper and its defaults (`:173-195`) |
| `tasks.restore` clears a conflicting link and returns `linkCleared` | L6 |
| nothing else | `spawnRepeatAfterCompletion` is left alone (L7) |

### 9.3 `convex/note_tags.ts` (#847; new module)

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
| `note_tags.move` | mutation | `{ tagId, parentId: Id<"noteTags"> \| null }` | `{ ok:true; changed: boolean } \| Fail<TagCode>` |
| `note_tags.remove` | mutation | `{ tagId }` | `{ ok:true; restorableUntilMs: number; childrenMovedTo: Id<"noteTags"> \| null } \| Fail<TagCode>` (OD-6 default) |
| `note_tags.restore` | mutation | `{ tagId }` | `{ ok:true; reparentedToRoot: boolean } \| Fail<TagCode>`. Eligible while `now - deletedAt <= GRACE_MS`, the same rule as notes. Children that moved up are not moved back. |
| `note_tags.attach` | mutation | `{ noteId, tagId }` | `{ ok:true; attached: boolean } \| Fail<TagCode>`. `attached:false` when the pair is already live. |
| `note_tags.detach` | mutation | `{ noteId, tagId }` | `{ ok:true; detached: boolean } \| Fail<TagCode>` |
| `note_tags.forNotes` | query | `{ noteIds: Id<"notes">[] }` (≤ 50) | `{ byNote: Record<string, Id<"noteTags">[]> }`. Only live links to live tags, ≤ 20 per note. |
| `note_tags.notesByTag` | query | `{ tagId, view: "active" \| "archived", paginationOpts }` | page of `NoteCard`, ordered by `linkedAt`, the time the pair last became live (newest first; a re-attach moves the note to the top, §10.4). Index `by_userId_tagId_deletedAt_linkedAt`, range `eq(userId).eq(tagId, t).eq(deletedAt, undefined)`, `.order("desc")`; each note is read and filtered by state (live, the requested archive state, not a template). Short pages are possible; `isDone` and the cursor are truthful. |

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
  cursor?: string | null,
}
returns: today's four groups (unchanged) + notesPage?: { nextCursor: string | null; scanned: number }
```

Behaviour (AE-11):

- Notes are scanned in feed order, **at most `SEARCH_SCAN_NOTES = 25` per call** (EXTRAPOLATED), through the first feed index (Active or Archived range, `isTemplate` fixed to `undefined`, so template pages are never scanned), and the matches among them are returned (≤ 8, the existing `GROUP_LIMIT`, `convex/search.ts:6`). `nextCursor` continues the scan. A user may need "search older notes". This replaces today's `collect()` of every note, task, habit and goal (`:80-97`).
- Matching and snippets use the safe projection (#803/#804), never raw `body`.
- With `tagId`, iteration runs over `noteTagLinks` for that tag, not over the feed.
- `createdFrom/To` filters inside the scan window (no `createdAt` index is proposed).
- Why 25: bodies are unbounded today (§2.1) and one function may read only a limited volume (Convex documents about 16 MiB and 32,000 documents per function; vendor figure, not verified here, UNKNOWN). #828 D4 proposes a 128 KiB body cap for the new paths. Until a body cap exists on every writer, the window size is a guess to be validated.
- Alternative: a Convex `searchIndex` on a derived plain-text field. It needs a schema owner and a field written by every body writer, and it stores a second copy of private text. Not proposed here. If chosen, #849 stops and a schema slice is raised first.
- Resource search stays gated until a resources API exists (#849 step 2).
- Tasks, habits and goals groups keep their current behaviour; making them bounded is outside this contract (listed in §11.2).

### 9.5 What UI tickets may call

| Ticket | May call | May not |
|---|---|---|
| #843 composer | `notes.create` (+`kind`), `note_tasks.captureTodo` once it exists, `note_tags.attach` after create | write `localStorage` as content; show a kind whose API is missing; parse `#tag` or `- [ ]` from text (OD-8) |
| #844 feed | `notes.feed` (active), `notes.togglePin`, `note_tags.forNotes` | read `body`; count rows; scan |
| #845 archive and trash | `notes.feed` (archived, trash), `archive`, `unarchive`, `remove`, `restore` | show a delete-forever or empty-trash control; promise anything beyond OD-4 |
| #848 tags UI | `note_tags.*` | build its own hierarchy rules |
| #850 search UI | `search.all` (+filters, cursor) | collect locally |
| #857 TODO view | `note_tasks.list`, `listForNote`, existing `tasks.toggleCompletion`, `tasks.remove`, `tasks.restore` | create a task by viewing a note; invent a second task identity, Kanban or recurrence |

## 10. Nested tags

### 10.1 Name normalisation and duplicates (AE-12)

`normalizeTagName(input)` is a pure function used by every tag writer.

1. Remove U+200E, U+200F, U+061C, U+200B, U+FEFF and U+2060 (bidi marks and zero-width characters often pasted from Hebrew and Arabic text).
2. `NFC`-normalise. Treat every Unicode whitespace character (tabs and line breaks included) as a space, trim both ends, collapse inner runs to one space. The result is `name` (display).
3. Reject (`TAG_NAME_INVALID`) any remaining Unicode control (Cc) or format (Cf) character other than U+200C and U+200D.
4. Length 1–64 Unicode code points (`Array.from(name).length`; a surrogate pair counts once).
5. Reject `/`, `\`, `#` and `,` (kept free for path, hashtag and list representations).
6. `nameKey = name.normalize("NFKC").toLowerCase()` (locale-independent).

Duplicate policy: among **live** tags with the same `parentId` (roots share `parentId: undefined`), `nameKey` is unique. Different parents may reuse a name. Names differing only by case, width, composition or an inner bidi mark are duplicates. Hebrew niqqud points are **not** stripped, so a pointed and an unpointed spelling are different tags (UNKNOWN whether the owner wants them merged; not decided). A soft-deleted tag does not block its name.

### 10.2 Limits (EXTRAPOLATED numbers, enforced by bounded reads)

| Constant | Value | Check |
|---|---|---|
| `TAG_NAME_MAX` | 64 code points | §10.1 |
| `TAG_MAX_DEPTH` | 5 (a root is depth 1) | walk up from the parent, at most 5 steps |
| `TAG_MAX_PER_USER` | 500 live tags | `take(501)` on `by_userId_deletedAt` before create |
| `TAG_MAX_CHILDREN` | 100 | `take(101)` on `by_userId_deletedAt_parentId_nameKey` with `parentId` fixed |
| `NOTE_MAX_TAGS` | 20 live links per note | `take(21)` on `by_userId_noteId_deletedAt` |

Exceeding returns `TAG_LIMIT` or `NOTE_TAG_LIMIT`. No limit check scans an unbounded range.

### 10.3 Hierarchy, cycles, moves

- `move(tag, newParent)`: reject `newParent == tag` and any newParent whose ancestor chain contains `tag` (`TAG_CYCLE`). The chain walk stops after `TAG_MAX_DEPTH + 1` steps; a longer chain means stored data is already corrupt and returns `TAG_CORRUPT_HIERARCHY` instead of looping.
- The new depth is `depth(newParent) + 1 + height(subtree of tag)`. The subtree is read level by level, at most `TAG_MAX_DEPTH` levels, `take(TAG_MAX_CHILDREN + 1)` per level, never more than `TAG_MAX_PER_USER` rows in total. A result above `TAG_MAX_DEPTH` is `TAG_DEPTH_EXCEEDED`.
- `parentId` must belong to the same owner and be live (`TAG_PARENT_NOT_FOUND`).
- No `depth` is stored. It is derived on demand, so a move never rewrites descendants.
- Two concurrent conflicting renames or moves: the sibling-name check reads the index range that the other writer inserts into, so Convex's optimistic concurrency control retries one of them and it then sees the other (vendor behaviour, EXTRAPOLATED; to be shown by TG-14 in §12.4, or reported UNKNOWN if the harness cannot run two transactions).

### 10.4 Membership

- One `noteTagLinks` row per `(userId, noteId, tagId)` ever. `attach` finds the pair through `by_userId_noteId_tagId`: live → `attached:false`; soft-deleted → revive it (clear `deletedAt`, set `linkedAt = now`, bump `updatedAt`); absent → insert with `linkedAt = createdAt = now`. `detach` soft-deletes a live row and returns `detached:false` otherwise. Both are idempotent and neither leaves a second row.
- Revival resets `linkedAt`, the ordering key of `notesByTag` (AE-20), so a note that is detached and re-attached moves to the top of that tag's list exactly like a first attach. `createdAt` keeps the first attach time. Ordering by `createdAt` or by `updatedAt` is not used: the first would leave a re-attached note in its old place, and the second would move a note whenever any future write touched the row.
- The note must be live (not trashed); the tag must be live; both owned. Archived notes accept attach and detach.
- A link is visible only if the link is live **and** the tag is live **and** the note is in the requested view.

### 10.5 Deleting a tag

- `remove` soft-deletes the tag only. It does not write any link row, so it is O(children) and unbounded cascades cannot happen. Links to a deleted tag simply stop being visible.
- Children move to the removed tag's parent (OD-6 default). If a moved child's name collides with a live sibling there, the whole operation returns `TAG_NAME_TAKEN` with `childTagId` and changes nothing.
- `restore` brings the tag back under its old parent if that parent is live, otherwise under the root (`reparentedToRoot:true`), and fails with `TAG_NAME_TAKEN` if a live sibling now has its name, or `TAG_RESTORE_EXPIRED` after 30 days.
- No physical deletion. Membership rows follow account soft deletion with the tables.

### 10.6 Relationship to other tag-like things

- `page-meta.data.tags: string[]` in the block codec (`packages/utils/src/blocks.ts:24-30`) is **not** the tag store. Tag APIs neither read nor write it, and filters ignore it. Two tag stores would conflict (#837 DO NOT). Whether the codec field is later retired is #786/#802/#840's call; recorded in §14.
- Inline `#word` text is plain text. The composer may offer autocompletion that calls `attach` on an explicit user choice; nothing parses the body.
- Folders and projects (#260) are separate. #837 asks that their semantics not be copied unchecked. Checked: no projects or folders table exists; `tasks.projectId` and `projectName` are free strings kept "until a projects table exists" (`convex/schema.ts:236-238`) and carry no hierarchy, uniqueness or deletion rules. Nothing is borrowed from them.

## 11. Paging, boundedness, generated API

### 11.1 Paging (AE-4)

- Argument `paginationOpts` (`numItems`, `cursor`); result `page`, `isDone`, `continueCursor` (Convex 1.32.0 `.paginate()`).
- Page size default 20, maximum 50 (`FEED_PAGE_DEFAULT`, `FEED_PAGE_MAX`, EXTRAPOLATED); smaller values accepted, larger clamped.
- Order is total: index fields then `_creationTime`. The feed's order is pinned first, then newest `updatedAt`.
- "Stable paging without duplicates" (#844) is a property of the order **and** of the client keeping loaded pages pinned (`usePaginatedQuery`). A repeated one-shot call with an old cursor can repeat or skip a note whose `updatedAt` changed between calls. #844's test has to show it, not assume it.
- Paged results carry safe summaries only. `body` and fence text never appear in a page.

### 11.2 Boundedness rule and the legacy exceptions (AE-16)

A reader introduced or changed by these slices must: start from an index prefix that fixes `userId` and the lifecycle fields; read with `paginate` or `take(N)` where N is a named constant; and never `collect()` a user-owned table unless an enforced limit proves the size. Review rejects anything else, and rejects any second task store.

Existing unbounded readers stay as they are until their owner acts:

| Reader | Lines | Owner |
|---|---|---|
| `listNotesForUser` / `notes.list` / MCP `notes_list` | `convex/notes.ts:29-33` | #842 keeps the shape, adds the archive filter. Boundedness: UI moves to `notes.feed` (#844, #805); then the legacy list can be capped. UNKNOWN date. |
| `search.all` | `convex/search.ts:80-97` | #849 |
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
| NL-15 | 120 notes, `numItems` 0, 1, 50, 1000, `NaN` | clamped to 1–50 or rejected as specified; walking all pages returns each note once; pinned first; equal `updatedAt` ordered deterministically |
| NL-16 | Instrumented context during `feed` | reads go through the §8.1 index and range; no `collect()` of `notes`; documents read ≤ page size + small constant |
| NL-17 | Legacy `notes.list` and MCP `notes_list` with an archived note | excluded |
| NL-18 | Inactive account (`deletedAt` set) | every function throws `This account is not active` |
| NL-19 | `pageType:"template"` note (stored with `isTemplate:true`) | never in any feed view, Trash or search |
| NL-20 | Note with a valid fence, a malformed fence and an unclosed fence | `preview` contains neither fence text nor `"type":`; the card has no `body` key |
| NL-21 | `kind` filter with view `archived`/`trash`; `nowMs` missing for trash | throws the specified message |
| NL-22 | Account deletion with live, archived, already-trashed notes | live and archived get the account `deletedAt`; the already-trashed keeps its older one |
| NL-23 | Instrumented context: 200 template notes (`isTemplate:true`) that sort ahead of 30 ordinary notes in every index order, in Active, Archived and Trash; `isTemplate:false` written directly | the first page of each view holds ordinary notes only; documents read ≤ page size + small constant, the same as with no templates; no `filter` on `pageType`; `isTemplate:false` rejected by the validator |

### 12.3 TODO identity

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
| TK-11 | `tasks.remove` then `tasks.restore` | link intact; then: remove, link a new row to the same block, restore the old row → success with `linkCleared:true`, exactly one live row linked |
| TK-12 | Trash the note | tasks stay live; `source.state = "note_trashed"`; restore the note → `ok` |
| TK-13 | Remove the block from the body | task untouched; `block_missing` |
| TK-14 | With a linked row present, call `tasks.list`, `listDueInRange`, `listToday` and `dayPlans.listCarryOver` through validators | none throws a return-validation error (and `dayPlans` accepts `flexibility`) |
| TK-15 | Body save or MCP `note_update` that edits a linked block's `data` | row unchanged |
| TK-16 | MCP `task_update completed:true` on a linked task | overlay shows done |
| TK-17 | `undoCreate` after `addTask` and after `captureTodo`; again after the window; after an unrelated later edit | row and block gone; `UNDO_EXPIRED`; `UNDO_CONFLICT` without deleting the later work |
| TK-18 | Forged link: `tasks.create`/`update`/MCP with `sourceNoteId` | rejected by the validator or ignored; no link written |
| TK-19 | `note_tasks.list` for each status | correct order (undated first for open), no deleted or foreign row, ≤ 50 per page |
| TK-20 | Two concurrent `link` calls for one block | one row. UNKNOWN if the harness cannot run two transactions |
| TK-21 | `captureTodo` / `addTask` when the body write is rejected (stale revision, oversized body) | no row exists afterwards |
| TK-22 | Note with 120 removed linked tasks and 3 live ones; `listForNote`, `taskPreview`, then one more `link` | the live read returns exactly the 3 live rows, `truncated:false`, and its documents read stay ≤ 3 + small constant (instrumented); the removed read returns the 20 newest removals with `removedTruncated:true`; the extra link is ok; a removed row whose block has a live row is not shown as a ghost |

### 12.4 Tags

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
| TG-12 | Restore at `GRACE` and `GRACE + 1`; restore with a live same-name sibling; with a deleted parent | ok; `TAG_RESTORE_EXPIRED`; `TAG_NAME_TAKEN`; `reparentedToRoot:true` |
| TG-13 | Account deletion | both tag tables soft-deleted (schema-derived exhaustive coverage), foreign rows untouched, earlier timestamps kept |
| TG-14 | Two concurrent conflicting renames or moves | exactly one succeeds. UNKNOWN if the harness cannot run two transactions |
| TG-15 | `notesByTag` paging with archived and trashed notes mixed in | only notes in the requested view; each once; truthful `isDone` |
| TG-16 | Attach tag T to note X, then to note Y; detach X and attach it again | `notesByTag(T)` order is Y, X before the re-attach and X, Y after it; X's link row is the same row, `createdAt` unchanged |

### 12.5 Search

| ID | Case | Expected |
|---|---|---|
| SR-01 | Old caller `{ query }` | same four groups; archived and trashed notes absent |
| SR-02 | 60 notes, match only in the oldest | first call returns `nextCursor`, not an empty "no results"; continuing finds it |
| SR-03 | Valid, malformed and unclosed fence in a body | snippet has no fence text or JSON keys |
| SR-04 | `kinds`, `tagId`, date range, `archived` modes; `createdFrom > createdTo`; unknown `tagId` | filters applied; invalid input rejected |
| SR-05 | B's data | never returned |

## 13. Unresolved decisions

### 13.1 Owner decisions (defaults are not adopted until Amit confirms)

See the index in §1: OD-1 to OD-8. Each states its recommended default there. In addition, one owner input is outstanding on a file: the inventory file named in §0.3.

### 13.2 Explicitly unadopted

| # | Item | Why it is listed |
|---|---|---|
| UA-1 | Any change to the 30-day restore eligibility, in either direction | #837 DONE |
| UA-2 | Version or history retention (#839); reuse of expiring Undo fragments (#828 D5) as history | #837 DONE |
| UA-3 | Permanent cleanup, purge job, empty-trash, "delete forever" | #837 DONE; no job exists (§2.5) |
| UA-4 | Account restoration of owned rows | #808, #837 |
| UA-5 | Resource and attachment storage and retention (#838) | |
| UA-6 | The journal model (#739), #270 | #837 DO NOT |
| UA-7 | Unlinking a task from a block; refreshing block snapshots; a task in several notes | §5.4 L9, §5.5 |
| UA-8 | Count APIs and aggregates | §9.1 |
| UA-9 | Backfill or migration of any legacy row | all slices |
| UA-10 | Tag subtree filter, tag cascade delete, tag sharing | OD-6, OD-7 |
| UA-11 | Hebrew niqqud-insensitive tag matching | §10.1 |

### 13.3 UNKNOWN

| # | Item |
|---|---|
| UK-1 | The merged shape of #787, #828, #831, #803, #804, #808. Every dependency in §3. |
| UK-2 | The owner's Blinko/Note/TODO inventory file (§0.3). |
| UK-3 | Whether `convex-test` runs Tempo's own modules under `bun test`, applies their `returns` validators and models multi-field index ranges. #815 shows it runs the Agent component (`convex/lib/agentComponent.test.ts`). |
| UK-4 | Whether any stored task has `flexibility` set (the `dayPlans` validator drift, §5.9). |
| UK-5 | Convex per-function read limits (about 16 MiB, 32,000 documents) are the vendor's published figures and were not verified in this worktree; they set the search window. |
| UK-6 | Whether the deployed backend matches this revision (#837). |
| UK-7 | Whether concurrent-transaction behaviour can be tested in the chosen harness. |
| UK-8 | Which route generates `api.d.ts` for new modules (§11.3). |
| UK-9 | Owner of the MCP raw-`body` exposure and of the `analytics.overview` count (§7.3). |
| UK-10 | Export of kinds, tags and links (#273). |

## 14. Notes for ticket sync

Follow-ups for the coordinator. This file edits no ticket.

1. **#841 MUTATES says "existing notes schema only"**, but the link fields and two indexes live on `tasks` (§8.2). Amend the wording, or move §8.2 to a separate schema owner. #856 requires the link to exist "under #841 or a separately approved schema owner".
2. **A validator-parity slice is needed before #856** (§5.9): `convex/dayPlans.ts` plus a test, one file. It also fixes the existing `flexibility` omission. No ticket owns `dayPlans.ts`.
3. **#842 and #849 list `convex/_generated/api.d.ts`** but add functions to existing modules, which needs no edit to it (§11.3). Only #847 and #856 add modules.
4. **#842 needs #803's projection** for `NoteCard.preview`; the feed must not ship with a raw-body fallback.
5. **`page-meta.tags` in the codec** (`packages/utils/src/blocks.ts:24-30`, from #786) is a second tag list. Decide whether it is retired or stays unread, before #846.
6. **MCP `notes_list` and `note_update` return and accept raw bodies** (`convex/mcpTools.ts:41-49`); archived rows leave with the shared helper, but raw fences still appear. Nobody in this batch owns it.
7. **`analytics.overview` counts soft-deleted notes and tasks** (`convex/analytics.ts:123-148`, `:41-83`). No web caller today; fix before one appears.
8. **#843 step 2 gating**: To-do capture waits for `note_tasks.captureTodo` (#856). Until then only quick and note kinds appear.
9. **#857** should read `note_tasks.list` and `listForNote`; it must not use `tasks.list`.
10. **#845 and #837 clocks**: the Trash UI must show `restorableUntilMs`, not `undoUntilMs`.
11. **Open PRs that may touch task readers** (by title only; their file lists were not read): #756 (Today task list) and #730 (`/tasks/energy`). Re-check path ownership at admission.
12. **No ticket owns two editor-side changes** this contract relies on: making "+ Task" call `note_tasks.addTask`, and a "make this a to-do" action that calls `note_tasks.link`. #788–#792 build the editor; #857 only lists. Until someone owns them, editor blocks stay page-local (§5.6).
13. **Fix round 1 widens #841 and #846.** #841 also adds `notes.isTemplate` and three `notes` indexes (§8.1), and its `tasks` link index carries `deletedAt` before `sourceBlockId` (§8.2); #846's `noteTagLinks` carries `linkedAt` (§8.3). Any writer of `notes.pageType` (none today; #787 and the editor tickets are the likely ones) must set or clear `isTemplate` in the same patch, and no ticket says so yet. #842's feed, #849's search scan and #856's readers must use these ranges.
14. **Guard note for this PR**: `docs/contracts/**` may change only in a PR that changes nothing else, carries the `config` label added by `Division6066`, and links no ticket (`scripts/factory/config-guard.mjs:14-16`, `:61-66`; `scope-guard` accepts a `config` PR with no ticket, `scripts/factory/scope-guard.mjs:3-4`). The PR therefore cannot go green on `config-guard` and `scope-guard` until that label is applied, which the author did not do.

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
| Path ownership of `docs/contracts/CORE-WEB-NOTES.md` | absent at the baseline. No open PR title in the 50 most recent suggests it. PR file lists were not read: UNKNOWN. |
| Repository checks | recorded in the PR body with the head SHA: `bun install --frozen-lockfile`, `bun run lint`, `bun run typecheck`, `bun run test`, the four scans/notices, local Playwright, build |
| Preview evidence | none. This is a contract, not a feature; nothing is coded, locally tested or preview-proven. |
