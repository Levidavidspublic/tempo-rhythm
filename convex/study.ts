import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalQuery,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { createNoteForUser, updateNoteForUser } from "./notes";
import {
  GRADE_FOR_BUTTON,
  newCardState,
  type ReviewButton,
  reviewCard,
  type Sm2State,
} from "../packages/core/srs/sm2";
import { AiAuthError, AiRateLimitedError } from "./lib/ai_errors";
import { callLLM } from "./lib/ai_router";
import { requireApprovedForAi } from "./lib/aiGate";
import { requireLivePage } from "./lib/pagePrivacy";
import { requireUser } from "./lib/requireUser";
import { isRestorable, UNDO_WINDOW_MS } from "./lib/softDelete";
import {
  blockItemCount,
  blockVersion,
  cardCounts,
  DEFAULT_NEW_LIMIT,
  dataSchemaFor,
  findStudyBlock,
  liveStates,
  newStudyBlockId,
  pageProse,
  parseModelJson,
  passMarkFor,
  readLiveSetWithBlock,
  readStudySets,
  recentAttempts,
  REVIEW_COUNT_LIMIT,
  replaceStudyBlock,
  requireLiveSet,
  SET_UNAVAILABLE,
  type StudyBlock,
  type StudyKind,
  type StudySetRead,
  stateRow,
  studyBlockFence,
  toSm2State,
} from "./lib/study";

/**
 * Study layer (kitchen T3): flashcard decks, quizzes and practice tests saved as blocks in pages.
 *
 * The page is the source of truth for content; these functions keep the set registry, SM-2
 * schedule state, the review log (for Undo) and quiz/test scores. Every function is owner-checked
 * (`requireUser`), and every set read goes through the page guard (`requireLivePage`), so a set on
 * a deleted page or account is unreachable. AI only proposes (`generate` never saves); the person
 * accepts with `createFromPreview`, which can be undone for 5 minutes (HARD_RULES §1, §6.2), and
 * an Undo can be brought back for 5 minutes (`redoCreate`). A saved set can be edited later
 * (`updateBlock`, written back into its page), with the same Undo.
 */

const kindValidator = v.union(v.literal("flashcards"), v.literal("quiz"), v.literal("test"));
const buttonValidator = v.union(
  v.literal("again"),
  v.literal("hard"),
  v.literal("good"),
  v.literal("easy"),
);
const answerValidator = v.object({
  itemId: v.string(),
  correct: v.optional(v.boolean()),
  points: v.optional(v.number()),
  maxPoints: v.optional(v.number()),
});

const PAGE_TITLE_MAX = 200;
/** Two grades of one card closer than this are one double-tapped answer. */
const DOUBLE_SUBMIT_MS = 2_000;
const ITEM_ID = /^[A-Za-z0-9_-]{1,32}$/;
const MAX_ANSWERS = 300;

type StateView = Pick<Sm2State, "dueAt" | "intervalDays" | "ease" | "repetitions" | "lapses">;

function stateView(row: Doc<"studyCardStates">): StateView {
  return {
    dueAt: row.dueAt,
    intervalDays: row.intervalDays,
    ease: row.ease,
    repetitions: row.repetitions,
    lapses: row.lapses,
  };
}

