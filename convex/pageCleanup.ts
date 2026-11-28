import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

/**
 * TEMPO-B06-SUPPORT-PAGE-CLEANUP (#883) — scheduled expiry of transient page payloads and
 * proposal content, and removal of content-free receipts once nothing needs them.
 *
 * One internal mutation, `runBatch`, run every five minutes by `convex/crons.ts`. It is the
 * "separately owned, reviewed transient-payload cleanup" that #828's page ledger names. The
 * tables it works on are inactive until a later ticket writes to them, so on every deployment
 * today a run finds nothing.
 *
 * Rules (all deadlines are read from the rows; no duration is hard-coded here):
 * - A deadline is reached when `deadline <= now`. `now = Date.now()` is read once per run.
 * - Order: operation payloads, then proposals, then operation receipts, then proposal receipts,
 *   so a receipt check sees content that this very run just expired.
 * - Expiring content replaces the stored `payload` with exactly `{ state: "expired", expiredAtMs }`.
 *   Nothing else on the row moves except `updatedAt` on a live row and a lapsed pending
 *   proposal's `status`.
 * - Receipts are hard-deleted only when every reference to them has lapsed (see `reviewOperation`
 *   and `reviewProposalReceipt`). Content-free rows only; an `available` fragment is never deleted.
 * - An Undo pair is one unit (#828 D5): the original names its undo in `undoneByOperationId` and
 *   the undo names the original in `undoOfOperationId`. Neither row is deleted until both pass
 *   every receipt check, and then both go in the same transaction. A row that is named by a link
 *   from outside its unit is kept, so no stored link is left pointing at a deleted row.
 * - Rows with `deletedAt` (account soft deletion) get their content expired in place, like any
 *   live row, without touching `deletedAt` or `updatedAt`. Their receipts wait for their own
 *   windows and then follow the same rule as every other receipt. Restoring an account cannot
 *   bring expired content back, so expiring it early on a deleted account loses nothing.
 * - Bounded: each run examines or writes at most `MAX_ROWS_PER_INVOCATION` rows, at most
 *   `MAX_PAYLOAD_ROWS_PER_INVOCATION` payload rows and at most
 *   `MAX_OPERATION_ROWS_PER_INVOCATION` operation receipts. When more remains, the run queues
 *   one continuation that carries only `{ stage, cursor }`.
 * - Nothing here logs, throws with, returns, schedules or copies fragment text. A row that does
 *   not fit the contract is skipped and counted, never thrown on.
 *
 * Retention this gives (not a guaranteed physical-erasure deadline): a fragment stays in its
 * table for at most the Undo window, plus the stored cleanup grace, plus up to one cron
 * interval, plus chain latency. Convex backups, snapshots and platform logs are outside this.
 *
 * Convex transaction limits checked 11 Oct 2026 (docs.convex.dev/production/state/limits): 16 MiB
 * read, 16 MiB written, 32,000 documents scanned, 16,000 documents written, 4,096 index ranges
 * read (`db.get` plus `db.query` calls), 1 second of user code. One run can read at most about
 * 5 MiB of fragments (20 payload rows at the 256 KiB-per-operation bound), at most
 * 2 receipts x 2 operations per Undo pair x 2 directions x 257 chain rows (2,056) of content-free
 * metadata (the chain rows are the only unbounded-in-theory read: each is under a few KiB), about
 * 2,200 documents scanned and at most about 135 index ranges, so every limit above keeps a wide
 * margin.
 */

/** Most rows one run may examine or write across all steps. */
export const MAX_ROWS_PER_INVOCATION = 100;
/**
 * Most `pageOperationPayloads` rows one run may examine. An operation can hold up to 256 KiB of
 * fragments, so this is the byte guard for both the read and the write side of the transaction.
 */
export const MAX_PAYLOAD_ROWS_PER_INVOCATION = 20;
/**
 * Most operation receipts one run may review. Each one reads up to `UNDO_CHAIN_LOOKBACK` rows
 * below and above itself on its note, and as many again for its Undo partner.
 */
export const MAX_OPERATION_ROWS_PER_INVOCATION = 2;
/** 256 intervening revisions bound one Undo (#828 D4); one more detects an overflowing chain. */
export const UNDO_CHAIN_LOOKBACK = 257;
/** One payload row per applied operation is the contract; a few extra are tolerated and counted. */
export const MAX_PAYLOAD_ROWS_PER_OPERATION = 2;
/**
 * An Undo pair: an applied operation and the undo receipt that reverted it. An undo receipt has
 * no Undo window of its own, so it cannot be undone, and no link chain is longer than this.
 */
