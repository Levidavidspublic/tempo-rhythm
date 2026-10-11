/**
 * TEMPO-B06-SUPPORT-PAGE-INVERSES (#831) — pure page-ledger helper.
 *
 * Implements the adopted #828 decisions D1-D5 as pure, deterministic code for the later mutation
 * consumers (#787 atomic page writes and Undo, #793 proposal confirmation):
 *
 * - D1  revision interpretation (a missing `notes.revision` is 0), overflow, versioned exact digests.
 * - D2  strict validators for the merged `pageOperations`, `pageOperationPayloads` and
 *       `pageProposals` shapes, including the cross-field state invariants the Convex validators
 *       cannot express, and the narrow proposal task input.
 * - D3  deterministic request encoding and digests, first-use / replay admission, and the distinct
 *       proposal-revision and page-revision guards for confirmation.
 * - D4  bounded splice planning (linear prefix/suffix diff), forward and inverse reconstruction,
 *       gap-free hash-linked chain validation and the conservative interval transform that turns a
 *       target operation into an Undo candidate, or fails closed with a typed code.
 * - D5  explicit-time Undo eligibility, repeated-Undo decisions and cleanup / metadata / proposal
 *       deadlines. These are decisions only; nothing here deletes, schedules or restores anything.
 *
 * This module registers no endpoints, reads no clock, generates no ids, performs no I/O and has no
 * authority: a committing mutation must still check authenticated ownership, live
 * account/note/conversation state, the current revision and digest, time eligibility, and write the
 * body, derived index, receipt and payload atomically. Pure planning proves none of that.
 *
 * Units. Offsets and `...Utf16` lengths are UTF-16 code units into exact JavaScript strings. Storage
 * budgets are UTF-8 bytes (body, combined fragments). The codec's `maxBodyChars` / `maxTextChars`
 * are UTF-16 code-unit limits and are enforced separately from any byte or code-point budget; no
 * limit is silently converted into another unit.
 *
 * Failures are bounded typed codes (`PageLedgerFailure`): never a message, never copied note text,
 * and `field` / `index` only ever name a schema field or a position.
 *
 * Hashing uses Web Crypto `crypto.subtle.digest("SHA-256")`, the implementation this repo already
 * uses (convex/lib/mcp/token.ts) and which the Convex runtime, Bun and browsers all provide. It is
 * asynchronous, so every function that hashes is `async`; everything else is synchronous.
 */
import type { Doc, Id } from "../_generated/dataModel";
import {
  BLOCK_CODEC_LIMITS,
  parseTempoBlocks,
  serializeTempoBlocks,
  type TempoBlock,
  taskDataSchema,
} from "./blocks";

// ---------------------------------------------------------------------------------------------
// Limits and timing (D4, D5). Every number here is an adopted #828 value except where noted.
// ---------------------------------------------------------------------------------------------

/** Adopted bounds (D2, D4). Byte budgets are UTF-8; `...Utf16Units` are UTF-16 code units. */
export const PAGE_LEDGER_LIMITS = {
  /** Body budget: 128 KiB measured as UTF-8 bytes. Enforced independently of the codec limit. */
  maxBodyUtf8Bytes: 128 * 1024,
  /** The canonical codec's own body limit (UTF-16 code units). Never replaced or converted. */
  maxBodyUtf16Units: BLOCK_CODEC_LIMITS.maxBodyChars,
  /** Combined removedText + insertedText per operation, measured as UTF-8 bytes. */
  maxFragmentUtf8Bytes: 256 * 1024,
  /**
   * Serialized (JSON, UTF-8 bytes) size of one `available` payload. D4 requires this check but
   * names no number; this is the helper's derived bound (twice the fragment budget), so structure
   * and escaping cannot push a payload far beyond its text budget. Flagged for ticket sync.
   */
  maxSerializedPayloadBytes: 512 * 1024,
  maxSplices: 64,
  maxInterveningRevisions: 256,
  /** Proposal title: at most 500 Unicode code points, and separately the codec's UTF-16 bound. */
  maxProposalTitleCodePoints: 500,
  maxProposalTitleUtf16Units: BLOCK_CODEC_LIMITS.maxTextChars,
  minDurationMin: 1,
  maxDurationMin: 1_440,
  defaultDurationMin: 15,
  maxSourceRequestKeyLength: 128,
  maxAgentPromptIdLength: 256,
} as const;

/** Adopted D3 / D5 windows, all in milliseconds. Separate from the 30-day account restoration. */
export const PAGE_LEDGER_TIMING = {
  /** Undo eligibility: appliedAtMs <= now < appliedAtMs + undoWindowMs. */
  undoWindowMs: 300_000,
  /** Technical cleanup grace added after an Undo window or a proposal's content deadline. */
  cleanupGraceMs: 300_000,
  /** Content-free receipt retention (operations and proposals): 48 hours. */
  receiptRetentionMs: 48 * 3_600_000,
  /** Pending proposal content lifetime: 24 hours after creation. */
  proposalLifetimeMs: 24 * 3_600_000,
  /** First-use request admission: ULID timestamp no older than 24 hours ... */
  requestMaxAgeMs: 24 * 3_600_000,
  /** ... and no more than 5 minutes in the future. */
  requestMaxFutureMs: 300_000,
} as const;

/** Version byte of the request encoding hashed into `requestDigest` / `confirmDigest`. */
export const PAGE_REQUEST_ENCODING_VERSION = 1;

const MAX_REVISION = Number.MAX_SAFE_INTEGER - 1;

// ---------------------------------------------------------------------------------------------
// Result and error types
// ---------------------------------------------------------------------------------------------

export type PageLedgerErrorCode =
  // shape and primitive validation
  | "invalid_shape"
  | "unexpected_field"
  | "missing_field"
  | "invalid_enum"
  | "invalid_number"
  | "invalid_timestamp"
  | "invalid_revision"
  | "invalid_id"
  | "invalid_request_id"
  | "invalid_block_id"
  | "invalid_digest"
  | "invalid_local_date"
  | "invalid_source_request_key"
  | "invalid_text"
  | "malformed_text"
  // revisions (D1)
  | "revision_overflow"
  | "revision_mismatch"
  // budgets (D2, D4)
  | "body_too_large_utf16"
  | "body_too_large_utf8"
  | "title_blank"
  | "title_too_many_code_points"
  | "title_too_long_utf16"
  | "duration_out_of_range"
  | "patch_not_allowed"
  | "patch_value_invalid"
  | "too_many_splices"
  | "fragments_too_large"
  | "payload_too_large"
  // splices
  | "invalid_splice"
  | "splice_unsorted"
  | "splice_overlap"
  | "splice_ambiguous"
  | "splice_out_of_range"
  | "splice_splits_surrogate"
  | "fragment_mismatch"
  // state and relationships
  | "state_invariant"
  | "deadline_mismatch"
  | "row_deleted"
  | "record_mismatch"
  // request identity (D3)
  | "request_id_reused"
  | "request_id_expired"
  | "request_id_in_future"
  | "duplicate_request_rows"
  // Undo eligibility (D5)
  | "undo_not_undoable"
  | "undo_not_open"
  | "undo_expired"
  | "undo_payload_expired"
  | "undo_already_undone"
  | "undo_receipt_expired"
  // chain validation (D4)
  | "too_many_intervening_revisions"
  | "chain_incomplete"
  | "chain_excess"
  | "chain_gap"
  | "chain_duplicate"
  | "chain_entry_malformed"
  | "chain_entry_deleted"
  | "chain_hash_link"
  | "chain_revision_mismatch"
  | "chain_inconsistent"
  | "current_body_digest_mismatch"
  // inverse planning (D4)
  | "conflict_overlapping_edit"
  | "conflict_target_changed"
  | "inverse_body_too_large"
  | "codec_roundtrip_failed"
  // proposal confirmation (D3)
  | "proposal_not_pending"
  | "proposal_expired"
  | "proposal_revision_stale"
  | "page_revision_stale"
  | "proposal_confirm_changed";

export type PageLedgerFailure = {
  readonly ok: false;
  readonly code: PageLedgerErrorCode;
  /** A schema field name, never caller-supplied text. */
  readonly field?: string;
  /** A zero-based position in a list (splice, chain entry, patch key) when one applies. */
  readonly index?: number;
};
export type PageLedgerSuccess<T> = { readonly ok: true; readonly value: T };
export type PageLedgerResult<T> = PageLedgerSuccess<T> | PageLedgerFailure;

class LedgerReject extends Error {
  readonly failure: PageLedgerFailure;
  constructor(failure: PageLedgerFailure) {
    super(failure.code);
    this.failure = failure;
  }
}

function reject(code: PageLedgerErrorCode, field?: string, index?: number): never {
  throw new LedgerReject({
    ok: false,
    code,
    ...(field === undefined ? {} : { field }),
    ...(index === undefined ? {} : { index }),
  });
}

function run<T>(fn: () => T): PageLedgerResult<T> {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    if (error instanceof LedgerReject) return error.failure;
    throw error;
  }
}

async function runAsync<T>(fn: () => Promise<T>): Promise<PageLedgerResult<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (error instanceof LedgerReject) return error.failure;
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Row and fragment types
// ---------------------------------------------------------------------------------------------

/** One forward change, content-free: UTF-16 offsets and lengths into the base body. */
export type PageDeltaEntry = {
  startUtf16: number;
  removedLengthUtf16: number;
  insertedLengthUtf16: number;
};

/** One forward change with its exact fragments. Offsets index the base body. */
export type PageSplice = { startUtf16: number; removedText: string; insertedText: string };

/**
 * A `pageOperations` row, or the insert candidate for one (`_id` and `_creationTime` are optional
 * so a row can be validated before it is inserted).
 */
export type PageOperationFacts = Omit<Doc<"pageOperations">, "_id" | "_creationTime"> & {
  _id?: Id<"pageOperations">;
  _creationTime?: number;
};
/** A `pageOperationPayloads` row, or its insert candidate. */
export type PageOperationPayloadFacts = Omit<
  Doc<"pageOperationPayloads">,
  "_id" | "_creationTime"
> & { _id?: Id<"pageOperationPayloads">; _creationTime?: number };
/** A `pageProposals` row, or its insert candidate. */
export type PageProposalFacts = Omit<Doc<"pageProposals">, "_id" | "_creationTime"> & {
  _id?: Id<"pageProposals">;
  _creationTime?: number;
};
export type PageOperationKind = Doc<"pageOperations">["kind"];
export type PageOperationSource = Doc<"pageOperations">["source"];

/** What re-parsing a candidate body with the canonical codec found. Counts only, no content. */
export type CodecSummary = { segments: number; validBlocks: number; brokenBlocks: number };

/** The immutable facts of a body change, shared by write plans and Undo plans. */
export type BodyChangeFacts = {
  result: "applied" | "noop";
  affectsBody: boolean;
  baseRevision: number;
  resultRevision: number;
  baseBodyDigest: string;
  resultBodyDigest: string;
  delta: PageDeltaEntry[];
};

// ---------------------------------------------------------------------------------------------
// Text, number and identity primitives
// ---------------------------------------------------------------------------------------------

type TextScan = { wellFormed: boolean; utf8Bytes: number; codePoints: number };

function isHighSurrogate(unit: number): boolean {
  return unit >= 0xd800 && unit <= 0xdbff;
}
function isLowSurrogate(unit: number): boolean {
  return unit >= 0xdc00 && unit <= 0xdfff;
}

/** One linear pass: well-formedness (no lone surrogate), UTF-8 byte length and code-point count. */
function scanText(text: string): TextScan {
  let utf8Bytes = 0;
  let codePoints = 0;
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    if (unit < 0x80) {
      utf8Bytes += 1;
    } else if (unit < 0x800) {
      utf8Bytes += 2;
    } else if (isHighSurrogate(unit)) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (!isLowSurrogate(next)) return { wellFormed: false, utf8Bytes, codePoints };
      utf8Bytes += 4;
      i += 1;
    } else if (isLowSurrogate(unit)) {
      return { wellFormed: false, utf8Bytes, codePoints };
    } else {
      utf8Bytes += 3;
    }
    codePoints += 1;
  }
  return { wellFormed: true, utf8Bytes, codePoints };
}