function attemptView(row: Doc<"studyAttempts">) {
  return {
    attemptId: row._id,
    kind: row.kind,
    score: row.score,
    maxScore: row.maxScore,
    percent: row.percent,
    ...(row.passed !== undefined ? { passed: row.passed } : {}),
    answers: row.answers,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/**
 * The review hub: totals for today and one row per live set, newest first. The read stays inside
 * `STUDY_READ_BUDGET` (lib/study.ts); past it, or past 100 sets, `truncated: true` says the hub
 * holds only the most recent sets.
 */
export const hub = query({
  args: { dayStartMs: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const { sets, truncated } = await readStudySets(ctx, user._id, { lastAttempt: true });
    let dueCount = 0;
    let newCount = 0;
    const rows = [];
    for (const { set, block, states, lastAttempt: last } of sets) {
      const counts = cardCounts(block, states, now);
      // A session takes at most DEFAULT_NEW_LIMIT new cards (reviewQueue), so the hub says the same.
      const setNew = Math.min(counts.newCount, DEFAULT_NEW_LIMIT);
      dueCount += counts.dueCount;
      newCount += setNew;
      rows.push({
        setId: set._id,
        noteId: set.noteId,
        kind: set.kind,
        title: block.data.title,
        itemCount: blockItemCount(block),
        dueCount: counts.dueCount,
        newCount: setNew,
        ...(set.lastStudiedAt !== undefined ? { lastStudiedAt: set.lastStudiedAt } : {}),
        ...(last
          ? {
              lastAttempt: {
                percent: last.percent,
                ...(last.passed !== undefined ? { passed: last.passed } : {}),
                finishedAt: last.finishedAt,
              },
            }
          : {}),
      });
    }
    const dayStartMs = Number.isFinite(args.dayStartMs) ? args.dayStartMs : now;
    const reviews = await ctx.db
      .query("studyReviews")
      .withIndex("by_user_reviewed", (q) => q.eq("userId", user._id).gte("reviewedAt", dayStartMs))
      .take(REVIEW_COUNT_LIMIT);
    const reviewedToday = reviews.filter((row) => row.deletedAt === undefined).length;
    return {
      dueCount,
      newCount: Math.min(newCount, DEFAULT_NEW_LIMIT),
      reviewedToday,
      sets: rows,
      ...(truncated ? { truncated: true as const } : {}),
    };
  },
});

/**
 * One set with its block (read from the page), card states and the last 5 attempts; or null.
 * `setId` comes from the URL, so it is any string: one that names no set reads as not available.
 */
export const getSet = query({
  args: { setId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const setId = ctx.db.normalizeId("studySets", args.setId);
    if (setId === null) return null;
    const live = await readLiveSetWithBlock(ctx, user._id, setId);
    if (!live) return null;
    const { set, note, block } = live;
    const states: Record<string, StateView> = {};
    if (block.type === "flashcards") {
      const rows = await liveStates(
        ctx,
        user._id,
        set._id,
        block.data.cards.map((card) => card.id),
      );
      for (const card of block.data.cards) {
        const row = rows.get(card.id);
        if (row) states[card.id] = stateView(row);
      }
    }
    const attempts = (await recentAttempts(ctx, user._id, set._id, 5)).map(attemptView);
    return {
      set: {
        setId: set._id,
        noteId: set.noteId,
        blockId: set.blockId,
        kind: set.kind,
        title: block.data.title,
        itemCount: blockItemCount(block),
        createdByTempo: set.createdByTempo,
        ...(set.sourceNoteId !== undefined ? { sourceNoteId: set.sourceNoteId } : {}),
        ...(set.lastStudiedAt !== undefined ? { lastStudiedAt: set.lastStudiedAt } : {}),
        createdAt: set.createdAt,
        updatedAt: set.updatedAt,
      },
      note: { id: note._id, title: note.title },
      block: { id: block.id, type: block.type, data: block.data },
      /** The block's content version: an edit sends it back so a save never overwrites newer words. */
      blockVersion: blockVersion(block),
      states,
      attempts,
    };
  },
});

/**
 * Cards to review: due first (oldest due first), then new cards up to `newLimit` (default 20).
 * Across every deck the read stays inside `STUDY_READ_BUDGET`, like the hub, and says
 * `truncated: true` past it; one set's queue (`setId`) reads one page and is never cut short.
 * `setId` comes from the URL (`?set=`), so it is any string: one that names no set has no cards.
 */
export const reviewQueue = query({
  args: { setId: v.optional(v.string()), newLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const newLimit = Math.max(0, Math.floor(Number.isFinite(args.newLimit) ? (args.newLimit as number) : DEFAULT_NEW_LIMIT));
    type QueueSet = Pick<StudySetRead, "set" | "block" | "states">;
    let sets: QueueSet[] = [];
    let truncated = false;
    if (args.setId !== undefined) {
      const setId = ctx.db.normalizeId("studySets", args.setId);
      const one = setId === null ? null : await readLiveSetWithBlock(ctx, user._id, setId);
      if (one && one.block.type === "flashcards") {
        const cardIds = one.block.data.cards.map((card) => card.id);
        sets = [{ ...one, states: await liveStates(ctx, user._id, one.set._id, cardIds) }];
      }
    } else {
      ({ sets, truncated } = await readStudySets(ctx, user._id, { kind: "flashcards" }));
    }
    type QueueCard = {
      setId: Id<"studySets">;
      setTitle: string;
      cardId: string;
      front: string;
      back: string;
      hint?: string;
      state: StateView | null;
    };
    const due: QueueCard[] = [];
    const fresh: QueueCard[] = [];
    for (const { set, block, states } of sets) {
      if (block.type !== "flashcards") continue;
      for (const card of block.data.cards) {
        const row = states.get(card.id);
        const base = {
          setId: set._id,
          setTitle: block.data.title,
          cardId: card.id,
          front: card.front,
          back: card.back,
          ...(card.hint !== undefined ? { hint: card.hint } : {}),
        };
        if (!row) fresh.push({ ...base, state: null });
        else if (row.dueAt <= now) due.push({ ...base, state: stateView(row) });
      }
    }
    due.sort((a, b) => (a.state as StateView).dueAt - (b.state as StateView).dueAt);
    return { cards: [...due, ...fresh.slice(0, newLimit)], ...(truncated ? { truncated: true as const } : {}) };
  },
});

/** The live sets registered on one live page (empty when the page isn't available). */
export const listForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    try {
      await requireLivePage(ctx, user._id, args.noteId);
    } catch {
      return [];
    }
    const rows = await ctx.db
      .query("studySets")
      .withIndex("by_note_block", (q) => q.eq("noteId", args.noteId))
      .take(256);
    return rows
      .filter((set) => set.userId === user._id && set.deletedAt === undefined)
      .map((set) => ({
        setId: set._id,
        blockId: set.blockId,
        kind: set.kind,
        title: set.title,
        itemCount: set.itemCount,
        ...(set.lastStudiedAt !== undefined ? { lastStudiedAt: set.lastStudiedAt } : {}),
      }));
  },
});