export const MAX_OPERATIONS_PER_UNDO_UNIT = 2;

/**
 * Rows a run reserves for one reviewed operation: every row of its Undo unit plus the payload
 * rows of each, all of which it may delete together.
 */
const OPERATION_ROW_COST = MAX_OPERATIONS_PER_UNDO_UNIT * (1 + MAX_PAYLOAD_ROWS_PER_OPERATION);

const STAGES = ["payloads", "proposals", "operations", "proposalReceipts"] as const;
type Stage = (typeof STAGES)[number];

export type PageCleanupResult = {
  /** Rows read from a scan index in this run. */
  examined: number;
  /** Rows patched or deleted in this run. */
  rowsWritten: number;
  expiredOperationPayloads: number;
  expiredProposalPayloads: number;
  /** Pending proposals that lapsed and were marked `expired`. */
  lapsedProposals: number;
  deletedOperations: number;
  deletedPayloadMarkers: number;
  deletedProposals: number;
  skipped: {
    /** The payload was already the expired marker. */
    alreadyExpired: number;
    /** A deadline was reached but the row's own Undo or proposal window is still open. */
    windowOpen: number;
    /** A receipt that something still references (payload, proposal, operation, Undo chain). */
    retained: number;
    /** A row that does not fit the contract (for example too many payload rows for one operation). */
    inconsistent: number;
  };
  /** True when a continuation was queued. */
  hasMore: boolean;
};

type Counts = Omit<PageCleanupResult, "hasMore">;

type Budget = { rows: number; payloadRows: number; operationRows: number };

type RunState = {
  ctx: MutationCtx;
  now: number;
  counts: Counts;
  budget: Budget;
  /** Operation receipts this run already deleted, for example as the partner in an Undo pair. */
  deletedOperations: Set<Id<"pageOperations">>;
};

/** A place in an index scan: the last row handled, as its deadline and creation time. */
type Position = { at: number; creationTime: number };

type StageOutcome = { position: Position | null; exhausted: boolean };

function emptyCounts(): Counts {
  return {
    examined: 0,
    rowsWritten: 0,
    expiredOperationPayloads: 0,
    expiredProposalPayloads: 0,
    lapsedProposals: 0,
    deletedOperations: 0,
    deletedPayloadMarkers: 0,
    deletedProposals: 0,
    skipped: { alreadyExpired: 0, windowOpen: 0, retained: 0, inconsistent: 0 },
  };
}

/** The opaque cursor holds two timestamps and nothing else. */
function formatCursor(position: Position): string {
  return `${position.at}:${position.creationTime}`;
}

/** `null` is the start of the index. `"invalid"` means the string is not one this job wrote. */
function parseCursor(cursor: string | null | undefined): Position | null | "invalid" {
  if (cursor === undefined || cursor === null) return null;
  const parts = cursor.split(":");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") return "invalid";
  const at = Number(parts[0]);
  const creationTime = Number(parts[1]);
  if (!Number.isFinite(at) || !Number.isFinite(creationTime)) return "invalid";
  return { at, creationTime };
}

/**
 * Rows with `deadline <= now`, oldest first, strictly after `position`. This is a keyset cursor
 * on (deadline, `_creationTime`): it survives the rows before it being deleted, which a cursor
 * that names a row id would not, and it does not re-read the first N rows on every call.
 * Skipped rows (tombstones, expired markers, receipts kept for a reference) stay in the indexes,
 * so a scan that restarted from the oldest row on every call would starve the live rows behind
 * them. Rows that share both a deadline and a `_creationTime` are not expected; if one pair
 * ever straddled a page edge, the later row would be picked up by the next tick.
 */