/** True when `offset` falls between the two halves of a surrogate pair in `text`. */
function splitsSurrogatePair(text: string, offset: number): boolean {
  return (
    offset > 0 &&
    offset < text.length &&
    isHighSurrogate(text.charCodeAt(offset - 1)) &&
    isLowSurrogate(text.charCodeAt(offset))
  );
}

/** True for a string with no lone surrogate (so it encodes to UTF-8 without loss). */
export function isWellFormedText(text: unknown): text is string {
  return typeof text === "string" && scanText(text).wellFormed;
}

/** UTF-8 byte length of a well-formed string; `undefined` when it has a lone surrogate. */
export function utf8ByteLength(text: string): number | undefined {
  const scan = scanText(text);
  return scan.wellFormed ? scan.utf8Bytes : undefined;
}

/** A finite safe nonnegative integer epoch-millisecond value. */
export function isValidTimestampMs(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0)
  );
}

/** A valid page revision: a safe integer in [0, Number.MAX_SAFE_INTEGER - 1]. */
export function isValidRevision(value: unknown): value is number {
  return isValidTimestampMs(value) && value <= MAX_REVISION;
}

const ULID_PATTERN = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BLOCK_ID_PATTERN = /^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const REQUEST_ID_PATTERN = /^req_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
const SOURCE_REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
// Convex ids are opaque; convex-test ids look like "12;users". Accept printable ASCII only.
const OPAQUE_ID_PATTERN = /^[\x21-\x7e]{1,128}$/;

/** A valid 26-character Crockford-base32 ULID whose 48-bit timestamp does not overflow. */
export function isValidUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_PATTERN.test(value);
}

/** The millisecond timestamp encoded in a ULID's first 10 characters, or `undefined`. */
export function ulidTimestampMs(ulid: unknown): number | undefined {
  if (!isValidUlid(ulid)) return undefined;
  let timestamp = 0;
  for (let i = 0; i < 10; i += 1) timestamp = timestamp * 32 + CROCKFORD.indexOf(ulid.charAt(i));
  return timestamp;
}

/** `req_` plus a valid ULID. */
export function isValidRequestId(value: unknown): value is string {
  return typeof value === "string" && REQUEST_ID_PATTERN.test(value);
}

/** `blk_` plus a valid ULID: the same shape the block codec accepts. */
export function isValidBlockId(value: unknown): value is string {
  return typeof value === "string" && BLOCK_ID_PATTERN.test(value);
}

/** 64 lowercase hexadecimal characters. */
export function isValidSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

/** A real calendar date `YYYY-MM-DD` (same rule as the block codec's `isoDate`). */
export function isValidLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_ID_PATTERN.test(value);
}

// --- strict readers (throw LedgerReject; wrapped by every exported function) ----------------

type Rec = Record<string, unknown>;

function snapshot(
  input: unknown,
  required: readonly string[],
  optional: readonly string[],
  index?: number
): Rec {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    reject("invalid_shape", undefined, index);
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null)
    reject("invalid_shape", undefined, index);
  const out: Rec = Object.create(null);
  for (const key of Object.keys(input)) {
    if (!required.includes(key) && !optional.includes(key)) {
      reject("unexpected_field", undefined, index);
    }
    const value = (input as Rec)[key];
    if (value !== undefined) out[key] = value;
  }
  for (const key of required) {
    if (!(key in out)) reject("missing_field", key, index);
  }
  return out;
}

function readSafeInt(value: unknown, field: string, index?: number): number {
  if (!isValidTimestampMs(value)) reject("invalid_number", field, index);
  return value;
}
function readTimestamp(value: unknown, field: string, index?: number): number {
  if (!isValidTimestampMs(value)) reject("invalid_timestamp", field, index);
  return value;
}
/** Convex's system `_creationTime` is a fractional millisecond float, not a safe integer. */
function readCreationTime(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    reject("invalid_timestamp", "_creationTime");
  }
  return value;
}
function readRevision(value: unknown, field: string): number {
  if (!isValidRevision(value)) reject("invalid_revision", field);
  return value;
}
function readDigest(value: unknown, field: string): string {
  if (!isValidSha256Hex(value)) reject("invalid_digest", field);
  return value;
}
function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") reject("invalid_shape", field);
  return value;
}
function readId<T extends string>(value: unknown, field: string): T {
  if (!isOpaqueId(value)) reject("invalid_id", field);
  return value as T;
}
function readEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) reject("invalid_enum", field);
  return value as T;
}
function readWellFormed(value: unknown, field: string, index?: number): string {
  if (typeof value !== "string") reject("invalid_text", field, index);
  if (!scanText(value).wellFormed) reject("malformed_text", field, index);
  return value;
}
function addMs(base: number, delta: number, field: string): number {
  const sum = base + delta;
  if (!Number.isSafeInteger(sum)) reject("invalid_timestamp", field);
  return sum;
}

// ---------------------------------------------------------------------------------------------
// D1 revisions
// ---------------------------------------------------------------------------------------------

/** D1: a missing `notes.revision` (legacy row) is revision 0; present values must be valid. */
export function effectiveRevision(stored: unknown): PageLedgerResult<number> {
  return run(() => (stored === undefined ? 0 : readRevision(stored, "revision")));
}

function advanceRevision(revision: number): number {
  // Valid revisions end at MAX_SAFE_INTEGER - 1, so advancing from there would overflow.
  if (revision >= MAX_REVISION) reject("revision_overflow", "revision");
  return revision + 1;
}

/** D1: the revision a body-changing write advances to, or `revision_overflow` before any write. */
export function nextRevision(revision: number): PageLedgerResult<number> {
  return run(() => advanceRevision(readRevision(revision, "revision")));
}

/**
 * D1/D3: the mandatory `expectedRevision` check against the stored `notes.revision`. A mismatch is
 * `revision_mismatch` (stale page); nothing is merged or retried here.
 */
export function checkExpectedRevision(
  storedRevision: unknown,
  expectedRevision: unknown
): PageLedgerResult<{ currentRevision: number }> {
  return run(() => {
    const currentRevision =
      storedRevision === undefined ? 0 : readRevision(storedRevision, "revision");
    const expected = readRevision(expectedRevision, "expectedRevision");
    if (expected !== currentRevision) reject("revision_mismatch", "expectedRevision");
    return { currentRevision };
  });
}

// ---------------------------------------------------------------------------------------------
// D1 digests
// ---------------------------------------------------------------------------------------------

