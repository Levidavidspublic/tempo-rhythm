Supersedes open PR #873 (redone 2026-10-12 for the v3 markdown-first run).

# Contract CORE-WEB-RESOURCES — Private resource storage, access and deletion boundaries

## Settled by the owner (2026-10-12)

Source: the owner's decisions for the v3 markdown-first rebuild, recorded in `docs/design/v3/OVERNIGHT-RUN.md`, section "Decisions (settled by Amit; do not reopen)", on branch `batch/v3-markdown-first`. This section wins over anything below it. The body was edited in place to match: each changed rule says "Superseded 2026-10-12" or "Settled 2026-10-12".

### Decisions that apply to this contract

| # | Decision (shortened) | Effect here |
|---|---|---|
| 1 | `notes.body` Markdown is the only source of truth. There is no second stored representation. Tempo blocks are fenced `json tempo` blocks inside it. The JSON is never shown. | A page refers to a resource from its body (RS-02), and `resourceLinks` becomes a derived index of those references (RS-03). AE-1 is amended. |
| 2 | Saving is byte-exact. remark-gfm is added for the read view. | A resource reference is ordinary Markdown in the body and round-trips byte for byte (RS-02). |
| 7 | Page menu: Copy as Markdown, Export .md. | An exported body carries resource references as same-origin paths, which resolve only with the owner's session (RS-05). |

Decisions 3 to 6 do not change this contract.

### Rules added by the settlement

| ID | Rule |
|---|---|
| RS-01 | **The storage model stays.** `resourceFolders`, `resources`, the upload state machine (section 9), the two byte routes (section 10), no bearer URLs (AE-3, AE-4) and Route 1 (AE-5) are unchanged. |
| RS-02 | **A page refers to a resource from its Markdown body,** with a link or an image to the same-origin proxy route: `[name](/api/resources/<resourceId>/content)`, or `![alt](/api/resources/<resourceId>/content?disposition=inline)` for an inline-safe image (OD-6). That relative path is the only resource reference (exact grammar EXTRAPOLATED). Tempo never writes a Convex storage URL, a `getUrl` URL, a bearer token, a JWT, bytes or base64 into a body. The path grants nothing by itself: the route re-runs the 10.2 checks on every request, so only the owner's session reads the bytes and anyone else gets 404. The reference is ordinary Markdown, saved byte for byte like any other text. |
| RS-03 | **`resourceLinks` is a derived index.** The body writer rebuilds a note's link rows from the references in its body, in the same transaction as the body write: one row per `(note, resource)` referenced. A reference to a foreign, missing, not-ready or deleted resource makes no row. A link row is never written on its own, so `linkToNote` and `unlinkFromNote` are not offered as row writes: attaching inserts the reference into the body through the page writer, and detaching removes it. Restoring a note rebuilds its link rows from the restored body (CORE-WEB-NOTES NT-09). |
| RS-04 | **Rendering.** The read view and Live Preview render a resource image inline only through the proxy path and only for the OD-6 inline types; anything else renders as a link. A resource reference is not remote media (CORE-WEB-EDITOR-MODES OD-05). When the route answers 404 (the resource was deleted, or the viewer is not the owner), the page shows a calm "file not available" state that never quotes the path (copy EXTRAPOLATED; the v3 design wins). |
| RS-05 | **Export.** Export .md and Copy as Markdown carry the body as it is, so resource references stay same-origin paths that resolve only with the owner's session. The manifest (8.1, 11.5) maps each `resourceId` to its file, so an export can be re-linked offline. |
| RS-06 | **No cascade into bodies.** Deleting a resource never edits a body (AE-14 stands): the reference stays in the Markdown and the route returns 404 (RS-04). Deleting a note hides its link rows, and restoring it rebuilds them (OD-5). |

### Owner decisions, now closed

| OD | Status | Settled answer |
|---|---|---|
| OD-1 | Default adopted | Allow PNG, JPEG, WebP, GIF, PDF, plain text and Markdown. Exclude audio, video, archives, JSON, CSV, HTML, SVG, Office files and executables. The user-facing privacy text is updated before activation. |
| OD-2 | Default adopted | 4 MiB per file; 50 MiB and 100 ready files per user; 3 open uploads; 20 uploads per hour; soft-deleted bytes keep counting until purged. The storage budget and spend are still approved separately by the owner (UNK-1): adopting this default approves no spend. |
| OD-3 | Default adopted | Restore window `GRACE_MS` (30 days). Account restore does not bulk-restore resources. Export is a metadata manifest plus per-file authenticated download of live resources only, with no bulk ZIP and no emailed link. |
| OD-4 | Default adopted | (a) No scheduled purge now; decide before quota UX is relied on. (b) Approved: the upload handler may delete only the blob it stored in the same request when `commitUpload` fails, and that blob was never referenced. |
| OD-5 | Default adopted | Resources survive note deletion. The note's link rows are hidden while it is trashed and rebuilt from its body when it is restored (RS-03). |
| OD-6 | Default adopted | Inline only for PNG, JPEG, WebP and GIF. PDF and text are download-only. |
| OD-7 | Default adopted | Route 2 is not approved. Use Route 1 (AE-5). |

With these defaults, BLK-1 and BLK-3 are cleared, BLK-2 is cleared except for storage spend (UNK-1), and BLK-4 to BLK-6 stay open.

### Superseded by the settlement

| Rule | Replacement |
|---|---|
| Section 1, item 4; AE-1 | The body's resource references are the attachment relation, and `resourceLinks` is their derived index (RS-02, RS-03). The only URL a body may hold is the same-origin proxy path. Bytes, base64, storage URLs and bearer URLs stay forbidden everywhere. |
| AE-14; section 6 `resourceLinks.deletedAt` comment | Link rows are rebuilt from bodies. A row is soft-deleted when the body stops referencing the resource and revived by its key when the reference returns. Note and resource deletion still write no link row. |
| Section 8.1, `linkToNote`, `unlinkFromNote`; section 14, #854 | Not offered as row writes. Attach and detach are body edits through the page writer (RS-03). |
| Section 8.1, `exportManifest({})` | `exportManifest({ nowMs })` returns `exportedAt = nowMs`, because queries never read the clock (C-26). This fixes the open Codex P2 on #873. |
| Section 8.2, `commitUpload`; `CommitUploadResult`; section 9.1, `ready` guard | `commitUpload` re-checks approval as well as the account, and returns `ACCOUNT_PENDING_APPROVAL` (403) with no write. This fixes the open Codex P2 on #873. |
| Section 1.3; AE-13; 9.3; 9.5 O1; 10.3, step 6; 11.4; ACC-14; UPL-21; UPL-26 | Under OD-4(b), the upload handler deletes the blob it stored in that request when the commit fails. `ctx.storage.delete` has exactly that one call site, and there is still no purge and no `.db.delete`. |
| Section 10.2, check 4 | The live link row it requires is the derived row rebuilt from the note's body. |
| Section 11.2 | The links come back on note restore because the restore rebuilds them (RS-03). |
| Section 14, #840 row; UNK-8 (for notes) | Decided: RS-02. UNK-8 stays open for versions (#839). |
| Section 13, OWN-05 to OWN-08, LIF-05 to LIF-07 | Re-scoped to the derived index. New cases LNK-01 to LNK-04, UPL-27 and LIF-11. |
| Section 1.1, OD-1 to OD-7; section 1.2, BLK-1 to BLK-3 | Closed, as in the tables above. |

### Open Codex findings on #873, fixed in this redo

1. P2, `exportManifest` needs a `nowMs` argument: it now takes `{ nowMs: v.number() }` and returns it as `exportedAt` (8.1, LIF-11).
2. P2, `commitUpload` should re-check approval: it now does, and returns `ACCOUNT_PENDING_APPROVAL` (403) with no write (8.2, 9.1, UPL-27).

