import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { isInactiveAccount } from "./accountDeletion";
import { BLOCK_CODEC_LIMITS } from "./blocks";

/**
 * Activation and privacy guards for page, Undo, proposal and Agent-linked chat data (#808).
 *
 * Account soft deletion (`accountDeletion.ts`) stamps `deletedAt` on every owned row. It does not
 * erase anything, and it does not by itself stop an endpoint from reading a row. These guards are
 * the read side of that contract: every endpoint, scheduled job or background result that touches
 * the records below calls one of them first, in the same transaction that reads or commits.
 *
 * - Page data: `notes` and the derived `noteBlocks` index.
 * - Undo data: `pageOperations` receipts and the private `pageOperationPayloads` fragments.
 * - Proposal data: `pageProposals`.
 * - Agent-linked data: `conversations.agentThreadId` and `chatRequests` (opaque Agent ids).
 *
 * Why host-side guards: the Agent component has no tenancy and its `addMessages` does not check
 * that a thread is live (#815), and its tables have no `deletedAt`, so account deletion cannot
 * (and must not, during the 30-day grace window) tombstone component rows. The host row is the
 * only place that says "this thread belongs to this person and is still alive". A component-facing
 * endpoint therefore takes a host `conversationId`, calls `requireLiveAgentThread`, and uses only
 * the thread id that comes back. It never accepts a client-supplied thread or message id.
 *
 * Properties every guard keeps:
 * - Read-only. The context type is `Pick<QueryCtx, "db">`, so no write, scheduler or component
 *   call is available, and no guard changes a row. Nothing here purges, expires or cleans up.
 * - Fail closed and indistinguishable. A missing row, another person's row, a tombstoned row and a
 *   tombstoned parent all raise the same calm `PagePrivacyError` for that kind of record, so a
 *   caller cannot probe which ids exist. Messages never contain ids, text or JSON.
 * - Ownership comes from the caller's `userId`, which the server derived (`requireUser`, or the
 *   owner a scheduled job was created with). Nothing here trusts an owner field supplied by a
 *   client, and every lookup is owner-scoped through an approved `by_userId*` index.
 * - Bounded. Index reads use `take`, never `collect`, and return references to the stored rows
 *   rather than copies of their content.
 * - Transient content never outlives its eligibility. Undo fragments and the proposed action are
 *   stored until a cleanup job replaces them, and that job can run late, so a guard never decides
 *   by "is it still stored". Fragments come back only while `now < undoUntilMs`. The proposed
 *   action comes back only for a `pending` proposal while `now < proposalExpiresAtMs`. Every
 *   other guard hands back receipt-shaped data (ids, status, revisions, digests, timestamps) and
 *   never the `payload` field, so a confirmed, rejected, cancelled, expired or late-cleanup
 *   proposal exposes no content however long its row lingers.
 * - Parent checks are live, not cached. A deleted account, note or conversation makes its derived
 *   rows unreachable on the very next read, even though those rows are not individually
 *   tombstoned (a single note or conversation delete does not cascade). Restoring the account row
 *   does not make tombstoned rows reachable again either: they stay denied until their own
 *   `deletedAt` is cleared by a reviewed restore path.
 *
 * What the guards do not decide (owned by the activating tickets, each of which must still call
 * the guard inside its committing mutation, not only before an external model call):
 * - Revision, digest, request-id and inverse validation (#787, #831).
 * - Chat claim, lease and generation-epoch fencing (#743).
 * - Proposal confirm contract and `expectedProposalRevision` handling (#793).
 * - Purging expired payloads (a separate cleanup ticket) and post-grace erasure.
 */

type PrivacyCtx = Pick<QueryCtx, "db">;

/** Reasons a guard refuses. Callers map these to calm copy; none implies "found but forbidden". */
export type PagePrivacyDenial =
  | "account_unavailable"
  | "page_unavailable"
  | "conversation_unavailable"
  | "thread_unavailable"
  | "request_unavailable"
  | "operation_unavailable"
  | "undo_unavailable"
  | "undo_expired"
  | "proposal_unavailable"
  | "proposal_expired";

