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
import { PagePrivacyError, requireActiveOwner, requireLivePage } from "./pagePrivacy";

/**
 * Study layer helpers (kitchen T3). The page is the source of truth for a set's content: every
 * read parses the page body with the codec and joins schedule state by item id. Every set read
 * goes through the page guard (`requireLivePage`; the hub's list read checks the owner once and
 * each page by the same rule), so a deleted page or account hides its sets on the next read.
 */

type DbCtx = Pick<QueryCtx, "db">;

export type StudyKind = StudyBlockType;
export type StudyBlock = Extract<TempoBlock, { type: StudyKind }>;

/** Calm copy for a set that is missing, someone else's, removed, or on a removed page. */
export const SET_UNAVAILABLE = "This study set isn't available.";

/** Upper bound on live sets one hub or queue read shows. */
export const STUDY_SET_SCAN_LIMIT = 100;
/**
 * Set rows one hub or queue read looks at, live or not. A set whose page is gone or whose block
 * no longer parses is skipped and not counted, so older live sets still show behind it.
 */
export const STUDY_SET_ROW_LIMIT = 400;
/** State rows one range reads per set: a deck holds at most 100 cards; extra room for stale ids. */
export const STATE_SCAN_LIMIT = 200;
/** A deck's card cap in the codec: the most per-card lookups one set can need. */
const MAX_DECK_CARDS = 100;
/** A Convex document, so a page and its body, is at most 1 MiB. */
const PAGE_BYTES_MAX = 1024 * 1024;

/**
 * What one hub or review-queue read may spend, well inside Convex's per-transaction caps (4,096
 * index ranges and gets, 16 MiB read), so the screens keep working for a heavy user.
 *
 * - `lookups`: the gets and index ranges spent on the sets. The owner and the set rows (2), then
 *   per set its page (1), its card states (1 range, plus 1 per card when the range comes back
 *   full) and, on the hub, its last score (1). The hub's one read of today's reviews comes on top.
 * - `pageBytes`: the page bodies read, in UTF-8 bytes (a page is at most 1 MiB).
 *
 * A set is read only while its worst case still fits, so a read never goes over. Past the budget
 * the answer carries `truncated: true` and holds the most recent sets read so far.
 */
export const STUDY_READ_BUDGET = { lookups: 2_000, pageBytes: 8 * 1024 * 1024 } as const;
export type StudyReadBudget = { lookups: number; pageBytes: number };
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

/**
 * The page body with this study block's fence rewritten to hold `data`, or null when the page has
 * no valid block with that id. Every other part of the page is kept exactly as it was, and the
 * fence keeps its own line ending. The caller still reads the result back with `findStudyBlock`,
 * which applies the codec's size caps.
 */
export function replaceStudyBlock(
  body: string,
  blockId: string,
  kind: StudyKind,
  data: unknown,
): string | null {
  const segments = parseTempoBlocks(body);
  const old = segments.find(
    (segment) => segment.kind === "valid" && segment.block.id === blockId && isStudyKind(segment.block.type),
  );
  if (!old) return null;
  const ending = /(?:\r\n|\r|\n)$/.exec(old.source)?.[0] ?? "";
  const fence = studyBlockFence(blockId, kind, data).replace(/\n$/, ending);
  return `${body.slice(0, old.start)}${fence}${body.slice(old.end)}`;
}