Ticket TEMPO-CORE-RESOURCE-CONTRACT-01 (#838), batch CORE-WEB. Status: **PROPOSAL, except the owner settlement above (2026-10-12), which is decided. Nothing else is adopted, and nothing is implemented.** Redo 2026-10-12: this file was copied from PR #873's head onto `integration` at `e150542953319ecfcdd2ae0496af36beb02b3274`. The code map in section 3 was not re-run against that head (UNKNOWN for files changed since `6cca807`). One known stale point: C-8 and section 16, item 3 say `noteBlocks` is not in `USER_OWNED_TABLES`, but #807 added it (now `convex/lib/accountDeletion.ts:37`). Checks for this redo (Bun 1.3.9): `bun run scan:forbidden-tech` passed and `git diff --check` on the staged files was clean; nothing else was run (UNKNOWN).
Written 11 Oct 2026 against `integration` @ `6cca80734d623c6db479d733bd5ab17cde6c8582` (the pinned evidence base). Integration advanced to `5fc1e67f011e58909bbe3b004f30dfa2d9394385` (#826, #827, #830) while this was written; the delta was checked: of every file cited below only `convex/schema.ts` changed (see C-2, C-8). Document-only change: no schema, API, storage write, provider setting, dependency or deletion.

Consumers (all held): #851 schema + lifecycle enrollment, #852 resource API, #853 byte access, #854 attach UI, #855 Resources library. Coordinated with #273 (export/account lifecycle), #300 (ingestion), #808 (page/account privacy lifecycle), #837 (note identity), #839 (versions), #840 (Markdown).

## 0. How to read this document

| Marker | Meaning |
|---|---|
| **ADOPTED-ENGINEERING** (AE-n) | An ordinary technical choice the coordinator may adopt without the owner. Not adopted until the coordinator records it with the prerequisite heads (same convention as #828). |
| **OWNER-DECISION** (OD-n) | Product, privacy, retention, limit, spend or setting choice that belongs to Amit. A recommended default is given. **The default is not adopted by merging this file.** |
| **EXTRAPOLATED** | A number or shape filled in here as a starting point, not read from a source. |
| **UNKNOWN** (UNK-n) | Not verifiable from the repo or the sources read. Not guessed. |
| `file:line` | Evidence read at `6cca807`. A claim about current code without one is a mistake in this document. |

Precedence applied: owner doc pack Part A (10 Oct) over Part B; `docs/HARD_RULES.md` over this file. Part A has no resource, attachment or storage decision. Its 8 Oct "assume every user is a whale" pricing standard applies to any per-user storage cost estimate (OD-2); no such estimate is made here because Convex storage prices and plan limits are UNKNOWN (UNK-1).

## 1. Summary

1. Tempo has **no file storage today** (section 3, C-1). Persisting user-selected files is a **new data class** that the PRD, TRD and HARD_RULES do not describe (C-18). Nothing here changes privacy policy; every policy-bearing choice is an OD below.
2. A **resource** is a file the signed-in owner explicitly picks in the web UI and uploads, one file at a time. It is owner-only, never processed, never indexed and never shared. It is **not** a route for third-party scanner content, imported raw histories, lecture recordings or voice audio (section 4).
3. Bytes are written and read **only through authenticated Convex HTTP actions** that re-check account, resource and (optionally) note state on every request. **No `ctx.storage.getUrl` URL and no `generateUploadUrl` URL is ever issued** (AE-4), because a Convex file URL is a bearer URL whose only documented revocation is deleting the blob, and deleting or hiding a metadata row does not revoke it (C-12, C-13).
4. Metadata is three new owner-scoped tables (`resourceFolders`, `resources`, `resourceLinks`). `notes` is untouched (AE-1). Superseded 2026-10-12: `resourceLinks` is a derived index of the resource references in note bodies (RS-02, RS-03); the `notes` schema is still untouched.
5. Soft delete only. **No physical purge is assumed** (OD-4). Consequence stated plainly: until a purge is approved, bytes outlive soft deletion and account deletion, with no read path, and per-user quota is only freed by a purge (section 11.4).

### 1.1 Owner decisions (all closed 2026-10-12: defaults adopted, see the top section)

| ID | Decision | Recommended default (EXTRAPOLATED) | Blocks |
|---|---|---|---|
| OD-1 | **Data classes.** Which file types may be stored; privacy-text update | **Default adopted 2026-10-12.** Allow PNG, JPEG, WebP, GIF, PDF, plain text, Markdown. Exclude audio, video, archives, JSON, CSV, HTML, SVG, Office files, executables. Update the user-facing privacy text before activation. | BLK-1 |
| OD-2 | **Limits, quota, spend.** Per-file size, per-user bytes and rows, rate, global storage budget, how soft-deleted bytes count | **Default adopted 2026-10-12** (limits only; spend still needs the owner). 4 MiB per file; 50 MiB and 100 ready files per user; 3 open uploads; 20 uploads per hour; soft-deleted bytes keep counting until purged; storage budget and spend approved separately (UNK-1). Full table in section 7. | BLK-2 |
| OD-3 | **Retention, restore, export.** Restore window; account-restore behavior; export shape and byte delivery | **Default adopted 2026-10-12.** Per-resource restore window = existing `GRACE_MS` (30 days); account restore does not bulk-restore resources (same as every other table); export = metadata manifest plus per-file authenticated download of **live** resources only (soft-deleted resources are not exported, so every manifest entry is readable through the content route, 11.5), no bulk ZIP and no emailed link. | BLK-3 |
| OD-4 | **Physical deletion.** (a) scheduled purge of bytes after soft delete or account deletion. (b) deleting a blob that the system itself just stored and failed to commit | **Default adopted 2026-10-12.** (a) Not approved now; decide before quota UX is relied on (section 11.4). (b) Approve, limited to the same-request blob that failed commit and was never referenced. | BLK-3 |
| OD-5 | **Note deletion vs attached resources** | **Default adopted 2026-10-12.** Resources survive note deletion. Only the note-to-resource link becomes invisible, and returns on note restore, rebuilt from the body (RS-03). | BLK-3 |
| OD-6 | **Preview and download disposition** | **Default adopted 2026-10-12.** Inline only for PNG, JPEG, WebP, GIF. PDF and text are download-only. | BLK-1 |
| OD-7 | **Direct browser route (Route 2)** instead of the same-origin proxy (Route 1): needs a CORS origin setting and a new env var | **Default adopted 2026-10-12.** Do not approve. Use Route 1 (AE-5). | none unless chosen |

### 1.2 Implementation is blocked until (explicit)

| ID | Blocked on | Cleared by |
|---|---|---|
| BLK-1 | Approved data classes and preview policy | OD-1, OD-6 recorded. Cleared 2026-10-12 (defaults adopted). |
| BLK-2 | Approved size, quota, rate and spend limits | OD-2 recorded. Cleared 2026-10-12 for limits (default adopted); storage spend still needs the owner (UNK-1). |
| BLK-3 | Approved retention, restore, export and deletion semantics | OD-3, OD-4, OD-5 recorded. Cleared 2026-10-12 (defaults adopted). |
| BLK-4 | A **feasible revocable access route** | Gates FG-1 to FG-6 (section 10.5) pass on a credentialed test deployment, by a separately admitted run. This file proposes the route; it proves nothing. |
| BLK-5 | Prerequisite contracts and schema owners | #837 note identity contract merged; #846 and #851 schema slices serial; #808 lifecycle owner released; no writer owns `convex/schema.ts`, `convex/http.ts` or generated `api.d.ts` |
| BLK-6 | Generated API route | The separately owned generation route (#806). No codegen, `convex dev` or deploy is admitted by this file. |

### 1.3 Explicit non-assumptions

No automatic ingestion, transcription, OCR, thumbnailing, embedding or search indexing of resource bytes. No public or shared links. No purge, no retention change, and no `ctx.storage.delete` except on the OD-4(b) path (settled 2026-10-12: the upload handler deletes the blob it stored in the same request when the commit fails). No third-party storage provider, no new dependency, no new env var in Route 1. No real private data in tests. Signed-in preview proof is a later gate and is not claimed.

## 2. Scope

In scope: ownership model, schemas, API signatures, upload state machine, access route, lifecycle, validation, test matrix. Out of scope: any code, `convex/schema.ts`, `convex/MIGRATIONS.md`, UI, `docs/PRD.md`, `docs/TRD.md`, `docs/HARD_RULES.md` (build tickets never edit the six docs; doc errors go to section 16).

## 3. Verified current state

Read at `6cca807`. "Typings" means `node_modules/convex/dist/esm-types/server/storage.d.ts` of installed `convex@1.32.0` (`bun.lock:959`). "Docs" means docs.convex.dev read through Context7 on 2026-10-11; not checked against the deployed backend (UNK-9).

| # | Claim | Evidence |
|---|---|---|
| C-1 | No Convex file storage is used anywhere. `grep -rnE "ctx\.storage\|_storage\|generateUploadUrl\|storage\.(get\|store\|delete\|generate)" convex apps packages --exclude-dir=node_modules --exclude-dir=.next` returns no line. | command run in this worktree at `6cca807` |
| C-2 | `notes` has only `userId, title, body, pinned, periodType, aiGenerated?, createdAt, updatedAt, deletedAt?`. No kind, folder, tag or attachment field. At the newer tip `5fc1e67f` (#826) it also has optional `pageType` and `date`, and a `noteBlocks` table exists; still no kind, folder, tag or attachment field. | `convex/schema.ts:256-275` at `6cca807`; `:256-288` and `:290` at `5fc1e67f` |
| C-3 | Owner is `userId: v.id("users")`, set by the server from `requireUser`; every user-owned table has `by_userId` and `by_userId_deletedAt`. | `convex/schema.ts:5-14`, `docs/BACKEND-SCHEMA.md:13-15` |
| C-4 | `requireUser` resolves the identity, throws "Not authenticated" or "User not found", and throws "This account is not active" for soft-deleted or deactivated users. `resolveUserFromIdentity` is exported and does not apply the inactive policy. | `convex/lib/requireUser.ts:45-63`, `:65-83` |
| C-5 | Pending accounts are refused by `requireApprovedUser`, which throws a plain `Error`. | `convex/lib/approval.ts:29-30`, `:120-126` |
| C-6 | Note read helpers return `null` for missing, foreign and soft-deleted notes; mutations throw "Note not found". `getSafe` takes a string and uses `normalizeId` so a bad URL id never throws. | `convex/notes.ts:50-60`, `:62-75`, `:155-158` |
| C-7 | UI Undo is 5 minutes (`UNDO_WINDOW_MS`). Server restore eligibility is 30 days from `deletedAt`, inclusive (`GRACE_MS`, `isRestorable`). `notes.restore` returns `{ success: false }` outside the window. | `convex/lib/softDelete.ts:1-14`, `convex/notes.ts:200-215` |
| C-8 | `USER_OWNED_TABLES` is an explicit list of 14 tables (unchanged at `5fc1e67f`, where the new user-owned `noteBlocks` table is not in it; #808 owns that; stale on 2026-10-12: #807 added it, now `convex/lib/accountDeletion.ts:37`). Account soft delete patches `{ deletedAt, updatedAt }` on every row found by `by_userId`, with an unbounded `.collect()`. It never touches storage. | `convex/lib/accountDeletion.ts:5-20`, `:93-95`, `:177-196` |
| C-9 | A test pins the exact `USER_OWNED_TABLES` list. A new owned table breaks it by design. | `convex/lib/accountDeletion.test.ts:69-88` |
| C-10 | Sign-in restore revives the account fields only; owned rows stay soft-deleted, and a test asserts this for nags, coach data and MCP tokens. | `convex/lib/accountDeletion.ts:32-55`, `convex/auth.ts:106-115`, `convex/lib/accountDeletion.test.ts:154-200` |
| C-11 | There is no scheduled job. No `convex/crons.ts`, no `cronJobs`, no `scheduler.runAfter`. `docs/HARD_RULES.md:237` says a scheduled job hard-deletes after 30 days; that job does not exist. #808 says the same. | `ls convex/crons*`, `rg "cronJobs\|scheduler\."` over `convex/` |
| C-12 | Typings: `getUrl` returns "a URL which fetches the file via an HTTP GET". After `storage.delete`, URLs "previously generated by `getUrl` will return 404s". Deleting the blob is the only revocation the API documents. | typings `:56-70`, `:149` |
| C-13 | Docs: Convex file URLs are bearer URLs. For expiring URLs Convex points to the Cloudflare R2 component. For per-request access control, serve through an HTTP action that authenticates and checks access. | docs.convex.dev "Serve files" |
| C-14 | Typings/docs: `generateUploadUrl` is a short-lived URL (docs: expires in 1 hour) used with a client POST that returns `{ storageId }`. File size is not limited by Convex; the POST has a 2 minute timeout. | typings `:118-145`; docs "Upload files" |
| C-15 | Typings/docs: `ctx.storage.store(blob)` and `ctx.storage.get(id)` exist only in actions and HTTP actions. Metadata (`_id, _creationTime, contentType?, sha256, size`) is read with `ctx.db.system.get("_storage", id)` in queries and mutations. HTTP action request and response bodies are limited to 20 MB. A request with `Authorization: Bearer <JWT>` makes `ctx.auth.getUserIdentity()` return the user in an HTTP action. | typings `:84-97`, `:189-225`; docs "HTTP actions", "Auth in functions" |
| C-16 | Docs limits per query or mutation: 32,000 documents scanned, 16,000 documents written, 4,096 index ranges read, 16 MiB read and written. | docs.convex.dev "Limits" |
| C-17 | Existing HTTP: `convex/http.ts` registers auth, RevenueCat and `/mcp` routes. The `/mcp` handler reads a Bearer token, enforces an origin allowlist from env `TEMPO_MCP_ALLOWED_ORIGINS`, caps the body, and returns 403 for pending accounts. The Next.js side is a thin same-origin proxy that drops `Origin` and `Cookie`. | `convex/http.ts:6-24`; `convex/mcpHttp.ts:24`, `:37-53`, `:69-71`; `apps/web/app/api/mcp/route.ts:21-28`, `:34-37`, `:71` |
| C-18 | No attachment, upload or file feature exists in PRD, TRD, APP-FLOW or UI-BRIEF. `docs/HARD_RULES.md:236` mentions only a data-export ZIP "stored in Convex file storage, link emailed via Resend". Memory import takes pasted text (1 MiB cap) and stores only derived memories. | `rg` over `docs/`; `docs/HARD_RULES.md:236`; `convex/memoryImport.ts:6`, `:14-23`; `docs/TRD.md:122` |
| C-19 | The RAM-only rule: third-party content is processed in memory only, raw bodies never reach disk or Convex, only approved derived records persist. | `docs/HARD_RULES.md:148-156` |
| C-20 | `scan:ram-only-audit` fails if `convex/schema.ts` has a line matching `raw(Message(s)\|Content\|Chat\|Scan\|Import)s?\|scannedContent\|chatExport`, and fails if `.db.delete(` calls in `convex/` exceed the baseline of 10. It does **not** match `ctx.storage.delete` or `getUrl`. Hard deletes exist today in seven places. | `scripts/scan-ram-only-audit.ts:32`, `:53`; `scripts/scan-baselines.json:4`; `convex/users.ts:236`, `goals.ts:90`, `habits.ts:114`, `conversations.ts:120,123`, `messages.ts:165`, `memories.ts:180` |
| C-21 | Web auth: `ConvexAuthNextjsProvider`; middleware protects `/api(.*)` except listed public routes, and redirects signed-out requests to `/sign-in?next=...`. The installed `@convex-dev/auth@0.0.91` exports `convexAuthNextjsToken(): Promise<string \| undefined>`; the repo does not call it today. | `apps/web/components/providers/providers.tsx:3,17`; `apps/web/proxy.ts:59-64`; `apps/web/lib/rootEntry.ts:14-25,48-52`; `node_modules/@convex-dev/auth/dist/nextjs/server/index.d.ts:55`; `rg convexAuthNextjsToken apps packages` returns nothing |
| C-22 | Search covers notes, tasks, habits and goals only. MCP tools expose no resource or attachment. | `convex/search.ts:15-42`; `rg -i resource convex/mcpTools.ts` shows only the crisis card (`:233`) |
| C-23 | The shared test fake context has only `auth` and `db` (no `storage`, no `db.system`, no `scheduler`), and `db.get` derives the table from the id prefix. | `convex/lib/testFakeCtx.ts:4-69` |
| C-24 | The only user-facing export is memories as Markdown. `convex/dsr.ts`, named by `docs/HARD_RULES.md:235`, does not exist. | `convex/memory.ts:155-189`; `ls convex/dsr.ts` |
| C-25 | The repo has no `ConvexError` and no `paginate` use. Both exist in the installed package (`convex/values` errors, `convex/server` `paginationOptsValidator`). | `rg ConvexError\|paginate convex/`; `node_modules/convex/dist/esm-types/values/errors.d.ts`, `server/pagination.d.ts` |
| C-26 | The queries convention: no `Date.now()` inside a query; the browser passes the time. | `docs/BACKEND-SCHEMA.md:19` |
| C-27 | A SHA-256 helper over Web Crypto already runs in Convex code. No ULID helper exists in `convex/`. | `convex/lib/mcp/token.ts:34-35`; `rg -i ulid convex/` |

## 4. Data-class boundary

| Class | Examples | Persist raw bytes? | Rule |
|---|---|---|---|
| **R1 resource** | An image, PDF or text file the owner picks and uploads in the web UI | **Yes, only after BLK-1 to BLK-4 clear** | This contract |
| T1 third-party scanner content | Email, WhatsApp, Telegram, ChatGPT or Claude export, Obsidian vault, Apple Notes | **No** | `docs/HARD_RULES.md:148-156` |
| T2 imported raw histories | History import (#817, #821, #750) | **No** | Same rule. Parser output is derived records only. |
| V1 audio and recordings | Voice audio, lecture recordings (#819 is separate) | **No** | Audio and video are not in the allowlist. Voice capture and spoken replies stay transient (#863, #864, both held and separate). |
| M1 memory import | Pasted memory export | **No** | `convex/memoryImport.ts:14-23` stores derived memories only |

How the boundary is enforced (AE-2, all reviewable by `rg`):

1. `resources.origin` is the literal `"user_upload"`. The only creator is `beginUpload`, a public mutation behind `requireUser`. No `internalMutation`, scanner, importer, coach tool, Agent tool or MCP tool inserts, reads or accepts a `resourceId`.
2. Resource bytes are read in exactly two places: upload validation and the byte route. No model call, parser, search index or embedding receives them.
3. The allowlist (OD-1) excludes the shapes that exports and recordings take: JSON, CSV, HTML, archives, audio, video.
4. **Residual risk (UNK-10):** a user can rename a text export to `.txt` and attach it. That is the owner's own explicit file, stored as an opaque resource and never processed. Content-based detection of exported histories is not attempted.
5. Nothing here reinterprets the RAM-only rule as permission to persist scanner-sourced or imported raw content. If an importer ever wants to keep a source file, it needs its own contract and an owner decision.

## 5. Decisions register (engineering)

All ADOPTED-ENGINEERING. Each names where it is specified.

| ID | Decision | Section |
|---|---|---|
| AE-1 | Three tables: `resourceFolders`, `resources`, `resourceLinks`. The `notes` schema is untouched. No bytes, base64, storage URL or bearer URL in any metadata field or in `notes.body`. Superseded 2026-10-12 (RS-02, RS-03): the body's same-origin proxy-path references are the attachment relation, and `resourceLinks` is their derived index. Was: the link table is the only attachment relation, and no URL of any kind is in `notes.body`. | 6, settlement |
| AE-2 | Provenance and isolation of bytes as in section 4. | 4 |
| AE-3 | **Storage ids never cross the server boundary.** No public function takes or returns a storage id. `resources.storageId` is set only by the internal commit, and `by_storageId` plus a commit check keep one blob per resource. | 6, 8 |
| AE-4 | **No bearer URLs.** `ctx.storage.getUrl` and `ctx.storage.generateUploadUrl` are never called. Bytes move only through the two HTTP routes. | 10 |
| AE-5 | **Route 1.** The browser calls a same-origin Next.js route; that route obtains the session JWT server-side and calls the Convex HTTP action. The Convex routes send no CORS headers and handle no `OPTIONS`. | 10 |
| AE-6 | HTTP handlers call `ctx.auth.getUserIdentity()` and pass `{ subject, email }` to internal functions that use `resolveUserFromIdentity`, `isInactiveAccount` and `isApproved`. Identity propagation through `ctx.runQuery` is **not** assumed. | 10 |
| AE-7 | Every byte request re-checks account, approval, resource owner, state and deletion, and optionally the note link, **before** touching storage. All denials are 404, except missing or invalid credentials (401) and pending approval (403). | 10 |
| AE-8 | Upload state machine with five states, lazy expiry (no cron), an attempts cap and row-slot recycling. | 9 |
| AE-9 | Idempotent `beginUpload` by `requestId` + `requestDigest`, aligned with #828 D3. | 9 |
| AE-10 | Validate before store: exact size, extension-to-type table, signature check, text check. Store a Blob typed with the server-determined type. | 12 |
| AE-11 | Filename and name normalization algorithm. | 12 |
| AE-12 | Folder identity is the Convex id. Sibling-unique names by `nameKey`. Depth, count and cycle bounds. Delete only when empty. | 6, 8 |
| AE-13 | Soft delete only. No `.db.delete` anywhere in resource code. `restoreResource` returns `{ success: false }` outside the window (window itself is OD-3). Settled 2026-10-12: `ctx.storage.delete` is called only on the OD-4(b) path. | 11 |
| AE-14 | Link visibility is derived (link live, resource live and ready, note live). No cascade writes into `notes`. Re-linking reuses the existing link row. Settled 2026-10-12 (RS-03): link rows are rebuilt from bodies, and a reference that returns revives its row by key. | 6, 11 |
| AE-15 | Bounded reads. Cursor pagination with `numItems` at most 100. No unbounded `.collect()` on a resource table except account soft delete, which relies on the row caps in section 7. | 7, 8 |
| AE-16 | All three tables join `USER_OWNED_TABLES`, and the exact-list test is updated in the same slice as the schema. | 11 |
| AE-17 | Error model: `ConvexError({ code })` from mutations; queries return `null` or `[]`; HTTP returns `{ "error": { "code" } }`. | 8 |
| AE-18 | Response headers, `no-store`, single-range support. | 10 |
| AE-19 | Pending-approval accounts can neither upload nor read. | 8, 10 |
| AE-20 | `convex/resources.test.ts` brings its own fake `storage` and `db.system`, because `testFakeCtx.ts` has none and is outside every resource ticket's scope. No real upload in tests. | 13 |

## 6. Entities and exact schemas

Proposed text for `convex/schema.ts` (#851). All timestamps are epoch-ms integers. Field names avoid the RAM-only scan pattern (C-20). `userId` is set by the server only. Every table has `by_userId` and `updatedAt` because account soft delete needs both (C-8, `docs/BACKEND-SCHEMA.md:15`).

```ts
resourceFolders: defineTable({
  userId: v.id("users"),
  parentId: v.optional(v.id("resourceFolders")), // undefined = library root
  name: v.string(),     // NFC, trimmed, 1..80 code points (section 12.3)
  nameKey: v.string(),  // name.normalize("NFKC").toLowerCase(); sibling-uniqueness key
  depth: v.number(),    // 0 for children of the root; at most RESOURCE_FOLDER_MAX_DEPTH - 1; subtree re-derived on move (8.3 rule 5)
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_deletedAt", ["userId", "deletedAt"])
  .index("by_userId_parentId_deletedAt", ["userId", "parentId", "deletedAt"])
  .index("by_userId_parentId_nameKey", ["userId", "parentId", "nameKey"]),

resources: defineTable({
  userId: v.id("users"),
  folderId: v.optional(v.id("resourceFolders")), // undefined = library root
  origin: v.literal("user_upload"),
  state: v.union(
    v.literal("reserved"), v.literal("ready"), v.literal("rejected"),
    v.literal("cancelled"), v.literal("expired"),
  ),
  rejectReason: v.optional(v.union(
    v.literal("size_mismatch"), v.literal("type_mismatch"),
    v.literal("content_mismatch"), v.literal("too_many_attempts"),
  )),
  // What the owner sees and edits
  name: v.string(),       // stem, normalized, 1..200 UTF-8 bytes
  extension: v.string(),  // lowercase, from the allowlist; immutable
  // Upload admission (client claims, kept for idempotency; never trusted for serving)
  requestId: v.string(),          // "req_" + 26-char ULID (AE-9)
  requestDigest: v.string(),      // SHA-256 hex of the canonical request (section 9.2)
  declaredMimeType: v.string(),   // may be ""
  declaredSizeBytes: v.number(),  // integer 1..RESOURCE_MAX_FILE_BYTES
  attempts: v.number(),           // POST attempts started, 0..RESOURCE_MAX_ATTEMPTS
  uploadDeadlineMs: v.number(),   // createdAt + RESOURCE_RESERVATION_TTL_MS
  // Verified facts, written once by the internal commit
  contentKind: v.optional(v.union(v.literal("image"), v.literal("pdf"), v.literal("text"))),
  mimeType: v.optional(v.string()),   // server-determined, from the allowlist table
  sizeBytes: v.optional(v.number()),  // from the _storage system table
  sha256: v.optional(v.string()),     // lowercase hex, from the _storage system table
  storageId: v.optional(v.id("_storage")), // server-only; never returned (AE-3)
  readyAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_deletedAt", ["userId", "deletedAt"])
  .index("by_userId_state", ["userId", "state"])
  .index("by_userId_requestId", ["userId", "requestId"])
  .index("by_userId_folderId_deletedAt", ["userId", "folderId", "deletedAt"])
  .index("by_userId_createdAt", ["userId", "createdAt"])
  .index("by_storageId", ["storageId"]),

resourceLinks: defineTable({
  userId: v.id("users"),
  noteId: v.id("notes"),
  resourceId: v.id("resources"),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.optional(v.number()), // set by the body rebuild when the reference leaves the body (RS-03); never by note or resource deletion
})
  .index("by_userId", ["userId"])
  .index("by_userId_deletedAt", ["userId", "deletedAt"])
  .index("by_userId_noteId_deletedAt", ["userId", "noteId", "deletedAt"])
  .index("by_userId_resourceId_deletedAt", ["userId", "resourceId", "deletedAt"])
  .index("by_userId_noteId_resourceId", ["userId", "noteId", "resourceId"]),
```

Invariants the schema cannot express (enforced by the internal commit and checked by test INV-01 to INV-05):

1. `state = "ready"` implies `contentKind, mimeType, sizeBytes, sha256, storageId, readyAt` are all set, and `sizeBytes === declaredSizeBytes`.
2. Any other state implies `storageId` is unset. (Upload validation runs before `store`; a failed attempt leaves no row-linked blob.)
3. At most one `resources` row per `storageId`; at most one link row per `(userId, noteId, resourceId)`; at most one live sibling folder per `(userId, parentId, nameKey)`.
4. `extension`, `mimeType`, `sizeBytes`, `sha256` and `storageId` never change after `ready`.
5. A note or resource may be hidden or deleted without any `resourceLinks` write (AE-14).
6. `resourceFolders.depth` equals the folder's number of ancestors (0 for children of the root) in every row state, and no folder exceeds `RESOURCE_FOLDER_MAX_DEPTH - 1`. `createFolder`, `moveFolder` and `restoreFolder` maintain it, including every descendant on a move (8.3 rule 5). Checked by FLD-03, FLD-09 and INV-05.

**Identity.** A folder is identified by its `_id`, not its path or name. Rename and move keep the id. Resources reference `folderId`; links reference `resourceId` and `noteId`. Renaming or moving a folder or resource never breaks a link.

**Why separate tables and not an array on `notes`.** `notes` stays the canonical page store (#837, #786). An array on `notes` would enlarge every note document, couple note writes to attachment writes, and make attachment lifecycle depend on note edits. Settled 2026-10-12: the body holds the references (RS-02) and `resourceLinks` indexes them; there is still no attachment field on `notes`.

## 7. Limits and policy constants

Named constants for `convex/lib/resource_policy.ts` (#852; file names use snake_case per `docs/HARD_RULES.md` section 4). Values marked OD-2 are owner limits; the rest are structural engineering bounds (AE).

| Constant | Value | Status |
|---|---|---|
| `RESOURCE_MAX_FILE_BYTES` | 4,194,304 (4 MiB) | OD-2, EXTRAPOLATED. Also bounded by the route: Convex HTTP 20 MB (C-15) and the Vercel function body limit for Route 1 (UNK-4). |
| `RESOURCE_MAX_TOTAL_BYTES_PER_USER` | 52,428,800 (50 MiB) | OD-2, EXTRAPOLATED |
| `RESOURCE_MAX_READY_PER_USER` | 100 (ready rows, including soft-deleted and unpurged) | OD-2, EXTRAPOLATED |
| `RESOURCE_MAX_OPEN_RESERVATIONS` | 3 | OD-2, EXTRAPOLATED |
| `RESOURCE_BEGIN_PER_HOUR` | 20 | OD-2, EXTRAPOLATED |
| `RESOURCE_MAX_ROWS_PER_USER` | 300 (all states, any `deletedAt`) | AE, EXTRAPOLATED; keeps account soft delete bounded (C-8, C-16) |
| `RESOURCE_MAX_LINKS_PER_NOTE` | 20 | OD-2, EXTRAPOLATED |
| `RESOURCE_MAX_LINKS_PER_RESOURCE` | 20 | OD-2, EXTRAPOLATED |
| `RESOURCE_MAX_LINKS_PER_USER` | 1,000 (all rows incl. unlinked) | AE, EXTRAPOLATED |
| `RESOURCE_FOLDER_MAX_COUNT` | 100 (all states) | AE, EXTRAPOLATED |
| `RESOURCE_FOLDER_MAX_DEPTH` | 4 | AE, EXTRAPOLATED |
| `RESOURCE_FOLDER_NAME_MAX` | 80 code points | AE |
| `RESOURCE_NAME_MAX_BYTES` | 200 UTF-8 bytes | AE |
| `RESOURCE_FILENAME_RAW_MAX` | 1,024 UTF-16 units | AE |
| `RESOURCE_RESERVATION_TTL_MS` | 1,800,000 (30 min) | AE, EXTRAPOLATED |
| `RESOURCE_MAX_ATTEMPTS` | 3 | AE, EXTRAPOLATED |
| `RESOURCE_PAGE_MAX` | 100 | AE |
| `REQUEST_ID_MAX_AGE_MS` / `REQUEST_ID_MAX_FUTURE_MS` | 86,400,000 / 300,000 | AE, copied from #828 D3 |
| `RESOURCE_RESTORE_GRACE_MS` | `GRACE_MS` = 2,592,000,000 (30 days) | OD-3 (`convex/lib/softDelete.ts:5`) |

Worst-case storage at the recommended defaults: 50 MiB per approved user; with the 30-account sign-up cap (`docs/BACKEND-SCHEMA.md:140`, itself an unenforced note) that is 1.5 GiB of ready bytes. Orphan bytes (section 9.5) add at most `RESOURCE_BEGIN_PER_HOUR x RESOURCE_MAX_ATTEMPTS x 4 MiB` = 240 MiB per user per hour under adversarial races. With OD-4(b) adopted (2026-10-12), that happens only when the same-request delete fails. Whether either fits the Convex plan is UNKNOWN (UNK-1).

## 8. API

Convex modules proposed: `convex/resources.ts` (public + internal metadata, #852) and `convex/resource_access.ts` (HTTP handlers + internal authorization, #853). The names below are the contract: component tickets call only these, and generated `api.d.ts` must list exactly what is exported. No function accepts a `userId` or a storage id from the client.

Common rules: every public function starts with `requireApprovedUser` (which includes `requireUser`; AE-19), so a pending account can neither upload nor read. Queries return `null` or `[]` for missing and foreign rows without exception (matches `convex/notes.ts:50-60`); no visibility exception below relaxes ownership. **Default visibility:** library and note queries (`list`, `listForNote`, `exportManifest`) return live `ready` rows only: soft-deleted and not-ready rows are hidden. **Explicit exceptions, and no others:**

| Query | Visibility exception |
|---|---|
| `resources.get` | The owner's own row in **any upload state** (`reserved`, `ready`, `rejected`, `cancelled`, `expired`), so a client can reconcile after a POST or a failure (9.3). A soft-deleted row is still `null` here; trash is read through `listTrash`, so `resourceView.deletedAt` and `restorableUntilMs` are non-null only in `listTrash` results. |
| `resources.listUploads` | The owner's own **non-ready** rows (`reserved`, `rejected`, `cancelled`, `expired`) by definition, never `ready` rows. |
| `resources.listTrash` | The owner's own soft-deleted `ready` rows inside the restore window, by definition. |

These exceptions are metadata only. Visibility of a row in a query never grants byte access: the content route (10.2, check 3) and the link rebuild (RS-03) still require a live `ready` row. Mutations throw `ConvexError({ code, message })` (AE-17; `message` never echoes a filename or note text). Queries take `nowMs` where they need the clock (C-26); mutations use server time.

```ts
const resourceViewValidator = v.object({
  _id: v.id("resources"),
  name: v.string(),
  extension: v.string(),
  folderId: v.union(v.id("resourceFolders"), v.null()),
  state: resourceStateValidator,
  rejectReason: v.union(rejectReasonValidator, v.null()),
  contentKind: v.union(v.literal("image"), v.literal("pdf"), v.literal("text"), v.null()),
  mimeType: v.union(v.string(), v.null()),
  sizeBytes: v.union(v.number(), v.null()),
  uploadDeadlineMs: v.union(v.number(), v.null()), // non-null only while state === "reserved"
  readyAt: v.union(v.number(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.union(v.number(), v.null()),
  restorableUntilMs: v.union(v.number(), v.null()), // deletedAt + restore window, else null
});                                                  // no storageId, no sha256, no URL (AE-3)

const folderViewValidator = v.object({
  _id: v.id("resourceFolders"),
  name: v.string(),
  parentId: v.union(v.id("resourceFolders"), v.null()),
  depth: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  deletedAt: v.union(v.number(), v.null()),
  restorableUntilMs: v.union(v.number(), v.null()),
});
```

### 8.1 Public functions (`convex/resources.ts`)

| Function | Args | Returns | Notes |
|---|---|---|---|
| `resources.get` (query) | `{ resourceId: v.string() }` | `resourceView \| null` | String id, `normalizeId("resources", …)`; bad, foreign, soft-deleted or other-table ids return `null` (C-6). Exception to default visibility: the owner sees own rows in any upload state (section 8 common rules). |
| `resources.list` (query) | `{ folderId: v.union(v.id("resourceFolders"), v.null()), paginationOpts }` | `PaginationResult<resourceView>` | Live `ready` rows only, `by_userId_folderId_deletedAt`. `numItems` clamped to 100. Foreign or deleted `folderId` returns an empty page. |
| `resources.listTrash` (query) | `{ nowMs: v.number(), paginationOpts }` | `PaginationResult<resourceView>` | Soft-deleted `ready` rows with `nowMs - deletedAt <= restore window`. |
| `resources.listUploads` (query) | `{ nowMs: v.number() }` | `resourceView[]` (at most 20) | Exception to default visibility (section 8 common rules): own rows in `reserved, rejected, cancelled, expired`, newest first, created within 24 h before `nowMs`. Feeds the orphan/failed-upload status in #854. |
| `resources.listForNote` (query) | `{ noteId: v.id("notes") }` | `resourceView[]` (at most 20) | `[]` when the note is foreign, missing or soft-deleted. Only links where link, resource (ready) and note are all live. The link rows are the derived index of the body's references (RS-03). |
| `resources.listFolders` (query) | `{ parentId: v.union(v.id("resourceFolders"), v.null()), paginationOpts }` | `PaginationResult<folderView>` | Live folders only. |
| `resources.getUsage` (query) | `{ nowMs: v.number() }` | `{ usedBytes, reservedBytes, limitBytes, readyCount, limitCount }` all `v.number()` | `usedBytes` counts ready rows including soft-deleted (OD-2). Display only; enforcement is in mutations. |
| `resources.beginUpload` (mutation) | `{ requestId: v.string(), filename: v.string(), declaredMimeType: v.string(), declaredSizeBytes: v.number(), folderId: v.optional(v.id("resourceFolders")) }` | `{ resourceId: v.id("resources"), state: resourceStateValidator, uploadDeadlineMs: v.number(), replayed: v.boolean() }` | Section 9. No bytes, no URL returned. |
| `resources.cancelUpload` (mutation) | `{ resourceId: v.id("resources") }` | `{ state: resourceStateValidator }` | `reserved` to `cancelled`. Already `cancelled` returns `cancelled` (idempotent). `ready` throws `NOT_CANCELLABLE`. |
| `resources.renameResource` (mutation) | `{ resourceId: v.id("resources"), name: v.string() }` | `resourceView` | Stem only; extension is fixed. |
| `resources.moveResource` (mutation) | `{ resourceId: v.id("resources"), folderId: v.union(v.id("resourceFolders"), v.null()) }` | `resourceView` | `null` = root. Foreign or deleted folder: `FOLDER_NOT_FOUND`. |
| `resources.linkToNote` (mutation) | `{ resourceId: v.id("resources"), noteId: v.id("notes") }` | `{ linked: v.literal(true), alreadyLinked: v.boolean() }` | Superseded 2026-10-12 (RS-03): not offered. Attach inserts the reference into the body through the page writer, and the rebuild applies these checks. Was: explicit attach. Resource must be `ready` and live (else `NOT_FOUND`); note owned and live (else `NOTE_NOT_FOUND`). Idempotent. |
| `resources.unlinkFromNote` (mutation) | `{ resourceId: v.id("resources"), noteId: v.id("notes") }` | `{ unlinked: v.boolean() }` | Superseded 2026-10-12 (RS-03): not offered. Detach removes the reference from the body. Was: sets link `deletedAt`. Idempotent. Never touches the resource. |
| `resources.deleteResource` (mutation) | `{ resourceId: v.id("resources") }` | `{ success: v.boolean(), undoUntilMs: v.number() }` | Soft delete of a `ready` row. Same shape as `convex/notes.ts:196`. |
| `resources.restoreResource` (mutation) | `{ resourceId: v.id("resources") }` | `{ success: v.boolean() }` | `false` outside the window (same as `convex/notes.ts:209-211`). Restores to its folder if live, else to the root. |
| `resources.createFolder` (mutation) | `{ name: v.string(), parentId: v.optional(v.id("resourceFolders")) }` | `folderView` | |
| `resources.renameFolder` (mutation) | `{ folderId: v.id("resourceFolders"), name: v.string() }` | `folderView` | |
| `resources.moveFolder` (mutation) | `{ folderId: v.id("resourceFolders"), parentId: v.union(v.id("resourceFolders"), v.null()) }` | `folderView` | Cycle, depth and sibling-name checks, and the bounded subtree depth recompute (section 8.3 rules 3 and 5). |
| `resources.deleteFolder` (mutation) | `{ folderId: v.id("resourceFolders") }` | `{ success: v.boolean() }` | Only when it has no live sub-folder and no live resource: else `FOLDER_NOT_EMPTY`. |
| `resources.restoreFolder` (mutation) | `{ folderId: v.id("resourceFolders") }` | `{ success: v.boolean() }` | Window as above; `NAME_TAKEN` if a live sibling now has the name; parent deleted: restores under root, with the same subtree depth recompute as `moveFolder` (section 8.3 rule 5). |

Export manifest (shape for #273; OD-3, default adopted 2026-10-12, decides bytes). Read-only query `resources.exportManifest({ nowMs: v.number() })` returning the shape below. Settled 2026-10-12, fixing the open Codex P2 on #873: a query never reads the clock (C-26), so the caller passes it.

```ts
type ResourceExportManifestV1 = {
  version: 1;
  exportedAt: number; // = args.nowMs; never Date.now() inside the query
  folders: { id: string; parentId: string | null; name: string; createdAt: number }[];
  resources: {
    id: string; folderId: string | null; filename: string; mimeType: string;
    sizeBytes: number; sha256: string; createdAt: number;
    linkedNoteIds: string[];
  }[];
  bytes: "per_file_authenticated_download"; // OD-3 default; never a URL
};
```

**Export and the content route agree (11.5):** the manifest lists **live `ready` resources only** (`state === "ready"`, `deletedAt === undefined`) and live folders only. A soft-deleted resource and its metadata are absent, so no manifest entry advertises a download that the content route (10.2, check 3) would answer with 404. Hence no `deletedAt` field in the shape. `linkedNoteIds` lists only notes whose link and note are both live. Its links are the derived rows of RS-03. At most `RESOURCE_MAX_READY_PER_USER` resources and `RESOURCE_FOLDER_MAX_COUNT` folders, so the result is bounded.

### 8.2 Internal functions (not callable by clients)

| Function | Args | Returns | Used by |
|---|---|---|---|
| `internal.resources.authorizeUpload` (mutation) | `{ subject: v.string(), email: v.optional(v.string()), resourceId: v.string() }` | `{ ok: true, userId, declaredSizeBytes, extension, declaredMimeType } or { ok: false, code }` | Upload handler, before reading the body. Resolves the user (AE-6; no user or an inactive account gives `NOT_AUTHENTICATED`, 401), checks approval, ownership, `state === "reserved"`, deadline (lazily expiring), and `attempts < RESOURCE_MAX_ATTEMPTS`; increments `attempts`. |
| `internal.resources.rejectUpload` (mutation) | `{ userId: v.id("users"), resourceId: v.id("resources"), reason: rejectReasonValidator }` | `null` | Upload handler on validation failure. `reserved` to `rejected`. |
| `internal.resources.commitUpload` (mutation) | `{ userId: v.id("users"), resourceId: v.id("resources"), storageId: v.id("_storage"), contentKind: contentKindValidator, mimeType: v.string() }` | `{ ok: true } or { ok: false, code }` | Upload handler after `ctx.storage.store`. Single transaction: re-check account active (else `NOT_AUTHENTICATED`) and approved with `isApproved` (else `ACCOUNT_PENDING_APPROVAL`, 403, because approval can change through `approval.setStatus` after `authorizeUpload`; settled 2026-10-12, fixing the open Codex P2 on #873), `state === "reserved"`, deadline, `by_storageId` unused, `ctx.db.system.get("_storage", storageId).size === declaredSizeBytes`; write verified facts; `reserved` to `ready`. |
| `internal.resource_access.authorizeRead` (query) | `{ subject: v.string(), email: v.optional(v.string()), resourceId: v.string(), noteId: v.optional(v.string()) }` | `{ ok: true, storageId, filename, mimeType, contentKind, sizeBytes } or { ok: false, status: 401 \| 403 \| 404 }` | Content handler (section 10). |

```ts
type AuthorizeUploadResult =
  | { ok: true; userId: Id<"users">; declaredSizeBytes: number; extension: string; declaredMimeType: string }
  | { ok: false; code: "NOT_AUTHENTICATED" | "NOT_FOUND" | "ACCOUNT_PENDING_APPROVAL" | "UPLOAD_NOT_OPEN" | "UPLOAD_EXPIRED" | "TOO_MANY_ATTEMPTS" };
type CommitUploadResult =
  | { ok: true }
  | { ok: false; code: "NOT_AUTHENTICATED" | "ACCOUNT_PENDING_APPROVAL" | "UPLOAD_NOT_OPEN" | "UPLOAD_EXPIRED" | "SIZE_MISMATCH" | "STORAGE_ID_IN_USE" | "NOT_FOUND" };
type AuthorizeReadResult =
  | { ok: true; storageId: Id<"_storage">; filename: string; mimeType: string; contentKind: "image" | "pdf" | "text"; sizeBytes: number }
  | { ok: false; status: 401 | 403 | 404 };
```

`NOT_AUTHENTICATED` is the 401 arm of the two upload-side unions, matching the 401 of `AuthorizeReadResult`. It is returned when the identity resolves to no user row, or to an inactive (soft-deleted or deactivated) account (`isInactiveAccount`, C-4), including an account deleted **after** `beginUpload` and before the POST (`authorizeUpload`) or between `store` and `commit` (`commitUpload`, 11.3 item 4). The handler maps it to HTTP 401 `{ "error": { "code": "NOT_AUTHENTICATED" } }` with no further detail, never to a 404 or an invented code. A call that returns `NOT_AUTHENTICATED` writes nothing: no `attempts` increment, no state change. A missing or unverifiable JWT never reaches these functions (the handler answers 401 at check 1 of 10.2).

`ACCOUNT_PENDING_APPROVAL` from `commitUpload` (settled 2026-10-12) is the 403 arm: an account whose approval was revoked or set back to pending between `authorizeUpload` and the commit. The handler maps it to HTTP 403 `{ "error": { "code": "ACCOUNT_PENDING_APPROVAL" } }`. Nothing is written: the row stays `reserved` and never becomes `ready`, and the handler deletes the blob it stored in that request (OD-4(b)).

### 8.3 Folder rules

1. Names: section 12.3. Duplicate sibling `nameKey` among live folders: `NAME_TAKEN`.
2. `createFolder` computes `depth = parent.depth + 1` (root children: 0); `depth > RESOURCE_FOLDER_MAX_DEPTH - 1` gives `FOLDER_TOO_DEEP`. `depth` is a stored field that must equal the folder's number of ancestors at all times (invariant 6, section 6), so every operation that changes a folder's parent also re-derives the depth of its whole subtree (rule 5).
3. Cycle rejection: moving a folder into itself or into any descendant gives `FOLDER_CYCLE`. The ancestry walk from the target parent is capped at `RESOURCE_FOLDER_MAX_DEPTH + 1` steps and **fails closed** with `FOLDER_CYCLE` if it does not reach the root (protects against corrupt data).
4. More than `RESOURCE_FOLDER_MAX_COUNT` folders gives `FOLDER_LIMIT`.
5. **Subtree depth recompute** (`moveFolder`, and `restoreFolder` when the restored folder's parent changes, e.g. to the root because the old parent was deleted). Stored `depth` is kept; it is not dropped for compute-on-read, because list views and create/move checks read it with no ancestry walk. In one mutation (one transaction, all or nothing):
   1. `newDepth = target parent ? parent.depth + 1 : 0`; `delta = newDepth - folder.depth`.
   2. Collect the moved folder's subtree **in every row state** (live and soft-deleted, so `restoreFolder` can never expose a stale depth) breadth first, reading children with `by_userId_parentId_nameKey` (`userId` and `parentId` equality only). Keep a visited set. Fail closed with `FOLDER_CYCLE`, and write nothing, if a node repeats, if the subtree has more than `RESOURCE_FOLDER_MAX_COUNT` nodes, or if it is more than `RESOURCE_FOLDER_MAX_DEPTH` levels deep (all of these mean corrupt data).
   3. If any node has `node.depth + delta > RESOURCE_FOLDER_MAX_DEPTH - 1`: `FOLDER_TOO_DEEP`, nothing written.
   4. Otherwise patch the moved folder (`parentId`, `depth`, `updatedAt`) and, when `delta !== 0`, every descendant's `depth` and `updatedAt`.

   Cost bound: at most `RESOURCE_FOLDER_MAX_COUNT` (100) folder reads, 100 index ranges and 100 writes per move, far below the per-transaction limits (32,000 documents scanned, 16,000 written, 4,096 index ranges, C-16). The `createFolder` and `renameFolder` paths never need this because a new folder has no descendants and a rename keeps the parent.

### 8.4 Error codes

| Code | Raised by | HTTP (routes) |
|---|---|---|
| `NOT_FOUND` | any foreign, missing, deleted, wrong-table or not-ready resource | 404 |
| `FOLDER_NOT_FOUND`, `NOTE_NOT_FOUND` | foreign, missing or (note) soft-deleted reference | n/a |
| `ACCOUNT_PENDING_APPROVAL` | approval gate (constant `convex/lib/approval.ts:29`), including the `commitUpload` re-check (settled 2026-10-12) | 403 |
| `INVALID_REQUEST_ID`, `REQUEST_ID_REUSED` | `beginUpload` | n/a |
| `INVALID_FILENAME`, `INVALID_NAME`, `UNSUPPORTED_TYPE`, `TYPE_MISMATCH`, `CONTENT_MISMATCH`, `INVALID_SIZE`, `FILE_TOO_LARGE`, `SIZE_MISMATCH` | validation | 400 / 413 |
| `QUOTA_EXCEEDED`, `COUNT_EXCEEDED`, `ROW_LIMIT`, `TOO_MANY_OPEN_UPLOADS`, `RATE_LIMITED` | `beginUpload` | 429 for `RATE_LIMITED`, else 409 |
| `UPLOAD_NOT_OPEN`, `UPLOAD_EXPIRED`, `TOO_MANY_ATTEMPTS`, `NOT_CANCELLABLE` | state machine | 409 / 410 |
| `NAME_TAKEN`, `FOLDER_CYCLE`, `FOLDER_TOO_DEEP`, `FOLDER_LIMIT`, `FOLDER_NOT_EMPTY`, `LINK_LIMIT` | folders, links | n/a |
| `STORAGE_ID_IN_USE`, `STORAGE_UNAVAILABLE` | internal commit, `ctx.storage` failure | 500 / 503 |

Missing or invalid credentials, and an unknown or inactive account (including one deleted mid-upload), return HTTP 401 with `{ "error": { "code": "NOT_AUTHENTICATED" } }` and no body detail. On the upload side this is the `NOT_AUTHENTICATED` arm of `AuthorizeUploadResult` and `CommitUploadResult` (8.2).

## 9. Upload: state machine, idempotency, cancellation, orphans

### 9.1 States

`reserved`, `ready`, `rejected`, `cancelled`, `expired`. Soft delete (`deletedAt`) is an overlay on `ready`, not a state. `rejected`, `cancelled` and `expired` are terminal and can never return to `reserved`.

| From | To | Trigger | Guard | Effect |
|---|---|---|---|---|
| (none) | `reserved` | `beginUpload` | auth, approval, valid fields, type allowed, size within limits, quota, counts, rate, open-reservation cap, request id fresh | Insert row (or recycle a slot, 9.4). Quota is reserved implicitly by the row. |
| `reserved` | `ready` | `commitUpload` | row still `reserved`, owner active and approved (settled 2026-10-12), `now <= uploadDeadlineMs`, `_storage.size === declaredSizeBytes`, `storageId` unused | Write verified facts. |
| `reserved` | `rejected` | `rejectUpload` | validation failure in the handler, before `store` | `rejectReason` set. Nothing stored. |
| `reserved` | `rejected` | `authorizeUpload` | `attempts >= RESOURCE_MAX_ATTEMPTS` | `rejectReason = "too_many_attempts"`. |
| `reserved` | `cancelled` | `cancelUpload` | owner | Terminal. |
| `reserved` | `expired` | lazy, on any touch | `now > uploadDeadlineMs` | Terminal. No cron (AE-8). |
| `ready` | (deleted overlay) | `deleteResource` | owner | `deletedAt` set. |
| `ready` | `ready` | `restoreResource` | within restore window | `deletedAt` cleared. |

Everything else is refused: `cancelUpload` on `ready` gives `NOT_CANCELLABLE`; any upload attempt on a non-`reserved` row gives `UPLOAD_NOT_OPEN` (410 `UPLOAD_EXPIRED` when the deadline passed).

```
                         commitUpload
  (none) --beginUpload--> reserved ----------> ready <--> (deleted overlay: deletedAt)
                             |
                             +--rejectUpload / attempts exhausted --> rejected
                             +--cancelUpload ------------------------> cancelled
                             +--lazy, now > uploadDeadlineMs --------> expired
```

### 9.2 Idempotent `beginUpload`

0. `requireUser`, then `requireApprovedUser` (AE-19), before anything else, replays included.
1. Validate `requestId`: `"req_"` + a valid 26-character ULID (Crockford base32); its timestamp must be at most `REQUEST_ID_MAX_AGE_MS` old and at most `REQUEST_ID_MAX_FUTURE_MS` ahead of server time, else `INVALID_REQUEST_ID`. If #786's request-id helper has merged by admission, import it instead of re-implementing (UNK-7).
2. Normalize the filename (12.1) and compute `requestDigest` = SHA-256 hex (Web Crypto, as in C-27) of the UTF-8 string `v1\n<name>.<extension>\n<declaredMimeType lowercased>\n<declaredSizeBytes>\n<folderId or empty>`.
3. Look up `by_userId_requestId` first, before quota or rate checks. Same id and same digest returns the existing row with `replayed: true` and writes nothing. Same id and a different digest throws `REQUEST_ID_REUSED`. A replay of a terminal row returns that terminal state; the client must use a new request id to retry after `rejected`, `cancelled` or `expired`.
4. Only then check folder ownership, type, size, quota, counts, rate and the open-reservation cap, in that order, and insert.

### 9.3 Cancellation and retry

| Situation | Behavior |
|---|---|
| User cancels while the POST is in flight | Client aborts the request and calls `cancelUpload`. If the handler already stored the blob, `commitUpload` sees `cancelled` and returns `UPLOAD_NOT_OPEN`, and the handler deletes the blob (OD-4(b), settled 2026-10-12). |
| Network drop mid-POST | The handler never reaches `store` (the body is read in full first). The row stays `reserved`; the client re-POSTs the same bytes to the same reservation. |
| Retry after a handler or storage error | Same. Each POST start increments `attempts`; three starts are allowed and a fourth is refused with `rejected(too_many_attempts)`. |
| Retry after `rejected`, `cancelled`, `expired` | Terminal. New `beginUpload` with a **new** `requestId`. |
| Duplicate finalize (second POST after `ready`) | The handler checks state before reading the body and answers 409 `UPLOAD_NOT_OPEN` with `{ state: "ready" }`. The client reconciles with `resources.get`. No second blob is stored. |
| Two POSTs race | `authorizeUpload` serializes. Both may start (within the attempts cap); the first `commitUpload` wins; the second returns `UPLOAD_NOT_OPEN`, and its handler deletes its blob (OD-4(b)). |
| Reservation not completed | Becomes `expired` on the next touch; stops counting toward quota immediately because quota only counts unexpired reservations. |

### 9.4 Bounded rows and slot recycling

Account soft delete collects every row of the user in one transaction (C-8), so each table needs a hard row bound (C-16). `beginUpload` inserts only while the user has fewer than `RESOURCE_MAX_ROWS_PER_USER` rows. At the cap it **overwrites in place** the oldest row in state `rejected`, `cancelled` or `expired` that is older than `REQUEST_ID_MAX_AGE_MS` (so its request id can no longer be replayed), resetting every field including `createdAt`. If no such row exists it throws `ROW_LIMIT`. This is an update, not a delete, so it adds no `.db.delete` call (C-20). `RESOURCE_MAX_READY_PER_USER` is checked separately and gives `COUNT_EXCEEDED`.

### 9.5 Orphan classes

An orphan is a blob in `_storage` that no `resources` row references.

| Class | Cause | Reachable by a client? | Treatment |
|---|---|---|---|
| O1 | `store` succeeded, then `commitUpload` failed (cancel race, duplicate POST, deadline, account deleted mid-upload, function error) | No. Reads resolve by `resourceId`, and no row points at it. | Settled 2026-10-12 (OD-4(b) adopted): the handler that stored it deletes it in the same request. If that delete fails, it stays an orphan: counted, bounded by `RESOURCE_MAX_ATTEMPTS` and accepted. |
| R (retained) | Blob of a soft-deleted resource or deleted account | No (route denies, 10.2) | Not an orphan. Retained until OD-4(a). |

No `_storage` reconciliation job is specified or assumed. A bounded, read-only report of unreferenced blobs is the natural first step for whoever owns OD-4 (UNK-6).

## 10. Byte access (revocable) and upload transport

### 10.1 Why not a Convex file URL

A file URL from `getUrl` fetches the bytes with no further check (C-12, C-13). Deleting or hiding the metadata row does not revoke a URL that was already handed to a browser, an email or a log. Making it revocable means deleting the blob, which is permanent deletion and is not approved. So no such URL is ever issued (AE-4). The Cloudflare R2 component would give expiring URLs, but it is a new dependency, provider, credential and spend; it is **rejected here** and would need its own owner approval.

### 10.2 Read route

Convex (`convex/http.ts` registration, handler in `convex/resource_access.ts`):

```
GET {CONVEX_SITE_URL}/resources/content?resourceId=<id>[&noteId=<id>][&disposition=inline]
Authorization: Bearer <Convex Auth JWT>
```

Order of checks, each failing closed and each before any storage access:

1. `Authorization` present and `ctx.auth.getUserIdentity()` non-null, else 401.
2. `internal.resource_access.authorizeRead` (AE-6): resolve the user with `resolveUserFromIdentity`; no user row or `isInactiveAccount` gives 401; not approved gives 403.
3. `ctx.db.normalizeId("resources", resourceId)`; row exists; `row.userId === user._id`; `state === "ready"`; `deletedAt === undefined`; `storageId` set. Any failure gives 404 (same response for missing, foreign, deleted, not ready, wrong table).
4. If `noteId` is present: normalized, owned, `deletedAt === undefined`, and a live link row exists for `(user, note, resource)`. Else 404. This is the "stale reference denial". The link row is the derived row rebuilt from that note's body (RS-03, settled 2026-10-12).
5. Only now `ctx.storage.get(storageId)`; `null` gives 404 (never reveal storage detail).

Response headers (AE-18): `Content-Type` = the stored server-determined `mimeType` (never the declared one; `text/markdown` is served as `text/plain; charset=utf-8`); `Content-Length`; `X-Content-Type-Options: nosniff`; `Cache-Control: private, no-store`; `Vary: Authorization`; `Content-Security-Policy: default-src 'none'; sandbox`; `Referrer-Policy: no-referrer`; `Cross-Origin-Resource-Policy: same-origin`; `Accept-Ranges: bytes`; `Content-Disposition: attachment; filename="<ASCII fallback>"; filename*=UTF-8''<percent-encoded>` unless `disposition=inline` **and** `mimeType` is one of the inline-safe image types (OD-6), in which case `inline`. The filename is built only from the normalized stem and extension (section 12), so it cannot carry quotes, CR, LF or path parts.

Range: a single `bytes=a-b`, `bytes=a-` or `bytes=-n` is served as 206 with `Content-Range`, clamped to the file size; a multi-range or unsatisfiable range gives 416 with `Content-Range: bytes */<size>`. No range header gives 200. The body is at most `RESOURCE_MAX_FILE_BYTES`, far below the 20 MB response cap (C-15).

Errors are `{ "error": { "code" } }` JSON with `Cache-Control: no-store`; no filename, note text, storage id or exception text.

### 10.3 Write route

```
POST {CONVEX_SITE_URL}/resources/upload?resourceId=<id>
Authorization: Bearer <Convex Auth JWT>
Content-Type: <declared>      Content-Length: <bytes>      body: raw file bytes
```

1. Identity (no identity: 401), then `internal.resources.authorizeUpload` (checks 1 to 3 of 10.2 for a `reserved` row, deadline, attempts; increments `attempts` only on `ok: true`). Its `NOT_AUTHENTICATED` arm is HTTP 401, same as check 1 and 2 of 10.2; `store` is not called.
2. If `Content-Length` is present and differs from `declaredSizeBytes`: `rejectUpload("size_mismatch")`, 400, **nothing stored**. Read the body as bytes; if its length differs: same.
3. Extension to expected type (12.2); non-empty `declaredMimeType` other than `application/octet-stream` must equal it, else `rejectUpload("type_mismatch")`.
4. Signature and text checks (12.2) on the bytes; failure: `rejectUpload("content_mismatch")`.
5. `ctx.storage.store(new Blob([bytes], { type: mimeType }))`, optionally with `{ sha256 }` when the client sent a digest header. A thrown error leaves the row `reserved` and returns 503 `STORAGE_UNAVAILABLE`.
6. `internal.resources.commitUpload`. On `ok: false` the handler deletes the blob it stored in this request (OD-4(b), settled 2026-10-12; if that delete fails, the blob is an orphan O1) and returns the code (`NOT_AUTHENTICATED` as 401, `ACCOUNT_PENDING_APPROVAL` as 403).
7. 200 `{ "resourceId", "state": "ready" }`.

Validation happens **before** `store`, so a rejected upload never creates a blob. This is why a Convex upload URL is not used: with an upload URL the bytes land first, Convex does not limit their size (C-14), and validation would have to follow, so oversize or wrong-type blobs could accumulate before any check.

### 10.4 Route 1: same-origin proxy (AE-5)

New Next.js route handlers (not in any current ticket scope, section 16) modeled on `apps/web/app/api/mcp/route.ts`:

```
GET  /api/resources/<resourceId>/content   -> Convex GET  /resources/content
POST /api/resources/<resourceId>/upload    -> Convex POST /resources/upload
```

They run server-side, read the session JWT with `convexAuthNextjsToken()` (C-21), send it as `Authorization: Bearer`, forward only the headers the route needs (never `Cookie`, never `Origin`), stream the upstream body, use `export const dynamic = "force-dynamic"` (as `route.ts:1`), set no caching, and map an absent token to 401 JSON. The browser never sees the JWT, `<img src="/api/resources/…/content">` works with the session cookie, and the Convex routes need no CORS (browsers cannot read their responses cross-origin). Revocation latency for this route is zero: the next request re-runs 10.2.

**Requirement: the middleware must let a signed-out request reach the handler.** Today it does not, so a handler that maps an absent token to 401 would never run for a signed-out request:

- `apps/web/proxy.ts:59-64`: the matcher includes `/(api|trpc)(.*)`, so `/api/resources/...` goes through the auth middleware.
- `apps/web/proxy.ts:47-56`: for a signed-out request the middleware calls `decideEntryRedirect` and, when it returns a path, answers with `nextjsMiddlewareRedirect` instead of calling the route.
- `apps/web/lib/rootEntry.ts:48-52`: every route that is not public, not the calendar bypass and not authenticated is redirected to `/sign-in?next=...` (an HTML page).
- `apps/web/lib/rootEntry.ts:14-25` and `apps/web/proxy.ts:10`: the public list (`PUBLIC_ROUTE_PATTERNS`, turned into `isPublicRoute`) holds `/api/health` and `/api/mcp` and no `/api/resources/...`.

So the proxy work **must** add `"/api/resources/(.*)"` to `PUBLIC_ROUTE_PATTERNS` in `apps/web/lib/rootEntry.ts`, in the same way `/api/mcp` is listed (`rootEntry.ts:23-24`: the route authenticates itself) and with the same pattern style as `"/projects/(.*)"` (`proxy.ts:19`), and must update the exact-array assertion in `apps/web/lib/rootEntry.test.ts:13-23` (test ACC-16). This removes only the redirect. Authentication stays in the handler (no token: 401 JSON `NOT_AUTHENTICATED`) and in Convex (10.2 re-runs on every request); the exemption exposes no data because the Next handler holds no bytes and sends the token it was given. It is deliberately no wider than the `/api/resources/` prefix. `apps/web/proxy.ts` itself and its `config.matcher` do not change: excluding the path from the matcher instead would also skip the Convex Auth middleware for it, which is not verified here to be compatible with `convexAuthNextjsToken()` (UNK-3, FG-2), whereas a public pattern keeps the middleware running. If the implementing ticket cannot add the pattern, the fallback is to document the real behaviour instead: a signed-out request gets a redirect to `/sign-in`, and ACC-15 changes to expect that redirect; that fallback is not recommended because image elements and `fetch` callers would then receive HTML for a denied request and must treat any non-image content type as failure.

Honest limit: bytes already delivered to a browser, a disk or a screenshot cannot be recalled. `no-store` only prevents the app from caching them.

**Route 2 (OD-7, not recommended):** the browser calls Convex directly with a JWT held in client JS. Needs a CORS origin allowlist (a new env var, as `TEMPO_MCP_ALLOWED_ORIGINS` is for `/mcp`, `convex/mcpHttp.ts:37-39`), `OPTIONS` handlers, and blob URLs for previews. #853 says no CORS broadening, so Route 2 needs an explicit owner setting decision.

### 10.5 Feasibility gates (what must be proven before BLK-4 clears)

None is proven here; this ticket has no credentialed deployment and runs no Convex command.

| Gate | Must show on a test deployment | If it fails |
|---|---|---|
| FG-1 | A request with a valid Bearer JWT gets `ctx.auth.getUserIdentity()` in an HTTP action; no or bad token gets `null` | Route not feasible; owner re-decides auth for bytes |
| FG-2 | The Next route obtains the session JWT with `convexAuthNextjsToken()` and the Convex route accepts it | Route 1 not feasible; consider Route 2 (OD-7) |
| FG-3 | Owner reads own bytes; foreign, deleted, not-ready, stale-note and signed-out requests are denied with the codes in 10.2; a signed-out request through the Next proxy gets 401 JSON, not a redirect (needs the `/api/resources/(.*)` public pattern, 10.4) | Fix before any UI |
| FG-4 | Upload at `RESOURCE_MAX_FILE_BYTES` succeeds end to end; `Content-Length`/length checks fire; `store(new Blob([...], { type }))` records the server-determined `contentType` in `_storage` | Lower the cap or change transport |
| FG-5 | No CORS header, env var or Convex setting is needed in Route 1 | Escalate as OD-7 |
| FG-6 | The Vercel function body and streaming limits for the proxy at the cap (UNK-4) | Lower `RESOURCE_MAX_FILE_BYTES` |

## 11. Lifecycle: delete, restore, account, purge, export

### 11.1 Resource and link deletion

`deleteResource` sets `deletedAt`/`updatedAt` on the row and returns `undoUntilMs = deletedAt + UNDO_WINDOW_MS` (5 minutes of UI Undo, `convex/lib/softDelete.ts:2`). The **server restore window is separate** (OD-3, default `GRACE_MS`); the toast deadline is never reused as the restore deadline (#444 clarification). From that instant: lists and `listForNote` omit it, the byte route returns 404, links stay untouched but invisible (AE-14). `restoreResource` within the window makes everything visible again with no link writes. The blob is not touched (OD-4).

### 11.2 Note deletion (OD-5)

Deleting a note writes nothing to resources. `listForNote` returns `[]` while the note is soft-deleted and the links reappear when the note is restored, because the restore rebuilds them from the body (RS-03, settled 2026-10-12). The resource stays in the library. The note-delete confirmation copy (UI, not here) must say attachments stay in Resources.

### 11.3 Account deletion and restore

1. `resourceFolders`, `resources`, `resourceLinks` are added to `USER_OWNED_TABLES` (C-8) and the exact-list test is updated in the same #851 slice (C-9, AE-16). Soft delete stamps `deletedAt`/`updatedAt`; blobs are untouched.
2. The byte route returns 401 for an inactive account even if rows and blobs exist (`isInactiveAccount`, C-4).
3. Sign-in restore revives the account only; resource rows stay deleted, like every other table (C-10). The user can restore individual resources within the window. This is the existing gap #808 already reports, not a new promise; **no document may claim full account restoration** (OD-3).
4. Mid-upload account deletion: before the POST, `authorizeUpload` returns `NOT_AUTHENTICATED` (401) and nothing is stored; between `store` and commit, `commitUpload` re-checks the account and returns `NOT_AUTHENTICATED` (401), so the row never becomes `ready` and the handler deletes the blob (OD-4(b); 8.2). A revoked approval in the same gap gives `ACCOUNT_PENDING_APPROVAL` (403) the same way.

### 11.4 Physical deletion and quota (OD-4)

No code in this contract calls `ctx.db.delete`, and `ctx.storage.delete` is called only on the OD-4(b) path (settled 2026-10-12): on a failed commit, the upload handler deletes the blob it stored in the same request. Therefore:

- Bytes of soft-deleted resources and deleted accounts remain in storage with no read path. `docs/HARD_RULES.md:237` ("after 30 days, a scheduled job hard-deletes") describes a job that does not exist (C-11).
- With the recommended quota rule (soft-deleted bytes keep counting) a user's quota is only freed by a purge. Without a purge, quota behaves as a lifetime allowance. If the owner chooses to stop counting soft-deleted bytes instead, storage can grow without account (bounded only by `RESOURCE_BEGIN_PER_HOUR`). This is part of OD-2 and OD-4(a).
- A purge, when approved, must: run only on resources soft-deleted longer than the restore window (soft-deleted rows are never in an export, 11.5), be bounded per run and idempotent, call `ctx.storage.delete`, record a tombstone (new optional `purgedAt`, additive), and be a separately reviewed ticket. `scan:ram-only-audit` does not detect `ctx.storage.delete` (C-20), so that review is manual until the scan is extended.
- Do **not** assume deleting a row revokes a leaked URL: the design avoids the question by never issuing one.

### 11.5 Export (OD-3)

`resources.exportManifest({ nowMs })` (8.1) lists metadata of **live `ready` resources only**. Bytes: per-file download through the same authenticated route, which serves exactly the live `ready` rows (10.2, check 3), so every manifest entry is downloadable and none is advertised that would 404. **Soft-deleted resources are not exported**, neither their metadata nor their bytes; their retained blobs have no read path by design (R, section 9.5). To export a soft-deleted resource the owner restores it first, inside the restore window. After the window the bytes are retained but unexportable until OD-4(a) decides their fate; this is stated, not hidden. If the owner instead wants trash exported, that needs a separate export-scoped authenticated read route and its own OD-3 decision; it is **not** specified or adopted here, and the content route stays 404 for soft-deleted rows. A bulk ZIP produced by an action and delivered as a stored file plus an emailed link, as `docs/HARD_RULES.md:236` describes for data export, would create exactly the bearer URL this contract forbids; #273 must reconcile that with this contract before any export of resource bytes. Settled 2026-10-12 (RS-05): an exported body keeps its resource references as same-origin paths.

## 12. Validation

### 12.1 Filename normalization (`normalizeFilename`, pure, in `resource_policy.ts`)

Input: the raw client filename. Output: `{ name, extension }` or an error code. Steps, in order:

1. Not a string, empty, or longer than `RESOURCE_FILENAME_RAW_MAX` UTF-16 units: `INVALID_FILENAME`.
2. `normalize("NFC")`.
3. Keep only the part after the last `/` or `\`.
4. Remove C0 and C1 control characters (U+0000-U+001F, U+007F-U+009F), zero-width and bidi controls (U+200B-U+200F, U+202A-U+202E, U+2066-U+2069, U+FEFF), and the characters `< > : " | ? *`.
5. Collapse whitespace runs to one space; trim; strip leading and trailing dots and spaces.
6. Split at the last dot. No dot, a leading dot only, or a trailing dot: `INVALID_FILENAME`.
7. `extension` = lowercase text after the dot (`jpeg` is stored as `jpg`). Not in the allowlist: `UNSUPPORTED_TYPE`.
8. `name` = text before the dot, trimmed. Empty: `INVALID_FILENAME`. A Windows reserved device name (`CON, PRN, AUX, NUL, COM1-9, LPT1-9`, any case) gets a `_` prefix.
9. Truncate `name` to `RESOURCE_NAME_MAX_BYTES` UTF-8 bytes without splitting a code point; NFC again.

Verified outputs (synthetic):

| Input | Result |
|---|---|
| `Report.PDF` | name `Report`, ext `pdf` |
| `../../etc/passwd.txt` | name `passwd`, ext `txt` |
| `C:\Users\me\scan.png` | name `scan`, ext `png` |
| `evil` + U+202E + `gpj.exe.png` | name `evilgpj.exe`, ext `png` |
| `  .hidden.md  ` | name `hidden`, ext `md` |
| `CON.txt` | name `_CON`, ext `txt` |
| `שלום עולם.pdf` | name `שלום עולם`, ext `pdf` |
| `e` + U+0301 + `cole.png` | name `école` (NFC), ext `png` |
| `a` + U+0000 + `b.png` | name `ab`, ext `png` |
| `holiday photo.JPEG` | name `holiday photo`, ext `jpg` |
| 300 x `x` + `.png` | name of 200 bytes, ext `png` |
| `noext`, `...`, `notes.`, `.md` | `INVALID_FILENAME` |
| `photo.png.exe` | `UNSUPPORTED_TYPE` |

### 12.2 Type table and content checks (AE-10)

A MIME string alone is never trusted. The extension fixes the expected type; the bytes must match it. The table is the OD-1 default; changing it is an allowlist change, not a schema change (`contentKind` is a closed three-value union, so a new kind needs a schema amendment).

| contentKind | mimeType | extension | Byte check |
|---|---|---|---|
| image | `image/png` | `png` | starts `89 50 4E 47 0D 0A 1A 0A` |
| image | `image/jpeg` | `jpg` | starts `FF D8 FF` |
| image | `image/webp` | `webp` | bytes 0-3 `RIFF`, bytes 8-11 `WEBP` |
| image | `image/gif` | `gif` | starts `GIF87a` or `GIF89a` |
| pdf | `application/pdf` | `pdf` | starts `%PDF-` at offset 0 |
| text | `text/plain` | `txt` | valid UTF-8 (fatal decoder), no NUL, no control character other than TAB, LF, CR |
| text | `text/markdown` | `md` | same as `txt` |

Declared MIME: empty and `application/octet-stream` mean "unknown" and are accepted; any other value must equal the table type for the extension (`TYPE_MISMATCH` at `beginUpload` when determinable from the extension, again at upload). A signature that does not match the extension's type gives `CONTENT_MISMATCH`.

What this does and does not prove: it proves the bytes start like the claimed format. It does not prove the file is benign (a PDF can carry active content; an image can target a decoder). That is why serving is `attachment` by default, `nosniff`, sandbox CSP, and inline only for raster images (OD-6). No malware scanning is specified; adding one is a new provider, access and spend (UNK-11). SVG, HTML and anything else that can run script in the app origin are excluded (PRD `docs/PRD.md:249`, TRD `docs/TRD.md:198`).

### 12.3 Names

Resource rename and folder names: NFC; steps 4 and 5 of 12.1; no dot-suffix logic; folder names 1-80 code points, resource stems 1-200 bytes; empty after cleaning: `INVALID_NAME`. Folder `nameKey` = `name.normalize("NFKC").toLowerCase()`. UI renders names with `dir="auto"` (Hebrew and English mix; PRD F-71, F-72).

## 13. Synthetic test matrix (coverage the implementation tickets must add)

Fixtures: users A and B; notes `nA1` (A), `nA2` (A, soft-deleted), `nB1` (B); folders `fA1`, `fA2` (A), `fB1` (B); resources `rA1` (A, ready), `rAd` (A, ready, soft-deleted), `rAr` (A, reserved), `rAx` (A, rejected), `rB1` (B, ready). Bytes are generated in memory (valid PNG header, ASCII text). No file system, no network, no real data. Tests in `convex/resources.test.ts` and `convex/resource_access.test.ts` use their own fake `storage` and `db.system` (AE-20).

Settled 2026-10-12: OWN-05 to OWN-08 and LIF-05 to LIF-07 call `linkToNote` and `unlinkFromNote`, which are no longer offered (RS-03). They apply to the body rebuild instead, with the same expected results: a reference to a foreign, missing, not-ready or deleted resource, or one in a foreign or soft-deleted note, makes no live link row. UPL-21 and UPL-26 now expect the handler to delete the same-request blob (OD-4(b)), and ACC-14 expects exactly one `storage.delete` call site. New cases: LNK-01 to LNK-04, UPL-27 and LIF-11.

| ID | Given / When | Then |
|---|---|---|
| **OWN-01** | B calls `get(rA1)` | `null`, same as a nonexistent id |
| OWN-02 | A calls `get` with a `notes` id string | `null`, no throw |
| OWN-03 | B calls `renameResource`, `moveResource`, `deleteResource`, `restoreResource`, `cancelUpload` on `rA1` | `NOT_FOUND`; row unchanged |
| OWN-04 | A `moveResource(rA1, fB1)` and `beginUpload(folderId = fB1)` | `FOLDER_NOT_FOUND`; no row inserted; usage unchanged |
| OWN-05 | A `linkToNote(rA1, nB1)` | `NOTE_NOT_FOUND`; no link row |
| OWN-06 | A `linkToNote(rA1, nA2)` (soft-deleted note) | `NOTE_NOT_FOUND` |
| OWN-07 | A `linkToNote(rB1, nA1)` | `NOT_FOUND`; no link row |
| OWN-08 | A `linkToNote(rAr, nA1)`, `linkToNote(rAx, nA1)`, `linkToNote(rAd, nA1)` | `NOT_FOUND` for not-ready or deleted |
| OWN-09 | A `listForNote(nB1)`; B `listForNote(nA1)` | `[]` |
| OWN-10 | A `list`/`listFolders` with `fB1` as parent | empty page |
| OWN-11 | No public function has a `storageId` or `userId` argument or return field (reflect over exports and view validators) | holds |
| OWN-12 | Internal `commitUpload` with a `storageId` already bound to `rB1` | `STORAGE_ID_IN_USE`; `rAr` stays `reserved` |
| OWN-13 | Pending-approval account calls `beginUpload` and the read route | `ACCOUNT_PENDING_APPROVAL` / 403; no row |
| OWN-14 | Visibility exceptions (section 8): A calls `get` on `rAr`, `rAx`, `rA1`, `rAd`; A calls `list`, `listForNote`, `listUploads`, `listTrash`; B calls `get` on `rAr` and `listUploads` | `get` returns the view for `rAr`, `rAx`, `rA1` and `null` for `rAd`; `list` and `listForNote` omit `rAr`, `rAx`, `rAd`; `listUploads` returns exactly `rAr` and `rAx` and never a `ready` row; `listTrash` returns only `rAd` (non-null `deletedAt`, `restorableUntilMs`); B gets `null` and an empty `listUploads` |
| **ACC-01** | Read route, no `Authorization` | 401, empty detail |
| ACC-02 | Read route, malformed/expired token (identity `null`) | 401 |
| ACC-03 | A reads `rA1` | 200, bytes equal, headers per 10.2, `Cache-Control: private, no-store`, `nosniff`, `Content-Type` is the stored type |
| ACC-04 | B reads `rA1`; A reads a nonexistent id; A reads a `notes` id | identical 404 bodies |
| ACC-05 | A reads `rAd` (deleted), `rAr` (reserved), `rAx` (rejected), cancelled, expired | 404 each |
| ACC-06 | A restores `rAd` inside the window, then reads | 200 |
| ACC-07 | A reads `rA1` with `noteId = nA1` and a live link | 200 |
| ACC-08 | Same, link unlinked; or `nA1` soft-deleted; or `noteId = nB1`; or malformed `noteId` | 404 each (stale reference) |
| ACC-09 | A's account soft-deleted (`users.deletedAt` set), valid token | 401; blob untouched |
| ACC-15 | Signed out through the Next proxy (no session cookie), GET `/api/resources/<id>/content` and POST `/api/resources/<id>/upload` | HTTP 401 `{ "error": { "code": "NOT_AUTHENTICATED" } }`, not a 307 to `/sign-in`; the route handler ran (10.4) |
| ACC-16 | The public-route list (`PUBLIC_ROUTE_PATTERNS`) and the matcher built from it as at `proxy.ts:10`: `/api/resources/<id>/content`, `/api/resources/<id>/upload`; then `/api/resources`, `/api/resources-x`, `/api/notes`; each signed out through `decideEntryRedirect` | the first two are public and give `null`; the others are not public and give `/sign-in?next=...` (the exemption is no wider than the `/api/resources/` prefix). Whether the matcher is unit-testable under `bun test` is not verified here; if not, the test pins the list and a regex-equivalent check |
| ACC-10 | `Range: bytes=0-9`, `bytes=-4`, `bytes=5-`, `bytes=0-1,3-4`, `bytes=999999999-` | 206, 206, 206, 416, 416; `Content-Range` correct; no range gives 200 |
| ACC-11 | `disposition=inline` for PNG; for PDF; for text | `inline` only for PNG (OD-6); others `attachment` |
| ACC-12 | Filename `evil"\r\nX: y.png` stored via the normalizer | header contains no quote, CR or LF; RFC 5987 form present |
| ACC-13 | Response is built twice for A then B on the same URL shape | no shared state; every response carries `Vary: Authorization` and `no-store` |
| ACC-14 | Source scan of `convex/` | zero `getUrl`, zero `generateUploadUrl`, zero `.db.delete` in resource modules; exactly one `storage.delete` call site, in the upload handler's commit-failure branch, on the blob that request stored (OD-4(b), settled 2026-10-12) |
| **UPL-01** | begin, POST valid PNG, commit | `ready`; `sizeBytes`, `sha256` come from `_storage`, not from the client |
| UPL-02 | begin twice, same id and digest | same `resourceId`, `replayed: true`, usage and row count unchanged |
| UPL-03 | begin, same id, different filename or size | `REQUEST_ID_REUSED` |
| UPL-04 | request id malformed, ULID older than 24 h, ULID more than 5 min ahead | `INVALID_REQUEST_ID` |
| UPL-05 | declared size 0, -1, 1.5, NaN, `RESOURCE_MAX_FILE_BYTES + 1` | `INVALID_SIZE` / `FILE_TOO_LARGE`; no row |
| UPL-06 | `Content-Length` or actual bytes differ from declared | `rejected(size_mismatch)`, 400; `store` not called |
| UPL-07 | extension `.png` with declared `application/pdf` | `TYPE_MISMATCH`, `store` not called |
| UPL-08 | `evil.html` renamed `evil.png`, HTML bytes | `rejected(content_mismatch)`; `store` not called |
| UPL-09 | `.txt` with a NUL byte; with invalid UTF-8; `.pdf` with PNG bytes | `rejected(content_mismatch)` |
| UPL-10 | `.svg`, `.html`, `.zip`, `.json`, `.mp3`, `.mp4` | `UNSUPPORTED_TYPE` at `beginUpload` |
| UPL-11 | Quota: usage + declared over `RESOURCE_MAX_TOTAL_BYTES_PER_USER` | `QUOTA_EXCEEDED` |
| UPL-12 | 101st ready row; 4th open reservation; 21st begin in an hour; 301st row with no recyclable slot | `COUNT_EXCEEDED`, `TOO_MANY_OPEN_UPLOADS`, `RATE_LIMITED`, `ROW_LIMIT` |
| UPL-13 | Two begins that together exceed the quota, run in sequence | second gets `QUOTA_EXCEEDED` |
| UPL-14 | `cancelUpload` on `reserved`, then POST | `cancelled`; POST gets `UPLOAD_NOT_OPEN`; `store` not called |
| UPL-15 | `cancelUpload` on `ready` | `NOT_CANCELLABLE`; `cancelUpload` twice on `cancelled` is idempotent |
| UPL-16 | POST after the deadline | `UPLOAD_EXPIRED`; row lazily `expired`; no longer counts toward quota |
| UPL-17 | Second POST after `ready` | 409 `UPLOAD_NOT_OPEN` with `state: "ready"`; `store` not called |
| UPL-18 | POST aborted before the body completes, then POST again | one blob total; `ready` |
| UPL-19 | `store` throws | row stays `reserved`; 503 `STORAGE_UNAVAILABLE`; `attempts` incremented |
| UPL-20 | Three failed POST starts, then a fourth | `rejected(too_many_attempts)` |
| UPL-21 | `commitUpload` after `cancelUpload` (race) | `UPLOAD_NOT_OPEN`; row stays `cancelled`; the handler deletes the blob it stored (OD-4(b)) |
| UPL-22 | `_storage.size` differs from declared at commit | not `ready` |
| UPL-23 | Replay of a `rejected` request id | returns `rejected` with the same reason; no new row |
| UPL-24 | Slot recycling at the row cap | the oldest eligible terminal row is overwritten (all fields, `createdAt` reset); no `.db.delete` |
| UPL-25 | A `beginUpload`, then A's account is soft-deleted, then POST with a valid token | `authorizeUpload` returns `{ ok: false, code: "NOT_AUTHENTICATED" }`; handler 401; `store` not called; `attempts` unchanged |
| UPL-26 | `store` succeeds, then A's account is soft-deleted, then `commitUpload` | `{ ok: false, code: "NOT_AUTHENTICATED" }`; handler 401; row never `ready`; the handler deletes the blob (OD-4(b)) |
| UPL-27 | `store` succeeds, then an admin sets A's approval back to pending (or revokes it) with `approval.setStatus`, then `commitUpload` | `{ ok: false, code: "ACCOUNT_PENDING_APPROVAL" }`; handler 403; the row stays `reserved` and never becomes `ready`; usage unchanged; the handler deletes the blob |
| **FIL-01** | Every row of the 12.1 table | exact outputs |
| FIL-02 | Property: for 1,000 generated inputs, output never contains a control, bidi override, path separator or any of `< > : " \| ? *`; UTF-8 length at most 200; idempotent on its own output | holds |
| **FLD-01** | Create sibling with the same `nameKey` (`Résumé`, `RÉSUMÉ`, NFD form) | `NAME_TAKEN` |
| FLD-02 | `moveFolder` into itself; into a descendant | `FOLDER_CYCLE` |
| FLD-03 | Chain to `RESOURCE_FOLDER_MAX_DEPTH`; one deeper; move that makes the subtree too deep | `FOLDER_TOO_DEEP`; no folder row written |
| FLD-04 | Fixture with a corrupt parent loop | ancestry walk stops after the bound and returns `FOLDER_CYCLE`; no infinite loop |
| FLD-05 | 101st folder | `FOLDER_LIMIT` |
| FLD-06 | `deleteFolder` with a live resource or sub-folder; then empty | `FOLDER_NOT_EMPTY`; then success |
| FLD-07 | `restoreResource` whose folder was deleted | restored at the root |
| FLD-08 | `list` with `numItems` 1,000 | clamped to 100; page cursor stable |
| FLD-09 | At `RESOURCE_FOLDER_MAX_DEPTH` 4 (deepest allowed depth 3): folder `f` (depth 0) with child `c` (1), grandchild `g` (2) and a soft-deleted child `d` (1); root-level `p` (0) and `q` (0) with child `q1` (1). `moveFolder(f, p)`; then `moveFolder(f, q1)`; then `moveFolder(f, null)` | after the first move `f`, `c`, `g`, `d` have depth 1, 2, 3, 2; the second is `FOLDER_TOO_DEEP` (`g` would be 4) and no row is written; after the last they have 0, 1, 2, 1; in a separate run, after the first move only, `createFolder` under `c` gets depth 3 (`c.depth + 1`) and under `g` gets `FOLDER_TOO_DEEP`; `restoreFolder(d)` exposes the correct depth; a corrupt loop or a subtree over `RESOURCE_FOLDER_MAX_COUNT` nodes gives `FOLDER_CYCLE` with no write; reads and writes stay at most 100 each |
| **LIF-01** | `softDeleteUserAccount` with two owners and rows in all three tables | only the target user's rows get `deletedAt`; repeat run keeps timestamps; other owner untouched |
| LIF-02 | `USER_OWNED_TABLES` exact-list test | includes the three tables; adding a table without registering fails |
| LIF-03 | Account soft delete with resource rows and a blob | zero `storage.delete` calls; blob still present |
| LIF-04 | `signInRestorePatch` after account deletion | resource rows stay deleted (same as nags/coach, C-10); `restoreResource` works inside the window and returns `{ success: false }` at window + 1 ms |
| LIF-05 | Delete `nA1`, then `listForNote`, restore `nA1` | `[]` then the links again; no `resourceLinks` write in between |
| LIF-06 | Delete `rA1`, `listForNote`, restore | links hidden, then visible; no link write |
| LIF-07 | `unlinkFromNote`, link again | same link row reused (row count unchanged) |
| LIF-08 | Link limits: 21st link on a note, on a resource; 1,001st for the user | `LINK_LIMIT` |
| LIF-09 | `exportManifest` | no `storageId`, no URL; counts bounded |
| LIF-10 | `exportManifest` for A with `rA1` (live), `rAd` (soft-deleted), `rAr`/`rAx` (not ready), then read each listed id through the read route | only `rA1` is listed (no `rAd` row or metadata, no `deletedAt` field); every listed `id` returns 200; `rAd` returns 404 and is not in the manifest; after `restoreResource(rAd)` it is listed and returns 200 |
| LIF-11 | `exportManifest({ nowMs })` twice, with two different `nowMs` values | `exportedAt` equals the `nowMs` passed each time; the query never reads `Date.now()` (C-26) |
| **LNK-01** | A saves `nA1` with a body holding `![x](/api/resources/<rA1>/content?disposition=inline)` and `[y](/api/resources/<rA1>/content)` | one live link row `(A, nA1, rA1)`; the body is stored byte for byte |
| LNK-02 | A saves `nA1` again without the references, then adds them back | the row is soft-deleted, then revived (the same row; row count unchanged) |
| LNK-03 | A body in `nA1` that references `rB1` (B's), `rAd` (deleted), `rAr` (reserved) and a malformed id | no link row for any of them; reading each path through the route gives 404 |
| LNK-04 | Soft-delete every link row of `nA1`, then rebuild from its body; restore `nA2` (soft-deleted) whose body references `rA1` | the rebuilt rows equal the old ones; `nA2`'s row is live again after the restore (RS-03) |
| **INV-01** | Property over random op sequences | `ready` rows always carry all verified fields (6, invariant 1) |
| INV-02 | Property | non-`ready` rows never carry `storageId` |
| INV-03 | Property | no two resources share a `storageId`; no duplicate link triple |
| INV-04 | `scan:ram-only-audit` on the implementation branch | passes at baseline 10; no schema line matches the raw-content pattern |
| INV-05 | Property over random folder create, move, delete and restore sequences | every folder's stored `depth` equals its ancestor count in every row state; none exceeds `RESOURCE_FOLDER_MAX_DEPTH - 1` |

Section 13 states what the tests must prove. It is not evidence that any of them ran.

## 14. Consumer contracts

| Ticket | Must |
|---|---|
| #851 schema | Add exactly the section 6 tables, `MIGRATIONS.md` entry (additive, inactive), `USER_OWNED_TABLES` entries and the updated exact-list test (LIF-01, LIF-02). No endpoints, no storage calls, no upload URL. |
| #852 API | Implement section 8 `convex/resources.ts` and `convex/lib/resource_policy.ts` (constants, `normalizeFilename`, type table, sniff, `parseRequestId`). No function in #852 calls a `ctx.storage` method; storage calls exist only in the #853 handlers. `commitUpload` may read `ctx.db.system.get("_storage", id)` for size and hash. Test OWN, UPL (policy half), FLD, LIF. |
| #853 access | Implement both HTTP handlers (read **and** upload) in `convex/resource_access.ts`, registered in `convex/http.ts`; no CORS, no `OPTIONS`. Its title and DONE widen from "serve" to "serve and accept" (section 16). Test ACC, UPL (handler half). |
| (new, proposed) proxy | (a) The `/api/resources/(.*)` public-route pattern and its test, then (b) the two Next.js route handlers of 10.4 (section 16 item 2), held, after FG-1 and FG-2. |
| #854 attach UI | Call `beginUpload`, then POST bytes to `/api/resources/<id>/upload` with an `AbortController`; cancel calls `cancelUpload`; retry re-POSTs while `reserved`, or uses a new request id after a terminal state; show `listUploads` rows as "not completed"; attach only a `ready` resource, by inserting its RS-02 reference into the body through the editor (settled 2026-10-12; was `linkToNote`); never keep any URL other than the RS-02 proxy path; treat a non-image content type from a preview request as failure. |
| #855 library | Use `list`, `listFolders`, `listTrash`, `moveResource`, `renameResource`, `deleteResource`, `restoreResource`; preview via the proxy with `disposition=inline` for images only; download is `attachment`; text and PDF are never rendered in the app origin. |
| #273 export | Use `exportManifest`; reconcile the emailed-link export in `docs/HARD_RULES.md:236` with AE-4 before exporting bytes. |
| #808 lifecycle | Resource tables follow the same soft-delete rule; no cascades; purge is a separate path (OD-4). |
| #837 notes | Link visibility uses `notes.deletedAt` only. If an archive field gives notes another hidden state, amend 6 and 8 before activation. Settled 2026-10-12: the body writer rebuilds `resourceLinks` with the other derived indexes (CORE-WEB-NOTES NT-01, NT-09). |
| #839 versions | Version snapshots must not embed resource bytes or URLs; whether they may reference `resourceId` is not decided here (UNK-8). |
| #840 Markdown | Settled 2026-10-12: a body refers to a resource with the RS-02 same-origin proxy path, never a storage URL or a bearer URL. The editor renders it per RS-04. |

## 15. UNKNOWN register

| ID | Unknown | Effect |
|---|---|---|
| UNK-1 | Convex file-storage price, free allowance and plan limits for the test and live deployments; no per-user cost estimate under the 8 Oct whale standard was made | OD-2 cannot be priced |
| UNK-2 | Whether `getUrl` URLs ever expire (docs call them bearer URLs and point to R2 for expiry) | Irrelevant to the design (never issued) but unverified |
| UNK-3 | Whether the current JWT reaches the Next route handler in the form `convexAuthNextjsToken()` returns for this deployment | FG-2 |
| UNK-4 | Vercel function request and response body limits and streaming behavior for this project | FG-6; caps `RESOURCE_MAX_FILE_BYTES` |
| UNK-5 | Whether `store(new Blob([...], { type }))` records the Blob type as `_storage.contentType` | FG-4 |
| UNK-6 | How many unreferenced blobs exist or will exist; no reconciliation report exists | OD-4 |
| UNK-7 | Whether #786 adds a request-id/ULID helper before admission | `parseRequestId` may import instead of re-implement |
| UNK-8 | How versions (#839) will reference a resource. Settled 2026-10-12 for notes: RS-02. | Section 14 |
| UNK-9 | Whether the deployed backend matches this revision | All |
| UNK-10 | Content-based detection of a renamed export (`.txt` holding a chat history) | Residual risk, section 4 |
| UNK-11 | Malware or content scanning of uploads | Out of scope; would be new provider, access and spend |
| UNK-12 | Exact Convex transaction ceilings for account soft delete once the new tables join it | Row caps in section 7 are a margin, not a proof; docs list 16,000 documents written (C-16) |
| UNK-13 | Whether tier or entitlement should gate uploads | PRD is silent; AE-19 gates approval only |

## 16. Notes for ticket sync (not done here)

1. **#853 scope and wording.** The upload handler is proposed in `convex/resource_access.ts`/`convex/http.ts` (no new file), so #853's title, GOAL and DONE should widen to serve **and accept** bytes. #852 keeps only metadata and internal authorization/commit.
2. **New held tickets for the Next.js proxy, two parts** (AGENTS.md rule 2: at most 3 files + 1 test each). (a) *Middleware exemption*: add `"/api/resources/(.*)"` to `PUBLIC_ROUTE_PATTERNS` in `apps/web/lib/rootEntry.ts` and update `apps/web/lib/rootEntry.test.ts` (one source file, one test). It is required, not optional: `apps/web/proxy.ts:47-56` and `apps/web/lib/rootEntry.ts:48-52` redirect every signed-out non-public `/api/*` request to `/sign-in`, and `/api/resources/...` is not in `rootEntry.ts:14-25`, so without it the handlers of (b) never see a signed-out request and cannot return 401 (10.4). `apps/web/proxy.ts` and its matcher stay unchanged. (b) *Route handlers*: the two route files of 10.4 and one test, no shared helper file (if one is needed the ticket splits). (b) must not activate before (a) merges (ACC-15 fails without it).
3. **#851/#846 serial schema order** and the exact-list test (C-9) must be amended in the same slice. At `5fc1e67f` the user-owned `noteBlocks` table (#826) is not in `USER_OWNED_TABLES`; the schema-derived exhaustiveness check LIF-02 asks for will flag it, which is #808's slice, not this one. (Stale on 2026-10-12: #807 added `noteBlocks` to the list.)
4. **Doc errors found, not edited:** `docs/HARD_RULES.md:237` describes a 30-day hard-delete job that does not exist (C-11); `docs/HARD_RULES.md:235` names `convex/dsr.ts`, which does not exist (C-24); `docs/HARD_RULES.md:236` export-by-emailed-link conflicts with AE-4; `convex/schema.ts:5-7` says hard deletes are forbidden while seven exist (C-20).
5. **Scan gap:** `scan:ram-only-audit` does not detect `ctx.storage.delete`, `getUrl` or `generateUploadUrl`. A scan extension needs its own ticket (config-guarded files).
6. **First uses in this repo:** `ConvexError` and cursor pagination (C-25), `v.id("_storage")`, `ctx.db.system`, HTTP `GET`/`POST` with a bearer JWT. Treat them as new patterns when reviewing.
7. **Privacy text.** HARD_RULES section 10 and the GetTerms-hosted policy do not mention stored user files; the owner must update them before activation (OD-1).
8. **Settled 2026-10-12:** OD-1 to OD-7 are closed, with their defaults adopted (top section). Coordinator: record AE adoption with prerequisite heads.
9. **RS-02 grammar.** The exact reference form (the relative path, its query parameters, whether it carries `noteId`) is EXTRAPOLATED. The editor and #854 should share one helper that writes and recognises it.
10. **RS-03 writer.** The body writer (#787) must rebuild `resourceLinks` in the same transaction as the body. `linkToNote` and `unlinkFromNote` leave #852's scope.
11. **OD-4(b) by default.** The adopted default creates the repo's first `ctx.storage.delete` call site. `scan:ram-only-audit` does not see it (C-20), so its review is manual. The owner may still veto the default.
12. **OD-2 by default.** The adopted default sets limits, not spend. Storage spend still needs the owner (UNK-1).
13. **RS-04 copy.** The "file not available" state takes its copy from the v3 design (`docs/design/v3/`, branch `batch/v3-markdown-first`, not read for this redo).

## 17. DONE mapping

| #838 DONE requirement | Where |
|---|---|
| Exact schemas | Section 6 |
| API signatures | Section 8 (plus 10.2, 10.3 for the HTTP routes) |
| Cross-user and foreign-note cases | Section 13 (OWN-01 to OWN-14, ACC-04, ACC-08) |
| Upload state machine | Section 9 |
| Blocks implementation on data classes, size and quota limits, retention/restore/export policy, feasible revocable access route | Section 1.2 (BLK-1 to BLK-4), OD-1 to OD-5, FG-1 to FG-6 |
| No automatic ingestion, transcription, indexing, public sharing or purge assumed | Sections 1.3, 4, 11.4 |