// ---------------------------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------------------------

/**
 * Accept a preview: a new page holding the block, and its set. Undo with `undoCreate` for 5
 * minutes. `data` is validated with the kind's codec schema before anything is written.
 */
export const createFromPreview = mutation({
  args: {
    kind: kindValidator,
    title: v.string(),
    data: v.any(),
    sourceNoteId: v.optional(v.id("notes")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const title = args.title.trim();
    if (title.length === 0 || title.length > PAGE_TITLE_MAX) {
      throw new Error("Give the page a title of up to 200 characters.");
    }
    let prefix = "";
    let source: { noteId: string; title: string } | undefined;
    if (args.sourceNoteId !== undefined) {
      const { note } = await requireLivePage(ctx, user._id, args.sourceNoteId);
      // One line only: a title with line breaks, brackets or backticks can't open a fence or a link.
      const sourceTitle = note.title.replace(/[\r\n]+/g, " ").replace(/\[\[|\]\]/g, "").trim().slice(0, 200);
      if (sourceTitle.length > 0) {
        prefix = `Made from [[${sourceTitle}]]\n\n`;
        source = { noteId: String(args.sourceNoteId), title: sourceTitle };
      }
    }
    // The block's `source` comes from the checked page only, never from the client.
    const candidate =
      args.data !== null && typeof args.data === "object" && !Array.isArray(args.data)
        ? { ...(args.data as Record<string, unknown>), source }
        : args.data;
    if (candidate && typeof candidate === "object" && source === undefined) {
      delete (candidate as Record<string, unknown>).source;
    }
    const parsed = dataSchemaFor(args.kind).safeParse(candidate);
    if (!parsed.success) {
      throw new Error("This preview can't be saved as it is. Try editing it.");
    }
    const now = Date.now();
    const blockId = newStudyBlockId(now);
    const body = `${prefix}${studyBlockFence(blockId, args.kind, parsed.data)}`;
    const block = findStudyBlock(body, blockId);
    if (!block) {
      throw new Error("This preview is too large for one page block.");
    }
    const noteId = await createNoteForUser(ctx, user._id, { title, body });
    const setId = await ctx.db.insert("studySets", {
      userId: user._id,
      noteId,
      blockId,
      kind: args.kind,
      title: block.data.title,
      itemCount: blockItemCount(block),
      ...(args.sourceNoteId !== undefined ? { sourceNoteId: args.sourceNoteId } : {}),
      createdByTempo: true,
      createdAt: now,
      updatedAt: now,
    });
    return { noteId, setId, undoUntil: now + UNDO_WINDOW_MS };
  },
});

/**
 * A write to a made page this soon after it was made is part of making it, not an edit. A later
 * write is the person's own change, and `undoCreate` says it took that away too.
 */
const PAGE_EDIT_GRACE_MS = 5_000;
const REDO_GONE = "The 5 minutes to bring this back have passed.";

/**
 * What `undoCreate` did: it took the set (and the page it made) back. When that also took away
 * what the person did since (`removedEdits`), `redoUntil` is when `redoCreate` stops bringing it
 * back.
 */
export type UndoCreateResult = {
  success: true;
  pageRemoved: boolean;
  removedEdits?: true;
  redoUntil?: number;
};

/**
 * Undo `createFromPreview` within 5 minutes, in one click (HARD_RULES §1): removes the set and the
 * page it made (soft deletes), whatever happened to them since. When that also takes away the
 * person's own changes (the page changed after its first few seconds, or the set was studied),
 * the answer says so (`removedEdits: true`, with `redoUntil`), so the screen can say it in words
 * and offer to bring it all back (`redoCreate`).
 */
export const undoCreate = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args): Promise<UndoCreateResult> => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id || set.deletedAt !== undefined) {
      throw new Error(SET_UNAVAILABLE);
    }
    const now = Date.now();
    if (now - set.createdAt > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this have passed.");
    }
    const note = set.createdByTempo ? await ctx.db.get(set.noteId) : null;
    const page = note && note.userId === user._id && note.deletedAt === undefined ? note : null;
    const removedEdits =
      (page !== null && page.updatedAt - set.createdAt > PAGE_EDIT_GRACE_MS) ||
      set.lastStudiedAt !== undefined;
    await ctx.db.patch(set._id, { deletedAt: now, updatedAt: now });
    if (page) await ctx.db.patch(page._id, { deletedAt: now, updatedAt: now });
    return {
      success: true,
      pageRemoved: page !== null,
      ...(removedEdits ? { removedEdits: true as const, redoUntil: now + UNDO_WINDOW_MS } : {}),
    };
  },
});

