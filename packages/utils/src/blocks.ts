import { z } from "zod";

export const BLOCK_CODEC_LIMITS = {
  maxBodyChars: 1_048_576,
  maxBlockChars: 65_536,
  maxBlocks: 256,
  maxJsonDepth: 16,
  maxShortStringChars: 200,
  maxTextChars: 500,
  maxArrayItems: 100,
} as const;

const shortString = z.string().max(BLOCK_CODEC_LIMITS.maxShortStringChars);
const text = z.string().min(1).max(BLOCK_CODEC_LIMITS.maxTextChars);
const pageType = z.enum(["daily", "weekly", "project", "plain", "template"]);
const isoDate = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
const isoDateTime = z.string().datetime({ offset: true });
const blockId = z.string().regex(/^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

export const pageMetaDataSchema = z
  .object({
    pageType,
    date: isoDate.optional(),
    tags: z.array(shortString).max(BLOCK_CODEC_LIMITS.maxArrayItems),
  })
  .strict();

export const taskDataSchema = z
  .object({
    title: text,
    durationMin: z.number().int().positive().max(1_440).default(15),
    status: z.enum(["now", "later", "done"]),
    order: z.number().int().nonnegative(),
    inelastic: z.boolean(),
    reason: text.optional(),
    scheduledAt: isoDateTime.nullable().optional(),
    doneAt: isoDateTime.nullable().optional(),
  })
  .strict();

export const templateDataSchema = z
  .object({
    name: text,
    forPageType: pageType,
    isDefault: z.boolean(),
    tokens: z.array(shortString).max(BLOCK_CODEC_LIMITS.maxArrayItems),
    origin: z.enum(["builtin", "user"]),
    status: z.enum(["draft", "live"]),
    enabled: z.boolean(),
  })
  .strict();

/**
 * Study blocks (kitchen T3): flashcards, a quiz and a practice test, saved inside a page as
 * `json tempo` fences like every other block. `blocks.ts` adds the three envelopes to the one
 * page codec; this file only holds their `data` shapes, so the codec keeps a single parser.
 *
 * The limits are the codec's own: every free-text field is at most 500 characters and every list
 * at most 100 items, so a deck or a test always fits in one block (64 KB).
 */

// Study fields reuse the codec's own `text` (1–500 chars) and `shortString` (≤ 200 chars).

/** A card, choice, question or part id. Unique inside its block; never shown. */
const studyItemId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);

/** Who made the block: the person, the coach (after Accept), or Tempo's outline reader. */
const studyOriginSchema = z.enum(["user", "coach", "outline"]);

/** The page a block was made from. `noteId` is an opaque page id. */
const studySourceSchema = z
  .object({
    noteId: shortString.min(1),
    title: text,
  })
  .strict();

const flashcardSchema = z
  .object({
    id: studyItemId,
    front: text,
    back: text,
    hint: text.optional(),
  })
  .strict();

const flashcardsDataSchema = z
  .object({
    title: text,
    cards: z.array(flashcardSchema).min(1).max(100),
    origin: studyOriginSchema,
    source: studySourceSchema.optional(),
  })
  .strict()
  .refine((data) => uniqueIds(data.cards.map((card) => card.id)), "Card ids repeat");

const studyChoiceSchema = z.object({ id: studyItemId, text }).strict();

/** 1 = recall, 2 = understand, 3 = apply. The adaptive quiz moves between them. */
const quizDifficultySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const quizQuestionSchema = z
  .object({
    id: studyItemId,
    prompt: text,
    choices: z.array(studyChoiceSchema).min(2).max(6),
    answerId: studyItemId,
    explanation: text.optional(),
    difficulty: quizDifficultySchema,
  })
  .strict()
  .refine((q) => q.choices.some((choice) => choice.id === q.answerId), "The answer is not a choice")
  .refine((q) => uniqueIds(q.choices.map((choice) => choice.id)), "Choice ids repeat");