const DENIAL_MESSAGES: Record<PagePrivacyDenial, string> = {
  account_unavailable: "This account is not active.",
  page_unavailable: "This page isn't available.",
  conversation_unavailable: "This chat isn't available.",
  thread_unavailable: "This chat isn't available.",
  request_unavailable: "This message isn't available.",
  operation_unavailable: "This change isn't available.",
  undo_unavailable: "This change can't be undone.",
  undo_expired: "The time to undo this change has passed.",
  proposal_unavailable: "This suggestion isn't available.",
  proposal_expired: "This suggestion has expired.",
};

/** Thrown by every guard. The message is fixed copy; `code` is for the caller, never for display. */
export class PagePrivacyError extends Error {
  readonly code: PagePrivacyDenial;

  constructor(code: PagePrivacyDenial) {
    super(DENIAL_MESSAGES[code]);
    this.name = "PagePrivacyError";
    this.code = code;
  }
}

/**
 * Tables whose rows belong to one page (they carry `userId` and `noteId`). A deleted account or
 * note makes these unreachable. A test derives this set from the schema, so a new page-child
 * table fails the focused test until it is listed here and guarded.
 */
export const NOTE_CHILD_TABLES = [
  "noteBlocks",
  "pageOperations",
  "pageOperationPayloads",
  "pageProposals",
] as const satisfies readonly TableNames[];

/**
 * Tables whose rows belong to one conversation and carry `userId` (so account deletion
 * tombstones them directly). `messages` is parent-owned and has no `userId`; `messages.ts`
 * guards it through its conversation.
 */
export const CONVERSATION_CHILD_TABLES = [
  "chatRequests",
  "pageProposals",
  // Content-free usage rows; convex/voice.ts admits a session only for a live conversation the
  // caller owns (requireLegacyWritableConversation) and re-checks it on every grant and sentence.
  "voiceSessions",
] as const satisfies readonly TableNames[];

/**
 * `pageProposals` fields that hold the proposed action. Only `requirePendingProposal` may expose
 * it, and only as `task`. A test derives the full field list from the schema, so a new field must
 * be classified here or in `PROPOSAL_RECEIPT_FIELDS` before the focused test passes.
 */
export const PROPOSAL_CONTENT_FIELDS = [
  "payload",
] as const satisfies readonly (keyof Doc<"pageProposals">)[];

/** `pageProposals` fields a receipt may carry: ids, status, revisions, digest and timestamps. */
export const PROPOSAL_RECEIPT_FIELDS = [
  "_id",
  "_creationTime",
  "userId",
  "kind",
  "schemaVersion",
  "noteId",
  "localDate",
  "conversationId",
  "sourceRequestKey",
  "sourceAgentPromptId",
  "proposalRevision",
  "expectedPageRevision",
  "blockId",
  "status",
  "proposalExpiresAtMs",
  "cleanupDueAtMs",
  "metadataExpiresAtMs",
  "decidedAtMs",
  "confirmedOperationId",
  "confirmDigest",
  "createdAt",
  "updatedAt",
  "deletedAt",
] as const satisfies readonly (keyof Doc<"pageProposals">)[];

/** A proposal without its content. Built from an allowlist, so a new field is withheld by default. */
export type ProposalReceipt = Pick<Doc<"pageProposals">, (typeof PROPOSAL_RECEIPT_FIELDS)[number]>;

type AvailableUndoPayload = Extract<
  Doc<"pageOperationPayloads">["payload"],
  { state: "available" }
>;

function denial(code: PagePrivacyDenial): PagePrivacyError {
  return new PagePrivacyError(code);
}

function toProposalReceipt(proposal: Doc<"pageProposals">): ProposalReceipt {
  const receipt: Partial<Record<keyof ProposalReceipt, unknown>> = {};
  for (const field of PROPOSAL_RECEIPT_FIELDS) {
    if (proposal[field] !== undefined) {
      receipt[field] = proposal[field];
    }
  }
  return receipt as ProposalReceipt;
}

async function loadActiveOwner(ctx: PrivacyCtx, userId: Id<"users">): Promise<Doc<"users">> {
  const user = await ctx.db.get(userId);
  if (!user || isInactiveAccount(user)) {
    throw denial("account_unavailable");
  }
  return user;
}