/** JSON with every object's keys sorted, so the same content always reads the same. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** A 53-bit string hash: two multiply-xor lanes, after cyrb53 (public domain). Not cryptographic. */
function hash53(text: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * The version of a block's content: the same title, cards or questions always give the same
 * string, and any change gives another. An edit carries the version it started from, so a save
 * never overwrites a block that changed in the page meanwhile. An edit guard, not a security check.
 */
export function blockVersion(block: { type: StudyKind; data: unknown }): string {
  const text = canonicalJson({ type: block.type, data: block.data });
  return `v1-${text.length.toString(36)}-${hash53(text).toString(36)}`;
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

/** UTF-8 length of a string: what a page body weighs against the read budget. */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      // A surrogate pair is one 4-byte character.
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Gets and index ranges spent so far, and page bytes read: counted against `StudyReadBudget`. */
export type ReadMeter = { lookups: number; pageBytes: number };

/** The caller's last quiz or test scores on a set, newest first. */
export async function recentAttempts(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
  limit: number,
): Promise<Doc<"studyAttempts">[]> {
  const rows = await ctx.db
    .query("studyAttempts")
    .withIndex("by_set", (q) => q.eq("setId", setId).eq("deletedAt", undefined))
    .order("desc")
    .take(limit);
  return rows.filter((row) => row.userId === userId);
}

export type StudySetRead = LiveSet & {
  block: StudyBlock;
  /** Live card states by card id (flashcards only; empty for quizzes and tests). */
  states: Map<string, Doc<"studyCardStates">>;
  /** The last score (quizzes and tests, when asked for). */
  lastAttempt?: Doc<"studyAttempts">;
};

/**
 * The caller's live sets on live pages, newest first, with their card states: at most
 * `STUDY_SET_SCAN_LIMIT` of them, inside the read budget (`STUDY_READ_BUDGET`). A set whose page is
 * gone or whose block no longer parses is skipped, not counted. `truncated` says the read stopped
 * before it had looked at every set (the budget or the limits ran out), so the answer holds only
 * the most recent ones. `kind` skips other kinds before their pages are read.
 *
 * The owner is checked once with the page guard (`requireActiveOwner`). Each page is read once,
 * so its bytes are counted, and admitted by the page guard's own rule: the caller's page, not
 * deleted (`requireLivePage`). A removed account reads as no sets.
 */
export async function readStudySets(
  ctx: DbCtx,
  userId: Id<"users">,
  options: { kind?: StudyKind; lastAttempt?: boolean; budget?: StudyReadBudget } = {},
): Promise<{ sets: StudySetRead[]; truncated: boolean }> {
  const budget = options.budget ?? STUDY_READ_BUDGET;
  try {
    await requireActiveOwner(ctx, userId);
  } catch (error) {
    if (error instanceof PagePrivacyError) return { sets: [], truncated: false };
    throw error;
  }
  const rows = await ctx.db
    .query("studySets")
    .withIndex("by_userId_updated", (q) => q.eq("userId", userId).eq("deletedAt", undefined))
    .order("desc")
    .take(STUDY_SET_ROW_LIMIT);
  const meter: ReadMeter = { lookups: 2, pageBytes: 0 };
  const sets: StudySetRead[] = [];
  // A full take may have left older rows unread.
  let truncated = rows.length === STUDY_SET_ROW_LIMIT;
  for (let index = 0; index < rows.length; index++) {
    const set = rows[index];
    if (options.kind !== undefined && set.kind !== options.kind) continue;
    if (sets.length === STUDY_SET_SCAN_LIMIT) {
      truncated = true;
      break;
    }
    const worst =
      1 +
      (set.kind === "flashcards" ? 1 + MAX_DECK_CARDS : 0) +
      (options.lastAttempt && set.kind !== "flashcards" ? 1 : 0);
    if (meter.lookups + worst > budget.lookups || meter.pageBytes + PAGE_BYTES_MAX > budget.pageBytes) {
      truncated = true;
      break;
    }
    const note = await ctx.db.get(set.noteId);
    meter.lookups += 1;
    if (note) meter.pageBytes += utf8Bytes(note.body);
    if (!note || note.userId !== userId || note.deletedAt !== undefined) continue;
    const block = findStudyBlock(note.body, set.blockId);
    if (!block || block.type !== set.kind) continue;
    const states =
      block.type === "flashcards"
        ? await liveStates(ctx, userId, set._id, block.data.cards.map((card) => card.id), meter)
        : new Map<string, Doc<"studyCardStates">>();
    let lastAttempt: Doc<"studyAttempts"> | undefined;
    if (options.lastAttempt && block.type !== "flashcards") {
      [lastAttempt] = await recentAttempts(ctx, userId, set._id, 1);
      meter.lookups += 1;
    }
    sets.push({ set, note, block, states, ...(lastAttempt ? { lastAttempt } : {}) });
  }
  return { sets, truncated };
}

/**
 * Live card states of a set for the given cards, keyed by card id. One index range over the set's
 * state rows (at most `STATE_SCAN_LIMIT`). When that range comes back full, rows past it may hold
 * a card's state, so each card it didn't find is looked up on its own: old or orphaned state rows
 * can never crowd a live one out. `meter`, when given, counts the lookups spent.
 */
export async function liveStates(
  ctx: DbCtx,
  userId: Id<"users">,
  setId: Id<"studySets">,
  cardIds: readonly string[],
  meter?: ReadMeter,
): Promise<Map<string, Doc<"studyCardStates">>> {
  const wanted = new Set(cardIds);
  const out = new Map<string, Doc<"studyCardStates">>();
  const rows = await ctx.db
    .query("studyCardStates")
    .withIndex("by_set_card", (q) => q.eq("setId", setId))
    .take(STATE_SCAN_LIMIT);
  if (meter) meter.lookups += 1;
  for (const row of rows) {
    if (row.userId === userId && row.deletedAt === undefined && wanted.has(row.cardId)) {
      out.set(row.cardId, row);
    }
  }
  if (rows.length < STATE_SCAN_LIMIT) return out;
  for (const cardId of wanted) {
    if (out.has(cardId)) continue;
    const row = await stateRow(ctx, userId, setId, cardId);
    if (meter) meter.lookups += 1;
    if (row && row.deletedAt === undefined) out.set(cardId, row);
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