async function digestWellFormed(text: string, field: string): Promise<string> {
  if (!scanText(text).wellFormed) reject("malformed_text", field);
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Lowercase SHA-256 hex of the exact UTF-8 text. No trimming, Unicode normalization, newline
 * change or JSON re-serialization. A string with a lone surrogate is `malformed_text`, because
 * UTF-8 encoding would silently replace it and let two different strings share a digest.
 */
export function sha256Hex(text: string): Promise<PageLedgerResult<string>> {
  return runAsync(() => digestWellFormed(text, "text"));
}

/** D1: digest of a page body (exact UTF-8 text). Equality and corruption only, never authority. */
export function digestBody(body: string): Promise<PageLedgerResult<string>> {
  return runAsync(() => digestWellFormed(body, "body"));
}

// ---------------------------------------------------------------------------------------------
// D2/D4 budgets
// ---------------------------------------------------------------------------------------------

function assertBodyBudget(body: unknown): string {
  if (typeof body !== "string") reject("invalid_text", "body");
  // Codec limit first: O(1), and it keeps an absurdly large string from being scanned at all.
  if (body.length > PAGE_LEDGER_LIMITS.maxBodyUtf16Units) reject("body_too_large_utf16", "body");
  const scan = scanText(body);
  if (!scan.wellFormed) reject("malformed_text", "body");
  if (scan.utf8Bytes > PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes) reject("body_too_large_utf8", "body");
  return body;
}

/**
 * D4: a body that may be written. Two independent limits: `body.length <=
 * BLOCK_CODEC_LIMITS.maxBodyChars` (UTF-16 code units, the codec's limit) and at most 128 KiB of
 * UTF-8. The code-unit limit is checked first, so the failure code names the codec bound when both
 * would fail. Oversized writes fail here, before any mutation; nothing is truncated.
 */
export function checkBodyBudget(body: unknown): PageLedgerResult<{ utf8Bytes: number }> {
  return run(() => ({ utf8Bytes: scanText(assertBodyBudget(body)).utf8Bytes }));
}

/** An existing body being read: well-formed and within the codec's own limit, not the write budget. */
function assertExistingBody(body: unknown, field: string): string {
  if (typeof body !== "string") reject("invalid_text", field);
  if (body.length > PAGE_LEDGER_LIMITS.maxBodyUtf16Units) reject("body_too_large_utf16", field);
  if (!scanText(body).wellFormed) reject("malformed_text", field);
  return body;
}

type TaskData = Extract<TempoBlock, { type: "task" }>["data"];
export type ProposalTaskInput = { title: string; durationMin: number };

function parseProposalTask(
  input: unknown,
  durationRequired: boolean,
  field: string
): ProposalTaskInput {
  const record = snapshot(input, durationRequired ? ["title", "durationMin"] : ["title"], [
    ...(durationRequired ? [] : ["durationMin"]),
  ]);
  // Bound the work before scanning. Past twice the code-point cap a string necessarily has more
  // code points than allowed (a code point is at most two UTF-16 units).
  if (
    typeof record.title === "string" &&
    record.title.length > 2 * PAGE_LEDGER_LIMITS.maxProposalTitleCodePoints
  ) {
    reject("title_too_many_code_points", `${field}.title`);
  }
  const title = readWellFormed(record.title, `${field}.title`);
  const scan = scanText(title);
  if (!/\S/.test(title)) reject("title_blank", `${field}.title`);
  if (scan.codePoints > PAGE_LEDGER_LIMITS.maxProposalTitleCodePoints) {
    reject("title_too_many_code_points", `${field}.title`);
  }
  if (title.length > PAGE_LEDGER_LIMITS.maxProposalTitleUtf16Units) {
    reject("title_too_long_utf16", `${field}.title`);
  }
  const rawDuration =
    record.durationMin === undefined ? PAGE_LEDGER_LIMITS.defaultDurationMin : record.durationMin;
  if (
    typeof rawDuration !== "number" ||
    !Number.isInteger(rawDuration) ||
    rawDuration < PAGE_LEDGER_LIMITS.minDurationMin ||
    rawDuration > PAGE_LEDGER_LIMITS.maxDurationMin
  ) {
    reject("duration_out_of_range", `${field}.durationMin`);
  }
  // The block codec is the single task validator; its narrower reading of either field also fails.
  if (
    !taskDataSchema.shape.title.safeParse(title).success ||
    !taskDataSchema.shape.durationMin.safeParse(rawDuration).success
  ) {
    reject("invalid_text", `${field}.title`);
  }
  return { title, durationMin: rawDuration };
}

/**
 * D2: the narrow proposal task input. `title` is nonblank with at most 500 Unicode code points AND
 * at most `BLOCK_CODEC_LIMITS.maxTextChars` UTF-16 code units (two different units, both enforced;
 * the code-point rule is checked first). `durationMin` is an integer in 1-1440 and defaults to 15
 * when omitted. The title is stored exactly as given: never trimmed or normalized.
 */
export function validateProposalTaskInput(input: unknown): PageLedgerResult<ProposalTaskInput> {
  return run(() => parseProposalTask(input, false, "task"));
}

// ---------------------------------------------------------------------------------------------
// Splices and deltas (D2, D4)
// ---------------------------------------------------------------------------------------------

type Extent = { start: number; removed: number };

/**
 * D4 ordering. Entries must be sorted by base offset, strictly increasing, non-overlapping and not
 * touching: two splices whose spans meet (or that start at the same offset) are ambiguous and must
 * be merged into one hunk by the caller. This keeps both the forward order and every inverse
 * interval unambiguous.
 */
function assertOrdered(entries: readonly Extent[]): void {
  for (let i = 1; i < entries.length; i += 1) {
    const previous = entries[i - 1] as Extent;
    const current = entries[i] as Extent;
    const previousEnd = previous.start + previous.removed;
    if (!Number.isSafeInteger(previousEnd)) reject("splice_out_of_range", undefined, i - 1);
    if (current.start < previous.start) reject("splice_unsorted", undefined, i);
    if (current.start < previousEnd) reject("splice_overlap", undefined, i);
    if (current.start === previousEnd) reject("splice_ambiguous", undefined, i);
  }
}

function parseDeltaList(input: unknown, field: string): PageDeltaEntry[] {
  if (!Array.isArray(input)) reject("invalid_shape", field);
  if (input.length > PAGE_LEDGER_LIMITS.maxSplices) reject("too_many_splices", field);
  const out: PageDeltaEntry[] = [];
  let combined = 0;
  input.forEach((raw: unknown, index: number) => {
    const record = snapshot(
      raw,
      ["startUtf16", "removedLengthUtf16", "insertedLengthUtf16"],
      [],
      index
    );
    const startUtf16 = readSafeInt(record.startUtf16, "startUtf16", index);
    const removedLengthUtf16 = readSafeInt(record.removedLengthUtf16, "removedLengthUtf16", index);
    const insertedLengthUtf16 = readSafeInt(
      record.insertedLengthUtf16,
      "insertedLengthUtf16",
      index
    );
    if (removedLengthUtf16 === 0 && insertedLengthUtf16 === 0)
      reject("invalid_splice", field, index);
    if (startUtf16 + removedLengthUtf16 > PAGE_LEDGER_LIMITS.maxBodyUtf16Units) {
      reject("splice_out_of_range", field, index);
    }
    // Every UTF-16 code unit takes at least one UTF-8 byte, so this lower-bounds the byte budget.
    combined += removedLengthUtf16 + insertedLengthUtf16;
    if (combined > PAGE_LEDGER_LIMITS.maxFragmentUtf8Bytes)
      reject("fragments_too_large", field, index);
    out.push({ startUtf16, removedLengthUtf16, insertedLengthUtf16 });
  });
  assertOrdered(
    out.map((entry) => ({ start: entry.startUtf16, removed: entry.removedLengthUtf16 }))
  );
  return out;
}

/** D2/D4: validate the content-free `delta` array of an operation row. Returns a fresh copy. */
export function validatePageDelta(input: unknown): PageLedgerResult<PageDeltaEntry[]> {
  return run(() => parseDeltaList(input, "delta"));
}

function serializedPayloadBytes(splices: readonly PageSplice[]): number {
  return scanText(JSON.stringify({ state: "available", splices })).utf8Bytes;
}

function parseSpliceList(input: unknown, field: string): PageSplice[] {
  if (!Array.isArray(input)) reject("invalid_shape", field);
  if (input.length > PAGE_LEDGER_LIMITS.maxSplices) reject("too_many_splices", field);
  const out: PageSplice[] = [];
  let combinedBytes = 0;
  input.forEach((raw: unknown, index: number) => {
    const record = snapshot(raw, ["startUtf16", "removedText", "insertedText"], [], index);
    const startUtf16 = readSafeInt(record.startUtf16, "startUtf16", index);
    if (typeof record.removedText !== "string" || typeof record.insertedText !== "string") {
      reject("invalid_text", field, index);
    }
    // Bound the work before scanning: a UTF-16 unit is at least one UTF-8 byte.
    if (
      record.removedText.length + record.insertedText.length + combinedBytes >
      PAGE_LEDGER_LIMITS.maxFragmentUtf8Bytes
    ) {
      reject("fragments_too_large", field, index);
    }
    const removed = scanText(record.removedText);
    const inserted = scanText(record.insertedText);
    if (!removed.wellFormed || !inserted.wellFormed) reject("malformed_text", field, index);
    if (record.removedText === record.insertedText) reject("invalid_splice", field, index);
    combinedBytes += removed.utf8Bytes + inserted.utf8Bytes;
    if (combinedBytes > PAGE_LEDGER_LIMITS.maxFragmentUtf8Bytes) {
      reject("fragments_too_large", field, index);
    }
    if (startUtf16 + record.removedText.length > PAGE_LEDGER_LIMITS.maxBodyUtf16Units) {
      reject("splice_out_of_range", field, index);
    }
    out.push({
      startUtf16,
      removedText: record.removedText,
      insertedText: record.insertedText,
    });
  });
  assertOrdered(
    out.map((entry) => ({ start: entry.startUtf16, removed: entry.removedText.length }))
  );
  if (serializedPayloadBytes(out) > PAGE_LEDGER_LIMITS.maxSerializedPayloadBytes) {
    reject("payload_too_large", field);
  }
  return out;
}

/**
 * D2/D4: validate a list of exact-fragment splices (the shape of an `available` payload): at most
 * 64, sorted, strictly increasing, non-overlapping and non-touching, no identity hunks, well-formed
 * text, combined fragments within 256 KiB UTF-8 and the serialized payload within its byte bound.
 * Offsets are NOT checked against any body here; see `applyPageSplices`.
 */
export function validatePageSplices(input: unknown): PageLedgerResult<PageSplice[]> {
  return run(() => parseSpliceList(input, "splices"));
}

function deltaOf(splices: readonly PageSplice[]): PageDeltaEntry[] {
  return splices.map((splice) => ({
    startUtf16: splice.startUtf16,
    removedLengthUtf16: splice.removedText.length,
    insertedLengthUtf16: splice.insertedText.length,
  }));
}

/** Checks validated splices against the exact base body they were planned for. */
function assertSplicesFitBase(base: string, splices: readonly PageSplice[]): void {
  splices.forEach((splice, index) => {
    const end = splice.startUtf16 + splice.removedText.length;
    if (end > base.length) reject("splice_out_of_range", "splices", index);
    if (splitsSurrogatePair(base, splice.startUtf16) || splitsSurrogatePair(base, end)) {
      reject("splice_splits_surrogate", "splices", index);
    }
    if (base.slice(splice.startUtf16, end) !== splice.removedText) {
      reject("fragment_mismatch", "splices", index);
    }
  });
}

function assembleSplices(base: string, splices: readonly PageSplice[]): string {
  // Equivalent to applying the sorted, non-overlapping splices right-to-left (tested), in one pass.
  let out = "";
  let cursor = 0;
  for (const splice of splices) {
    out += base.slice(cursor, splice.startUtf16) + splice.insertedText;
    cursor = splice.startUtf16 + splice.removedText.length;
  }
  return out + base.slice(cursor);
}

/**
 * D4 forward reconstruction: apply validated splices to the exact `base` body. Every offset must be
 * in range, must not split a surrogate pair, and every `removedText` must equal the exact base
 * slice it claims to replace; otherwise nothing is applied (`fragment_mismatch`, ...).
 */
export function applyPageSplices(base: string, splices: unknown): PageLedgerResult<string> {
  return run(() => {
    const checkedBase = assertExistingBody(base, "base");
    const list = parseSpliceList(splices, "splices");
    assertSplicesFitBase(checkedBase, list);
    return assembleSplices(checkedBase, list);
  });
}

function invertSplices(splices: readonly PageSplice[]): PageSplice[] {
  let shift = 0;
  return splices.map((splice) => {
    const inverse: PageSplice = {
      startUtf16: splice.startUtf16 + shift,
      removedText: splice.insertedText,
      insertedText: splice.removedText,
    };
    shift += splice.insertedText.length - splice.removedText.length;
    return inverse;
  });
}

/**
 * D4 inverse reconstruction against the operation's own result body: the same hunks expressed in
 * result coordinates with removed and inserted text swapped. `applyPageSplices(result,
 * invertPageSplices(splices))` returns the original base, byte for byte.
 */
export function invertPageSplices(splices: unknown): PageLedgerResult<PageSplice[]> {
  return run(() => invertSplices(parseSpliceList(splices, "splices")));
}

/**
 * D4 baseline diff: one replacement hunk found by a linear longest-common-prefix / longest-common-
 * suffix scan. No diff package and nothing quadratic. Both boundaries are moved outward until they
 * do not split a surrogate pair in either string. Identical strings give no hunk. The hunk may
 * legitimately contain a whole former body; that is an explicit short-lived inverse-data decision.
 */
export function diffToSingleSplice(before: string, after: string): PageSplice[] {
  if (before === after) return [];
  const shorter = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shorter && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix += 1;
  while (
    prefix > 0 &&
    (splitsSurrogatePair(before, prefix) || splitsSurrogatePair(after, prefix))
  ) {
    prefix -= 1;
  }
  let suffix = 0;
  const maxSuffix = shorter - prefix;
  while (
    suffix < maxSuffix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  while (
    suffix > 0 &&
    (splitsSurrogatePair(before, before.length - suffix) ||
      splitsSurrogatePair(after, after.length - suffix))
  ) {
    suffix -= 1;
  }
  return [
    {
      startUtf16: prefix,
      removedText: before.slice(prefix, before.length - suffix),
      insertedText: after.slice(prefix, after.length - suffix),
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Codec re-parse
// ---------------------------------------------------------------------------------------------

function summarizeCodec(body: string): CodecSummary {
  const segments = parseTempoBlocks(body);
  // The codec is lossless by contract: untouched, broken and unknown blocks keep their exact source.
  if (serializeTempoBlocks(segments) !== body) reject("codec_roundtrip_failed", "body");
  let validBlocks = 0;
  let brokenBlocks = 0;
  for (const segment of segments) {
    if (segment.kind === "valid") validBlocks += 1;
    else if (segment.kind === "broken") brokenBlocks += 1;
  }
  return { segments: segments.length, validBlocks, brokenBlocks };
}

// ---------------------------------------------------------------------------------------------
// Row validators (D2)
// ---------------------------------------------------------------------------------------------

const OPERATION_KINDS = ["save", "patch_block", "add_task", "undo"] as const;
const OPERATION_SOURCES = ["ui", "coach", "mcp", "legacy"] as const;
const OPERATION_REQUIRED = [
  "userId",
  "noteId",
  "requestId",
  "requestDigest",
  "kind",
  "source",
  "result",
  "affectsBody",
  "baseRevision",
  "resultRevision",
  "baseBodyDigest",
  "resultBodyDigest",
  "delta",
  "appliedAtMs",
  "metadataExpiresAtMs",
  "createdAt",
  "updatedAt",
] as const;
const OPERATION_OPTIONAL = [
  "_id",
  "_creationTime",
  "undoUntilMs",
  "undoneAtMs",
  "undoneByOperationId",
  "undoOfOperationId",
  "proposalId",
  "deletedAt",
] as const;

function parseOperation(input: unknown): PageOperationFacts {
  const r = snapshot(input, OPERATION_REQUIRED, OPERATION_OPTIONAL);
  const kind = readEnum(r.kind, "kind", OPERATION_KINDS);
  const source = readEnum(r.source, "source", OPERATION_SOURCES);
  const result = readEnum(r.result, "result", ["applied", "noop"] as const);
  const affectsBody = readBoolean(r.affectsBody, "affectsBody");
  const baseRevision = readRevision(r.baseRevision, "baseRevision");
  const resultRevision = readRevision(r.resultRevision, "resultRevision");
  const baseBodyDigest = readDigest(r.baseBodyDigest, "baseBodyDigest");
  const resultBodyDigest = readDigest(r.resultBodyDigest, "resultBodyDigest");
  if (!isValidRequestId(r.requestId)) reject("invalid_request_id", "requestId");
  const requestId = r.requestId;
  const requestDigest = readDigest(r.requestDigest, "requestDigest");
  const delta = parseDeltaList(r.delta, "delta");
  const appliedAtMs = readTimestamp(r.appliedAtMs, "appliedAtMs");
  const metadataExpiresAtMs = readTimestamp(r.metadataExpiresAtMs, "metadataExpiresAtMs");
  const createdAt = readTimestamp(r.createdAt, "createdAt");
  const updatedAt = readTimestamp(r.updatedAt, "updatedAt");
  const undoUntilMs =
    r.undoUntilMs === undefined ? undefined : readTimestamp(r.undoUntilMs, "undoUntilMs");
  const undoneAtMs =
    r.undoneAtMs === undefined ? undefined : readTimestamp(r.undoneAtMs, "undoneAtMs");
  const deletedAt = r.deletedAt === undefined ? undefined : readTimestamp(r.deletedAt, "deletedAt");
  const rowId = r._id === undefined ? undefined : readId<Id<"pageOperations">>(r._id, "_id");
  const undoneByOperationId =
    r.undoneByOperationId === undefined
      ? undefined
      : readId<Id<"pageOperations">>(r.undoneByOperationId, "undoneByOperationId");
  const undoOfOperationId =
    r.undoOfOperationId === undefined
      ? undefined
      : readId<Id<"pageOperations">>(r.undoOfOperationId, "undoOfOperationId");
  const proposalId =
    r.proposalId === undefined
      ? undefined
      : readId<Id<"pageProposals">>(r.proposalId, "proposalId");
  const creationTime =
    r._creationTime === undefined ? undefined : readCreationTime(r._creationTime);

  if (updatedAt < createdAt) reject("state_invariant", "updatedAt");
  if (
    metadataExpiresAtMs !==
    addMs(appliedAtMs, PAGE_LEDGER_TIMING.receiptRetentionMs, "metadataExpiresAtMs")
  ) {
    reject("deadline_mismatch", "metadataExpiresAtMs");
  }
  if (rowId !== undefined && (rowId === undoneByOperationId || rowId === undoOfOperationId)) {
    reject("state_invariant", "_id");
  }

  if (result === "noop") {
    // A byte-identical no-op reserves its request identity and nothing else.
    if (kind === "undo") reject("state_invariant", "kind");
    if (affectsBody) reject("state_invariant", "affectsBody");
    if (resultRevision !== baseRevision) reject("state_invariant", "resultRevision");
    if (resultBodyDigest !== baseBodyDigest) reject("state_invariant", "resultBodyDigest");
    if (delta.length !== 0) reject("state_invariant", "delta");
    if (
      undoUntilMs !== undefined ||
      undoneAtMs !== undefined ||
      undoneByOperationId !== undefined ||
      undoOfOperationId !== undefined ||
      proposalId !== undefined
    ) {
      reject("state_invariant", "result");
    }
  } else {
    if (!affectsBody) reject("state_invariant", "affectsBody");
    if (resultRevision !== baseRevision + 1) reject("state_invariant", "resultRevision");
    if (resultBodyDigest === baseBodyDigest) reject("state_invariant", "resultBodyDigest");
    if (delta.length === 0) reject("state_invariant", "delta");
    if (kind === "undo") {
      // An undo is another real body revision that links its target. It has no Undo window of its
      // own (no redo), so no eligibility, undone or proposal fields.
      if (undoOfOperationId === undefined) reject("missing_field", "undoOfOperationId");
      if (
        undoUntilMs !== undefined ||
        undoneAtMs !== undefined ||
        undoneByOperationId !== undefined ||
        proposalId !== undefined
      ) {
        reject("state_invariant", "kind");
      }
    } else {
      if (undoOfOperationId !== undefined) reject("state_invariant", "undoOfOperationId");
      if (undoUntilMs === undefined) reject("missing_field", "undoUntilMs");
      if (undoUntilMs !== addMs(appliedAtMs, PAGE_LEDGER_TIMING.undoWindowMs, "undoUntilMs")) {
        reject("deadline_mismatch", "undoUntilMs");
      }
      if ((undoneAtMs === undefined) !== (undoneByOperationId === undefined)) {
        reject("state_invariant", "undoneAtMs");
      }
      if (undoneAtMs !== undefined && (undoneAtMs < appliedAtMs || undoneAtMs >= undoUntilMs)) {
        reject("state_invariant", "undoneAtMs");
      }
      // The only proposal flow is add_task_to_today, which writes through an add_task operation.
      if (proposalId !== undefined && kind !== "add_task") reject("state_invariant", "proposalId");
    }
  }

  return {
    ...(rowId === undefined ? {} : { _id: rowId }),
    ...(creationTime === undefined ? {} : { _creationTime: creationTime }),
    userId: readId<Id<"users">>(r.userId, "userId"),
    noteId: readId<Id<"notes">>(r.noteId, "noteId"),
    requestId,
    requestDigest,
    kind,
    source,
    result,
    affectsBody,
    baseRevision,
    resultRevision,
    baseBodyDigest,
    resultBodyDigest,
    delta,
    appliedAtMs,
    ...(undoUntilMs === undefined ? {} : { undoUntilMs }),
    ...(undoneAtMs === undefined ? {} : { undoneAtMs }),
    ...(undoneByOperationId === undefined ? {} : { undoneByOperationId }),
    ...(undoOfOperationId === undefined ? {} : { undoOfOperationId }),
    ...(proposalId === undefined ? {} : { proposalId }),
    metadataExpiresAtMs,
    createdAt,
    updatedAt,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

/**
 * D2: validate a `pageOperations` row (or insert candidate) from untrusted input. Strict shape (no
 * unexpected field), safe-integer revisions, valid timestamps / ULID request id / digests, a valid
 * delta, and every cross-field state invariant: applied vs noop vs undo, `undoUntilMs` only on an
 * applied non-undo operation and exactly applied + 5 minutes, `undoneAtMs` and `undoneByOperationId`
 * together or not at all, `undoOfOperationId` exactly when kind is undo, `metadataExpiresAtMs`
 * exactly applied + 48 hours. Returns a fresh object copy.
 */
export function validatePageOperationFacts(input: unknown): PageLedgerResult<PageOperationFacts> {
  return run(() => parseOperation(input));
}

function parsePayloadRow(input: unknown): PageOperationPayloadFacts {
  const r = snapshot(
    input,
    [
      "userId",
      "noteId",
      "operationId",
      "undoUntilMs",
      "cleanupDueAtMs",
      "payload",
      "createdAt",
      "updatedAt",
    ],
    ["_id", "_creationTime", "deletedAt"]
  );
  const undoUntilMs = readTimestamp(r.undoUntilMs, "undoUntilMs");
  const cleanupDueAtMs = readTimestamp(r.cleanupDueAtMs, "cleanupDueAtMs");
  const createdAt = readTimestamp(r.createdAt, "createdAt");
  const updatedAt = readTimestamp(r.updatedAt, "updatedAt");
  const deletedAt = r.deletedAt === undefined ? undefined : readTimestamp(r.deletedAt, "deletedAt");
  const rowId = r._id === undefined ? undefined : readId<Id<"pageOperationPayloads">>(r._id, "_id");
  const creationTime =
    r._creationTime === undefined ? undefined : readCreationTime(r._creationTime);
  if (updatedAt < createdAt) reject("state_invariant", "updatedAt");
  if (cleanupDueAtMs !== addMs(undoUntilMs, PAGE_LEDGER_TIMING.cleanupGraceMs, "cleanupDueAtMs")) {
    reject("deadline_mismatch", "cleanupDueAtMs");
  }

  const head = snapshot(r.payload, ["state"], ["splices", "expiredAtMs"]);
  const state = readEnum(head.state, "payload.state", ["available", "expired"] as const);
  let payload: PageOperationPayloadFacts["payload"];
  if (state === "available") {
    const body = snapshot(r.payload, ["state", "splices"], []);
    const splices = parseSpliceList(body.splices, "payload.splices");
    // One payload per applied operation and an applied operation has a nonempty delta.
    if (splices.length === 0) reject("state_invariant", "payload.splices");
    payload = { state: "available", splices };
  } else {
    const body = snapshot(r.payload, ["state", "expiredAtMs"], []);
    payload = {
      state: "expired",
      expiredAtMs: readTimestamp(body.expiredAtMs, "payload.expiredAtMs"),
    };
  }

  return {
    ...(rowId === undefined ? {} : { _id: rowId }),
    ...(creationTime === undefined ? {} : { _creationTime: creationTime }),
    userId: readId<Id<"users">>(r.userId, "userId"),
    noteId: readId<Id<"notes">>(r.noteId, "noteId"),
    operationId: readId<Id<"pageOperations">>(r.operationId, "operationId"),
    undoUntilMs,
    cleanupDueAtMs,
    payload,
    createdAt,
    updatedAt,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

/**
 * D2: validate a `pageOperationPayloads` row. The `available` union holds 1-64 sorted,
 * non-touching, exact splices within the fragment and serialized byte budgets; `expired` holds only
 * a timestamp. `cleanupDueAtMs` is exactly `undoUntilMs` + 5 minutes. Returns a fresh copy.
 */
export function validatePageOperationPayloadFacts(
  input: unknown
): PageLedgerResult<PageOperationPayloadFacts> {
  return run(() => parsePayloadRow(input));
}

function assertPayloadMatchesOperation(
  operation: PageOperationFacts,
  payload: PageOperationPayloadFacts
): void {
  if (operation._id === undefined) reject("missing_field", "_id");
  if (payload.operationId !== operation._id) reject("record_mismatch", "operationId");
  if (payload.userId !== operation.userId) reject("record_mismatch", "userId");
  if (payload.noteId !== operation.noteId) reject("record_mismatch", "noteId");
  // Payloads exist only for an applied, non-undo, body-changing operation.
  if (operation.result !== "applied" || operation.kind === "undo" || !operation.affectsBody) {
    reject("state_invariant", "kind");
  }
  if (payload.undoUntilMs !== operation.undoUntilMs) reject("deadline_mismatch", "undoUntilMs");
  if (payload.payload.state === "available") {
    const { splices } = payload.payload;
    if (splices.length !== operation.delta.length) reject("record_mismatch", "payload.splices");
    splices.forEach((splice, index) => {
      const entry = operation.delta[index] as PageDeltaEntry;
      if (
        splice.startUtf16 !== entry.startUtf16 ||
        splice.removedText.length !== entry.removedLengthUtf16 ||
        splice.insertedText.length !== entry.insertedLengthUtf16
      ) {
        reject("record_mismatch", "payload.splices", index);
      }
    });
  }
}

/**
 * D2: an operation and its payload belong together: same owner and note, the payload points at the
 * operation, the same `undoUntilMs`, and (when available) every splice's start and lengths equal the
 * matching delta entry. The operation must carry its `_id`.
 */
export function validateOperationPayloadPair(
  operation: unknown,
  payload: unknown
): PageLedgerResult<{ operation: PageOperationFacts; payload: PageOperationPayloadFacts }> {
  return run(() => {
    const parsedOperation = parseOperation(operation);
    const parsedPayload = parsePayloadRow(payload);
    assertPayloadMatchesOperation(parsedOperation, parsedPayload);
    return { operation: parsedOperation, payload: parsedPayload };
  });
}

const PROPOSAL_STATUSES = ["pending", "confirmed", "rejected", "cancelled", "expired"] as const;

function parseProposal(input: unknown): PageProposalFacts {
  const r = snapshot(
    input,
    [
      "userId",
      "kind",
      "schemaVersion",
      "noteId",
      "localDate",
      "conversationId",
      "sourceRequestKey",
      "proposalRevision",
      "expectedPageRevision",
      "blockId",
      "status",
      "proposalExpiresAtMs",
      "cleanupDueAtMs",
      "metadataExpiresAtMs",
      "payload",
      "createdAt",
      "updatedAt",
    ],
    [
      "_id",
      "_creationTime",
      "sourceAgentPromptId",
      "decidedAtMs",
      "confirmedOperationId",
      "confirmDigest",
      "deletedAt",
    ]
  );
  if (r.kind !== "add_task_to_today") reject("invalid_enum", "kind");
  if (r.schemaVersion !== 1) reject("invalid_enum", "schemaVersion");
  if (!isValidLocalDate(r.localDate)) reject("invalid_local_date", "localDate");
  if (
    typeof r.sourceRequestKey !== "string" ||
    !SOURCE_REQUEST_KEY_PATTERN.test(r.sourceRequestKey)
  ) {
    reject("invalid_source_request_key", "sourceRequestKey");
  }
  let sourceAgentPromptId: string | undefined;
  if (r.sourceAgentPromptId !== undefined) {
    if (
      typeof r.sourceAgentPromptId !== "string" ||
      r.sourceAgentPromptId.length < 1 ||
      r.sourceAgentPromptId.length > PAGE_LEDGER_LIMITS.maxAgentPromptIdLength
    ) {
      reject("invalid_text", "sourceAgentPromptId");
    }
    sourceAgentPromptId = readWellFormed(r.sourceAgentPromptId, "sourceAgentPromptId");
  }
  const proposalRevision = readSafeInt(r.proposalRevision, "proposalRevision");
  const expectedPageRevision = readSafeInt(r.expectedPageRevision, "expectedPageRevision");
  if (!isValidBlockId(r.blockId)) reject("invalid_block_id", "blockId");
  const status = readEnum(r.status, "status", PROPOSAL_STATUSES);
  const proposalExpiresAtMs = readTimestamp(r.proposalExpiresAtMs, "proposalExpiresAtMs");
  const cleanupDueAtMs = readTimestamp(r.cleanupDueAtMs, "cleanupDueAtMs");
  const metadataExpiresAtMs = readTimestamp(r.metadataExpiresAtMs, "metadataExpiresAtMs");
  const createdAt = readTimestamp(r.createdAt, "createdAt");
  const updatedAt = readTimestamp(r.updatedAt, "updatedAt");
  const decidedAtMs =
    r.decidedAtMs === undefined ? undefined : readTimestamp(r.decidedAtMs, "decidedAtMs");
  const deletedAt = r.deletedAt === undefined ? undefined : readTimestamp(r.deletedAt, "deletedAt");
  const confirmedOperationId =
    r.confirmedOperationId === undefined
      ? undefined
      : readId<Id<"pageOperations">>(r.confirmedOperationId, "confirmedOperationId");
  const confirmDigest =
    r.confirmDigest === undefined ? undefined : readDigest(r.confirmDigest, "confirmDigest");
  const rowId = r._id === undefined ? undefined : readId<Id<"pageProposals">>(r._id, "_id");
  const creationTime =
    r._creationTime === undefined ? undefined : readCreationTime(r._creationTime);

  if (updatedAt < createdAt) reject("state_invariant", "updatedAt");
  if (
    cleanupDueAtMs < proposalExpiresAtMs ||
    cleanupDueAtMs > addMs(proposalExpiresAtMs, PAGE_LEDGER_TIMING.cleanupGraceMs, "cleanupDueAtMs")
  ) {
    reject("deadline_mismatch", "cleanupDueAtMs");
  }
  if (
    metadataExpiresAtMs <
    addMs(createdAt, PAGE_LEDGER_TIMING.receiptRetentionMs, "metadataExpiresAtMs")
  ) {
    reject("deadline_mismatch", "metadataExpiresAtMs");
  }
  if (status === "pending") {
    if (
      decidedAtMs !== undefined ||
      confirmedOperationId !== undefined ||
      confirmDigest !== undefined
    ) {
      reject("state_invariant", "status");
    }
    // D5: an undecided proposal keeps its creation-time content deadline (24 hours), so a stored
    // row cannot stretch content access (or, through it, the cleanup deadline) past that lifetime.
    if (
      proposalExpiresAtMs !==
      addMs(createdAt, PAGE_LEDGER_TIMING.proposalLifetimeMs, "proposalExpiresAtMs")
    ) {
      reject("deadline_mismatch", "proposalExpiresAtMs");
    }
  } else if (status === "confirmed") {
    if (decidedAtMs === undefined) reject("missing_field", "decidedAtMs");
    if (confirmedOperationId === undefined) reject("missing_field", "confirmedOperationId");
    if (confirmDigest === undefined) reject("missing_field", "confirmDigest");
  } else {
    if (confirmedOperationId !== undefined || confirmDigest !== undefined) {
      reject("state_invariant", "status");
    }
    if (status !== "expired" && decidedAtMs === undefined) reject("missing_field", "decidedAtMs");
    // D5: rejection or cancellation ends content access at the decision time
    // (`proposalDeadlinesAfterDecision`). The cleanup bound above is relative to
    // `proposalExpiresAtMs`, so this also keeps cleanup within the grace after the decision.
    const endsAtDecision = status === "rejected" || status === "cancelled";
    if (endsAtDecision && proposalExpiresAtMs !== decidedAtMs) {
      reject("deadline_mismatch", "proposalExpiresAtMs");
    }
  }
  if (decidedAtMs !== undefined && decidedAtMs < createdAt)
    reject("state_invariant", "decidedAtMs");

  const head = snapshot(r.payload, ["state"], ["task", "expiredAtMs"]);
  const payloadState = readEnum(head.state, "payload.state", ["available", "expired"] as const);
  let payload: PageProposalFacts["payload"];
  if (payloadState === "available") {
    const body = snapshot(r.payload, ["state", "task"], []);
    payload = { state: "available", task: parseProposalTask(body.task, true, "payload.task") };
  } else {
    const body = snapshot(r.payload, ["state", "expiredAtMs"], []);
    payload = {
      state: "expired",
      expiredAtMs: readTimestamp(body.expiredAtMs, "payload.expiredAtMs"),
    };
  }

  return {
    ...(rowId === undefined ? {} : { _id: rowId }),
    ...(creationTime === undefined ? {} : { _creationTime: creationTime }),
    userId: readId<Id<"users">>(r.userId, "userId"),
    kind: "add_task_to_today",
    schemaVersion: 1,
    noteId: readId<Id<"notes">>(r.noteId, "noteId"),
    localDate: r.localDate as string,
    conversationId: readId<Id<"conversations">>(r.conversationId, "conversationId"),
    sourceRequestKey: r.sourceRequestKey as string,
    ...(sourceAgentPromptId === undefined ? {} : { sourceAgentPromptId }),
    proposalRevision,
    expectedPageRevision,
    blockId: r.blockId as string,
    status,
    proposalExpiresAtMs,
    cleanupDueAtMs,
    metadataExpiresAtMs,
    payload,
    ...(decidedAtMs === undefined ? {} : { decidedAtMs }),
    ...(confirmedOperationId === undefined ? {} : { confirmedOperationId }),
    ...(confirmDigest === undefined ? {} : { confirmDigest }),
    createdAt,
    updatedAt,
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

/**
 * D2: validate a `pageProposals` row. Real calendar `localDate`, 1-128 ASCII letter/digit/underscore/
 * hyphen `sourceRequestKey`, 1-256 character `sourceAgentPromptId`, safe nonnegative
 * `proposalRevision` and `expectedPageRevision` (two distinct guards), `blk_` + ULID `blockId`, the
 * D5 deadline relationships (a pending proposal's `proposalExpiresAtMs` is exactly `createdAt` + 24
 * hours), status-dependent decided / confirmed fields, and a payload whose task
 * passes `validateProposalTaskInput` rules with a stored `durationMin`. Returns a fresh copy.
 */
export function validatePageProposalFacts(input: unknown): PageLedgerResult<PageProposalFacts> {
  return run(() => parseProposal(input));
}

// ---------------------------------------------------------------------------------------------
// D3 request encoding, digests and admission
// ---------------------------------------------------------------------------------------------

/**
 * The allowlisted `patch_block` keys are exactly the fields of the canonical task block data, and
 * each value must parse unchanged through that field's own codec schema. #787 decides which of these
 * a given endpoint accepts; the digest cannot encode anything else.
 */
const PATCHABLE_TASK_KEYS = Object.keys(taskDataSchema.shape) as (keyof TaskData)[];
export type PageTaskPatch = Partial<Record<keyof TaskData, string | number | boolean | null>>;

export type PageRequestInput =
  | { kind: "save"; noteId: string; expectedRevision: number; body: string }
  | {
      kind: "patch_block";
      noteId: string;
      expectedRevision: number;
      blockId: string;
      patch: PageTaskPatch;
    }
  | {
      kind: "add_task";
      noteId: string;
      expectedRevision: number;
      localDate: string;
      task: { title: string; durationMin?: number };
    }
  | { kind: "undo"; noteId: string; targetOperationId: string }
  | {
      kind: "confirm_proposal";
      noteId: string;
      proposalId: string;
      expectedProposalRevision: number;
      expectedPageRevision: number;
      task: { title: string; durationMin?: number };
    };

type EncodedValue = string | number | boolean | null;

function encodeValue(value: EncodedValue): string {
  if (value === null) return "n";
  if (typeof value === "boolean") return value ? "b1" : "b0";
  if (typeof value === "number") return `i${value}`;
  // Length-prefixed in UTF-8 bytes so no content can imitate a field boundary.
  return `s${scanText(value).utf8Bytes}:${value}`;
}

function encodeFields(fields: readonly (readonly [string, EncodedValue])[]): string {
  const lines = fields.map(([name, value]) => `${name}=${encodeValue(value)}`);
  return `tempo-page-request/v${PAGE_REQUEST_ENCODING_VERSION}\n${lines.join("\n")}\n`;
}

function parseTaskPatch(input: unknown): [string, EncodedValue][] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    reject("invalid_shape", "patch");
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) reject("invalid_shape", "patch");
  const keys = Object.keys(input).sort();
  if (keys.length === 0 || keys.length > PATCHABLE_TASK_KEYS.length)
    reject("invalid_shape", "patch");
  return keys.map((key, index) => {
    if (!(PATCHABLE_TASK_KEYS as string[]).includes(key))
      reject("patch_not_allowed", "patch", index);
    const value = (input as Rec)[key];
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      reject("patch_value_invalid", "patch", index);
    }
    if (typeof value === "string" && value.length > BLOCK_CODEC_LIMITS.maxTextChars) {
      reject("patch_value_invalid", "patch", index);
    }
    if (typeof value === "string" && !scanText(value).wellFormed) {
      reject("malformed_text", "patch", index);
    }
    if (typeof value === "number" && (!Number.isSafeInteger(value) || Object.is(value, -0))) {
      reject("patch_value_invalid", "patch", index);
    }
    const parsed = taskDataSchema.shape[key as keyof TaskData].safeParse(value);
    if (!parsed.success || !Object.is(parsed.data, value))
      reject("patch_value_invalid", "patch", index);
    return [`patch.${key}`, value as EncodedValue] as [string, EncodedValue];
  });
}

function encodeRequest(input: unknown): string {
  const head = typeof input === "object" && input !== null ? (input as Rec).kind : undefined;
  const kind = readEnum(head, "kind", [
    "save",
    "patch_block",
    "add_task",
    "undo",
    "confirm_proposal",
  ] as const);
  switch (kind) {
    case "save": {
      const r = snapshot(input, ["kind", "noteId", "expectedRevision", "body"], []);
      return encodeFields([
        ["kind", kind],
        ["noteId", readId<string>(r.noteId, "noteId")],
        ["expectedRevision", readRevision(r.expectedRevision, "expectedRevision")],
        ["body", assertBodyBudget(r.body)],
      ]);
    }
    case "patch_block": {
      const r = snapshot(input, ["kind", "noteId", "expectedRevision", "blockId", "patch"], []);
      if (!isValidBlockId(r.blockId)) reject("invalid_block_id", "blockId");
      return encodeFields([
        ["kind", kind],
        ["noteId", readId<string>(r.noteId, "noteId")],
        ["expectedRevision", readRevision(r.expectedRevision, "expectedRevision")],
        ["blockId", r.blockId],
        ...parseTaskPatch(r.patch),
      ]);
    }
    case "add_task": {
      const r = snapshot(input, ["kind", "noteId", "expectedRevision", "localDate", "task"], []);
      if (!isValidLocalDate(r.localDate)) reject("invalid_local_date", "localDate");
      const task = parseProposalTask(r.task, false, "task");
      return encodeFields([
        ["kind", kind],
        ["noteId", readId<string>(r.noteId, "noteId")],
        ["expectedRevision", readRevision(r.expectedRevision, "expectedRevision")],
        ["localDate", r.localDate],
        ["title", task.title],
        ["durationMin", task.durationMin],
      ]);
    }
    case "undo": {
      // Undo is surgical across later edits, so it carries no expected body revision.
      const r = snapshot(input, ["kind", "noteId", "targetOperationId"], []);
      return encodeFields([
        ["kind", kind],
        ["noteId", readId<string>(r.noteId, "noteId")],
        ["targetOperationId", readId<string>(r.targetOperationId, "targetOperationId")],
      ]);
    }
    case "confirm_proposal": {
      const r = snapshot(
        input,
        [
          "kind",
          "noteId",
          "proposalId",
          "expectedProposalRevision",
          "expectedPageRevision",
          "task",
        ],
        []
      );
      const task = parseProposalTask(r.task, false, "task");
      return encodeFields([
        ["kind", kind],
        ["noteId", readId<string>(r.noteId, "noteId")],
        ["proposalId", readId<string>(r.proposalId, "proposalId")],
        [
          "expectedProposalRevision",
          readSafeInt(r.expectedProposalRevision, "expectedProposalRevision"),
        ],
        ["expectedPageRevision", readSafeInt(r.expectedPageRevision, "expectedPageRevision")],
        ["title", task.title],
        ["durationMin", task.durationMin],
      ]);
    }
  }
}

/**
 * D3: the versioned, explicitly ordered, length-prefixed encoding that is hashed into
 * `requestDigest`. It covers the version, kind, target note, expected body revision (where the
 * kind has one) and the exact submitted body / allowlisted patch / task / confirmation fields. It
 * excludes the request id itself, wall-clock time, retry count and the server-assigned `source`.
 * Nothing is trimmed, normalized or re-serialized; invalid content is rejected, not repaired.
 */
export function encodePageRequest(input: unknown): PageLedgerResult<string> {
  return run(() => encodeRequest(input));
}

/** D3: lowercase SHA-256 hex of `encodePageRequest`. Equal digests mean equal meaningful content. */
export function computePageRequestDigest(input: unknown): Promise<PageLedgerResult<string>> {
  return runAsync(async () => digestWellFormed(encodeRequest(input), "request"));
}

export type RequestAdmission =
  | { readonly decision: "first_use" }
  | { readonly decision: "replay"; readonly operation: PageOperationFacts };

/**
 * D3: decide what an incoming request is, given the `pageOperations` rows the caller found by
 * owner + requestId (an ordinary index, so more than one row is possible and is a failure). Callers
 * run this after auth / active-account / parent-ownership checks and BEFORE comparing the current
 * `expectedRevision`.
 *
 * - One retained row with the same digest and note: `replay` the original receipt. A replay is valid
 *   while `now < metadataExpiresAtMs`; at or after it the key is `request_id_expired`.
 * - One row with a different digest or note: `request_id_reused`. Never a new write.
 * - No row: first-use admission. The ULID timestamp must be within [now - 24h, now + 5min]
 *   (inclusive); older is `request_id_expired`, newer is `request_id_in_future`.
 *
 * Different valid request ids are distinct intents even for identical text (equal digests, no
 * replay). The ULID bound is a replay bound, not trusted client authority.
 */
export function decideRequestAdmission(input: {
  nowMs: number;
  userId: string;
  noteId: string;
  requestId: string;
  requestDigest: string;
  matches: readonly unknown[];
}): PageLedgerResult<RequestAdmission> {
  return run((): RequestAdmission => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const userId = readId<string>(input.userId, "userId");
    const noteId = readId<string>(input.noteId, "noteId");
    if (!isValidRequestId(input.requestId)) reject("invalid_request_id", "requestId");
    const requestDigest = readDigest(input.requestDigest, "requestDigest");
    if (!Array.isArray(input.matches)) reject("invalid_shape", "matches");
    if (input.matches.length > 1) reject("duplicate_request_rows", "matches");
    const [match] = input.matches;
    if (match !== undefined) {
      const operation = parseOperation(match);
      if (operation.deletedAt !== undefined) reject("row_deleted", "deletedAt");
      if (operation.requestId !== input.requestId || operation.userId !== userId) {
        reject("record_mismatch", "requestId");
      }
      if (nowMs >= operation.metadataExpiresAtMs) reject("request_id_expired", "requestId");
      if (operation.requestDigest !== requestDigest || operation.noteId !== noteId) {
        reject("request_id_reused", "requestId");
      }
      return { decision: "replay", operation };
    }
    const issuedAt = ulidTimestampMs(input.requestId.slice(4)) as number;
    if (issuedAt < nowMs - PAGE_LEDGER_TIMING.requestMaxAgeMs)
      reject("request_id_expired", "requestId");
    if (issuedAt > nowMs + PAGE_LEDGER_TIMING.requestMaxFutureMs) {
      reject("request_id_in_future", "requestId");
    }
    return { decision: "first_use" };
  });
}

// ---------------------------------------------------------------------------------------------
// D5 deadlines and eligibility (explicit time, decisions only)
// ---------------------------------------------------------------------------------------------

export type OperationDeadlines = {
  undoUntilMs: number;
  cleanupDueAtMs: number;
  metadataExpiresAtMs: number;
};

/**
 * D5: server-set deadlines for an operation applied at `appliedAtMs`: Undo until +5 minutes,
 * payload cleanup due 5 minutes after that, receipt metadata until +48 hours.
 */
export function operationDeadlines(appliedAtMs: number): PageLedgerResult<OperationDeadlines> {
  return run(() => {
    const applied = readTimestamp(appliedAtMs, "appliedAtMs");
    const undoUntilMs = addMs(applied, PAGE_LEDGER_TIMING.undoWindowMs, "undoUntilMs");
    return {
      undoUntilMs,
      cleanupDueAtMs: addMs(undoUntilMs, PAGE_LEDGER_TIMING.cleanupGraceMs, "cleanupDueAtMs"),
      metadataExpiresAtMs: addMs(
        applied,
        PAGE_LEDGER_TIMING.receiptRetentionMs,
        "metadataExpiresAtMs"
      ),
    };
  });
}

export type ProposalDeadlines = {
  proposalExpiresAtMs: number;
  cleanupDueAtMs: number;
  metadataExpiresAtMs: number;
};

/**
 * D5: deadlines of a new pending proposal: content for 24 hours, cleanup due 5 minutes later,
 * receipt metadata for 48 hours from creation.
 */
export function proposalDeadlinesAtCreation(
  createdAtMs: number
): PageLedgerResult<ProposalDeadlines> {
  return run(() => {
    const created = readTimestamp(createdAtMs, "createdAtMs");
    const proposalExpiresAtMs = addMs(
      created,
      PAGE_LEDGER_TIMING.proposalLifetimeMs,
      "proposalExpiresAtMs"
    );
    return {
      proposalExpiresAtMs,
      cleanupDueAtMs: addMs(
        proposalExpiresAtMs,
        PAGE_LEDGER_TIMING.cleanupGraceMs,
        "cleanupDueAtMs"
      ),
      metadataExpiresAtMs: addMs(
        created,
        PAGE_LEDGER_TIMING.receiptRetentionMs,
        "metadataExpiresAtMs"
      ),
    };
  });
}

/**
 * D5: rejection or cancellation expires content access immediately (`proposalExpiresAtMs` becomes
 * the decision time) and schedules cleanup within the same five-minute technical grace. The
 * existing receipt metadata deadline is kept.
 */
export function proposalDeadlinesAfterDecision(
  proposal: unknown,
  decidedAtMs: number
): PageLedgerResult<ProposalDeadlines> {
  return run(() => {
    const parsed = parseProposal(proposal);
    const decided = readTimestamp(decidedAtMs, "decidedAtMs");
    return {
      proposalExpiresAtMs: decided,
      cleanupDueAtMs: addMs(decided, PAGE_LEDGER_TIMING.cleanupGraceMs, "cleanupDueAtMs"),
      metadataExpiresAtMs: parsed.metadataExpiresAtMs,
    };
  });
}

/**
 * D5: a confirmed proposal's content expires with its operation's Undo window, cleanup follows by
 * the grace, and the receipt metadata deadline is extended to at least the operation's, so a late
 * valid confirmation keeps its receipt.
 */
export function proposalDeadlinesAfterConfirmation(
  proposal: unknown,
  operation: unknown
): PageLedgerResult<ProposalDeadlines> {
  return run(() => {
    const parsedProposal = parseProposal(proposal);
    const parsedOperation = parseOperation(operation);
    if (parsedOperation.undoUntilMs === undefined) reject("state_invariant", "undoUntilMs");
    return {
      proposalExpiresAtMs: parsedOperation.undoUntilMs,
      cleanupDueAtMs: addMs(
        parsedOperation.undoUntilMs,
        PAGE_LEDGER_TIMING.cleanupGraceMs,
        "cleanupDueAtMs"
      ),
      metadataExpiresAtMs: Math.max(
        parsedProposal.metadataExpiresAtMs,
        parsedOperation.metadataExpiresAtMs
      ),
    };
  });
}

/** D5: Undo is eligible for `appliedAtMs <= now < undoUntilMs` (inclusive start, exclusive end). */
export function isUndoEligible(appliedAtMs: number, undoUntilMs: number, nowMs: number): boolean {
  return (
    isValidTimestampMs(appliedAtMs) &&
    isValidTimestampMs(undoUntilMs) &&
    isValidTimestampMs(nowMs) &&
    appliedAtMs <= nowMs &&
    nowMs < undoUntilMs
  );
}

/** D5: cleanup is due at `now >= cleanupDueAtMs` (inclusive). A decision only; nothing is deleted. */
export function isCleanupDue(cleanupDueAtMs: number, nowMs: number): boolean {
  return isValidTimestampMs(cleanupDueAtMs) && isValidTimestampMs(nowMs) && nowMs >= cleanupDueAtMs;
}

/** D5: a receipt is past its retention at `now >= metadataExpiresAtMs`. */
export function isMetadataExpired(metadataExpiresAtMs: number, nowMs: number): boolean {
  return (
    isValidTimestampMs(metadataExpiresAtMs) &&
    isValidTimestampMs(nowMs) &&
    nowMs >= metadataExpiresAtMs
  );
}

/**
 * D5: inverse fragments are readable only while Undo is eligible, even when cleanup is late: the
 * payload must be `available` and `now < undoUntilMs`. Invalid input is not readable.
 */
export function isUndoPayloadReadable(payload: unknown, nowMs: number): boolean {
  const parsed = validatePageOperationPayloadFacts(payload);
  return (
    parsed.ok &&
    isValidTimestampMs(nowMs) &&
    parsed.value.deletedAt === undefined &&
    parsed.value.payload.state === "available" &&
    nowMs < parsed.value.undoUntilMs
  );
}

/**
 * D5: proposal content is readable only for a pending or confirmed proposal with an `available`
 * payload and `now < proposalExpiresAtMs`. Rejected, cancelled and expired proposals are never
 * readable, even before cleanup runs.
 */
export function isProposalContentReadable(proposal: unknown, nowMs: number): boolean {
  const parsed = validatePageProposalFacts(proposal);
  return (
    parsed.ok &&
    isValidTimestampMs(nowMs) &&
    parsed.value.deletedAt === undefined &&
    (parsed.value.status === "pending" || parsed.value.status === "confirmed") &&
    parsed.value.payload.state === "available" &&
    nowMs < parsed.value.proposalExpiresAtMs
  );
}

export type UndoRequestDecision =
  | { readonly decision: "eligible" }
  | { readonly decision: "already_undone"; readonly undoOperationId: string };

/**
 * D5: whether a (validated, authorized) target operation may be undone now. An already-undone
 * operation answers with the id of the Undo that did it, so an authorized retry returns the previous
 * result with no second write; that answer lasts while the receipt is retained. Otherwise the target
 * must be an applied, non-undo, body-changing operation inside its window. Expiry is reported as
 * expiry, never as a conflict.
 */
export function decideUndoRequest(input: {
  nowMs: number;
  target: unknown;
}): PageLedgerResult<UndoRequestDecision> {
  return run((): UndoRequestDecision => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const target = parseOperation(input.target);
    return decideUndoTarget(target, nowMs);
  });
}

function decideUndoTarget(target: PageOperationFacts, nowMs: number): UndoRequestDecision {
  if (target.deletedAt !== undefined) reject("row_deleted", "deletedAt");
  if (target.kind === "undo" || target.result !== "applied" || !target.affectsBody) {
    reject("undo_not_undoable", "kind");
  }
  if (target.undoneAtMs !== undefined) {
    if (nowMs >= target.metadataExpiresAtMs) reject("undo_receipt_expired", "metadataExpiresAtMs");
    return { decision: "already_undone", undoOperationId: target.undoneByOperationId as string };
  }
  if (nowMs < target.appliedAtMs) reject("undo_not_open", "appliedAtMs");
  if (nowMs >= (target.undoUntilMs as number)) reject("undo_expired", "undoUntilMs");
  return { decision: "eligible" };
}

export type ProposalConfirmationDecision =
  | { readonly decision: "confirm" }
  | { readonly decision: "replay"; readonly confirmedOperationId: string };

/**
 * D3: whether a confirmation may proceed, with the two revisions kept distinct.
 * `expectedProposalRevision` (from the caller) guards an edited or replaced proposal against the
 * stored `proposalRevision`; the proposal's stored `expectedPageRevision` guards the target page
 * against the note's current revision. A stale page needs a fresh preview and is never applied to
 * the newer page. Order: an already-confirmed proposal replays (same `confirmDigest`) or is
 * `proposal_confirm_changed` while `now < metadataExpiresAtMs`, and at or after it is
 * `request_id_expired`; rejected / cancelled / expired status, a spent content window or an
 * expired payload cannot write; then the proposal guard, then the page guard.
 */
export function decideProposalConfirmation(input: {
  nowMs: number;
  proposal: unknown;
  expectedProposalRevision: number;
  noteRevision: unknown;
  confirmDigest: string;
}): PageLedgerResult<ProposalConfirmationDecision> {
  return run((): ProposalConfirmationDecision => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const proposal = parseProposal(input.proposal);
    const expectedProposalRevision = readSafeInt(
      input.expectedProposalRevision,
      "expectedProposalRevision"
    );
    const currentRevision =
      input.noteRevision === undefined ? 0 : readRevision(input.noteRevision, "revision");
    const confirmDigest = readDigest(input.confirmDigest, "confirmDigest");
    if (proposal.deletedAt !== undefined) reject("row_deleted", "deletedAt");
    if (proposal.status === "confirmed") {
      // D3: like a request replay, a confirmation replay lasts only while its receipt is retained.
      if (nowMs >= proposal.metadataExpiresAtMs)
        reject("request_id_expired", "metadataExpiresAtMs");
      if (proposal.confirmDigest !== confirmDigest)
        reject("proposal_confirm_changed", "confirmDigest");
      return { decision: "replay", confirmedOperationId: proposal.confirmedOperationId as string };
    }
    if (proposal.status !== "pending") reject("proposal_not_pending", "status");
    if (proposal.payload.state !== "available" || nowMs >= proposal.proposalExpiresAtMs) {
      reject("proposal_expired", "proposalExpiresAtMs");
    }
    if (expectedProposalRevision !== proposal.proposalRevision) {
      reject("proposal_revision_stale", "expectedProposalRevision");
    }
    if (proposal.expectedPageRevision !== currentRevision) {
      reject("page_revision_stale", "expectedPageRevision");
    }
    return { decision: "confirm" };
  });
}

// ---------------------------------------------------------------------------------------------
// D4 write planning
// ---------------------------------------------------------------------------------------------

export type BodyChangePlan = {
  /** The immutable receipt facts (revisions, digests, delta) for the operation row. */
  facts: BodyChangeFacts;
  /** Exact fragments for the payload row; empty for a noop. Offsets index the base body. */
  splices: PageSplice[];
  /** The candidate body for the note, to be written in the same transaction. */
  resultBody: string;
  /** What the canonical codec found when the candidate was re-parsed. */
  codec: CodecSummary;
};

async function finishChange(
  before: string,
  splices: PageSplice[],
  baseRevision: number
): Promise<BodyChangePlan> {
  assertSplicesFitBase(before, splices);
  const baseBodyDigest = await digestWellFormed(before, "body");
  if (splices.length === 0) {
    return {
      facts: {
        result: "noop",
        affectsBody: false,
        baseRevision,
        resultRevision: baseRevision,
        baseBodyDigest,
        resultBodyDigest: baseBodyDigest,
        delta: [],
      },
      splices: [],
      resultBody: before,
      codec: summarizeCodec(before),
    };
  }
  const resultRevision = advanceRevision(baseRevision);
  const resultBody = assertBodyBudget(assembleSplices(before, splices));
  const codec = summarizeCodec(resultBody);
  return {
    facts: {
      result: "applied",
      affectsBody: true,
      baseRevision,
      resultRevision,
      baseBodyDigest,
      resultBodyDigest: await digestWellFormed(resultBody, "body"),
      delta: deltaOf(splices),
    },
    splices,
    resultBody,
    codec,
  };
}

/**
 * D1/D4: plan an arbitrary whole-body save. The change is one exact replacement hunk from the
 * linear prefix/suffix diff, never a text search. `after` must satisfy `checkBodyBudget`; `before`
 * is the existing body (a legacy body larger than the write budget stays readable and only has to
 * stay inside the codec limit). Identical bodies plan a noop that still reserves the request
 * identity and does not advance the revision. Fails before any mutation if the revision would
 * overflow or the hunk exceeds the fragment or serialized-payload budget.
 */
export function planBodyChange(input: {
  before: string;
  after: string;
  noteRevision: unknown;
}): Promise<PageLedgerResult<BodyChangePlan>> {
  return runAsync(async () => {
    const before = assertExistingBody(input.before, "before");
    // A byte-identical save is a noop of an existing body, so an oversized legacy body is not
    // rejected for being unchanged; every body that would be WRITTEN must meet the budget.
    const after = input.after === input.before ? before : assertBodyBudget(input.after);
    const baseRevision =
      input.noteRevision === undefined ? 0 : readRevision(input.noteRevision, "revision");
    const splices = diffToSingleSplice(before, after);
    // The hunk must itself satisfy every splice bound before it can become a payload.
    parseSpliceList(splices, "splices");
    const plan = await finishChange(before, splices, baseRevision);
    if (plan.resultBody !== after) reject("state_invariant", "body");
    return plan;
  });
}

/**
 * D4: plan a change from exact, caller-derived splices (for example an appended task block or one
 * block's source segment), so a precisely known target is addressed by offset and never found by
 * text search. The splices must be sorted, non-overlapping, non-touching, in range, must not split
 * a surrogate pair, and every `removedText` must equal the exact base slice. An empty list is a
 * noop. All-or-nothing: any invalid splice rejects the whole plan.
 */
export function planSpliceChange(input: {
  before: string;
  splices: unknown;
  noteRevision: unknown;
}): Promise<PageLedgerResult<BodyChangePlan>> {
  return runAsync(async () => {
    const before = assertExistingBody(input.before, "before");
    const splices = parseSpliceList(input.splices, "splices");
    const baseRevision =
      input.noteRevision === undefined ? 0 : readRevision(input.noteRevision, "revision");
    return finishChange(before, splices, baseRevision);
  });
}

// ---------------------------------------------------------------------------------------------
// D4 chain validation and the conservative interval transform
// ---------------------------------------------------------------------------------------------

export type Interval = { start: number; end: number };

/**
 * D4 transform of one inverse target interval across a later operation's delta (sorted base
 * offsets of that operation). A later edit strictly before the interval (its span ends before the
 * interval starts) shifts it by the edit's length change; one strictly after (it starts after the
 * interval ends) leaves it alone; anything else conflicts: an insertion inside a nonempty interval,
 * any touching replacement or deletion, an insertion exactly at either edge, or any edit touching a
 * zero-width restore anchor. Returns `undefined` on conflict. No similar-text search, no nearby guess.
 */
export function transformIntervalAcrossDelta(
  interval: Interval,
  delta: readonly PageDeltaEntry[]
): Interval | undefined {
  let shift = 0;
  for (const entry of delta) {
    const editStart = entry.startUtf16;
    const editEnd = entry.startUtf16 + entry.removedLengthUtf16;
    if (editEnd < interval.start) {
      shift += entry.insertedLengthUtf16 - entry.removedLengthUtf16;
    } else if (editStart > interval.end) {
      break;
    } else {
      return undefined;
    }
  }
  return { start: interval.start + shift, end: interval.end + shift };
}

/**
 * D4: validate the gap-free, hash-linked metadata chain between a target operation and the current
 * body. `intervening` is the caller's `take(257)` of owner/page-scoped, `affectsBody = true`,
 * ascending `pageOperations` with `resultRevision` > the target's. Requirements: at most 256
 * entries and `currentRevision - target.resultRevision <= 256`; exactly one entry for each revision
 * target.resultRevision + 1 .. currentRevision, none missing, repeated, soft-deleted or malformed;
 * same owner and note; each entry applied and body-changing; each base digest equals the previous
 * result digest; the last result digest equals `currentBodyDigest`. Digests never replace
 * ownership, span or chain validation, and the metadata alone cannot reconstruct a historical body.
 */
export function validateOperationChain(input: {
  target: unknown;
  intervening: readonly unknown[];
  currentRevision: number;
  currentBodyDigest: string;
}): PageLedgerResult<PageOperationFacts[]> {
  return run(() => {
    const target = parseOperation(input.target);
    return assertChain(
      target,
      input.intervening,
      readRevision(input.currentRevision, "revision"),
      readDigest(input.currentBodyDigest, "currentBodyDigest")
    );
  });
}

function assertChain(
  target: PageOperationFacts,
  intervening: readonly unknown[],
  currentRevision: number,
  currentBodyDigest: string
): PageOperationFacts[] {
  if (!Array.isArray(intervening)) reject("invalid_shape", "intervening");
  const expectedCount = currentRevision - target.resultRevision;
  if (
    expectedCount > PAGE_LEDGER_LIMITS.maxInterveningRevisions ||
    intervening.length > PAGE_LEDGER_LIMITS.maxInterveningRevisions
  ) {
    reject("too_many_intervening_revisions", "intervening");
  }
  if (expectedCount < 0) reject("chain_revision_mismatch", "revision");
  if (intervening.length < expectedCount) reject("chain_incomplete", "intervening");
  if (intervening.length > expectedCount) reject("chain_excess", "intervening");

  const chain: PageOperationFacts[] = [];
  let previousDigest = target.resultBodyDigest;
  intervening.forEach((raw: unknown, index: number) => {
    let entry: PageOperationFacts;
    try {
      entry = parseOperation(raw);
    } catch (error) {
      if (error instanceof LedgerReject) reject("chain_entry_malformed", "intervening", index);
      throw error;
    }
    if (entry.deletedAt !== undefined) reject("chain_entry_deleted", "intervening", index);
    if (entry.userId !== target.userId || entry.noteId !== target.noteId) {
      reject("record_mismatch", "intervening", index);
    }
    if (entry.result !== "applied" || !entry.affectsBody) {
      reject("chain_entry_malformed", "intervening", index);
    }
    const expectedRevision = target.resultRevision + 1 + index;
    if (entry.resultRevision < expectedRevision) reject("chain_duplicate", "intervening", index);
    if (entry.resultRevision > expectedRevision) reject("chain_gap", "intervening", index);
    if (entry.baseBodyDigest !== previousDigest) reject("chain_hash_link", "intervening", index);
    if (
      entry.kind === "undo" &&
      target._id !== undefined &&
      entry.undoOfOperationId === target._id
    ) {
      // The target would have to be marked undone; an unmarked target is an inconsistent ledger.
      reject("chain_inconsistent", "intervening", index);
    }
    previousDigest = entry.resultBodyDigest;
    chain.push(entry);
  });
  if (previousDigest !== currentBodyDigest)
    reject("current_body_digest_mismatch", "currentBodyDigest");
  return chain;
}

export type UndoPlan = {
  /** The Undo operation's receipt facts (applied, one revision after `currentRevision`). */
  facts: BodyChangeFacts;
  /** The target operation this Undo reverses; stored as `undoOfOperationId`. */
  targetOperationId: string;
  /** The candidate body for the note, to be written in the same transaction. */
  candidateBody: string;
  codec: CodecSummary;
  /** Number of intervening body-changing revisions that were transformed across. */
  interveningCount: number;
};

/**
 * D4/D5: plan a surgical Undo of one applied operation, or fail closed. Everything the plan needs
 * is supplied: explicit `nowMs`, the note's stored `revision` (missing = 0), the current body, the
 * target operation + its payload, and the intervening operations (`take(257)`).
 *
 * 1. The target must be undoable and inside its window; its payload must be `available`, readable
 *    and consistent with the operation (`validateOperationPayloadPair`).
 * 2. The chain must be gap-free and hash-linked up to a body whose SHA-256 is recomputed here and
 *    compared with the last result digest, within the 256-revision bound.
 * 3. Each target hunk becomes an interval in the target's result coordinates, is transformed
 *    across every later delta (`transformIntervalAcrossDelta`), then the exact current slice is
 *    compared with the originally inserted text before it is replaced by the removed text. Any
 *    hunk that conflicts fails the whole plan: nothing is applied partially and nothing falls back
 *    to restoring a whole earlier body.
 * 4. The candidate must satisfy the write budget and re-parse losslessly with the canonical codec.
 *
 * A successful plan is a candidate, not a write: the committing mutation must recheck ownership,
 * live state, the current revision and digest, then update body, derived index, revision and the
 * Undo receipt (marking the target undone) atomically.
 */
export function planUndo(input: {
  nowMs: number;
  /** The owner and page the caller scoped every fetched row to; each row must agree. */
  userId: string;
  noteId: string;
  noteRevision: unknown;
  currentBody: string;
  target: { operation: unknown; payload: unknown };
  intervening: readonly unknown[];
}): Promise<PageLedgerResult<UndoPlan>> {
  return runAsync(async () => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const currentRevision =
      input.noteRevision === undefined ? 0 : readRevision(input.noteRevision, "revision");
    const currentBody = assertExistingBody(input.currentBody, "currentBody");
    const targetRows = snapshot(input.target, ["operation"], ["payload"]);
    const operation = parseOperation(targetRows.operation);
    // Defense in depth for a mis-scoped fetch. This is not authorization.
    if (
      operation.userId !== readId<string>(input.userId, "userId") ||
      operation.noteId !== readId<string>(input.noteId, "noteId")
    ) {
      reject("record_mismatch", "operation");
    }
    // Eligibility first: a noop, an undo receipt, an undone, expired or deleted target is reported
    // as such even when its payload is already gone.
    const decision = decideUndoTarget(operation, nowMs);
    if (decision.decision === "already_undone") reject("undo_already_undone", "undoneAtMs");
    if (targetRows.payload === undefined) reject("missing_field", "payload");
    const payload = parsePayloadRow(targetRows.payload);
    assertPayloadMatchesOperation(operation, payload);
    if (payload.deletedAt !== undefined) reject("row_deleted", "deletedAt");
    if (payload.payload.state !== "available" || nowMs >= payload.undoUntilMs) {
      reject("undo_payload_expired", "payload");
    }
    const splices = payload.payload.splices;

    const currentBodyDigest = await digestWellFormed(currentBody, "currentBody");
    const chain = assertChain(operation, input.intervening, currentRevision, currentBodyDigest);
    const resultRevision = advanceRevision(currentRevision);

    // Each target hunk, as an interval in the target's result coordinates.
    let shift = 0;
    const intervals: { interval: Interval; splice: PageSplice }[] = splices.map((splice) => {
      const start = splice.startUtf16 + shift;
      shift += splice.insertedText.length - splice.removedText.length;
      return { interval: { start, end: start + splice.insertedText.length }, splice };
    });

    const transformed = intervals.map(({ interval, splice }, index) => {
      let moved: Interval | undefined = interval;
      for (const later of chain) {
        moved = transformIntervalAcrossDelta(moved, later.delta);
        if (moved === undefined) reject("conflict_overlapping_edit", "intervening", index);
      }
      if (moved.end > currentBody.length) reject("conflict_target_changed", "splices", index);
      if (
        splitsSurrogatePair(currentBody, moved.start) ||
        splitsSurrogatePair(currentBody, moved.end)
      ) {
        reject("conflict_target_changed", "splices", index);
      }
      // The exact current slice must still be what the original operation inserted.
      if (currentBody.slice(moved.start, moved.end) !== splice.insertedText) {
        reject("conflict_target_changed", "splices", index);
      }
      return { interval: moved, splice };
    });
    for (let i = 1; i < transformed.length; i += 1) {
      const previous = (transformed[i - 1] as (typeof transformed)[number]).interval;
      const current = (transformed[i] as (typeof transformed)[number]).interval;
      if (current.start <= previous.end) reject("conflict_overlapping_edit", "splices", i);
    }

    const undoSplices: PageSplice[] = transformed.map(({ interval, splice }) => ({
      startUtf16: interval.start,
      removedText: splice.insertedText,
      insertedText: splice.removedText,
    }));
    const candidateBody = assembleSplices(currentBody, undoSplices);
    if (candidateBody.length > PAGE_LEDGER_LIMITS.maxBodyUtf16Units) {
      reject("inverse_body_too_large", "body");
    }
    const candidateScan = scanText(candidateBody);
    if (!candidateScan.wellFormed) reject("malformed_text", "body");
    if (candidateScan.utf8Bytes > PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes) {
      reject("inverse_body_too_large", "body");
    }
    const codec = summarizeCodec(candidateBody);
    const delta = deltaOf(undoSplices);
    // The Undo is itself an operation row: its delta must satisfy every delta invariant.
    parseDeltaList(delta, "delta");

    return {
      facts: {
        result: "applied",
        affectsBody: true,
        baseRevision: currentRevision,
        resultRevision,
        baseBodyDigest: currentBodyDigest,
        resultBodyDigest: await digestWellFormed(candidateBody, "body"),
        delta,
      },
      targetOperationId: operation._id as string,
      candidateBody,
      codec,
      interveningCount: chain.length,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Row builders (validated insert candidates / the single transition to undone)
// ---------------------------------------------------------------------------------------------

/**
 * Build the `pageOperations` insert candidate for a body change or an Undo and validate it with the
 * same rules as a stored row. `kind: "undo"` requires `undoOfOperationId`; other kinds must not
 * carry it. The deadlines come from `nowMs` (the server-set `appliedAtMs`); an `undoUntilMs` is
 * added only for an applied non-undo operation.
 */
export function buildOperationFacts(input: {
  userId: string;
  noteId: string;
  requestId: string;
  requestDigest: string;
  kind: PageOperationKind;
  source: PageOperationSource;
  change: BodyChangeFacts;
  nowMs: number;
  proposalId?: string;
  undoOfOperationId?: string;
}): PageLedgerResult<PageOperationFacts> {
  return run(() => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const deadlines = (() => {
      const undoUntilMs = addMs(nowMs, PAGE_LEDGER_TIMING.undoWindowMs, "undoUntilMs");
      return {
        undoUntilMs,
        metadataExpiresAtMs: addMs(
          nowMs,
          PAGE_LEDGER_TIMING.receiptRetentionMs,
          "metadataExpiresAtMs"
        ),
      };
    })();
    const withUndoWindow = input.change.result === "applied" && input.kind !== "undo";
    return parseOperation({
      userId: input.userId,
      noteId: input.noteId,
      requestId: input.requestId,
      requestDigest: input.requestDigest,
      kind: input.kind,
      source: input.source,
      result: input.change.result,
      affectsBody: input.change.affectsBody,
      baseRevision: input.change.baseRevision,
      resultRevision: input.change.resultRevision,
      baseBodyDigest: input.change.baseBodyDigest,
      resultBodyDigest: input.change.resultBodyDigest,
      delta: input.change.delta,
      appliedAtMs: nowMs,
      ...(withUndoWindow ? { undoUntilMs: deadlines.undoUntilMs } : {}),
      ...(input.undoOfOperationId === undefined
        ? {}
        : { undoOfOperationId: input.undoOfOperationId }),
      ...(input.proposalId === undefined ? {} : { proposalId: input.proposalId }),
      metadataExpiresAtMs: deadlines.metadataExpiresAtMs,
      createdAt: nowMs,
      updatedAt: nowMs,
    });
  });
}

/**
 * Build the `pageOperationPayloads` insert candidate for an applied, non-undo operation (already
 * inserted, so its `_id` is known) and validate that the pair agree. The payload is `available`,
 * with `cleanupDueAtMs` exactly `undoUntilMs` + 5 minutes. No payload exists for a noop or undo.
 */
export function buildPayloadFacts(input: {
  operation: unknown;
  splices: unknown;
  nowMs: number;
}): PageLedgerResult<PageOperationPayloadFacts> {
  return run(() => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const operation = parseOperation(input.operation);
    if (operation.undoUntilMs === undefined) reject("state_invariant", "undoUntilMs");
    const row = parsePayloadRow({
      userId: operation.userId,
      noteId: operation.noteId,
      operationId: operation._id,
      undoUntilMs: operation.undoUntilMs,
      cleanupDueAtMs: addMs(
        operation.undoUntilMs,
        PAGE_LEDGER_TIMING.cleanupGraceMs,
        "cleanupDueAtMs"
      ),
      payload: { state: "available", splices: input.splices },
      createdAt: nowMs,
      updatedAt: nowMs,
    });
    assertPayloadMatchesOperation(operation, row);
    return row;
  });
}

/**
 * The single immutable-fact transition: mark an eligible target as undone by an Undo operation.
 * Re-checks eligibility at `nowMs` and returns the validated updated row; the caller patches
 * exactly `undoneAtMs`, `undoneByOperationId` and `updatedAt`.
 */
export function markOperationUndone(input: {
  target: unknown;
  undoOperationId: string;
  nowMs: number;
}): PageLedgerResult<PageOperationFacts> {
  return run(() => {
    const nowMs = readTimestamp(input.nowMs, "nowMs");
    const target = parseOperation(input.target);
    const decision = decideUndoTarget(target, nowMs);
    if (decision.decision === "already_undone") reject("undo_already_undone", "undoneAtMs");
    return parseOperation({
      ...target,
      undoneAtMs: nowMs,
      undoneByOperationId: readId<string>(input.undoOperationId, "undoOperationId"),
      updatedAt: Math.max(target.updatedAt, nowMs),
    });
  });
}