async function loadLivePage(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  noteId: Id<"notes">,
): Promise<Doc<"notes">> {
  const note = await ctx.db.get(noteId);
  if (!note || note.userId !== userId || note.deletedAt !== undefined) {
    throw denial("page_unavailable");
  }
  return note;
}

async function loadLiveConversation(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
  code: PagePrivacyDenial = "conversation_unavailable",
): Promise<Doc<"conversations">> {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.userId !== userId || conversation.deletedAt !== undefined) {
    throw denial(code);
  }
  return conversation;
}

/** The owner's account is active. Use for background work that holds only a `userId`. */
export async function requireActiveOwner(
  ctx: PrivacyCtx,
  userId: Id<"users">,
): Promise<Doc<"users">> {
  return loadActiveOwner(ctx, userId);
}

/**
 * Active account and a live note this person owns. Call before reading or writing anything about
 * the page, and again in the mutation that commits a late result.
 */
export async function requireLivePage(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  noteId: Id<"notes">,
): Promise<{ user: Doc<"users">; note: Doc<"notes"> }> {
  const user = await loadActiveOwner(ctx, userId);
  const note = await loadLivePage(ctx, userId, noteId);
  return { user, note };
}

/**
 * Live derived `noteBlocks` rows of a live page, in index (`position`) order. At most `limit`
 * rows (the codec's block cap by default); `truncated` says more existed. A deleted page or
 * account returns nothing but a denial, never stale derived rows.
 */
export async function readLivePageBlocks(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  noteId: Id<"notes">,
  limit: number = BLOCK_CODEC_LIMITS.maxBlocks,
): Promise<{ note: Doc<"notes">; blocks: Doc<"noteBlocks">[]; truncated: boolean }> {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new RangeError("limit must be a positive integer");
  }
  const { note } = await requireLivePage(ctx, userId, noteId);
  const rows = await ctx.db
    .query("noteBlocks")
    .withIndex("by_userId_noteId_deletedAt_position", (q) =>
      q.eq("userId", userId).eq("noteId", noteId).eq("deletedAt", undefined),
    )
    .take(limit + 1);
  return { note, blocks: rows.slice(0, limit), truncated: rows.length > limit };
}

/** Active account and a live conversation this person owns. */
export async function requireLiveConversation(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
): Promise<{ user: Doc<"users">; conversation: Doc<"conversations"> }> {
  const user = await loadActiveOwner(ctx, userId);
  const conversation = await loadLiveConversation(ctx, userId, conversationId);
  return { user, conversation };
}

/**
 * The Agent thread of a live conversation. Every component-facing endpoint, generation and
 * completion path takes a host `conversationId` and uses only the `agentThreadId` returned here.
 * A conversation that never got a thread is refused, not given a guessed one.
 */
export async function requireLiveAgentThread(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  conversationId: Id<"conversations">,
): Promise<{ user: Doc<"users">; conversation: Doc<"conversations">; agentThreadId: string }> {
  const { user, conversation } = await requireLiveConversation(ctx, userId, conversationId);
  const agentThreadId = conversation.agentThreadId;
  if (agentThreadId === undefined || agentThreadId.length === 0) {
    throw denial("thread_unavailable");
  }
  return { user, conversation, agentThreadId };
}

/**
 * A live `chatRequests` row of a live conversation. Pass `conversationId` when the caller already
 * names one, so a request cannot be used against a different conversation. The row's opaque
 * Agent message ids are only safe to hand to the component after this returns. Epoch and claim
 * fencing stay with the chat implementation.
 */
export async function requireLiveChatRequest(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  requestId: Id<"chatRequests">,
  conversationId?: Id<"conversations">,
): Promise<{
  user: Doc<"users">;
  request: Doc<"chatRequests">;
  conversation: Doc<"conversations">;
}> {
  const user = await loadActiveOwner(ctx, userId);
  const request = await ctx.db.get(requestId);
  if (
    !request ||
    request.userId !== userId ||
    request.deletedAt !== undefined ||
    (conversationId !== undefined && request.conversationId !== conversationId)
  ) {
    throw denial("request_unavailable");
  }
  const conversation = await loadLiveConversation(ctx, userId, request.conversationId);
  return { user, request, conversation };
}