const quizDataSchema = z
  .object({
    title: text,
    mode: z.enum(["adaptive", "fixed"]),
    questions: z.array(quizQuestionSchema).min(1).max(100),
    origin: studyOriginSchema,
    source: studySourceSchema.optional(),
  })
  .strict()
  .refine((data) => uniqueIds(data.questions.map((q) => q.id)), "Question ids repeat");

const studyPoints = z.number().int().min(1).max(100);

/** Test question plugins. Each plugin owns how a question is drawn and how it is marked. */
const mcqQuestionSchema = z
  .object({
    plugin: z.literal("mcq"),
    id: studyItemId,
    prompt: text,
    points: studyPoints,
    choices: z.array(studyChoiceSchema).min(2).max(6),
    answerId: studyItemId,
    explanation: text.optional(),
  })
  .strict()
  .refine((q) => q.choices.some((choice) => choice.id === q.answerId), "The answer is not a choice");

const shortQuestionSchema = z
  .object({
    plugin: z.literal("short"),
    id: studyItemId,
    prompt: text,
    points: studyPoints,
    accepted: z.array(shortString.min(1)).min(1).max(10),
    explanation: text.optional(),
  })
  .strict();

/** One numbered part of a Bagrut-style question (labelled א, ב, ג… or a, b, c…). */
const bagrutPartSchema = z
  .object({
    id: studyItemId,
    label: z.string().min(1).max(8),
    prompt: text,
    points: studyPoints,
    modelAnswer: text.optional(),
    rubric: text.optional(),
  })
  .strict();

/** A Bagrut-style question: a stem and its parts, each with its own points; marked by rubric. */
const bagrutQuestionSchema = z
  .object({
    plugin: z.literal("bagrut"),
    id: studyItemId,
    stem: text,
    parts: z.array(bagrutPartSchema).min(1).max(8),
  })
  .strict()
  .refine((q) => uniqueIds(q.parts.map((part) => part.id)), "Part ids repeat");

const testQuestionSchema = z.union([mcqQuestionSchema, shortQuestionSchema, bagrutQuestionSchema]);

/**
 * A section of a test. `pick` = "answer N of these" (Bagrut style); without it every question
 * in the section counts.
 */
const testSectionSchema = z
  .object({
    id: studyItemId,
    title: text,
    instructions: text.optional(),
    pick: z.number().int().min(1).max(20).optional(),
    questions: z.array(testQuestionSchema).min(1).max(20),
  })
  .strict()
  .refine((section) => section.pick === undefined || section.pick <= section.questions.length, {
    message: "A section can't ask for more questions than it has",
  });

const testDataSchema = z
  .object({
    title: text,
    style: z.enum(["standard", "bagrut"]),
    durationMin: z.number().int().min(1).max(300).optional(),
    passMark: z.number().int().min(0).max(100).optional(),
    sections: z.array(testSectionSchema).min(1).max(10),
    origin: studyOriginSchema,
    source: studySourceSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      uniqueIds(data.sections.map((s) => s.id)) &&
      uniqueIds(data.sections.flatMap((s) => s.questions.map((q) => q.id))),
    "Section or question ids repeat",
  );


/** The three study block types, as they appear in a block envelope's `type`. */
const STUDY_BLOCK_TYPES = ["flashcards", "quiz", "test"] as const;


function uniqueIds(ids: readonly string[]): boolean {
  return new Set(ids).size === ids.length;
}

const envelopeBase = { id: blockId, v: z.literal(1) } as const;
export const tempoBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...envelopeBase, type: z.literal("page-meta"), data: pageMetaDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("task"), data: taskDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("template"), data: templateDataSchema }).strict(),
  // Study blocks (kitchen T3); data shapes above.
  z.object({ ...envelopeBase, type: z.literal("flashcards"), data: flashcardsDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("quiz"), data: quizDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("test"), data: testDataSchema }).strict(),
]);

export type TempoBlock = z.infer<typeof tempoBlockSchema>;
export type BlockErrorCode =
  | "body_too_large"
  | "too_many_blocks"
  | "block_too_large"
  | "unclosed_fence"
  | "malformed_json"
  | "invalid_envelope"
  | "unsupported_type"
  | "unsupported_version"
  | "invalid_data"
  | "duplicate_id"
  | "duplicate_page_meta"
  | "nesting_too_deep";

