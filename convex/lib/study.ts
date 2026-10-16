import {
  flashcardsDataSchema,
  parseTempoBlocks,
  quizDataSchema,
  STUDY_BLOCK_TYPES,
  type StudyBlockType,
  type TempoBlock,
  testDataSchema,
} from "@tempo/utils";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Sm2State } from "../../packages/core/srs/sm2";
import { PagePrivacyError, requireLivePage } from "./pagePrivacy";

/**
 * Study layer helpers (kitchen T3). The page is the source of truth for a set's content: every
 * read parses the page body with the codec and joins schedule state by item id. Every set read
 * goes through `requireLivePage`, so a deleted page or account hides its sets on the next read.
 */

type DbCtx = Pick<QueryCtx, "db">;

export type StudyKind = StudyBlockType;
export type StudyBlock = Extract<TempoBlock, { type: StudyKind }>;

/** Calm copy for a set that is missing, someone else's, removed, or on a removed page. */
export const SET_UNAVAILABLE = "This study set isn't available.";

/** Upper bound on sets one hub or queue read walks. */
export const STUDY_SET_SCAN_LIMIT = 100;
/** States per set: a deck holds at most 100 cards; extra room for stale ids. */
export const STATE_SCAN_LIMIT = 200;
/** Reviews counted for "reviewed today". */
export const REVIEW_COUNT_LIMIT = 1000;
export const DEFAULT_NEW_LIMIT = 20;
/** A Bagrut-style test passes at 55 unless the test sets its own pass mark. */
export const BAGRUT_PASS_MARK = 55;

export function isStudyKind(value: unknown): value is StudyKind {
  return (STUDY_BLOCK_TYPES as readonly unknown[]).includes(value);
}

export function dataSchemaFor(kind: StudyKind) {
  return kind === "flashcards"
    ? flashcardsDataSchema
    : kind === "quiz"
      ? quizDataSchema
      : testDataSchema;
}

/** The valid study block with this id in a page body, or null when it is gone or broken. */
export function findStudyBlock(body: string, blockId: string): StudyBlock | null {
  for (const segment of parseTempoBlocks(body)) {
    if (segment.kind === "valid" && segment.block.id === blockId && isStudyKind(segment.block.type)) {
      return segment.block as StudyBlock;
    }
  }
  return null;
}

/** Number of study items: cards, quiz questions, or test questions. */
export function blockItemCount(block: StudyBlock): number {
  switch (block.type) {
    case "flashcards":
      return block.data.cards.length;
    case "quiz":
      return block.data.questions.length;
    case "test":
      return block.data.sections.reduce((sum, section) => sum + section.questions.length, 0);
  }
}

/** The page body's prose, without any `json tempo` block. */
export function pageProse(body: string): string {
  return parseTempoBlocks(body)
    .filter((segment) => segment.kind === "markdown")
    .map((segment) => segment.source)
    .join("")
    .trim();
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** `blk_` + a 26-character ULID (10 time chars, 16 random), the codec's block id grammar. */
export function newStudyBlockId(now: number, random: () => number = Math.random): string {
  let time = "";
  let t = Math.max(0, Math.floor(now));
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i++) {
    rand += CROCKFORD[Math.floor(random() * 32) % 32];
  }
  return `blk_${time}${rand}`;
}

/** A study block fence for a page body. */
export function studyBlockFence(blockId: string, kind: StudyKind, data: unknown): string {
  return `\`\`\`json tempo\n${JSON.stringify({ id: blockId, v: 1, type: kind, data })}\n\`\`\`\n`;
}

export type LiveSet = { set: Doc<"studySets">; note: Doc<"notes"> };

/**
 * A live set the caller owns, on a live page the caller owns. Throws the same calm error for a
 * missing, foreign or removed set; a removed page or account raises the page guard's error.
 */