/**
 * Bring it back: takes `undoCreate` back for 5 minutes after it. The set returns, and so does the
 * page when that Undo removed it (both were soft-deleted in that one write), as they were, with
 * every change made before the Undo. Owner-checked; a set that is already back changes nothing.
 */
export const redoCreate = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args): Promise<{ success: true; pageRestored: boolean }> => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id || !set.createdByTempo) {
      throw new Error(SET_UNAVAILABLE);
    }
    const undoneAt = set.deletedAt;
    if (undoneAt === undefined) return { success: true, pageRestored: false };
    const now = Date.now();
    if (now - undoneAt > UNDO_WINDOW_MS) throw new Error(REDO_GONE);
    const note = await ctx.db.get(set.noteId);
    // Only what that Undo removed: a page deleted at another time (or someone else's) stays as it is.
    const page = note && note.userId === user._id && note.deletedAt === undoneAt ? note : null;
    await ctx.db.patch(set._id, { deletedAt: undefined, updatedAt: now });
    if (page) await ctx.db.patch(page._id, { deletedAt: undefined, updatedAt: now });
    return { success: true, pageRestored: page !== null };
  },
});

/**
 * Register a study block already in a page as a set. Idempotent: returns the existing set's id
 * (restoring it if it had been removed) and refreshes its title and item count from the page.
 */