/** A live `pageOperations` receipt on a live page. */
export async function requireLiveOperation(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  operationId: Id<"pageOperations">,
): Promise<{ user: Doc<"users">; operation: Doc<"pageOperations">; note: Doc<"notes"> }> {
  const user = await loadActiveOwner(ctx, userId);
  const operation = await ctx.db.get(operationId);
  if (!operation || operation.userId !== userId || operation.deletedAt !== undefined) {
    throw denial("operation_unavailable");
  }
  const note = await loadLivePage(ctx, userId, operation.noteId);
  return { user, operation, note };
}

/**
 * The owner's receipt for a request id, for idempotent replay, or `null` when there is none.
 * The receipt is returned only if its page is live, so a replay cannot read a deleted page's
 * history. Indexes are not unique: more than one row, or only tombstoned rows, is refused rather
 * than guessed at.
 */
export async function findLiveOperationReceipt(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  requestId: string,
): Promise<{ operation: Doc<"pageOperations">; note: Doc<"notes"> } | null> {
  await loadActiveOwner(ctx, userId);
  const rows = await ctx.db
    .query("pageOperations")
    .withIndex("by_userId_requestId", (q) => q.eq("userId", userId).eq("requestId", requestId))
    .take(2);
  if (rows.length === 0) {
    return null;
  }
  const operation = rows[0];
  if (rows.length > 1 || operation.userId !== userId || operation.deletedAt !== undefined) {
    throw denial("operation_unavailable");
  }
  const note = await loadLivePage(ctx, userId, operation.noteId);
  return { operation, note };
}

export type UndoAccess =
  | {
      /** Authorized idempotent retry: the earlier Undo already ran. Nothing to read or write. */
      state: "already_undone";
      operation: Doc<"pageOperations">;
      note: Doc<"notes">;
    }
  | {
      state: "eligible";
      operation: Doc<"pageOperations">;
      note: Doc<"notes">;
      payloadId: Id<"pageOperationPayloads">;
      /** The stored forward splices (not copied). The inverse is derived from them by #831. */
      splices: AvailableUndoPayload["splices"];
    };

/**
 * Read access to one operation's private inverse fragments, for Undo only.
 *
 * Refuses a deleted account or page, another person's operation, an undo receipt or no-op, a
 * window that has closed, a payload already replaced by its expired marker, and a missing or
 * ambiguous payload row. The window is `appliedAtMs <= now < undoUntilMs` on both the receipt and
 * the payload: once it passes, the fragments are unreachable even if the cleanup job is late.
 * The fragments (`splices`) are returned only in the `eligible` state. `already_undone` and every
 * refusal carry receipt data or nothing, never fragments.
 * Nothing here proves the inverse is still safe to apply; a conflicting later edit is the Undo
 * mutation's calm failure to report.
 */
export async function requireUndoAccess(
  ctx: PrivacyCtx,
  args: { userId: Id<"users">; operationId: Id<"pageOperations">; now?: number },
): Promise<UndoAccess> {
  const { userId, operationId } = args;
  const now = args.now ?? Date.now();
  const { operation, note } = await requireLiveOperation(ctx, userId, operationId);

  if (
    operation.kind === "undo" ||
    operation.result !== "applied" ||
    !operation.affectsBody ||
    operation.undoUntilMs === undefined
  ) {
    throw denial("undo_unavailable");
  }
  const undoneAt = operation.undoneAtMs !== undefined;
  const undoneBy = operation.undoneByOperationId !== undefined;
  if (undoneAt !== undoneBy) {
    throw denial("undo_unavailable");
  }
  if (undoneAt) {
    return { state: "already_undone", operation, note };
  }
  if (now < operation.appliedAtMs) {
    throw denial("undo_unavailable");
  }
  if (now >= operation.undoUntilMs) {
    throw denial("undo_expired");
  }

  const payloads = await ctx.db
    .query("pageOperationPayloads")
    .withIndex("by_userId_operationId", (q) =>
      q.eq("userId", userId).eq("operationId", operationId),
    )
    .take(2);
  if (payloads.length !== 1) {
    throw denial("undo_unavailable");
  }
  const row = payloads[0];
  if (row.userId !== userId || row.noteId !== operation.noteId || row.deletedAt !== undefined) {
    throw denial("undo_unavailable");
  }
  if (now >= row.undoUntilMs) {
    throw denial("undo_expired");
  }
  if (row.payload.state !== "available") {
    throw denial("undo_unavailable");
  }
  return { state: "eligible", operation, note, payloadId: row._id, splices: row.payload.splices };
}