export async function requireLiveSet(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
): Promise<LiveSet> {
  const set = await ctx.db.get(setId);
  if (!set || set.userId !== userId || set.deletedAt !== undefined) {
    throw new Error(SET_UNAVAILABLE);
  }
  const { note } = await requireLivePage(ctx, userId, set.noteId);
  return { set, note };
}

/** `requireLiveSet`, but null instead of an error (for queries). */
export async function readLiveSet(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
): Promise<LiveSet | null> {
  try {
    return await requireLiveSet(ctx, userId, setId);
  } catch (error) {
    if (error instanceof PagePrivacyError || (error instanceof Error && error.message === SET_UNAVAILABLE)) {
      return null;
    }
    throw error;
  }
}

/** A live set plus its block, still valid in its page and of the set's kind; else null. */
export async function readLiveSetWithBlock(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
): Promise<(LiveSet & { block: StudyBlock }) | null> {
  const live = await readLiveSet(ctx, userId, setId);
  if (!live) return null;
  const block = findStudyBlock(live.note.body, live.set.blockId);
  if (!block || block.type !== live.set.kind) return null;
  return { ...live, block };
}

/** The caller's live sets on live pages, newest first, at most `STUDY_SET_SCAN_LIMIT`. */
export async function listLiveSetsWithBlocks(
  ctx: DbCtx,
  userId: Id<"users">,
): Promise<(LiveSet & { block: StudyBlock })[]> {
  const sets = await ctx.db
    .query("studySets")
    .withIndex("by_userId_updated", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .order("desc")
    .take(STUDY_SET_SCAN_LIMIT);
  const out: (LiveSet & { block: StudyBlock })[] = [];
  for (const set of sets) {
    const live = await readLiveSetWithBlock(ctx, userId, set._id);
    if (live) out.push(live);
  }
  return out;
}

/** Live card states of a set, keyed by card id. */
export async function liveStates(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
): Promise<Map<string, Doc<"studyCardStates">>> {
  const rows = await ctx.db
    .query("studyCardStates")
    .withIndex("by_set_card", (q) => q.eq("setId", setId))
    .take(STATE_SCAN_LIMIT);
  const out = new Map<string, Doc<"studyCardStates">>();
  for (const row of rows) {
    if (row.userId === userId && row.deletedAt === undefined) out.set(row.cardId, row);
  }
  return out;
}

/** The card's state row (live or soft-deleted), for upserts. */
export async function stateRow(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
  cardId: string,
): Promise<Doc<"studyCardStates"> | null> {
  const rows = await ctx.db
    .query("studyCardStates")
    .withIndex("by_set_card", (q) => q.eq("setId", setId).eq("cardId", cardId))
    .take(2);
  return rows.find((row) => row.userId === userId) ?? null;
}

export function toSm2State(row: Pick<Doc<"studyCardStates">, keyof Sm2State>): Sm2State {
  return {
    ease: row.ease,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    lapses: row.lapses,
    dueAt: row.dueAt,
    ...(row.lastReviewedAt !== undefined ? { lastReviewedAt: row.lastReviewedAt } : {}),
  };
}

/** Due and new counts of one flashcard block, against its live states. */
export function cardCounts(
  block: StudyBlock,
  states: Map<string, Doc<"studyCardStates">>,
  now: number,
): { dueCount: number; newCount: number } {
  if (block.type !== "flashcards") return { dueCount: 0, newCount: 0 };
  let dueCount = 0;
  let newCount = 0;
  for (const card of block.data.cards) {
    const state = states.get(card.id);
    if (!state) newCount += 1;
    else if (state.dueAt <= now) dueCount += 1;
  }
  return { dueCount, newCount };
}

/** The pass mark a test uses, or undefined when it has none. */
export function passMarkFor(block: StudyBlock): number | undefined {
  if (block.type !== "test") return undefined;
  return block.data.passMark ?? (block.data.style === "bagrut" ? BAGRUT_PASS_MARK : undefined);
}

/** Strip a ```json fence (if any) and parse; null when it is not JSON. */
export function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  try {
    return JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    return null;
  }
}