export const registerBlock = mutation({
  args: { noteId: v.id("notes"), blockId: v.string() },
  handler: async (ctx, args): Promise<Id<"studySets">> => {
    const user = await requireUser(ctx);
    const { note } = await requireLivePage(ctx, user._id, args.noteId);
    const block = findStudyBlock(note.body, args.blockId);
    if (!block) {
      throw new Error("This block isn't a study block Tempo can read.");
    }
    const now = Date.now();
    const title = block.data.title;
    const itemCount = blockItemCount(block);
    const existing = (
      await ctx.db
        .query("studySets")
        .withIndex("by_note_block", (q) => q.eq("noteId", args.noteId).eq("blockId", args.blockId))
        .take(10)
    ).filter((set) => set.userId === user._id);
    const match = existing.find((set) => set.deletedAt === undefined) ?? existing[0];
    if (match) {
      const stale =
        match.deletedAt !== undefined ||
        match.title !== title ||
        match.itemCount !== itemCount ||
        match.kind !== block.type;
      if (stale) {
        await ctx.db.patch(match._id, {
          deletedAt: undefined,
          title,
          itemCount,
          kind: block.type,
          updatedAt: now,
        });
      }
      return match._id;
    }
    return ctx.db.insert("studySets", {
      userId: user._id,
      noteId: args.noteId,
      blockId: args.blockId,
      kind: block.type,
      title,
      itemCount,
      createdByTempo: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------------------------
// Editing a saved set
// ---------------------------------------------------------------------------------------------

/** What an edit's save (or its Undo) did: saved, or nothing written because the block changed. */
export type EditResult =
  | { status: "saved"; version: string; undoUntil: number }
  | { status: "changed"; version: string };

const EDIT_INVALID = "This edit can't be saved as it is. Check the items and try again.";

/**
 * Write a set's block back into its page: the one path for `updateBlock` and `undoUpdate`.
 *
 * - The set and its page pass the same guards as every set write (`requireLiveSet`: the caller's
 *   live set on the caller's live page and account), and the page is written through
 *   `updateNoteForUser`, which checks the owner again.
 * - `data` is checked with the kind's codec schema. `origin` and `source` stay the block's own,
 *   never the client's. The new body must read back with the block intact, so the codec's caps
 *   (64 KB per block, 1 MB per page) hold; the rest of the page is kept as it was.
 * - Nothing is written unless the block is still the version the edit started from: the result
 *   says "changed" instead. Writing what the block already holds is a no-op that reports saved,
 *   so a double-tapped Save writes once.
 * - Card schedules are keyed by set and card id, and every read joins them by the block's card
 *   ids. A kept card keeps its id and schedule. A removed card's state is left as it is: nothing
 *   reads it, and Undo brings the card back with its schedule. With `freshCardIds`, a card id
 *   that is new to the block but already has a live state (an id used again after an earlier
 *   removal) gets that state soft-deleted, so a new card always starts new.
 */
async function writeSetBlock(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: { setId: Id<"studySets">; data: unknown; baseVersion: string },
  options: { freshCardIds: boolean; markEdited: boolean },
): Promise<EditResult> {
  const { set, note } = await requireLiveSet(ctx, userId, args.setId);
  const block = findStudyBlock(note.body, set.blockId);
  if (!block || block.type !== set.kind) {
    throw new Error(SET_UNAVAILABLE);
  }
  if (args.data === null || typeof args.data !== "object" || Array.isArray(args.data)) {
    throw new Error(EDIT_INVALID);
  }
  const { origin: _origin, source: _source, ...content } = args.data as Record<string, unknown>;
  const candidate = {
    ...content,
    origin: block.data.origin,
    ...(block.data.source !== undefined ? { source: block.data.source } : {}),
  };
  const parsed = dataSchemaFor(set.kind).safeParse(candidate);
  if (!parsed.success) {
    throw new Error(EDIT_INVALID);
  }
  const now = Date.now();
  const current = blockVersion(block);
  if (blockVersion({ type: set.kind, data: parsed.data }) === current) {
    return { status: "saved", version: current, undoUntil: (set.editedAt ?? now) + UNDO_WINDOW_MS };
  }
  if (current !== args.baseVersion) {
    return { status: "changed", version: current };
  }
  const body = replaceStudyBlock(note.body, set.blockId, set.kind, parsed.data);
  const written = body === null ? null : findStudyBlock(body, set.blockId);
  if (body === null || !written || written.type !== set.kind) {
    throw new Error("This set is too large for one page block.");
  }
  if (options.freshCardIds && block.type === "flashcards" && written.type === "flashcards") {
    const before = new Set(block.data.cards.map((card) => card.id));
    for (const card of written.data.cards) {
      if (before.has(card.id)) continue;
      const row = await stateRow(ctx, userId, set._id, card.id);
      if (row && row.deletedAt === undefined) {
        await ctx.db.patch(row._id, { deletedAt: now, updatedAt: now });
      }
    }
  }
  await updateNoteForUser(ctx, userId, { noteId: note._id, body });
  await ctx.db.patch(set._id, {
    title: written.data.title,
    itemCount: blockItemCount(written),
    ...(options.markEdited ? { editedAt: now } : {}),
    updatedAt: now,
  });
  return { status: "saved", version: blockVersion(written), undoUntil: now + UNDO_WINDOW_MS };
}

/**
 * Save an edited set back into the page that holds it. `data` is the block's whole data as the
 * edit list reads it back; `baseVersion` is the `blockVersion` `getSet` gave when the edit started.
 * Undo with `undoUpdate` for 5 minutes.
 */
export const updateBlock = mutation({
  args: { setId: v.id("studySets"), data: v.any(), baseVersion: v.string() },
  handler: async (ctx, args): Promise<EditResult> => {
    const user = await requireUser(ctx);
    return writeSetBlock(ctx, user._id, args, { freshCardIds: true, markEdited: true });
  },
});

/**
 * Undo `updateBlock` within 5 minutes: writes back the block as it was before the edit (`data`,
 * which the screen kept), through the same guarded write. It runs only while the block is still
 * exactly what the edit saved (`version`); if the page changed since, nothing is written and the
 * result says so. A card the edit removed comes back with its schedule.
 */
export const undoUpdate = mutation({
  args: { setId: v.id("studySets"), data: v.any(), version: v.string() },
  handler: async (ctx, args): Promise<EditResult> => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id || set.deletedAt !== undefined) {
      throw new Error(SET_UNAVAILABLE);
    }
    if (set.editedAt === undefined) {
      throw new Error("There is nothing to undo.");
    }
    if (Date.now() - set.editedAt > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this have passed.");
    }
    return writeSetBlock(
      ctx,
      user._id,
      { setId: args.setId, data: args.data, baseVersion: args.version },
      { freshCardIds: false, markEdited: false },
    );
  },
});

/** Grade one card (SM-2). Undo with `undoReview` for 5 minutes. */
export const review = mutation({
  args: { setId: v.id("studySets"), cardId: v.string(), button: buttonValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { set, note } = await requireLiveSet(ctx, user._id, args.setId);
    const block = findStudyBlock(note.body, set.blockId);
    if (!block || block.type !== "flashcards" || set.kind !== "flashcards") {
      throw new Error(SET_UNAVAILABLE);
    }
    if (!block.data.cards.some((card) => card.id === args.cardId)) {
      throw new Error("This card isn't in the deck any more.");
    }
    const now = Date.now();
    const row = await stateRow(ctx, user._id, set._id, args.cardId);
    // A second tap of the same button on the same card within a moment is the same answer, not a
    // new review. A different button (Again, then Good on the card when it comes back) is a new one.
    if (
      row &&
      row.deletedAt === undefined &&
      row.lastReviewId !== undefined &&
      row.lastReviewedAt !== undefined &&
      now - row.lastReviewedAt < DOUBLE_SUBMIT_MS &&
      (row.lastButton ?? (await ctx.db.get(row.lastReviewId))?.button) === args.button
    ) {
      return { reviewId: row.lastReviewId, state: toSm2State(row), undoUntil: row.lastReviewedAt + UNDO_WINDOW_MS };
    }
    const prev = row && row.deletedAt === undefined ? toSm2State(row) : null;
    const next = reviewCard(prev ?? newCardState(now), GRADE_FOR_BUTTON[args.button as ReviewButton], now);
    const reviewId = await ctx.db.insert("studyReviews", {
      userId: user._id,
      setId: set._id,
      cardId: args.cardId,
      button: args.button,
      reviewedAt: now,
      prev,
      ...(prev !== null && row?.lastReviewId !== undefined ? { prevReviewId: row.lastReviewId } : {}),
      createdAt: now,
      updatedAt: now,
    });
    const stateFields = {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: now,
      lastReviewId: reviewId,
      lastButton: args.button,
    };
    if (row) {
      await ctx.db.patch(row._id, { ...stateFields, deletedAt: undefined, updatedAt: now });
    } else {
      await ctx.db.insert("studyCardStates", {
        userId: user._id,
        setId: set._id,
        cardId: args.cardId,
        ...stateFields,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(set._id, { lastStudiedAt: now, updatedAt: now });
    return { reviewId, state: next, undoUntil: now + UNDO_WINDOW_MS };
  },
});

/** Undo a grade within 5 minutes: the card goes back to its state before it. */
export const undoReview = mutation({
  args: { reviewId: v.id("studyReviews") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(args.reviewId);
    if (!row || row.userId !== user._id || row.deletedAt !== undefined) {
      throw new Error("There is nothing to undo.");
    }
    const now = Date.now();
    if (now - row.reviewedAt > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this have passed.");
    }
    await requireLiveSet(ctx, user._id, row.setId);
    const state = await stateRow(ctx, user._id, row.setId, row.cardId);
    if (!state || state.deletedAt !== undefined || state.lastReviewId !== row._id) {
      throw new Error("Only the latest grade of a card can be undone.");
    }
    if (row.prev === null) {
      await ctx.db.patch(state._id, {
        deletedAt: now,
        lastReviewId: undefined,
        lastButton: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(state._id, {
        ease: row.prev.ease,
        intervalDays: row.prev.intervalDays,
        repetitions: row.prev.repetitions,
        lapses: row.prev.lapses,
        dueAt: row.prev.dueAt,
        lastReviewedAt: row.prev.lastReviewedAt,
        // The grade before this one becomes the latest, so undo can step back one grade at a time.
        lastReviewId: row.prevReviewId,
        // Read from that review when it's needed (the double-tap check).
        lastButton: undefined,
        updatedAt: now,
      });
    }
    await ctx.db.patch(row._id, { deletedAt: now, updatedAt: now });
    return { success: true, state: row.prev };
  },
});

/** Save a finished quiz or test. Marks only: never the student's own words. */
export const recordAttempt = mutation({
  args: {
    setId: v.id("studySets"),
    kind: v.union(v.literal("quiz"), v.literal("test")),
    score: v.number(),
    maxScore: v.number(),
    answers: v.array(answerValidator),
    startedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const live = await readLiveSetWithBlock(ctx, user._id, args.setId);
    if (!live) throw new Error(SET_UNAVAILABLE);
    const { set, block } = live;
    if (set.kind !== args.kind) {
      throw new Error("This score doesn't match the set.");
    }
    const now = Date.now();
    const finite = (n: number) => Number.isFinite(n);
    if (
      !finite(args.score) ||
      !finite(args.maxScore) ||
      args.maxScore <= 0 ||
      args.score < 0 ||
      args.score > args.maxScore ||
      !finite(args.startedAt) ||
      args.startedAt > now
    ) {
      throw new Error("This score can't be saved.");
    }
    if (
      args.answers.length > MAX_ANSWERS ||
      args.answers.some(
        (a) =>
          !ITEM_ID.test(a.itemId) ||
          (a.points !== undefined && (!finite(a.points) || a.points < 0)) ||
          (a.maxPoints !== undefined && (!finite(a.maxPoints) || a.maxPoints < 0)),
      )
    ) {
      throw new Error("This score can't be saved.");
    }
    const percent = Math.round((args.score / args.maxScore) * 1000) / 10;
    const passMark = passMarkFor(block);
    const passed = passMark !== undefined ? percent >= passMark : undefined;
    const attemptId = await ctx.db.insert("studyAttempts", {
      userId: user._id,
      setId: set._id,
      kind: args.kind,
      score: args.score,
      maxScore: args.maxScore,
      percent,
      ...(passed !== undefined ? { passed } : {}),
      answers: args.answers.map((a) => ({
        itemId: a.itemId,
        ...(a.correct !== undefined ? { correct: a.correct } : {}),
        ...(a.points !== undefined ? { points: a.points } : {}),
        ...(a.maxPoints !== undefined ? { maxPoints: a.maxPoints } : {}),
      })),
      startedAt: args.startedAt,
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(set._id, { lastStudiedAt: now, updatedAt: now });
    return { attemptId, percent, ...(passed !== undefined ? { passed } : {}) };
  },
});

/** Remove a set from the study hub. The page and its block stay. Restorable for 30 days. */
export const removeSet = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id || set.deletedAt !== undefined) {
      throw new Error(SET_UNAVAILABLE);
    }
    const now = Date.now();
    await ctx.db.patch(set._id, { deletedAt: now, updatedAt: now });
    return { success: true, undoUntil: now + UNDO_WINDOW_MS };
  },
});

/** Bring a removed set back (within 30 days). */
export const restoreSet = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id) {
      throw new Error(SET_UNAVAILABLE);
    }
    const now = Date.now();
    if (!isRestorable(set.deletedAt, now)) {
      return { success: false };
    }
    await ctx.db.patch(set._id, { deletedAt: undefined, updatedAt: now });
    return { success: true };
  },
});

// ---------------------------------------------------------------------------------------------
// AI preview (never saves)
// ---------------------------------------------------------------------------------------------

/** Pages shorter than this (prose only) give the model too little to work with. */
export const GENERATE_MIN_CHARS = 80;
/** The prose the model sees, at most. */
export const GENERATE_MAX_CHARS = 12_000;

/** The caller's live page, as title + prose, for `generate`. Owner-checked through the page guard. */
export const pageForGenerate = internalQuery({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const { note } = await requireLivePage(ctx, user._id, args.noteId);
    return { noteId: note._id, title: note.title, prose: pageProse(note.body) };
  },
});

export type GenerateResult =
  | { status: "ready"; data: StudyBlock["data"] }
  | { status: "unavailable"; reason: "no_key" | "too_short" | "busy" | "failed" };

const SHAPES: Record<StudyKind, string> = {
  flashcards:
    '{"title": string, "cards": [{"id": string, "front": string, "back": string, "hint"?: string}]}  (2 to 30 cards)',
  quiz:
    '{"title": string, "mode": "adaptive", "questions": [{"id": string, "prompt": string, "choices": [{"id": string, "text": string}], "answerId": string, "explanation"?: string, "difficulty": 1 | 2 | 3}]}  (2 to 20 questions, 3 or 4 choices each; difficulty 1 = recall, 2 = understand, 3 = apply)',
  test:
    '{"title": string, "style": "standard", "sections": [{"id": string, "title": string, "questions": [{"plugin": "mcq", "id": string, "prompt": string, "points": number, "choices": [{"id": string, "text": string}], "answerId": string} | {"plugin": "short", "id": string, "prompt": string, "points": number, "accepted": [string]}]}]}  (1 to 3 sections, up to 10 questions each)',
};

function generateMessages(kind: StudyKind, title: string, prose: string) {
  return [
    {
      role: "system" as const,
      content: [
        "You turn a student's notes into study material. Use only facts in the notes.",
        `Reply with one JSON object of this shape and nothing else: ${SHAPES[kind]}.`,
        "Ids are short and use only letters, digits, - and _; they are unique inside the object.",
        "Every text is 1 to 500 characters. Write in the language of the notes. No emoji.",
      ].join("\n"),
    },
    { role: "user" as const, content: `Notes title: ${title}\n\n${prose.slice(0, GENERATE_MAX_CHARS)}` },
  ];
}

/** The class name only: never the message, which can carry provider text. */
function errorKind(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * One preview. `call` is the model seam and `hasKey` the key check; tests pass stand-ins.
 * Approval is checked before anything is read or any provider is called.
 */
export async function runGenerate(
  ctx: Pick<ActionCtx, "runQuery">,
  args: { noteId: Id<"notes">; kind: StudyKind },
  seams: { call?: typeof callLLM; hasKey?: () => boolean } = {},
): Promise<GenerateResult> {
  await requireApprovedForAi(ctx as ActionCtx);
  const hasKey = seams.hasKey ?? (() => Boolean(process.env.DEEPINFRA_API_KEY));
  if (!hasKey()) {
    return { status: "unavailable", reason: "no_key" };
  }
  const page = await ctx.runQuery(internal.study.pageForGenerate, { noteId: args.noteId });
  if (page.prose.length < GENERATE_MIN_CHARS) {
    return { status: "unavailable", reason: "too_short" };
  }
  let content: string;
  try {
    const result = await (seams.call ?? callLLM)({
      tier: "balanced",
      messages: generateMessages(args.kind, page.title, page.prose),
      maxTokens: 4000,
      temperature: 0.3,
      responseFormat: "json_object",
    });
    content = result.content;
  } catch (error) {
    if (error instanceof AiAuthError) return { status: "unavailable", reason: "no_key" };
    if (error instanceof AiRateLimitedError) return { status: "unavailable", reason: "busy" };
    console.error(`study.generate: the model could not be reached (${errorKind(error)})`);
    return { status: "unavailable", reason: "failed" };
  }
  const raw = parseModelJson(content);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: "unavailable", reason: "failed" };
  }
  const sourceTitle = page.title.trim().slice(0, 500);
  const { source: _modelSource, ...modelData } = raw as Record<string, unknown>;
  const candidate = {
    ...modelData,
    origin: "coach",
    ...(sourceTitle.length > 0 ? { source: { noteId: page.noteId, title: sourceTitle } } : {}),
  };
  const parsed = dataSchemaFor(args.kind).safeParse(candidate);
  if (!parsed.success) {
    return { status: "unavailable", reason: "failed" };
  }
  return { status: "ready", data: parsed.data };
}

/** An AI preview of a study block for a page. Never saves: Accept calls `createFromPreview`. */
export const generate = action({
  args: { noteId: v.id("notes"), kind: kindValidator },
  handler: async (ctx, args): Promise<GenerateResult> => {
    return runGenerate(ctx, args);
  },
});
