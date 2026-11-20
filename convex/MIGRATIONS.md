# Convex schema migrations

Chronological log of schema changes. Every entry names the change, the
deployment(s) it was pushed to, and the date. Additive-only changes (new
tables, new optional fields) deploy without a migration; anything destructive
needs a widen–migrate–narrow plan documented here **before** it ships.

Deployments:

- **prod**: `precious-wildcat-890` (`https://precious-wildcat-890.eu-west-1.convex.cloud`)

---

## 2026-08-11 — TF-OSS-01 keystone + T-005a/T-006a tables

Branch `cursor/tfoss01-tasks-calendar-alpha-fb84`, tickets #306 (TF-OSS-01,
Linear TEMPO-227), #161 (T-005a), #164 (T-006a).

Additive only — no destructive migration, no backfill required:

- **New table `taskRepeatCfgs`** — recurrence series config (design lifted from
  super-productivity, MIT, nothing vendored). Indexes `by_userId`,
  `by_userId_deletedAt`.
- **New fields on `tasks`** (all `v.optional(...)` — the deployment is
  populated): `energy`, `timeEstimate`, `timeSpentOnDay`, `repeatCfgId`,
  `parentTaskId`, `projectId`, `projectName`. New index
  `by_userId_projectId`.
- **New table `calendarEvents`** — single event source for Day/Week/Month
  views. Indexes `by_userId`, `by_userId_deletedAt_startsAtMs`,
  `by_userId_deletedAt`.

Deployed to: **pending** — requires `bun x convex deploy` with the prod deploy
key after this PR merges to `integration` (deploy key is not available to
cloud agents; needs Amit or a `CONVEX_DEPLOY_KEY` secret). Update this line
with the deployment name + date when pushed.

## 2026-10-05 — TEMPO-B04-01 templates, preferences, notifications

Branch `t/585-tempo-b04-01`, ticket #585. Additive only — new tables and one
optional field. No backfill.

- **`users.onboardedAt`** — optional number.
- **New table `templates`** — person-saved page templates. Indexes `by_userId`,
  `by_userId_deletedAt`. Starter templates stay in code, not rows.
- **New table `userPreferences`** — one settings row per person. Indexes
  `by_userId`, `by_userId_deletedAt`.
- **New table `notifications`** — indexes `by_userId`, `by_userId_createdAt`,
  `by_userId_deletedAt`.

Deployed to: **not deployed by this ticket**. Merge to `integration` deploys
the test deployment `ceaseless-dog-617` via `convex-deploy-test`. Live
(`precious-wildcat-890`) is not touched here.

## 2026-10-06 — TEMPO-GATE-01 sign-up approval gate + DeepInfra model seam

Additive only. No backfill required.

- **`users.approvalStatus`** — optional `"pending" | "approved" | "revoked"`, plus
  `approvalUpdatedAt` (number) and `approvalUpdatedBy` (admin email, `"cli"` or
  `"backfill"`). New index `by_approvalStatus`.
- New accounts (both write paths: `auth.ts` callback and `users.createOrUpdateUser`)
  start **`pending`**. Emails in Convex env **`TEMPO_ADMIN_EMAILS`** (comma separated)
  start approved and are always approved (admins).
- Rows with no `approvalStatus` created before `APPROVAL_GATE_EPOCH_MS`
  (7 Oct 2026 00:00 IDT) count as approved, so existing users and e2e test users
  keep working. Rows after it with no status count as pending (fail closed).
- Server-side rejection (`ACCOUNT_PENDING_APPROVAL`) for non-approved accounts in:
  `brain_dump.prioritize`, `nags.proposePhrases`, `memories.extractMemories`
  (actions, via `lib/aiGate.requireApprovedForAi`), `coach.sendMessage`,
  `messages.create`, `conversations.create` (via `lib/approval.requireApprovedUser`).
  Rule for new code: every action that calls an LLM, STT or TTS calls
  `requireApprovedForAi(ctx)` first.
