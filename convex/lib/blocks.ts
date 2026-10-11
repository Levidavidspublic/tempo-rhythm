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

const envelopeBase = { id: blockId, v: z.literal(1) } as const;
export const tempoBlockSchema = z.discriminatedUnion("type", [
  z.object({ ...envelopeBase, type: z.literal("page-meta"), data: pageMetaDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("task"), data: taskDataSchema }).strict(),
  z.object({ ...envelopeBase, type: z.literal("template"), data: templateDataSchema }).strict(),
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

function tempoFences(body: string): TempoFence[] {
  const matches: TempoFence[] = [];
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let ordinaryFence: { marker: "`" | "~"; length: number } | undefined;
  let tempoFence: TempoFence | undefined;
  let line: RegExpExecArray | null;
  while ((line = lines.exec(body)) !== null && line[0].length > 0) {
    const content = line[0].replace(/(?:\r\n|\r|\n)$/, "");
    const fence = /^(?<indent> {0,3})(?<marks>`{3,}|~{3,})(?<info>[^\r\n]*)$/.exec(content);
    if (!fence?.groups) continue;
    const marks = fence.groups.marks;
    const marker = marks[0] as "`" | "~";
    const info = fence.groups.info;
    if (tempoFence) {
      if (exactTempoCloser(content)) {
        tempoFence.closer = line;
        tempoFence = undefined;
      }
    } else if (ordinaryFence) {
      if (marker === ordinaryFence.marker && marks.length >= ordinaryFence.length && /^[\t ]*$/.test(info)) {
        ordinaryFence = undefined;
      }
    } else if (fence.groups.indent === "" && marks === "```" && /^json tempo[\t ]*$/.test(info)) {
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
  if (!(["page-meta", "task", "template"] as unknown[]).includes(record.type)) {
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