type SourceSegment = { source: string; start: number; end: number };
export type MarkdownSegment = SourceSegment & { kind: "markdown" };
export type ValidBlockSegment = SourceSegment & {
  kind: "valid";
  position: number;
  block: TempoBlock;
};
export type BrokenBlockSegment = SourceSegment & {
  kind: "broken";
  position: number;
  errorCode: BlockErrorCode;
  blockId?: string;
};
export type BlockSegment = MarkdownSegment | ValidBlockSegment | BrokenBlockSegment;

type TempoFence = { opener: RegExpExecArray; closer?: RegExpExecArray };

function exactTempoCloser(content: string): boolean {
  return /^```[\t ]*$/.test(content);
}

/**
 * CommonMark raw HTML blocks whose end is an explicit marker (start conditions 1-5 of
 * https://spec.commonmark.org/0.31.2/#html-blocks). Everything from the start line through the
 * first line containing the end marker, which may be the start line itself, is literal HTML, so
 * fence-looking lines in it are prose. Conditions 6-7 end at a blank line and are not modeled.
 * Every pattern is anchored or a fixed literal and each line is tested a constant number of times,
 * so the scan stays linear in the body length.
 */
const RAW_HTML_BLOCKS: readonly { start: RegExp; end: RegExp }[] = [
  { start: /^ {0,3}<(?:script|pre|style|textarea)(?:[\t >]|$)/i, end: /<\/(?:script|pre|style|textarea)>/i },
  { start: /^ {0,3}<!--/, end: /-->/ },
  { start: /^ {0,3}<\?/, end: /\?>/ },
  { start: /^ {0,3}<![A-Za-z]/, end: />/ },
  { start: /^ {0,3}<!\[CDATA\[/, end: /\]\]>/ },
];

/** The end marker of the raw HTML block that `content` opens, if any and if still open after it. */
function openRawHtmlBlockEnd(content: string): RegExp | undefined {
  for (const { start, end } of RAW_HTML_BLOCKS) {
    if (start.test(content)) return end.test(content) ? undefined : end;
  }
  return undefined;
}

function tempoFences(body: string): TempoFence[] {
  const matches: TempoFence[] = [];
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let ordinaryFence: { marker: "`" | "~"; length: number } | undefined;
  let tempoFence: TempoFence | undefined;
  let rawHtmlEnd: RegExp | undefined;
  for (let line = lines.exec(body); line !== null && line[0].length > 0; line = lines.exec(body)) {
    const content = line[0].replace(/(?:\r\n|\r|\n)$/, "");
    if (rawHtmlEnd) {
      if (rawHtmlEnd.test(content)) rawHtmlEnd = undefined;
      continue;
    }
    // Numbered groups (indent, marks, info): named groups need an ES2018 target in some consumers.
    const fence = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)$/.exec(content);
    if (!fence) {
      if (!tempoFence && !ordinaryFence) rawHtmlEnd = openRawHtmlBlockEnd(content);
      continue;
    }
    const indent = fence[1]!;
    const marks = fence[2]!;
    const marker = marks[0] as "`" | "~";
    const info = fence[3]!;
    if (tempoFence) {
      if (exactTempoCloser(content)) {
        tempoFence.closer = line;
        tempoFence = undefined;
      }
    } else if (ordinaryFence) {
      if (marker === ordinaryFence.marker && marks.length >= ordinaryFence.length && /^[\t ]*$/.test(info)) {
        ordinaryFence = undefined;
      }
    } else if (indent === "" && marks === "```" && /^json tempo[\t ]*$/.test(info)) {
      tempoFence = { opener: line };
      matches.push(tempoFence);
    } else if (marker === "~" || !info.includes("`")) {
      ordinaryFence = { marker, length: marks.length };
    }
  }
  return matches;
}

function jsonDepth(value: unknown, depth = 0): number {
  if (value === null || typeof value !== "object") return depth;
  if (depth > BLOCK_CODEC_LIMITS.maxJsonDepth) return depth;
  const values = Array.isArray(value) ? value : Object.values(value);
  return values.reduce((maximum, child) => Math.max(maximum, jsonDepth(child, depth + 1)), depth);
}