async function loadLiveProposal(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  proposalId: Id<"pageProposals">,
): Promise<{
  user: Doc<"users">;
  proposal: Doc<"pageProposals">;
  note: Doc<"notes">;
  conversation: Doc<"conversations">;
}> {
  const user = await loadActiveOwner(ctx, userId);
  const proposal = await ctx.db.get(proposalId);
  if (!proposal || proposal.userId !== userId || proposal.deletedAt !== undefined) {
    throw denial("proposal_unavailable");
  }
  const note = await loadLivePage(ctx, userId, proposal.noteId);
  const conversation = await loadLiveConversation(
    ctx,
    userId,
    proposal.conversationId,
    "proposal_unavailable",
  );
  return { user, proposal, note, conversation };
}

/**
 * The receipt of a live `pageProposals` row on a live page and a live conversation, whatever its
 * status. Use for receipts (for example a repeated confirm that returns `confirmedOperationId`).
 * The result is receipt-shaped and never carries `payload`: a confirmed, rejected, cancelled or
 * expired proposal, and a pending one past `proposalExpiresAtMs`, exposes no content here even
 * while the cleanup job is late and the content is still stored. `requirePendingProposal` is the
 * only guard that returns the proposed action.
 */
export async function requireLiveProposal(
  ctx: PrivacyCtx,
  userId: Id<"users">,
  proposalId: Id<"pageProposals">,
): Promise<{
  user: Doc<"users">;
  proposal: ProposalReceipt;
  note: Doc<"notes">;
  conversation: Doc<"conversations">;
}> {
  const { proposal, ...rest } = await loadLiveProposal(ctx, userId, proposalId);
  return { ...rest, proposal: toProposalReceipt(proposal) };
}

/**
 * The proposed action of a pending, unexpired proposal, for preview or confirmation. Beyond
 * `requireLiveProposal` it requires status `pending`, `now < proposalExpiresAtMs` (a late expiry
 * sweep does not extend access) and an `available` payload, and that the owner's live
 * `chatRequests` row named by `sourceRequestKey` still exists in the same conversation. A
 * rejected, cancelled, expired or already confirmed proposal never exposes its content here.
 * The content comes back only as `task`; `proposal` is the receipt, without `payload`.
 */
export async function requirePendingProposal(
  ctx: PrivacyCtx,
  args: { userId: Id<"users">; proposalId: Id<"pageProposals">; now?: number },
): Promise<{
  user: Doc<"users">;
  proposal: ProposalReceipt;
  note: Doc<"notes">;
  conversation: Doc<"conversations">;
  task: { title: string; durationMin: number };
}> {
  const { userId, proposalId } = args;
  const now = args.now ?? Date.now();
  const { proposal, ...rest } = await loadLiveProposal(ctx, userId, proposalId);

  if (proposal.status !== "pending") {
    throw denial("proposal_unavailable");
  }
  if (now >= proposal.proposalExpiresAtMs) {
    throw denial("proposal_expired");
  }
  if (proposal.payload.state !== "available") {
    throw denial("proposal_unavailable");
  }

  const sources = await ctx.db
    .query("chatRequests")
    .withIndex("by_userId_conversationId_requestKey", (q) =>
      q
        .eq("userId", userId)
        .eq("conversationId", proposal.conversationId)
        .eq("requestKey", proposal.sourceRequestKey),
    )
    .take(2);
  if (sources.length !== 1 || sources[0].deletedAt !== undefined) {
    throw denial("proposal_unavailable");
  }
  return { ...rest, proposal: toProposalReceipt(proposal), task: proposal.payload.task };
}