async function takeDue<T>(
  position: Position | null,
  now: number,
  limit: number,
  loadSameDeadline: (at: number, creationTime: number, n: number) => Promise<T[]>,
  loadLater: (after: number | null, n: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  if (position !== null && position.at <= now) {
    rows.push(...(await loadSameDeadline(position.at, position.creationTime, limit)));
  }
  if (rows.length < limit) {
    rows.push(...(await loadLater(position === null ? null : position.at, limit - rows.length)));
  }
  return rows;
}

function outcomeOf<T extends { _creationTime: number }>(
  previous: Position | null,
  rows: T[],
  limit: number,
  deadlineOf: (row: T) => number
): StageOutcome {
  const last = rows[rows.length - 1];
  return {
    position:
      last === undefined ? previous : { at: deadlineOf(last), creationTime: last._creationTime },
    exhausted: rows.length < limit,
  };
}

function expiredPayload(now: number) {
  return { state: "expired" as const, expiredAtMs: now };
}

/**
 * The one hard delete in this module. It is only ever called on content-free rows (a receipt or
 * an expired marker) after every check in `reviewOperation` or `reviewProposalReceipt` passed.
 */
async function deleteReceiptRow(
  state: RunState,
  id: Id<"pageOperations"> | Id<"pageOperationPayloads"> | Id<"pageProposals">
): Promise<void> {
  await state.ctx.db.delete(id);
  state.counts.rowsWritten += 1;
}

/** Only a live row gets a new `updatedAt`; a tombstone keeps the time it was deleted at. */
function touch(row: { deletedAt?: number }, now: number): { updatedAt?: number } {
  return row.deletedAt === undefined ? { updatedAt: now } : {};
}

// ---------------------------------------------------------------------------------------------
// Step 1: operation payloads
// ---------------------------------------------------------------------------------------------

async function expireOperationPayloads(
  state: RunState,
  position: Position | null
): Promise<StageOutcome> {
  const { ctx, now, counts, budget } = state;
  const limit = Math.min(budget.rows, budget.payloadRows);
  if (limit <= 0) return { position, exhausted: false };

  const rows = await takeDue<Doc<"pageOperationPayloads">>(
    position,
    now,
    limit,
    (at, creationTime, n) =>
      ctx.db
        .query("pageOperationPayloads")
        .withIndex("by_cleanupDueAtMs", (q) =>
          q.eq("cleanupDueAtMs", at).gt("_creationTime", creationTime)
        )
        .take(n),
    (after, n) =>
      ctx.db
        .query("pageOperationPayloads")
        .withIndex("by_cleanupDueAtMs", (q) =>
          after === null
            ? q.lte("cleanupDueAtMs", now)
            : q.gt("cleanupDueAtMs", after).lte("cleanupDueAtMs", now)
        )
        .take(n)
  );
  budget.rows -= rows.length;
  budget.payloadRows -= rows.length;
  counts.examined += rows.length;

  for (const row of rows) {
    if (row.payload.state !== "available") {
      counts.skipped.alreadyExpired += 1;
    } else if (row.undoUntilMs > now) {
      // The cleanup deadline is reached but Undo is still eligible: the row contradicts itself.
      counts.skipped.windowOpen += 1;
    } else {
      await ctx.db.patch(row._id, { payload: expiredPayload(now), ...touch(row, now) });
      counts.expiredOperationPayloads += 1;
      counts.rowsWritten += 1;
    }
  }
  return outcomeOf(position, rows, limit, (row) => row.cleanupDueAtMs);
}

// ---------------------------------------------------------------------------------------------
// Step 2: proposal content
// ---------------------------------------------------------------------------------------------

async function expireProposalContent(
  state: RunState,
  position: Position | null
): Promise<StageOutcome> {
  const { ctx, now, counts, budget } = state;
  const limit = budget.rows;
  if (limit <= 0) return { position, exhausted: false };

  const rows = await takeDue<Doc<"pageProposals">>(
    position,
    now,
    limit,
    (at, creationTime, n) =>
      ctx.db
        .query("pageProposals")
        .withIndex("by_cleanupDueAtMs", (q) =>
          q.eq("cleanupDueAtMs", at).gt("_creationTime", creationTime)
        )
        .take(n),
    (after, n) =>
      ctx.db
        .query("pageProposals")
        .withIndex("by_cleanupDueAtMs", (q) =>
          after === null
            ? q.lte("cleanupDueAtMs", now)
            : q.gt("cleanupDueAtMs", after).lte("cleanupDueAtMs", now)
        )
        .take(n)
  );
  budget.rows -= rows.length;
  counts.examined += rows.length;

  for (const row of rows) {
    if (row.payload.state !== "available") {
      counts.skipped.alreadyExpired += 1;
    } else if (row.status === "pending" && row.proposalExpiresAtMs > now) {
      // A pending proposal is never touched before it lapses, whatever its cleanup deadline says.
      counts.skipped.windowOpen += 1;
    } else {
      const lapsed = row.status === "pending";
      await ctx.db.patch(row._id, {
        payload: expiredPayload(now),
        ...(lapsed ? { status: "expired" as const } : {}),
        ...touch(row, now),
      });
      counts.expiredProposalPayloads += 1;
      counts.rowsWritten += 1;
      if (lapsed) counts.lapsedProposals += 1;
    }
  }
  return outcomeOf(position, rows, limit, (row) => row.cleanupDueAtMs);
}

// ---------------------------------------------------------------------------------------------
// Step 3: operation receipts
// ---------------------------------------------------------------------------------------------

/** Why a receipt, or the Undo unit it belongs to, is kept this run. */
type Hold = "windowOpen" | "retained" | "inconsistent";

/**
 * The operations on the same note with the 257 nearest lower (`"earlier"`) or higher (`"later"`)
 * revisions: enough to see an Undo chain of up to 256 plus the entry that shows it overflows, and
 * any undo receipt of this operation, which D4 places inside that same bound.
 */
async function neighbouringOperations(
  ctx: MutationCtx,
  operation: Doc<"pageOperations">,
  direction: "earlier" | "later"
): Promise<Doc<"pageOperations">[]> {
  return await ctx.db
    .query("pageOperations")
    .withIndex("by_userId_noteId_affectsBody_resultRevision", (q) => {
      const note = q
        .eq("userId", operation.userId)
        .eq("noteId", operation.noteId)
        .eq("affectsBody", true);
      return direction === "earlier"
        ? note.lt("resultRevision", operation.resultRevision)
        : note.gt("resultRevision", operation.resultRevision);
    })
    .order(direction === "earlier" ? "desc" : "asc")
    .take(UNDO_CHAIN_LOOKBACK);
}

/** True when the operation can still be undone, so every later operation in its chain is needed. */
function isUndoEligible(operation: Doc<"pageOperations">, now: number): boolean {
  return (
    operation.undoneAtMs === undefined &&
    operation.undoUntilMs !== undefined &&
    operation.undoUntilMs > now
  );
}

function namesAny(operation: Doc<"pageOperations">, ids: Set<Id<"pageOperations">>): boolean {
  return (
    (operation.undoneByOperationId !== undefined && ids.has(operation.undoneByOperationId)) ||
    (operation.undoOfOperationId !== undefined && ids.has(operation.undoOfOperationId))
  );
}

/**
 * The receipt plus every receipt its Undo links name (`undoneByOperationId`,
 * `undoOfOperationId`), followed until no new row appears. Links are followed only within the
 * receipt's own user: another user's row has only its owner compared, never holds the receipt and
 * is never deleted. A link to a row that is already gone holds nothing. More rows than an Undo
 * pair can hold means the links do not fit the contract.
 */
async function collectUndoUnit(
  ctx: MutationCtx,
  operation: Doc<"pageOperations">
): Promise<Doc<"pageOperations">[] | "inconsistent"> {
  const unit = [operation];
  for (let i = 0; i < unit.length; i++) {
    const member = unit[i];
    for (const linkedId of [member.undoneByOperationId, member.undoOfOperationId]) {
      if (linkedId === undefined || unit.some((row) => row._id === linkedId)) continue;
      const linked = await ctx.db.get(linkedId);
      if (linked === null || linked.userId !== operation.userId) continue;
      if (unit.length >= MAX_OPERATIONS_PER_UNDO_UNIT) return "inconsistent";
      unit.push(linked);
    }
  }
  return unit;
}

/**
 * The checks one receipt must pass on its own, cheapest first. Returns the payload rows to delete
 * with it, or why it is kept.
 */
async function checkReceipt(
  state: RunState,
  operation: Doc<"pageOperations">
): Promise<Doc<"pageOperationPayloads">[] | Hold> {
  const { ctx, now } = state;

  // The scan only returns receipts past this deadline; an Undo partner may not be past it yet.
  if (operation.metadataExpiresAtMs > now) return "retained";
  if (operation.undoUntilMs !== undefined && operation.undoUntilMs > now) return "windowOpen";

  const payloadRows = await ctx.db
    .query("pageOperationPayloads")
    .withIndex("by_userId_operationId", (q) =>
      q.eq("userId", operation.userId).eq("operationId", operation._id)
    )
    .take(MAX_PAYLOAD_ROWS_PER_OPERATION + 1);
  if (payloadRows.length > MAX_PAYLOAD_ROWS_PER_OPERATION) return "inconsistent";
  // An available fragment means the content step has not caught up: leave everything.
  if (payloadRows.some((row) => row.payload.state !== "expired")) return "retained";

  if (operation.proposalId !== undefined) {
    const proposal = await ctx.db.get(operation.proposalId);
    if (
      proposal !== null &&
      proposal.userId === operation.userId &&
      proposal.metadataExpiresAtMs > now
    ) {
      return "retained";
    }
  }
  return payloadRows;
}

/**
 * Hard-deletes one receipt whose own `metadataExpiresAtMs` is reached, together with its Undo
 * partner, but only if every row of that unit is past its own window and nothing that is still
 * inside its window needs any of them: no available fragment, no open proposal, and no
 * still-eligible lower revision on the same note whose gap-free chain (#828 D4/D5) runs through
 * them. A row on the same note, above or below, that names a row of the unit without being part
 * of it (a one-sided link) keeps the unit and is counted as inconsistent, so no stored link is
 * ever left pointing at a deleted row. Every lookup is scoped to the receipt's own `userId`.
 */
async function reviewOperation(state: RunState, operation: Doc<"pageOperations">): Promise<void> {
  const { ctx, now, counts } = state;
  // Already deleted earlier in this run as the partner of an Undo pair.
  if (state.deletedOperations.has(operation._id)) return;

  const unit = await collectUndoUnit(ctx, operation);
  if (unit === "inconsistent") {
    counts.skipped.inconsistent += 1;
    return;
  }

  const payloadRowsByMember: Doc<"pageOperationPayloads">[][] = [];
  for (const member of unit) {
    const checked = await checkReceipt(state, member);
    if (typeof checked === "string") {
      counts.skipped[checked] += 1;
      return;
    }
    payloadRowsByMember.push(checked);
  }

  const unitIds = new Set(unit.map((member) => member._id));
  const namesUnitFromOutside = (other: Doc<"pageOperations">) =>
    !unitIds.has(other._id) && namesAny(other, unitIds);
  for (const member of unit) {
    const earlier = await neighbouringOperations(ctx, member, "earlier");
    if (earlier.some((other) => isUndoEligible(other, now))) {
      counts.skipped.retained += 1;
      return;
    }
    if (earlier.some(namesUnitFromOutside)) {
      counts.skipped.inconsistent += 1;
      return;
    }
    const later = await neighbouringOperations(ctx, member, "later");
    if (later.some(namesUnitFromOutside)) {
      counts.skipped.inconsistent += 1;
      return;
    }
  }

  for (const [index, member] of unit.entries()) {
    for (const row of payloadRowsByMember[index]) {
      await deleteReceiptRow(state, row._id);
      counts.deletedPayloadMarkers += 1;
    }
    await deleteReceiptRow(state, member._id);
    state.deletedOperations.add(member._id);
    counts.deletedOperations += 1;
  }
}

async function reviewOperationReceipts(
  state: RunState,
  position: Position | null
): Promise<StageOutcome> {
  const { ctx, now, counts, budget } = state;
  const limit = Math.min(Math.floor(budget.rows / OPERATION_ROW_COST), budget.operationRows);
  if (limit <= 0) return { position, exhausted: false };

  const rows = await takeDue<Doc<"pageOperations">>(
    position,
    now,
    limit,
    (at, creationTime, n) =>
      ctx.db
        .query("pageOperations")
        .withIndex("by_metadataExpiresAtMs", (q) =>
          q.eq("metadataExpiresAtMs", at).gt("_creationTime", creationTime)
        )
        .take(n),
    (after, n) =>
      ctx.db
        .query("pageOperations")
        .withIndex("by_metadataExpiresAtMs", (q) =>
          after === null
            ? q.lte("metadataExpiresAtMs", now)
            : q.gt("metadataExpiresAtMs", after).lte("metadataExpiresAtMs", now)
        )
        .take(n)
  );
  budget.rows -= rows.length * OPERATION_ROW_COST;
  budget.operationRows -= rows.length;
  counts.examined += rows.length;

  for (const row of rows) await reviewOperation(state, row);
  return outcomeOf(position, rows, limit, (row) => row.metadataExpiresAtMs);
}

// ---------------------------------------------------------------------------------------------
// Step 4: proposal receipts
// ---------------------------------------------------------------------------------------------

async function reviewProposalReceipt(state: RunState, proposal: Doc<"pageProposals">) {
  const { ctx, now, counts } = state;

  if (proposal.payload.state !== "expired") {
    counts.skipped.retained += 1;
    return;
  }
  if (proposal.status === "pending" && proposal.proposalExpiresAtMs > now) {
    counts.skipped.windowOpen += 1;
    return;
  }
  if (proposal.confirmedOperationId !== undefined) {
    const operation = await ctx.db.get(proposal.confirmedOperationId);
    if (
      operation !== null &&
      operation.userId === proposal.userId &&
      operation.metadataExpiresAtMs > now
    ) {
      counts.skipped.retained += 1;
      return;
    }
  }
  await deleteReceiptRow(state, proposal._id);
  counts.deletedProposals += 1;
}

async function reviewProposalReceipts(
  state: RunState,
  position: Position | null
): Promise<StageOutcome> {
  const { ctx, now, counts, budget } = state;
  const limit = budget.rows;
  if (limit <= 0) return { position, exhausted: false };

  const rows = await takeDue<Doc<"pageProposals">>(
    position,
    now,
    limit,
    (at, creationTime, n) =>
      ctx.db
        .query("pageProposals")
        .withIndex("by_metadataExpiresAtMs", (q) =>
          q.eq("metadataExpiresAtMs", at).gt("_creationTime", creationTime)
        )
        .take(n),
    (after, n) =>
      ctx.db
        .query("pageProposals")
        .withIndex("by_metadataExpiresAtMs", (q) =>
          after === null
            ? q.lte("metadataExpiresAtMs", now)
            : q.gt("metadataExpiresAtMs", after).lte("metadataExpiresAtMs", now)
        )
        .take(n)
  );
  budget.rows -= rows.length;
  counts.examined += rows.length;

  for (const row of rows) await reviewProposalReceipt(state, row);
  return outcomeOf(position, rows, limit, (row) => row.metadataExpiresAtMs);
}

// ---------------------------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------------------------

async function runStage(
  stage: Stage,
  state: RunState,
  position: Position | null
): Promise<StageOutcome> {
  switch (stage) {
    case "payloads":
      return await expireOperationPayloads(state, position);
    case "proposals":
      return await expireProposalContent(state, position);
    case "operations":
      return await reviewOperationReceipts(state, position);
    case "proposalReceipts":
      return await reviewProposalReceipts(state, position);
  }
}

/**
 * Internal only; the cron passes `{}`. `stage` and `cursor` exist so a run that hits its row
 * budget can continue where it stopped. The return value is counts, never row content.
 */
export const runBatch = internalMutation({
  args: {
    stage: v.optional(
      v.union(
        v.literal("payloads"),
        v.literal("proposals"),
        v.literal("operations"),
        v.literal("proposalReceipts")
      )
    ),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<PageCleanupResult> => {
    const now = Date.now();
    const state: RunState = {
      ctx,
      now,
      counts: emptyCounts(),
      budget: {
        rows: MAX_ROWS_PER_INVOCATION,
        payloadRows: MAX_PAYLOAD_ROWS_PER_INVOCATION,
        operationRows: MAX_OPERATION_ROWS_PER_INVOCATION,
      },
      deletedOperations: new Set(),
    };

    let stageIndex = args.stage === undefined ? 0 : STAGES.indexOf(args.stage);
    let position = parseCursor(args.cursor);
    if (position === "invalid") {
      // Not a cursor this job wrote. Do not restart the stage (that could loop): move on, and
      // the next scheduled tick starts from the beginning anyway.
      stageIndex += 1;
      position = null;
    }

    let hasMore = false;
    while (stageIndex < STAGES.length) {
      const stage = STAGES[stageIndex];
      const outcome = await runStage(stage, state, position);
      if (!outcome.exhausted) {
        await ctx.scheduler.runAfter(0, internal.pageCleanup.runBatch, {
          stage,
          cursor: outcome.position === null ? null : formatCursor(outcome.position),
        });
        hasMore = true;
        break;
      }
      stageIndex += 1;
      position = null;
    }

    return { ...state.counts, hasMore };
  },
});
