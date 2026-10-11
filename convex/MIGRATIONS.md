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
  reads). `ai_smoke.pingMistral` → `ai_smoke.pingModel`. `MISTRAL_API_KEY` is no longer read.

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