- Admin surface: `approval.listForAdmin` (query) and `approval.setStatus` (mutation),
  admin-only. CLI (internal, deploy key needed):
  `npx convex run approval:setStatusByEmail '{"email":"x@y.z","status":"approved"}'`
  (`"revoked"` to revoke), `npx convex run approval:listByStatus '{"status":"pending"}'`,
  optional `npx convex run approval:approveExistingUsers`.
- **AI model seam:** `lib/ai_router.ts` now calls DeepInfra's OpenAI-compatible
  endpoint (`https://api.deepinfra.com/v1/openai/chat/completions`) with
  `TEMPO_AI_MODEL` (default `deepseek-ai/DeepSeek-V4.1-Flash`) and `DEEPINFRA_API_KEY`.
  `memories.extractMemories` uses the same seam (no more AI_PROVIDER/AI_MODEL/AI_API_KEY
  reads). `ai_smoke.pingMistral` → `ai_smoke.pingModel`. `MISTRAL_API_KEY` is no longer read
  for text; TEMPO-B07-01 (#976, below) reads it again, for coach web search only
  (`lib/webSearch.ts`).

Deployed to: **not deployed by this ticket**. Merge to `integration` deploys the test
deployment `ceaseless-dog-617` via `convex-deploy-test`. Live is Amit's.

## 2026-10-06 — TEMPO-GATE-03 approve every existing account (release step)
- New internal mutation `approval.approveAllExistingUsers({cutoffMs?, dryRun?})`:
  every account created before the cutoff (default: now) gets `approvalStatus: "approved"`
  (`approvalUpdatedBy: "release-backfill"`). Keeps explicit `revoked` and soft-deleted rows.
  Accounts created later still start `pending`. Idempotent. Prints counts only.
- No schema change.
- Test (ceaseless-dog-617): done 6 Oct 14:06 IDT (15 approved, 0 pending).
- Live: Phase H release step, right after the live Convex deploy (Amit only):
  `npx convex run --prod approval:approveAllExistingUsers '{"dryRun":true}'`, then without `dryRun`.

## 2026-10-06 — TEMPO-MCP-01 personal MCP tokens + `/mcp` endpoint
- New table `mcpTokens` {userId, name, tokenHash (SHA-256 hex), prefix, createdAt, lastUsedAt?,
  revokedAt?, windowStartMs?, windowCount?}; indexes `by_tokenHash`, `by_userId`. New table, so no
  backfill. The two `window*` fields back the 120 calls/minute limit.
- New HTTP route `POST|GET|DELETE|OPTIONS {CONVEX_SITE_URL}/mcp` (MCP Streamable HTTP, stateless,
  protocol 2025-06-18). Bearer token auth. GET and DELETE return 405.
- New public functions `mcp.createToken` / `listTokens` / `revokeToken`; internal `mcp.resolveToken`,
  `touchToken`, `authorizeCall`; internal `mcpTools.runReadTool` / `runWriteTool` / `runBrainDump`.
- Shared `(ctx, userId, args)` helpers extracted in tasks, notes, calendar_events, dayPlans and
  brain_dump. Public functions keep their signatures and behaviour.
- Optional Convex env var `TEMPO_MCP_ALLOWED_ORIGINS` (comma separated) for browser Origins.
  Requests with no Origin (server-side MCP clients) and localhost always pass.
- Deploy: merge to `integration` deploys test (`ceaseless-dog-617`). Live is Amit's.

## 2026-10-09 — TEMPO-B06-00 inactive page/block foundation

Ticket #786. Additive only; no backfill or data migration.

- `notes` keeps its existing required `periodType` and gains optional `pageType` and `date`
  fields, plus `by_userId_deletedAt_pageType_date`.
- New `noteBlocks` table is a disposable derived index of `notes.body`. It stores strictly
  shaped `page-meta`, `task`, and `template` rows, or bounded `broken` metadata, with ownership,
  audit/soft-delete fields, and indexes for user, note, position, and block ID access.
- This change does not activate a writer, rebuild existing notes, or assert uniqueness through
  an index. Future writers must validate dates, enforce daily uniqueness transactionally, and
  update the body and derived rows atomically.

Deployed to: **not deployed by this authoring ticket**. The normal integration TEST deployment is
separate; live is not touched here.

## 2026-10-11 — TEMPO-B06-SUPPORT-CHAT-STATE Agent lifecycle metadata + bounded memory index

Ticket #807. Additive only: new optional fields, one new table, one new index, plus account-deletion
enrollment. No backfill, no data migration, no deployment by this writer. Old rows validate unchanged.

- **`conversations`** gains four optional fields: `agentThreadId` (string), `nextChatSequence`
  (number), `chatGenerationEpoch` (number) and `activeChatRequestId` (`Id<"chatRequests">`). A missing
  sequence or epoch means zero to a consumer; nothing writes a default. No existing field or index
  changed. `agentThreadId` is an opaque Agent-component string, not a host table id.
- **New table `chatRequests`** — content-free request/lifecycle metadata. Required: `userId`,
  `conversationId`, `requestKey` (string), `payloadDigest` (string), `sequence` (number), `status`
  (`queued | running | completed | failed | cancelled`), `agentPromptMessageId` (string),
  `generationEpoch` (number), `createdAt`, `updatedAt`. Optional: `agentResultMessageId` (string),
  `generationLeaseExpiresAtMs` (number), `deletedAt`. Indexes: `by_userId`, `by_userId_deletedAt`,
  `by_userId_conversationId_requestKey`, `by_userId_conversationId_deletedAt_sequence`,
  `by_userId_conversationId_deletedAt_status_sequence`. These are ordinary indexes, not unique
  constraints. The table holds no prompt, reply, memory text, exception, provider payload or page
  content; Agent stays the store for new message content.
- **`memories`** gains index `by_userId_deletedAt_salience_updatedAt` over
  `[userId, deletedAt, salience, updatedAt]`. Existing indexes are kept.
- **Account deletion** (`convex/lib/accountDeletion.ts`): `chatRequests` and #786's `noteBlocks` join
  the ordinary soft-delete path. Each live row gets `deletedAt` and `updatedAt` from one timestamp, an
  earlier `deletedAt` is kept, and another user's rows are never touched. No Agent delete API is
  called, nothing is hard-deleted and stored Agent ids are not cleared: component tables have no
  `deletedAt`, so a delete there would end the 30-day recoverable window. The tombstones are what
  deny access. Sign-in restoration restores the account row only; independently deleted child rows
  stay deleted, so this is not complete account-data recovery.
- `convex/lib/accountDeletion.test.ts` now derives the owned tables from the schema (everything with a
  `userId`, minus the `authTables` keys) and requires a typed fixture for each. A new owned table
  with no fixture fails typecheck or the focused test, then must also pass the deletion, isolation
  and idempotence run.

### Contract a later chat implementation adopts (not implemented here)

- **Identity.** One row per owner + conversation + `requestKey`. A writer must look the key up and
  insert in one transaction, because the index does not enforce uniqueness. Validate `requestKey` as
  1-128 ASCII letters, digits, underscore or hyphen. `payloadDigest` is lowercase SHA-256 hex of a
  versioned, deterministic encoding of the exact accepted payload, with no trimming before the
  comparison. Same key and same digest is a retry: reuse the saved `agentPromptMessageId` (and
  `agentResultMessageId` once completed), and take no second claim or prompt. Same key with a
  different digest fails. Different keys with identical text are different requests.
- **Order and claim.** FIFO by `sequence`, reserved from `conversations.nextChatSequence`. At most one
  running request per conversation, recorded in `activeChatRequestId`. Claiming and completing
  compare `activeChatRequestId` and `generationEpoch`, and recheck the account, conversation and
  request tombstones. Cancel, replacement or lease reclaim bumps `chatGenerationEpoch`, so a late
  completion is rejected. Provider output may reach Agent storage only through the guarded
  committing mutation. Sequence and epochs are nonnegative safe integers, checked for overflow
  before mutating; timestamps are finite server epoch milliseconds. Convex validators here
  establish structural types only.
- **Context.** Queued later prompts must not leak into the current request's context; assemble it up
  to the claimed `sequence`.
- **Live-memory read.** Exact `userId`, `deletedAt = undefined`, `.order("desc")`, `.take(20)` on
  `by_userId_deletedAt_salience_updatedAt`. Ties follow `updatedAt`, then Convex's appended creation
  time. No `collect()` and sort, and no newest-N-then-filter substitute.
- The fields do not prove exactly-once provider execution. Retry, lease length, reclaim, scheduling
  and interrupted-call cost need to be specified and tested by the chat implementation.

### Activation gates still open

- #806 Agent registration, types and real component tests. This ticket registers nothing and adds no
  endpoint, scheduler, provider call or Workflow dependency.
- The chat implementation proves duplicate request, changed payload, competing sends, interrupted
  generation, late completion and large live/deleted memory fixtures. Fake-context tests here are not
  Agent-integration or transaction-concurrency proof.
- **Known gap, outside this ticket's scope:** `convex/conversations.ts` `remove` still hard-deletes the
  conversation and its messages. Until that is repaired, deleting a conversation that way would leave
  its `chatRequests` rows and Agent thread behind and skip the grace window. #808 keeps the
  activation and privacy guards.
- `softDeleteUserAccount` reads each owned table with an unpaginated `collect()` inside one mutation.
  That is fine while `chatRequests` and `noteBlocks` have no writer, but it must be chunked or
  continued before either table can hold thousands of rows per person, or one account deletion can
  exceed Convex's per-transaction read limits.
- Expiry and retention proposals D1-D5 and the page/Undo records (#786 follow-ups, #831) are separate
  slices and are not part of this change.

Deployed to: **not deployed by this authoring ticket**. The normal integration TEST deployment is
separate; live is not touched here.

## 2026-10-11 — TEMPO-B06-SUPPORT-PAGE-LEDGER inactive page operations and proposals

Ticket #828. Additive only: one new optional field, three new tables and their indexes, plus
account-deletion enrollment. No backfill, no data migration, no deployment by this writer. Old rows
validate unchanged. Builds on #786 (`5fc1e67`, PR #826) and #807 (`edeb073`, PR #877). D1-D5 in the
ticket were adopted by the coordinator on 11 Oct 2026. This slice implements only their structural
shapes and indexes; the semantic limits stay with the later helper.

- **`notes.revision`** — optional number. A missing value means revision 0 for a legacy row. Nothing
  writes it yet and nothing backfills it. `notes.body` stays canonical. No existing field or index
  changed.
- **New table `pageOperations`** — lightweight, content-free write receipts. Required: `userId`,
  `noteId`, `requestId`, `requestDigest`, `kind` (`save | patch_block | add_task | undo`), `source`
  (`ui | coach | mcp | legacy`), `result` (`applied | noop`), `affectsBody` (boolean),
  `baseRevision`, `resultRevision`, `baseBodyDigest`, `resultBodyDigest`, `delta` (array of
  `{startUtf16, removedLengthUtf16, insertedLengthUtf16}`, offsets and lengths only), `appliedAtMs`,
  `metadataExpiresAtMs`, `createdAt`, `updatedAt`. Optional: `undoUntilMs`, `undoneAtMs`,
  `undoneByOperationId`, `undoOfOperationId`, `proposalId`, `deletedAt`. Indexes: `by_userId`,
  `by_userId_deletedAt`, `by_userId_requestId`, `by_userId_noteId_affectsBody_resultRevision`,
  `by_metadataExpiresAtMs`.
- **New table `pageOperationPayloads`** — the only operation table that holds source fragments, and
  it is private and separately expiring. Required: `userId`, `noteId`, `operationId`, `undoUntilMs`,
  `cleanupDueAtMs`, `payload`, `createdAt`, `updatedAt`. `payload` is a strict union:
  `{state: "available", splices: [{startUtf16, removedText, insertedText}]}` or
  `{state: "expired", expiredAtMs}`. Optional: `deletedAt`. Indexes: `by_userId`,
  `by_userId_deletedAt`, `by_userId_operationId`, `by_userId_noteId_deletedAt`, `by_cleanupDueAtMs`.
- **New table `pageProposals`** — one pending page action, not another chat store. Required: `userId`,
  `kind` (`add_task_to_today`), `schemaVersion` (literal 1), `noteId`, `localDate`, `conversationId`,
  `sourceRequestKey`, `proposalRevision`, `expectedPageRevision`, `blockId`, `status`
  (`pending | confirmed | rejected | cancelled | expired`), `proposalExpiresAtMs`, `cleanupDueAtMs`,
  `metadataExpiresAtMs`, `payload`, `createdAt`, `updatedAt`. `payload` is a strict union:
  `{state: "available", task: {title, durationMin}}` or `{state: "expired", expiredAtMs}`. Optional:
  `sourceAgentPromptId` (an opaque Agent string, never a host table id), `decidedAtMs`,
  `confirmedOperationId`, `confirmDigest`, `deletedAt`. Indexes: `by_userId`, `by_userId_deletedAt`,
  `by_userId_noteId_deletedAt`, `by_userId_conversationId_sourceRequestKey`, `by_cleanupDueAtMs`,
  `by_metadataExpiresAtMs`. A proposal stores only the proposed action content, never a copied prompt,
  reply, memory or raw audio.
- None of the three tables uses `v.any`, a record or bytes. All indexes are ordinary, not unique
  constraints: a committing writer enforces uniqueness (`userId + requestId`, `operationId`, `userId +
  conversationId + sourceRequestKey`) inside its own transaction.
- **Validators are structural only.** Convex `v.string` and `v.number` do not enforce the adopted
  ranges. Each new table's comment in `convex/schema.ts` lists what the later helper must validate:
  safe-integer revisions, `req_` plus ULID request ids, 64-character lowercase SHA-256 hex digests,
  delta and splice length agreement, the nonempty-delta and noop rules, Undo field pairing, real
  `YYYY-MM-DD` dates, proposal title and duration limits against the block codec, and the 5-minute
  Undo and 48-hour metadata windows. Every later committing writer must call those validators.
- **Account deletion** (`convex/lib/accountDeletion.ts`): `pageOperations`, `pageOperationPayloads`
  and `pageProposals` join `USER_OWNED_TABLES` and the ordinary soft-delete path. Each live row gets
  `deletedAt` and `updatedAt` from one timestamp, an earlier `deletedAt` is kept, and another user's
  rows are never touched. Soft deletion is a tombstone only: it does not rewrite an `available` payload
  to `expired`, erase a fragment, change `undoUntilMs`, `cleanupDueAtMs` or any other expiry value,
  schedule cleanup, call an Agent or component API, or hard-delete. #777 token revocation and every
  #807 behaviour are unchanged. Sign-in restoration restores the account row only; it does not restore
  tombstoned rows and does not resurrect an expired Undo or proposal window.
- `convex/lib/accountDeletion.test.ts` keeps the schema-derived exhaustive lifecycle check from #807.
  The three new tables have typed fixtures there, so a new owned table with no fixture still fails
  typecheck or the focused test. It also asserts the exact field, union and index shapes, that no
  unknown-content blob exists, and that source text appears only in the payload table.

### Still inactive, and the gates that remain open

- No writer, endpoint, `pageLedger` helper, scheduler registration, cleanup execution, migration or
  backfill is added here. `notes.revision` is never set.
- **Semantic helper and inverse planning:** TEMPO-B06-SUPPORT-PAGE-INVERSES (#831) owns
  `convex/lib/pageLedger.ts`, the bounds above, digest and request identity behaviour, and the
  surgical inverse transform.
- **Activation and privacy guards:** #808 must deny reads and writes on a deleted account, note or
  conversation. Enrolling the tables in account deletion does not prove those endpoint guards.
- **Cleanup:** the reviewed transient-payload cleanup that turns `available` into `expired`, and the
  scheduling, catch-up and evidence for it, are not implemented. Payload-producing activation stays
  held until it is reviewed and implemented. A timestamp or a UI countdown alone does not bound
  physical retention.
- **Consumers:** #787 (atomic page writes, revisions, request idempotency, Undo), #793 (proposal
  confirmation) and #792/#794 (preview acceptance) stay held behind the slices above.
- **Account deletion read size:** `softDeleteUserAccount` still reads each owned table with an
  unpaginated `collect()` inside one mutation. That is fine while the new tables have no writer, but
  it must be chunked or continued before any of them can hold thousands of rows per person.
- **Retention:** the 30-day account restore window does not set a minimum for inverse fragments or
  proposal content. Whatever is kept for an audit or restoration policy needs its own reviewed
  decision, and source text is not retained by default.
- Transaction isolation, real cleanup, browser persistence and preview Undo are not proven by this
  slice. Fake-context tests here are not transaction-concurrency proof.

Deployed to: **not deployed by this authoring ticket**. The normal integration TEST deployment is
separate; live is not touched here.

## 2026-10-16 — TEMPO-B07-01 coach web search + done-tasks range index

Branch `t/976-coach-web-search`, ticket #976 (Ticket 0, `convex-arch`). Additive only — one new
table, three new optional fields, one new index. No backfill.

- **New optional field `userPreferences.coachWebSearch`** — the person turned coach web search on.
  Missing reads as `false` (`preferences.get`, `preferencesFor`).
- **New optional field `messages.sources`** — `{ title, site, url }[]` on a coach reply that searched
  the web, in `[1]`, `[2]` citation order. No page text or snippet is stored.
- **New table `coachWebSearches`** — one content-free row per web search the coach actually ran
  (`userId`, `utcDateKey`, timestamps, `deletedAt`): the per-person daily limit counts them per UTC
  day. Indexes `by_userId`, `by_userId_utcDateKey`. Enrolled in account deletion
  (`USER_OWNED_TABLES`); tombstoned rows still count toward their day. Booking a search
  hard-deletes up to 10 of the caller's rows from more than 7 days ago (expired rate-limit counts,
  HARD_RULES §5), so the table stays small.
- **New index `tasks.by_userId_deletedAt_completedAt`** — `tasks.listDoneInRange`.

Deployed to: **not deployed by this authoring ticket**.

## 2026-10-19 — Kitchen: Executor connection hardening before switch-on

Branch `kitchen/executor-hardening` (owner-approved Kitchen PR, `convex-arch`; based on
`batch/b07`, after #1082). Widen-only — three new optional fields, no new index, no backfill.

- **New optional field `connectionLimits.disconnectGeneration`** — the person's cancellation
  point: every Executor disconnect adds one. Missing reads as `0`.
- **New optional field `oauthPending.startGeneration`** — the person's `disconnectGeneration` when
  the connect attempt started. Missing reads as `0`, so an attempt in flight during the deploy
  still works unless the person disconnects after it.
- **New optional field `connections.startGeneration`** — carried from the attempt to the staged
  (`pending_confirm`) row. The callback and `confirmExecutorConnect` refuse an attempt whose start
  is below the person's current `disconnectGeneration` (the tokens are revoked at Executor).
- **`connections.confirmNonceHash` / `confirmExpiresAt` meaning widened** — a confirmed row now keeps
  the nonce's SHA-256 until the nonce's own `confirmExpiresAt` (10 minutes from staging, never
  extended), so a repeated confirm answers `connected` instead of `expired`; the scheduled
  `connections.expireConfirmNonce` clears both then. Rows confirmed before this deploy have them
  cleared already, which is the same end state.

Deployed to: **not deployed by this PR**.