function syntacticallyValidBlockId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const result = blockId.safeParse((value as { id?: unknown }).id);
  return result.success ? result.data : undefined;
}

function classifyError(value: unknown): BlockErrorCode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "invalid_envelope";
  const record = value as Record<string, unknown>;
  if (record.v !== 1) return "unsupported_version";
  if (!(["page-meta", "task", "template", ...STUDY_BLOCK_TYPES] as unknown[]).includes(record.type)) {
    return "unsupported_type";
  }
  return "invalid_data";
}

function broken(
  source: string,
  start: number,
  end: number,
  position: number,
  errorCode: BlockErrorCode,
  value?: unknown,
): BrokenBlockSegment {
  const id = syntacticallyValidBlockId(value);
  return { kind: "broken", source, start, end, position, errorCode, ...(id ? { blockId: id } : {}) };
}

/** Parse exact `json tempo` fences without executing or rewriting their contents. */
export function parseTempoBlocks(body: string): BlockSegment[] {
  if (body.length > BLOCK_CODEC_LIMITS.maxBodyChars) {
    return [broken(body, 0, body.length, 0, "body_too_large")];
  }

  const segments: BlockSegment[] = [];
  const seenIds = new Set<string>();
  let seenPageMeta = false;
  let cursor = 0;
  let position = 0;
  const fences = tempoFences(body);

  for (const { opener: match, closer: close } of fences) {
    const start = match.index;
    if (start < cursor) continue;
    if (start > cursor) segments.push({ kind: "markdown", source: body.slice(cursor, start), start: cursor, end: start });

    const contentStart = start + match[0].length;
    const end = close ? close.index + close[0].length : body.length;
    const source = body.slice(start, end);
    const contentEnd = close ? close.index : body.length;
    const jsonSource = body.slice(contentStart, contentEnd).replace(/(?:\r\n|\r|\n)$/, "");
    position += 1;

    if (!close) {
      segments.push(broken(source, start, end, position, "unclosed_fence"));
      cursor = end;
      break;
    }
    if (position > BLOCK_CODEC_LIMITS.maxBlocks) {
      segments.push(broken(source, start, end, position, "too_many_blocks"));
      cursor = end;
      continue;
    }
    if (jsonSource.length > BLOCK_CODEC_LIMITS.maxBlockChars) {
      segments.push(broken(source, start, end, position, "block_too_large"));
      cursor = end;
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(jsonSource);
    } catch {
      segments.push(broken(source, start, end, position, "malformed_json"));
      cursor = end;
      continue;
    }
    const sourceId = syntacticallyValidBlockId(value);
    const duplicateId = sourceId !== undefined && seenIds.has(sourceId);
    if (sourceId !== undefined) seenIds.add(sourceId);

    if (jsonDepth(value) > BLOCK_CODEC_LIMITS.maxJsonDepth) {
      segments.push(broken(source, start, end, position, "nesting_too_deep", value));
      cursor = end;
      continue;
    }

    const result = tempoBlockSchema.safeParse(value);
    if (duplicateId) {
      segments.push(broken(source, start, end, position, "duplicate_id", value));
    } else if (!result.success) {
      segments.push(broken(source, start, end, position, classifyError(value), value));
    } else if (result.data.type === "page-meta" && seenPageMeta) {
      segments.push(broken(source, start, end, position, "duplicate_page_meta", value));
    } else {
      if (result.data.type === "page-meta") seenPageMeta = true;
      segments.push({ kind: "valid", source, start, end, position, block: result.data });
    }
    cursor = end;
  }

  if (cursor < body.length || segments.length === 0) {
    segments.push({ kind: "markdown", source: body.slice(cursor), start: cursor, end: body.length });
  }
  return segments;
}

/** Lossless for unchanged segments: emits the exact original UTF-16 source slices. */
export function serializeTempoBlocks(segments: readonly BlockSegment[]): string {
  return segments.map((segment) => segment.source).join("");
}
