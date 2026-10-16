import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  type ActionCtx,
  action,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { createNoteForUser } from "./notes";
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
  cardCounts,
  DEFAULT_NEW_LIMIT,
  dataSchemaFor,
  findStudyBlock,
  listLiveSetsWithBlocks,
  liveStates,
  newStudyBlockId,
  pageProse,
  parseModelJson,
  passMarkFor,
  readLiveSetWithBlock,
  REVIEW_COUNT_LIMIT,
  requireLiveSet,
  SET_UNAVAILABLE,
  type StudyBlock,
  type StudyKind,
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
 * accepts with `createFromPreview`, which can be undone for 5 minutes (HARD_RULES §1, §6.2).
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

async function recentAttempts(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
  setId: Id<"studySets">,
  limit: number,
) {
  const rows = await ctx.db
    .query("studyAttempts")
    .withIndex("by_set", (q) => q.eq("setId", setId).eq("deletedAt", undefined))
    .order("desc")
    .take(limit);
  return rows.filter((row) => row.userId === userId);
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/** The review hub: totals for today and one row per live set. */
export const hub = query({
  args: { dayStartMs: v.number() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const sets = await listLiveSetsWithBlocks(ctx, user._id);
    let dueCount = 0;
    let newCount = 0;
    const rows = [];
    for (const { set, block } of sets) {
      const states = block.type === "flashcards" ? await liveStates(ctx, user._id, set._id) : new Map();
      const counts = cardCounts(block, states, now);
      dueCount += counts.dueCount;
      newCount += counts.newCount;
      const [last] = block.type === "flashcards" ? [] : await recentAttempts(ctx, user._id, set._id, 1);
      rows.push({
        setId: set._id,
        noteId: set.noteId,
        kind: set.kind,
        title: block.data.title,
        itemCount: blockItemCount(block),
        dueCount: counts.dueCount,
        newCount: counts.newCount,
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
    return { dueCount, newCount, reviewedToday, sets: rows };
  },
});

/** One set with its block (read from the page), card states and the last 5 attempts; or null. */
export const getSet = query({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const live = await readLiveSetWithBlock(ctx, user._id, args.setId);
    if (!live) return null;
    const { set, note, block } = live;
    const states: Record<string, StateView> = {};
    if (block.type === "flashcards") {
      const rows = await liveStates(ctx, user._id, set._id);
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
      states,
      attempts,
    };
  },
});

/** Cards to review: due first (oldest due first), then new cards up to `newLimit` (default 20). */
export const reviewQueue = query({
  args: { setId: v.optional(v.id("studySets")), newLimit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const newLimit = Math.max(0, Math.floor(Number.isFinite(args.newLimit) ? (args.newLimit as number) : DEFAULT_NEW_LIMIT));
    let sets: (Awaited<ReturnType<typeof listLiveSetsWithBlocks>>[number])[];
    if (args.setId !== undefined) {
      const one = await readLiveSetWithBlock(ctx, user._id, args.setId);
      sets = one ? [one] : [];
    } else {
      sets = await listLiveSetsWithBlocks(ctx, user._id);
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
    for (const { set, block } of sets) {
      if (block.type !== "flashcards") continue;
      const states = await liveStates(ctx, user._id, set._id);
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
    return { cards: [...due, ...fresh.slice(0, newLimit)] };
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
    const parsed = dataSchemaFor(args.kind).safeParse(args.data);
    if (!parsed.success) {
      throw new Error("This preview can't be saved as it is. Try editing it.");
    }
    let prefix = "";
    if (args.sourceNoteId !== undefined) {
      const { note: source } = await requireLivePage(ctx, user._id, args.sourceNoteId);
      prefix = `Made from [[${source.title}]]\n\n`;
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

/** Undo `createFromPreview` within 5 minutes: removes the set and the page it made. */
export const undoCreate = mutation({
  args: { setId: v.id("studySets") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const set = await ctx.db.get(args.setId);
    if (!set || set.userId !== user._id || set.deletedAt !== undefined) {
      throw new Error(SET_UNAVAILABLE);
    }
    const now = Date.now();
    if (now - set.createdAt > UNDO_WINDOW_MS) {
      throw new Error("The 5 minutes to undo this have passed.");
    }
    await ctx.db.patch(set._id, { deletedAt: now, updatedAt: now });
    let pageRemoved = false;
    if (set.createdByTempo) {
      const note = await ctx.db.get(set.noteId);
      if (note && note.userId === user._id && note.deletedAt === undefined) {
        await ctx.db.patch(note._id, { deletedAt: now, updatedAt: now });
        pageRemoved = true;
      }
    }
    return { success: true, pageRemoved };
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
    const prev = row && row.deletedAt === undefined ? toSm2State(row) : null;
    const next = reviewCard(prev ?? newCardState(now), GRADE_FOR_BUTTON[args.button as ReviewButton], now);
    const stateFields = {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: now,
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
    const reviewId = await ctx.db.insert("studyReviews", {
      userId: user._id,
      setId: set._id,
      cardId: args.cardId,
      button: args.button,
      reviewedAt: now,
      prev,
      createdAt: now,
      updatedAt: now,
    });
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
    if (!state || state.deletedAt !== undefined || state.lastReviewedAt !== row.reviewedAt) {
      throw new Error("Only the latest grade of a card can be undone.");
    }
    if (row.prev === null) {
      await ctx.db.patch(state._id, { deletedAt: now, updatedAt: now });
    } else {
      await ctx.db.patch(state._id, {
        ease: row.prev.ease,
        intervalDays: row.prev.intervalDays,
        repetitions: row.prev.repetitions,
        lapses: row.prev.lapses,
        dueAt: row.prev.dueAt,
        lastReviewedAt: row.prev.lastReviewedAt,
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
  const candidate = {
    ...(raw as Record<string, unknown>),
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
