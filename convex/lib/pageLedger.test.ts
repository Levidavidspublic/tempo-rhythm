import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { ACCOUNT_RESTORE_GRACE_MS } from "./accountDeletion";
import { BLOCK_CODEC_LIMITS, parseTempoBlocks, serializeTempoBlocks } from "./blocks";
import {
  applyPageSplices,
  buildOperationFacts,
  buildPayloadFacts,
  checkBodyBudget,
  checkExpectedRevision,
  computePageRequestDigest,
  decideProposalConfirmation,
  decideRequestAdmission,
  decideUndoRequest,
  diffToSingleSplice,
  digestBody,
  effectiveRevision,
  encodePageRequest,
  invertPageSplices,
  isCleanupDue,
  isMetadataExpired,
  isProposalContentReadable,
  isUndoEligible,
  isUndoPayloadReadable,
  isValidBlockId,
  isValidLocalDate,
  isValidRequestId,
  isValidSha256Hex,
  isValidUlid,
  markOperationUndone,
  nextRevision,
  operationDeadlines,
  PAGE_LEDGER_LIMITS,
  PAGE_LEDGER_TIMING,
  type PageLedgerErrorCode,
  type PageLedgerResult,
  type PageOperationFacts,
  type PageOperationKind,
  type PageOperationPayloadFacts,
  type PageSplice,
  planBodyChange,
  planSpliceChange,
  planUndo,
  proposalDeadlinesAfterConfirmation,
  proposalDeadlinesAfterDecision,
  proposalDeadlinesAtCreation,
  sha256Hex,
  transformIntervalAcrossDelta,
  ulidTimestampMs,
  utf8ByteLength,
  validateOperationChain,
  validateOperationPayloadPair,
  validatePageDelta,
  validatePageOperationFacts,
  validatePageOperationPayloadFacts,
  validatePageProposalFacts,
  validatePageSplices,
  validateProposalTaskInput,
} from "./pageLedger";
import schema from "../schema";

// ---------------------------------------------------------------------------------------------
// Synthetic fixtures. Nothing here is real note content, a real id or a real key.
// ---------------------------------------------------------------------------------------------

const NOW = Date.UTC(2026, 9, 11, 12, 0, 0);
const MIN = 60_000;
const HOUR = 3_600_000;
const USER = "user_1";
const NOTE = "note_1";
const OTHER_NOTE = "note_2";
const HEX_A = "a".repeat(64);
const HEX_B = "b".repeat(64);
const HEX_C = "c".repeat(64);
const BLOCK_A = "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6";
const BLOCK_B = "blk_01K5F3Z8Q4E1N3P5R7T9V1X3Z5";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulidAt(ms: number, tail = "ABCDEFGHJKMNPQRS"): string {
  let head = "";
  let remaining = ms;
  for (let i = 0; i < 10; i += 1) {
    head = CROCKFORD.charAt(remaining % 32) + head;
    remaining = Math.floor(remaining / 32);
  }
  return head + tail;
}
const requestIdAt = (ms: number) => `req_${ulidAt(ms)}`;
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

function ok<T>(result: PageLedgerResult<T>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.code} (${result.field ?? "-"})`);
  return result.value;
}
function fail(result: PageLedgerResult<unknown>, code: PageLedgerErrorCode, field?: string) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe(code);
  if (field !== undefined) expect(result.field).toBe(field);
}
const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function taskFence(id: string, title: string, status = "now", order = 1, doneAt?: string): string {
  const data = {
    title,
    status,
    order,
    inelastic: false,
    ...(doneAt === undefined ? {} : { doneAt }),
  };
  return `\`\`\`json tempo\n${JSON.stringify({ type: "task", id, v: 1, data })}\n\`\`\`\n`;
}

function operationRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: USER,
    noteId: NOTE,
    requestId: requestIdAt(NOW - 1_000),
    requestDigest: HEX_A,
    kind: "save",
    source: "ui",
    result: "applied",
    affectsBody: true,
    baseRevision: 0,
    resultRevision: 1,
    baseBodyDigest: HEX_B,
    resultBodyDigest: HEX_C,
    delta: [{ startUtf16: 3, removedLengthUtf16: 2, insertedLengthUtf16: 4 }],
    appliedAtMs: NOW,
    undoUntilMs: NOW + 5 * MIN,
    metadataExpiresAtMs: NOW + 48 * HOUR,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
const noopRow = (overrides: Record<string, unknown> = {}) =>
  operationRow({
    result: "noop",
    affectsBody: false,
    resultRevision: 0,
    resultBodyDigest: HEX_B,
    delta: [],
    undoUntilMs: undefined,
    ...overrides,
  });
const undoRow = (overrides: Record<string, unknown> = {}) =>
  operationRow({ kind: "undo", undoOfOperationId: "op_1", undoUntilMs: undefined, ...overrides });

function payloadRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: USER,
    noteId: NOTE,
    operationId: "op_1",
    undoUntilMs: NOW + 5 * MIN,
    cleanupDueAtMs: NOW + 10 * MIN,
    payload: {
      state: "available",
      splices: [{ startUtf16: 3, removedText: "ab", insertedText: "wxyz" }],
    },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function proposalRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: USER,
    kind: "add_task_to_today",
    schemaVersion: 1,
    noteId: NOTE,
    localDate: "2026-10-11",
    conversationId: "conv_1",
    sourceRequestKey: "chat-key_1",
    proposalRevision: 0,
    expectedPageRevision: 3,
    blockId: BLOCK_A,
    status: "pending",
    proposalExpiresAtMs: NOW + 24 * HOUR,
    cleanupDueAtMs: NOW + 24 * HOUR + 5 * MIN,
    metadataExpiresAtMs: NOW + 48 * HOUR,
    payload: { state: "available", task: { title: "Email supervisor", durationMin: 15 } },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------------------------
// A minimal in-memory ledger that drives the helper the way #787 will: plan, build the receipt and
// payload rows, "write", then (after a JSON round trip, as if reloaded) plan an Undo.
// ---------------------------------------------------------------------------------------------

class Ledger {
  body: string;
  revision: number | undefined;
  ops: PageOperationFacts[] = [];
  payloads = new Map<string, PageOperationPayloadFacts>();
  private sequence = 0;

  constructor(body: string, revision?: number) {
    this.body = body;
    this.revision = revision;
  }

  async apply(
    change: { after: string } | { splices: PageSplice[] },
    nowMs = NOW,
    kind: PageOperationKind = "save"
  ) {
    const plan = ok(
      "after" in change
        ? await planBodyChange({
            before: this.body,
            after: change.after,
            noteRevision: this.revision,
          })
        : await planSpliceChange({
            before: this.body,
            splices: change.splices,
            noteRevision: this.revision,
          })
    );
    this.sequence += 1;
    const built = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(nowMs - this.sequence),
        requestDigest: sha(`request-${this.sequence}`),
        kind,
        source: "ui",
        change: plan.facts,
        nowMs,
      })
    );
    const op = { ...built, _id: `op_${this.sequence}` } as unknown as PageOperationFacts;
    this.ops.push(op);
    if (plan.facts.result === "applied") {
      const payload = ok(buildPayloadFacts({ operation: op, splices: plan.splices, nowMs }));
      this.payloads.set(
        op._id as string,
        {
          ...payload,
          _id: `pl_${this.sequence}`,
        } as unknown as PageOperationPayloadFacts
      );
      this.body = plan.resultBody;
      this.revision = plan.facts.resultRevision;
    }
    return { op, plan };
  }

  /** Plan, "commit" and record an Undo exactly as a mutation would, marking the target undone. */
  async undo(id: string, nowMs: number) {
    const plan = ok(await planUndo(this.undoInput(id, nowMs)));
    this.sequence += 1;
    const built = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(nowMs - this.sequence),
        requestDigest: sha(`undo-${this.sequence}`),
        kind: "undo",
        source: "ui",
        change: plan.facts,
        nowMs,
        undoOfOperationId: id,
      })
    );
    const op = { ...built, _id: `op_${this.sequence}` } as unknown as PageOperationFacts;
    const marked = ok(
      markOperationUndone({ target: this.target(id), undoOperationId: op._id as string, nowMs })
    );
    this.ops[this.ops.findIndex((existing) => existing._id === id)] = marked;
    this.ops.push(op);
    this.body = plan.candidateBody;
    this.revision = plan.facts.resultRevision;
    return { op, plan };
  }

  target(id: string): PageOperationFacts {
    return this.ops.find((op) => op._id === id) as PageOperationFacts;
  }

  intervening(id: string): PageOperationFacts[] {
    const target = this.target(id);
    return this.ops
      .filter((op) => op.affectsBody && op.resultRevision > target.resultRevision)
      .sort((a, b) => a.resultRevision - b.resultRevision);
  }

  undoInput(id: string, nowMs: number) {
    return reload({
      nowMs,
      userId: USER,
      noteId: NOTE,
      noteRevision: this.revision,
      currentBody: this.body,
      target: { operation: this.target(id), payload: this.payloads.get(id) },
      intervening: this.intervening(id),
    });
  }
}

// ---------------------------------------------------------------------------------------------
// D1: revisions and content identity
// ---------------------------------------------------------------------------------------------

describe("D1 revisions", () => {
  test("a missing notes.revision is revision 0 and nothing else is guessed", () => {
    expect(ok(effectiveRevision(undefined))).toBe(0);
    expect(ok(effectiveRevision(0))).toBe(0);
    expect(ok(effectiveRevision(41))).toBe(41);
    expect(ok(effectiveRevision(Number.MAX_SAFE_INTEGER - 1))).toBe(Number.MAX_SAFE_INTEGER - 1);
  });

  test("rejects out-of-range, fractional, non-finite, negative and non-number revisions", () => {
    for (const bad of [
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -0,
      "3",
      null,
      {},
    ]) {
      fail(effectiveRevision(bad), "invalid_revision");
    }
  });

  test("advancing rejects overflow before any write", () => {
    expect(ok(nextRevision(0))).toBe(1);
    expect(ok(nextRevision(Number.MAX_SAFE_INTEGER - 2))).toBe(Number.MAX_SAFE_INTEGER - 1);
    fail(nextRevision(Number.MAX_SAFE_INTEGER - 1), "revision_overflow");
    fail(nextRevision(Number.MAX_SAFE_INTEGER), "invalid_revision");
  });

  test("expectedRevision is mandatory and compared against the legacy-zero interpretation", () => {
    expect(ok(checkExpectedRevision(undefined, 0))).toEqual({ currentRevision: 0 });
    expect(ok(checkExpectedRevision(7, 7))).toEqual({ currentRevision: 7 });
    fail(checkExpectedRevision(undefined, 1), "revision_mismatch");
    fail(checkExpectedRevision(7, 6), "revision_mismatch");
    fail(checkExpectedRevision(7, undefined), "invalid_revision");
    fail(checkExpectedRevision(7, "7"), "invalid_revision");
    fail(checkExpectedRevision("7", 7), "invalid_revision");
  });

  test("an applied write at the revision ceiling cannot be planned", async () => {
    const result = await planBodyChange({
      before: "a",
      after: "b",
      noteRevision: Number.MAX_SAFE_INTEGER - 1,
    });
    fail(result, "revision_overflow");
    // A noop does not advance, so it is still plannable at the ceiling.
    const noop = ok(
      await planBodyChange({ before: "a", after: "a", noteRevision: Number.MAX_SAFE_INTEGER - 1 })
    );
    expect(noop.facts.result).toBe("noop");
  });
});

describe("D1 digests", () => {
  test("SHA-256 matches the published test vectors", async () => {
    expect(ok(await sha256Hex(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(ok(await sha256Hex("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(ok(await sha256Hex("The quick brown fox jumps over the lazy dog"))).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
    );
  });

  test("hashes exact UTF-8: no trimming, no Unicode normalization, no newline change", async () => {
    const samples = ["café", "café", "a\r\nb", "a\nb", " a ", "a", "😀", "日本語", "é"];
    for (const sample of samples) expect(ok(await digestBody(sample))).toBe(sha(sample));
    const digests = new Set(await Promise.all(samples.map(async (s) => ok(await digestBody(s)))));
    expect(digests.size).toBe(samples.length);
  });

  test("a lone surrogate would hash like U+FFFD, so it is rejected instead", async () => {
    fail(await digestBody("a\ud800b"), "malformed_text");
    fail(await sha256Hex("\udc00"), "malformed_text");
  });

  test("identifier and digest shape predicates", () => {
    expect(isValidSha256Hex(HEX_A)).toBe(true);
    for (const bad of [
      "A".repeat(64),
      "a".repeat(63),
      "a".repeat(65),
      "g".repeat(64),
      "",
      5,
      null,
    ]) {
      expect(isValidSha256Hex(bad)).toBe(false);
    }
    expect(isValidUlid("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
    for (const bad of [
      "01arz3ndektsv4rrffq69g5fav",
      "01ARZ3NDEKTSV4RRFFQ69G5FA",
      "01ARZ3NDEKTSV4RRFFQ69G5FAVV",
      "81ARZ3NDEKTSV4RRFFQ69G5FAV",
      "01ARZ3NDEKTSV4RRFFQ69G5FAU",
      "01ARZ3NDEKTSV4RRFFQ69G5FAI",
      "01ARZ3NDEKTSV4RRFFQ69G5FAL",
      "01ARZ3NDEKTSV4RRFFQ69G5FAO",
    ]) {
      expect(isValidUlid(bad)).toBe(false);
    }
    expect(isValidRequestId("req_01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
    expect(isValidRequestId("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false);
    expect(isValidRequestId("REQ_01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(false);
    expect(ulidTimestampMs(ulidAt(NOW))).toBe(NOW);
    expect(ulidTimestampMs(ulidAt(0))).toBe(0);
    expect(ulidTimestampMs("nope")).toBeUndefined();
  });

  test("the block id predicate agrees with the canonical codec", () => {
    const accepted = [BLOCK_A, BLOCK_B];
    const refused = [
      "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4Z",
      "blk_81K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
      "blk_01k5f3z8q2c9p4q6r8t0v2x4z6",
      "blk_01K5F3Z8Q2C9P4Q6R8T0V2X4ZU",
      "block_01K5F3Z8Q2C9P4Q6R8T0V2X4Z6",
    ];
    for (const id of accepted) {
      expect(isValidBlockId(id)).toBe(true);
      expect(parseTempoBlocks(taskFence(id, "x")).some((s) => s.kind === "valid")).toBe(true);
    }
    for (const id of refused) {
      expect(isValidBlockId(id)).toBe(false);
      expect(parseTempoBlocks(taskFence(id, "x")).some((s) => s.kind === "valid")).toBe(false);
    }
  });

  test("local dates must be real calendar dates", () => {
    for (const good of ["2026-10-11", "2028-02-29", "2000-02-29", "2026-12-31", "0001-01-01"]) {
      expect(isValidLocalDate(good)).toBe(true);
    }
    for (const bad of [
      "2027-02-29",
      "1900-02-29",
      "2026-13-01",
      "2026-00-10",
      "2026-04-31",
      "2026-10-32",
      "2026-1-1",
      "26-10-11",
      "2026-10-11T00:00:00Z",
      " 2026-10-11",
      "",
      20261011,
    ]) {
      expect(isValidLocalDate(bad)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// D2/D4: independent unit budgets
// ---------------------------------------------------------------------------------------------

describe("body budget: UTF-8 bytes and the codec's UTF-16 limit are independent", () => {
  const maxBytes = PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes;

  test("the adopted values are the adopted values", () => {
    expect(maxBytes).toBe(131_072);
    expect(PAGE_LEDGER_LIMITS.maxBodyUtf16Units).toBe(BLOCK_CODEC_LIMITS.maxBodyChars);
    expect(PAGE_LEDGER_LIMITS.maxFragmentUtf8Bytes).toBe(262_144);
    expect(PAGE_LEDGER_LIMITS.maxSplices).toBe(64);
    expect(PAGE_LEDGER_LIMITS.maxInterveningRevisions).toBe(256);
  });

  test("ASCII body at and just beyond 128 KiB", () => {
    expect(ok(checkBodyBudget("a".repeat(maxBytes)))).toEqual({ utf8Bytes: maxBytes });
    fail(checkBodyBudget("a".repeat(maxBytes + 1)), "body_too_large_utf8");
    expect(ok(checkBodyBudget(""))).toEqual({ utf8Bytes: 0 });
  });

  test("two-byte text hits the byte budget with half as many UTF-16 units", () => {
    expect(ok(checkBodyBudget("é".repeat(maxBytes / 2))).utf8Bytes).toBe(maxBytes);
    fail(checkBodyBudget("é".repeat(maxBytes / 2 + 1)), "body_too_large_utf8");
  });

  test("surrogate pairs cost four bytes but two UTF-16 units", () => {
    const pairs = maxBytes / 4;
    expect("😀".repeat(pairs).length).toBe(maxBytes / 2);
    expect(ok(checkBodyBudget("😀".repeat(pairs))).utf8Bytes).toBe(maxBytes);
    fail(checkBodyBudget("😀".repeat(pairs + 1)), "body_too_large_utf8");
    expect(utf8ByteLength("a😀é日")).toBe(1 + 4 + 2 + 3);
  });

  test("the codec's UTF-16 limit is checked separately and first", () => {
    const limit = BLOCK_CODEC_LIMITS.maxBodyChars;
    // At the codec limit the UTF-16 rule passes and the byte budget is what rejects.
    fail(checkBodyBudget("a".repeat(limit)), "body_too_large_utf8");
    // One unit beyond it, the codec bound is the one named.
    fail(checkBodyBudget("a".repeat(limit + 1)), "body_too_large_utf16");
  });

  test("a lone surrogate or a non-string is not a body", () => {
    fail(checkBodyBudget("ok\ud83d"), "malformed_text");
    fail(checkBodyBudget("\ude00 ok"), "malformed_text");
    fail(checkBodyBudget(5), "invalid_text");
    fail(checkBodyBudget(null), "invalid_text");
  });

  test("CRLF, combining text and adjacent blocks count exactly as written", () => {
    const body = `a\r\nb\r\né\n${taskFence(BLOCK_A, "One")}${taskFence(BLOCK_B, "Two")}`;
    expect(ok(checkBodyBudget(body)).utf8Bytes).toBe(utf8ByteLength(body) as number);
    expect(utf8ByteLength("\r\n")).toBe(2);
    expect(utf8ByteLength("é")).toBe(3);
  });
});

describe("proposal task input: code points, UTF-16 units and duration", () => {
  const title = (value: string, durationMin?: number) =>
    validateProposalTaskInput({
      title: value,
      ...(durationMin === undefined ? {} : { durationMin }),
    });

  test("accepts a normal task and applies the stored default of 15 minutes", () => {
    expect(ok(title("Email supervisor"))).toEqual({ title: "Email supervisor", durationMin: 15 });
    expect(ok(title("Email supervisor", 90))).toEqual({
      title: "Email supervisor",
      durationMin: 90,
    });
  });

  test("the title is stored exactly: no trimming or normalization", () => {
    expect(ok(title("  spaced  ")).title).toBe("  spaced  ");
    expect(ok(title("café")).title).toBe("café");
  });

  test("blank titles are rejected", () => {
    for (const blank of ["", " ", "\n\t", " ", " "]) fail(title(blank), "title_blank");
  });

  test("500 UTF-16 units pass; 501 fail", () => {
    expect(ok(title("a".repeat(500))).title.length).toBe(500);
    fail(title("a".repeat(501)), "title_too_many_code_points");
  });

  test("code points and UTF-16 units are different limits, each enforced", () => {
    // 250 astral characters: 250 code points (under 500) but 500 UTF-16 units (at the codec bound).
    expect(ok(title("😀".repeat(250))).title.length).toBe(500);
    // 251: 251 code points still under 500, but 502 UTF-16 units exceeds the codec bound.
    fail(title("😀".repeat(251)), "title_too_long_utf16");
    // Combining marks: 250 x (e + accent) is 500 code points and 500 units.
    expect(ok(title("é".repeat(250))).title.length).toBe(500);
    fail(title("é".repeat(251)), "title_too_many_code_points");
    // The stricter unit always dominates, so the code-point cap can never be the only failure.
    for (const sample of ["a".repeat(500), "😀".repeat(250), "é".repeat(499)]) {
      expect([...sample].length).toBeLessThanOrEqual(sample.length);
    }
  });

  test("durations are integers from 1 to 1440", () => {
    expect(ok(title("t", 1)).durationMin).toBe(1);
    expect(ok(title("t", 1440)).durationMin).toBe(1440);
    for (const bad of [0, 1441, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      fail(title("t", bad), "duration_out_of_range");
    }
    fail(validateProposalTaskInput({ title: "t", durationMin: "15" }), "duration_out_of_range");
  });

  test("an enormous title is refused without being scanned", () => {
    fail(title("a".repeat(5_000_000)), "title_too_many_code_points");
    fail(title("😀".repeat(1_000_000)), "title_too_many_code_points");
  });

  test("rejects unexpected and malformed input", () => {
    fail(validateProposalTaskInput({ title: "t", done: true }), "unexpected_field");
    fail(validateProposalTaskInput({}), "missing_field");
    fail(validateProposalTaskInput(null), "invalid_shape");
    fail(validateProposalTaskInput("title"), "invalid_shape");
    fail(title("bad\ud800"), "malformed_text");
    fail(validateProposalTaskInput({ title: 5 }), "invalid_text");
  });
});

// ---------------------------------------------------------------------------------------------
// D2: strict shapes and cross-field state invariants
// ---------------------------------------------------------------------------------------------

describe("pageOperations facts", () => {
  test("accepts applied, noop, undo and undone rows and returns a fresh copy", () => {
    const applied = operationRow();
    const parsed = ok(validatePageOperationFacts(applied));
    expect(parsed).toEqual(applied as never);
    (applied.delta as { startUtf16: number }[])[0]!.startUtf16 = 99;
    expect(parsed.delta[0]?.startUtf16).toBe(3);

    expect(ok(validatePageOperationFacts(noopRow())).result).toBe("noop");
    expect(ok(validatePageOperationFacts(undoRow())).kind).toBe("undo");
    const undone = operationRow({ undoneAtMs: NOW + 1, undoneByOperationId: "op_9" });
    expect(String(ok(validatePageOperationFacts(undone)).undoneByOperationId)).toBe("op_9");
    const persisted = operationRow({ _id: "op_1", _creationTime: NOW, deletedAt: NOW + 5 });
    expect(String(ok(validatePageOperationFacts(persisted))._id)).toBe("op_1");
    expect(ok(validatePageOperationFacts(reload(applied)))).toBeDefined();
  });

  test("Convex's fractional system _creationTime is accepted; a nonsense one is not", () => {
    const fractional = operationRow({ _id: "op_1", _creationTime: 1_760_000_000_123.456 });
    expect(ok(validatePageOperationFacts(fractional))._creationTime).toBe(1_760_000_000_123.456);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      fail(
        validatePageOperationFacts(operationRow({ _creationTime: bad })),
        "invalid_timestamp",
        "_creationTime"
      );
    }
    ok(validatePageOperationPayloadFacts(payloadRow({ _creationTime: 1.5 })));
    ok(validatePageProposalFacts(proposalRow({ _creationTime: 1.5 })));
  });

  test("accepts a coach add_task write that came from a proposal", () => {
    const row = operationRow({ kind: "add_task", source: "coach", proposalId: "prop_1" });
    expect(String(ok(validatePageOperationFacts(row)).proposalId)).toBe("prop_1");
  });

  const shapeCases: [string, unknown, PageLedgerErrorCode][] = [
    ["null", null, "invalid_shape"],
    ["array", [], "invalid_shape"],
    ["string", "row", "invalid_shape"],
    ["a class instance", new (class Row {})(), "invalid_shape"],
    ["a null-prototype-less custom prototype", Object.create({ inherited: 1 }), "invalid_shape"],
    ["an unexpected field", operationRow({ extra: 1 }), "unexpected_field"],
    ["an own __proto__ key", JSON.parse('{"__proto__":1}'), "unexpected_field"],
    ["a missing requestId", operationRow({ requestId: undefined }), "missing_field"],
    ["a missing delta", operationRow({ delta: undefined }), "missing_field"],
    ["an unknown kind", operationRow({ kind: "delete" }), "invalid_enum"],
    ["an unknown source", operationRow({ source: "cron" }), "invalid_enum"],
    ["an unknown result", operationRow({ result: "failed" }), "invalid_enum"],
    ["a non-boolean affectsBody", operationRow({ affectsBody: "true" }), "invalid_shape"],
    ["an empty userId", operationRow({ userId: "" }), "invalid_id"],
    ["a numeric noteId", operationRow({ noteId: 7 }), "invalid_id"],
    ["a spaced id", operationRow({ noteId: "note 1" }), "invalid_id"],
    ["a 129-character id", operationRow({ noteId: "n".repeat(129) }), "invalid_id"],
  ];
  for (const [name, input, code] of shapeCases) {
    test(`rejects ${name}`, () => fail(validatePageOperationFacts(input), code));
  }

  const identityCases: [string, Record<string, unknown>, PageLedgerErrorCode, string][] = [
    [
      "lowercase ULID",
      { requestId: `req_${ulidAt(NOW).toLowerCase()}` },
      "invalid_request_id",
      "requestId",
    ],
    ["short ULID", { requestId: `req_${ulidAt(NOW).slice(1)}` }, "invalid_request_id", "requestId"],
    ["long ULID", { requestId: `req_${ulidAt(NOW)}A` }, "invalid_request_id", "requestId"],
    [
      "ULID with U",
      { requestId: "req_01ARZ3NDEKTSV4RRFFQ69G5FAU" },
      "invalid_request_id",
      "requestId",
    ],
    [
      "overflowing ULID time",
      { requestId: "req_81ARZ3NDEKTSV4RRFFQ69G5FAV" },
      "invalid_request_id",
      "requestId",
    ],
    ["missing prefix", { requestId: ulidAt(NOW) }, "invalid_request_id", "requestId"],
    ["uppercase digest", { requestDigest: "A".repeat(64) }, "invalid_digest", "requestDigest"],
    ["short digest", { baseBodyDigest: "a".repeat(63) }, "invalid_digest", "baseBodyDigest"],
    ["non-hex digest", { resultBodyDigest: "z".repeat(64) }, "invalid_digest", "resultBodyDigest"],
  ];
  for (const [name, overrides, code, field] of identityCases) {
    test(`rejects ${name}`, () =>
      fail(validatePageOperationFacts(operationRow(overrides)), code, field));
  }

  test("numbers: revisions, timestamps and overflow", () => {
    for (const bad of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER,
      "1",
    ]) {
      fail(
        validatePageOperationFacts(operationRow({ baseRevision: bad })),
        "invalid_revision",
        "baseRevision"
      );
    }
    for (const bad of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      "1",
      -0,
    ]) {
      fail(
        validatePageOperationFacts(operationRow({ appliedAtMs: bad })),
        "invalid_timestamp",
        "appliedAtMs"
      );
    }
    // The largest legal pair is (MAX - 2) -> (MAX - 1).
    const top = operationRow({
      baseRevision: Number.MAX_SAFE_INTEGER - 2,
      resultRevision: Number.MAX_SAFE_INTEGER - 1,
    });
    expect(ok(validatePageOperationFacts(top)).resultRevision).toBe(Number.MAX_SAFE_INTEGER - 1);
    const beyond = operationRow({
      baseRevision: Number.MAX_SAFE_INTEGER - 1,
      resultRevision: Number.MAX_SAFE_INTEGER,
    });
    fail(validatePageOperationFacts(beyond), "invalid_revision", "resultRevision");
    // A deadline that would leave the safe-integer range is refused, not wrapped.
    const late = Number.MAX_SAFE_INTEGER - 10;
    fail(
      validatePageOperationFacts(operationRow({ appliedAtMs: late, metadataExpiresAtMs: late })),
      "invalid_timestamp",
      "metadataExpiresAtMs"
    );
  });

  const invariantCases: [string, Record<string, unknown>, PageLedgerErrorCode][] = [
    ["applied without affectsBody", { affectsBody: false }, "state_invariant"],
    ["applied that skips a revision", { resultRevision: 2 }, "state_invariant"],
    ["applied that does not advance", { resultRevision: 0 }, "state_invariant"],
    ["applied with an empty delta", { delta: [] }, "state_invariant"],
    ["applied with equal digests", { resultBodyDigest: HEX_B }, "state_invariant"],
    ["applied without undoUntilMs", { undoUntilMs: undefined }, "missing_field"],
    ["undoUntilMs one millisecond long", { undoUntilMs: NOW + 5 * MIN + 1 }, "deadline_mismatch"],
    [
      "metadata deadline one millisecond short",
      { metadataExpiresAtMs: NOW + 48 * HOUR - 1 },
      "deadline_mismatch",
    ],
    ["updatedAt before createdAt", { updatedAt: NOW - 1 }, "state_invariant"],
    ["undoneAtMs without undoneByOperationId", { undoneAtMs: NOW + 1 }, "state_invariant"],
    ["undoneByOperationId without undoneAtMs", { undoneByOperationId: "op_9" }, "state_invariant"],
    [
      "undone before it was applied",
      { undoneAtMs: NOW - 1, undoneByOperationId: "op_9" },
      "state_invariant",
    ],
    [
      "undone exactly at the exclusive end",
      { undoneAtMs: NOW + 5 * MIN, undoneByOperationId: "op_9" },
      "state_invariant",
    ],
    ["a save that carries undoOfOperationId", { undoOfOperationId: "op_0" }, "state_invariant"],
    ["a save that carries a proposal", { proposalId: "prop_1" }, "state_invariant"],
    [
      "self-referencing undone link",
      { _id: "op_9", undoneAtMs: NOW + 1, undoneByOperationId: "op_9" },
      "state_invariant",
    ],
  ];
  for (const [name, overrides, code] of invariantCases) {
    test(`rejects ${name}`, () => fail(validatePageOperationFacts(operationRow(overrides)), code));
  }

  test("undone is allowed from the first millisecond up to just before the end", () => {
    for (const at of [NOW, NOW + 5 * MIN - 1]) {
      const row = operationRow({ undoneAtMs: at, undoneByOperationId: "op_9" });
      expect(ok(validatePageOperationFacts(row)).undoneAtMs).toBe(at);
    }
  });

  test("noop receipts reserve identity only", () => {
    const cases: [Record<string, unknown>, PageLedgerErrorCode][] = [
      [{ affectsBody: true }, "state_invariant"],
      [{ resultRevision: 1 }, "state_invariant"],
      [{ resultBodyDigest: HEX_C }, "state_invariant"],
      [
        { delta: [{ startUtf16: 0, removedLengthUtf16: 0, insertedLengthUtf16: 1 }] },
        "state_invariant",
      ],
      [{ undoUntilMs: NOW + 5 * MIN }, "state_invariant"],
      [{ undoneAtMs: NOW, undoneByOperationId: "op_9" }, "state_invariant"],
      [{ undoOfOperationId: "op_1" }, "state_invariant"],
      [{ proposalId: "prop_1" }, "state_invariant"],
      [{ kind: "undo", undoOfOperationId: "op_1" }, "state_invariant"],
    ];
    for (const [overrides, code] of cases)
      fail(validatePageOperationFacts(noopRow(overrides)), code);
  });

  test("an undo is another real body revision that links its target and has no window of its own", () => {
    fail(validatePageOperationFacts(undoRow({ undoOfOperationId: undefined })), "missing_field");
    const cases: Record<string, unknown>[] = [
      { undoUntilMs: NOW + 5 * MIN },
      { undoneAtMs: NOW, undoneByOperationId: "op_9" },
      { proposalId: "prop_1" },
    ];
    for (const overrides of cases) {
      fail(validatePageOperationFacts(undoRow(overrides)), "state_invariant");
    }
    fail(validatePageOperationFacts(undoRow({ delta: [] })), "state_invariant");
    fail(validatePageOperationFacts(undoRow({ affectsBody: false })), "state_invariant");
  });
});

describe("delta validation", () => {
  const d = (startUtf16: number, removedLengthUtf16: number, insertedLengthUtf16: number) => ({
    startUtf16,
    removedLengthUtf16,
    insertedLengthUtf16,
  });

  test("accepts sorted entries separated by at least one unit", () => {
    expect(ok(validatePageDelta([]))).toEqual([]);
    expect(ok(validatePageDelta([d(0, 0, 1)]))).toEqual([d(0, 0, 1)]);
    expect(ok(validatePageDelta([d(0, 2, 1), d(3, 0, 5)]))).toHaveLength(2);
  });

  const cases: [string, unknown, PageLedgerErrorCode][] = [
    ["unsorted entries", [d(5, 1, 1), d(2, 1, 1)], "splice_unsorted"],
    ["overlapping entries", [d(0, 5, 1), d(3, 1, 1)], "splice_overlap"],
    ["touching entries", [d(0, 2, 1), d(2, 0, 1)], "splice_ambiguous"],
    ["coincident insertions", [d(4, 0, 1), d(4, 0, 2)], "splice_ambiguous"],
    ["an entry that changes nothing", [d(3, 0, 0)], "invalid_splice"],
    ["a negative offset", [d(-1, 1, 1)], "invalid_number"],
    ["a fractional length", [d(0, 1.5, 1)], "invalid_number"],
    ["a 2^53 offset", [d(2 ** 53, 0, 1)], "invalid_number"],
    [
      "a span beyond the codec's body limit",
      [d(BLOCK_CODEC_LIMITS.maxBodyChars, 1, 1)],
      "splice_out_of_range",
    ],
    ["lengths beyond the fragment budget", [d(0, 200_000, 100_000)], "fragments_too_large"],
    ["an unexpected key", [{ ...d(0, 1, 1), text: "x" }], "unexpected_field"],
    ["a missing key", [{ startUtf16: 0, removedLengthUtf16: 1 }], "missing_field"],
    ["a non-array", { 0: d(0, 1, 1) }, "invalid_shape"],
  ];
  for (const [name, input, code] of cases) {
    test(`rejects ${name}`, () => fail(validatePageDelta(input), code));
  }

  test("at most 64 entries", () => {
    const sixtyFour = Array.from({ length: 64 }, (_, i) => d(i * 2, 1, 1));
    expect(ok(validatePageDelta(sixtyFour))).toHaveLength(64);
    const sixtyFive = Array.from({ length: 65 }, (_, i) => d(i * 2, 1, 1));
    fail(validatePageDelta(sixtyFive), "too_many_splices");
  });
});

describe("pageOperationPayloads facts", () => {
  test("accepts available and expired payloads and returns a fresh copy", () => {
    const row = payloadRow();
    const parsed = ok(validatePageOperationPayloadFacts(row));
    expect(parsed).toEqual(row as never);
    const expired = payloadRow({ payload: { state: "expired", expiredAtMs: NOW + 11 * MIN } });
    expect(ok(validatePageOperationPayloadFacts(expired)).payload.state).toBe("expired");
    expect(
      String(
        ok(validatePageOperationPayloadFacts(payloadRow({ _id: "pl_1", deletedAt: NOW + 3 })))._id
      )
    ).toBe("pl_1");
  });

  const cases: [string, Record<string, unknown>, PageLedgerErrorCode][] = [
    [
      "cleanup due one millisecond late",
      { cleanupDueAtMs: NOW + 10 * MIN + 1 },
      "deadline_mismatch",
    ],
    ["cleanup due before the grace", { cleanupDueAtMs: NOW + 5 * MIN }, "deadline_mismatch"],
    ["an unknown payload state", { payload: { state: "pending" } }, "invalid_enum"],
    [
      "available with expiredAtMs",
      { payload: { state: "available", splices: [], expiredAtMs: 1 } },
      "unexpected_field",
    ],
    [
      "expired with splices",
      { payload: { state: "expired", expiredAtMs: 1, splices: [] } },
      "unexpected_field",
    ],
    ["expired without a timestamp", { payload: { state: "expired" } }, "missing_field"],
    [
      "expired with a bad timestamp",
      { payload: { state: "expired", expiredAtMs: -5 } },
      "invalid_timestamp",
    ],
    [
      "available with no splices",
      { payload: { state: "available", splices: [] } },
      "state_invariant",
    ],
    [
      "a splice that changes nothing",
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 0, removedText: "a", insertedText: "a" }],
        },
      },
      "invalid_splice",
    ],
    [
      "a lone-surrogate fragment",
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 0, removedText: "a", insertedText: "\ud83d" }],
        },
      },
      "malformed_text",
    ],
    [
      "a non-string fragment",
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 0, removedText: 1, insertedText: "a" }],
        },
      },
      "invalid_text",
    ],
    [
      "an extra splice key",
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 0, removedText: "a", insertedText: "b", note: "x" }],
        },
      },
      "unexpected_field",
    ],
    [
      "a negative start",
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: -1, removedText: "a", insertedText: "b" }],
        },
      },
      "invalid_number",
    ],
  ];
  for (const [name, overrides, code] of cases) {
    test(`rejects ${name}`, () =>
      fail(validatePageOperationPayloadFacts(payloadRow(overrides)), code));
  }

  test("splice ordering matches the delta rules", () => {
    const splice = (startUtf16: number, removedText: string, insertedText: string) => ({
      startUtf16,
      removedText,
      insertedText,
    });
    expect(ok(validatePageSplices([splice(0, "ab", "x"), splice(3, "", "y")]))).toHaveLength(2);
    fail(validatePageSplices([splice(5, "a", "b"), splice(1, "a", "b")]), "splice_unsorted");
    fail(validatePageSplices([splice(0, "abcd", "x"), splice(2, "a", "b")]), "splice_overlap");
    fail(validatePageSplices([splice(0, "ab", "x"), splice(2, "", "y")]), "splice_ambiguous");
    fail(validatePageSplices([splice(1, "", "x"), splice(1, "", "y")]), "splice_ambiguous");
  });

  test("combined fragments are bounded at 256 KiB of UTF-8", () => {
    const half = PAGE_LEDGER_LIMITS.maxFragmentUtf8Bytes / 2;
    const exact = [
      { startUtf16: 0, removedText: "a".repeat(half), insertedText: "b".repeat(half) },
    ];
    expect(ok(validatePageSplices(exact))).toHaveLength(1);
    const beyond = [
      { startUtf16: 0, removedText: "a".repeat(half), insertedText: "b".repeat(half + 1) },
    ];
    fail(validatePageSplices(beyond), "fragments_too_large");
    // Bytes, not UTF-16 units: 131072 two-byte characters are 262144 bytes in only 131072 units.
    const twoByte = [{ startUtf16: 0, removedText: "é".repeat(half), insertedText: "" }];
    expect(ok(validatePageSplices(twoByte))).toHaveLength(1);
    const twoByteBeyond = [{ startUtf16: 0, removedText: "é".repeat(half), insertedText: "é" }];
    fail(validatePageSplices(twoByteBeyond), "fragments_too_large");
    // The budget is per operation, not per splice.
    const split = [
      { startUtf16: 0, removedText: "a".repeat(half), insertedText: "" },
      { startUtf16: half + 1, removedText: "b".repeat(half + 1), insertedText: "" },
    ];
    fail(validatePageSplices(split), "fragments_too_large");
  });

  test("the serialized payload is bounded as well as its text", () => {
    // 100,000 control characters are 100,000 UTF-8 bytes, but each serializes to six JSON bytes.
    const noisy = [{ startUtf16: 0, removedText: "\u0001".repeat(100_000), insertedText: "" }];
    fail(validatePageSplices(noisy), "payload_too_large");
    const quiet = [{ startUtf16: 0, removedText: "a".repeat(100_000), insertedText: "" }];
    expect(ok(validatePageSplices(quiet))).toHaveLength(1);
  });

  test("at most 64 splices", () => {
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        startUtf16: i * 3,
        removedText: "a",
        insertedText: "b",
      }));
    expect(ok(validatePageSplices(make(64)))).toHaveLength(64);
    fail(validatePageSplices(make(65)), "too_many_splices");
  });
});

describe("operation and payload belong together", () => {
  const operation = (overrides: Record<string, unknown> = {}) =>
    operationRow({ _id: "op_1", ...overrides });

  test("a consistent pair validates", () => {
    const pair = ok(validateOperationPayloadPair(operation(), payloadRow()));
    expect(String(pair.operation._id)).toBe("op_1");
  });

  test("an expired payload still pairs (it holds no fragments to compare)", () => {
    const expired = payloadRow({ payload: { state: "expired", expiredAtMs: NOW + 11 * MIN } });
    expect(ok(validateOperationPayloadPair(operation(), expired)).payload.payload.state).toBe(
      "expired"
    );
  });

  const cases: [string, Record<string, unknown>, Record<string, unknown>, PageLedgerErrorCode][] = [
    ["a different operation id", {}, { operationId: "op_2" }, "record_mismatch"],
    ["a different owner", {}, { userId: "user_2" }, "record_mismatch"],
    ["a different note", {}, { noteId: OTHER_NOTE }, "record_mismatch"],
    [
      "a different undoUntilMs",
      {},
      { undoUntilMs: NOW + 5 * MIN + 1, cleanupDueAtMs: NOW + 10 * MIN + 1 },
      "deadline_mismatch",
    ],
    [
      "a splice start that differs from the delta",
      {},
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 4, removedText: "ab", insertedText: "wxyz" }],
        },
      },
      "record_mismatch",
    ],
    [
      "a removed length that differs from the delta",
      {},
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 3, removedText: "a", insertedText: "wxyz" }],
        },
      },
      "record_mismatch",
    ],
    [
      "an inserted length that differs from the delta",
      {},
      {
        payload: {
          state: "available",
          splices: [{ startUtf16: 3, removedText: "ab", insertedText: "wx" }],
        },
      },
      "record_mismatch",
    ],
    [
      "a different splice count",
      {},
      {
        payload: {
          state: "available",
          splices: [
            { startUtf16: 3, removedText: "ab", insertedText: "wxyz" },
            { startUtf16: 9, removedText: "c", insertedText: "d" },
          ],
        },
      },
      "record_mismatch",
    ],
    ["a noop operation", noopRow({ _id: "op_1" }), {}, "state_invariant"],
    ["an undo operation", undoRow({ _id: "op_5" }), { operationId: "op_5" }, "state_invariant"],
  ];
  for (const [name, operationOverrides, payloadOverrides, code] of cases) {
    test(`rejects ${name}`, () => {
      const op = Object.keys(operationOverrides).length > 0 ? operationOverrides : operation();
      fail(validateOperationPayloadPair(op, payloadRow(payloadOverrides)), code);
    });
  }

  test("the operation must carry its id", () => {
    fail(validateOperationPayloadPair(operationRow(), payloadRow()), "missing_field", "_id");
  });
});

describe("pageProposals facts", () => {
  test("accepts a pending proposal and returns a fresh copy", () => {
    const row = proposalRow();
    const parsed = ok(validatePageProposalFacts(row));
    expect(parsed).toEqual(row as never);
    expect(
      ok(validatePageProposalFacts(proposalRow({ sourceAgentPromptId: "p".repeat(256) })))
        .sourceAgentPromptId
    ).toHaveLength(256);
  });

  test("accepts each decided status and an expired payload", () => {
    const decided = { decidedAtMs: NOW + 10 };
    expect(
      ok(validatePageProposalFacts(proposalRow({ status: "rejected", ...decided }))).status
    ).toBe("rejected");
    expect(
      ok(validatePageProposalFacts(proposalRow({ status: "cancelled", ...decided }))).status
    ).toBe("cancelled");
    expect(ok(validatePageProposalFacts(proposalRow({ status: "expired" }))).status).toBe(
      "expired"
    );
    const confirmed = proposalRow({
      status: "confirmed",
      ...decided,
      confirmedOperationId: "op_1",
      confirmDigest: HEX_A,
    });
    expect(String(ok(validatePageProposalFacts(confirmed)).confirmedOperationId)).toBe("op_1");
    const cleaned = proposalRow({
      status: "rejected",
      ...decided,
      payload: { state: "expired", expiredAtMs: NOW + 20 },
    });
    expect(ok(validatePageProposalFacts(cleaned)).payload.state).toBe("expired");
  });

  const cases: [string, Record<string, unknown>, PageLedgerErrorCode][] = [
    ["another kind", { kind: "add_task" }, "invalid_enum"],
    ["another schema version", { schemaVersion: 2 }, "invalid_enum"],
    ["a 29 February in a common year", { localDate: "2027-02-29" }, "invalid_local_date"],
    ["month 13", { localDate: "2026-13-01" }, "invalid_local_date"],
    ["31 April", { localDate: "2026-04-31" }, "invalid_local_date"],
    ["a one-digit month", { localDate: "2026-1-01" }, "invalid_local_date"],
    ["an empty source request key", { sourceRequestKey: "" }, "invalid_source_request_key"],
    [
      "a 129-character source request key",
      { sourceRequestKey: "k".repeat(129) },
      "invalid_source_request_key",
    ],
    ["a source request key with a dot", { sourceRequestKey: "a.b" }, "invalid_source_request_key"],
    ["a non-ASCII source request key", { sourceRequestKey: "clé" }, "invalid_source_request_key"],
    ["an empty prompt id", { sourceAgentPromptId: "" }, "invalid_text"],
    ["a 257-character prompt id", { sourceAgentPromptId: "p".repeat(257) }, "invalid_text"],
    ["a negative proposal revision", { proposalRevision: -1 }, "invalid_number"],
    ["a fractional page revision", { expectedPageRevision: 1.5 }, "invalid_number"],
    ["a malformed block id", { blockId: "blk_123" }, "invalid_block_id"],
    ["an unknown status", { status: "approved" }, "invalid_enum"],
    ["cleanup before content expiry", { cleanupDueAtMs: NOW + 24 * HOUR - 1 }, "deadline_mismatch"],
    [
      "cleanup more than the grace after content expiry",
      { cleanupDueAtMs: NOW + 24 * HOUR + 5 * MIN + 1 },
      "deadline_mismatch",
    ],
    [
      "receipt metadata shorter than 48 hours",
      { metadataExpiresAtMs: NOW + 48 * HOUR - 1 },
      "deadline_mismatch",
    ],
    ["a pending proposal with a decision time", { decidedAtMs: NOW + 1 }, "state_invariant"],
    [
      "a pending proposal with a confirmed operation",
      { confirmedOperationId: "op_1" },
      "state_invariant",
    ],
    ["a rejected proposal without a decision time", { status: "rejected" }, "missing_field"],
    [
      "a confirmed proposal without its operation",
      { status: "confirmed", decidedAtMs: NOW + 1, confirmDigest: HEX_A },
      "missing_field",
    ],
    [
      "a confirmed proposal without its digest",
      { status: "confirmed", decidedAtMs: NOW + 1, confirmedOperationId: "op_1" },
      "missing_field",
    ],
    [
      "a rejected proposal with a confirm digest",
      { status: "rejected", decidedAtMs: NOW + 1, confirmDigest: HEX_A },
      "state_invariant",
    ],
    [
      "a payload task with a blank title",
      { payload: { state: "available", task: { title: "  ", durationMin: 15 } } },
      "title_blank",
    ],
    [
      "a payload task without a stored duration",
      { payload: { state: "available", task: { title: "t" } } },
      "missing_field",
    ],
    [
      "a payload task with a 0 minute duration",
      { payload: { state: "available", task: { title: "t", durationMin: 0 } } },
      "duration_out_of_range",
    ],
    [
      "a payload task with an unexpected done flag",
      { payload: { state: "available", task: { title: "t", durationMin: 15, done: true } } },
      "unexpected_field",
    ],
    ["an extra proposal field", { prompt: "copied text" }, "unexpected_field"],
  ];
  for (const [name, overrides, code] of cases) {
    test(`rejects ${name}`, () => fail(validatePageProposalFacts(proposalRow(overrides)), code));
  }
});

// ---------------------------------------------------------------------------------------------
// D3: request encoding, digests and admission
// ---------------------------------------------------------------------------------------------

describe("D3 request encoding and digests", () => {
  const save = (overrides: Record<string, unknown> = {}) => ({
    kind: "save",
    noteId: NOTE,
    expectedRevision: 3,
    body: "Hello\r\nWorld é 😀\n",
    ...overrides,
  });
  const digestOf = async (input: unknown) => ok(await computePageRequestDigest(input));

  test("the encoding is versioned, ordered and length-prefixed (golden)", () => {
    expect(
      ok(encodePageRequest({ kind: "undo", noteId: "note_1", targetOperationId: "op_1" }))
    ).toBe("tempo-page-request/v1\nkind=s4:undo\nnoteId=s6:note_1\ntargetOperationId=s4:op_1\n");
    expect(ok(encodePageRequest(save({ body: "a\nb" })))).toBe(
      "tempo-page-request/v1\nkind=s4:save\nnoteId=s6:note_1\nexpectedRevision=i3\nbody=s3:a\nb\n"
    );
  });

  test("equal meaning gives the same digest regardless of property order", async () => {
    const reordered = {
      body: "Hello\r\nWorld é 😀\n",
      expectedRevision: 3,
      noteId: NOTE,
      kind: "save",
    };
    expect(await digestOf(save())).toBe(await digestOf(reordered));
    expect(await digestOf(save())).toBe(await digestOf(reload(save())));
    expect(await digestOf(save())).toBe(sha(ok(encodePageRequest(save()))));
  });

  test("any changed meaningful content changes the digest: no normalization", async () => {
    const base = await digestOf(save());
    const variants = [
      save({ body: "Hello\nWorld é 😀\n" }),
      save({ body: "Hello\r\nWorld é 😀" }),
      save({ body: " Hello\r\nWorld é 😀\n" }),
      save({ body: "Hello\r\nWorld é 😀\n" }),
      save({ expectedRevision: 4 }),
      save({ noteId: OTHER_NOTE }),
    ];
    const digests = await Promise.all(variants.map(digestOf));
    for (const digest of digests) expect(digest).not.toBe(base);
    expect(new Set([base, ...digests]).size).toBe(variants.length + 1);
  });

  test("field boundaries cannot be forged by content", async () => {
    const a = await digestOf({
      kind: "add_task",
      noteId: NOTE,
      expectedRevision: 1,
      localDate: "2026-10-11",
      task: { title: "x\ndurationMin=i15\nz", durationMin: 15 },
    });
    const b = await digestOf({
      kind: "add_task",
      noteId: NOTE,
      expectedRevision: 1,
      localDate: "2026-10-11",
      task: { title: "x", durationMin: 15 },
    });
    expect(a).not.toBe(b);
  });

  test("the digest excludes the request id, time and retry count", async () => {
    // Identity of a request is requestId + digest; the digest itself carries no id or clock.
    const encoded = ok(encodePageRequest(save()));
    expect(encoded).not.toContain("req_");
    expect(encoded).not.toContain(String(NOW));
    expect(Object.keys(save())).not.toContain("requestId");
  });

  test("kinds are distinct intents with their own fields", async () => {
    const digests = await Promise.all(
      [
        save(),
        { kind: "undo", noteId: NOTE, targetOperationId: "op_1" },
        { kind: "undo", noteId: NOTE, targetOperationId: "op_2" },
        {
          kind: "patch_block",
          noteId: NOTE,
          expectedRevision: 3,
          blockId: BLOCK_A,
          patch: { status: "done" },
        },
        {
          kind: "patch_block",
          noteId: NOTE,
          expectedRevision: 3,
          blockId: BLOCK_A,
          patch: { status: "later" },
        },
        {
          kind: "patch_block",
          noteId: NOTE,
          expectedRevision: 3,
          blockId: BLOCK_B,
          patch: { status: "done" },
        },
        {
          kind: "add_task",
          noteId: NOTE,
          expectedRevision: 3,
          localDate: "2026-10-11",
          task: { title: "T" },
        },
        {
          kind: "add_task",
          noteId: NOTE,
          expectedRevision: 3,
          localDate: "2026-10-12",
          task: { title: "T" },
        },
        {
          kind: "confirm_proposal",
          noteId: NOTE,
          proposalId: "prop_1",
          expectedProposalRevision: 0,
          expectedPageRevision: 3,
          task: { title: "T" },
        },
        {
          kind: "confirm_proposal",
          noteId: NOTE,
          proposalId: "prop_1",
          expectedProposalRevision: 1,
          expectedPageRevision: 3,
          task: { title: "T" },
        },
        {
          kind: "confirm_proposal",
          noteId: NOTE,
          proposalId: "prop_1",
          expectedProposalRevision: 0,
          expectedPageRevision: 4,
          task: { title: "T" },
        },
        {
          kind: "confirm_proposal",
          noteId: NOTE,
          proposalId: "prop_1",
          expectedProposalRevision: 0,
          expectedPageRevision: 3,
          task: { title: "T edited" },
        },
      ].map(digestOf)
    );
    expect(new Set(digests).size).toBe(digests.length);
  });

  test("an omitted duration and an explicit 15 are the same meaning", async () => {
    const withDefault = await digestOf({
      kind: "add_task",
      noteId: NOTE,
      expectedRevision: 1,
      localDate: "2026-10-11",
      task: { title: "T" },
    });
    const explicit = await digestOf({
      kind: "add_task",
      noteId: NOTE,
      expectedRevision: 1,
      localDate: "2026-10-11",
      task: { title: "T", durationMin: 15 },
    });
    const other = await digestOf({
      kind: "add_task",
      noteId: NOTE,
      expectedRevision: 1,
      localDate: "2026-10-11",
      task: { title: "T", durationMin: 16 },
    });
    expect(withDefault).toBe(explicit);
    expect(other).not.toBe(explicit);
  });

  test("patches are allowlisted to the codec's task fields, validated by the codec, and order-free", async () => {
    const patch = (value: Record<string, unknown>) => ({
      kind: "patch_block",
      noteId: NOTE,
      expectedRevision: 3,
      blockId: BLOCK_A,
      patch: value,
    });
    const first = await digestOf(patch({ status: "done", doneAt: "2026-10-11T10:00:00Z" }));
    const second = await digestOf(patch({ doneAt: "2026-10-11T10:00:00Z", status: "done" }));
    expect(first).toBe(second);
    fail(encodePageRequest(patch({ type: "template" })), "patch_not_allowed");
    fail(encodePageRequest(patch({ id: BLOCK_B })), "patch_not_allowed");
    fail(encodePageRequest(patch({ status: "finished" })), "patch_value_invalid");
    fail(encodePageRequest(patch({ durationMin: 1.5 })), "patch_value_invalid");
    fail(encodePageRequest(patch({ durationMin: 0 })), "patch_value_invalid");
    fail(encodePageRequest(patch({ order: -1 })), "patch_value_invalid");
    fail(encodePageRequest(patch({ title: "" })), "patch_value_invalid");
    fail(encodePageRequest(patch({ title: "x".repeat(501) })), "patch_value_invalid");
    fail(encodePageRequest(patch({ doneAt: "yesterday" })), "patch_value_invalid");
    fail(encodePageRequest(patch({ inelastic: { nested: true } })), "patch_value_invalid");
    fail(encodePageRequest(patch({})), "invalid_shape");
    fail(encodePageRequest(patch({ title: "bad\ud800" })), "malformed_text");
    expect(ok(encodePageRequest(patch({ doneAt: null, scheduledAt: null })))).toContain(
      "patch.doneAt=n"
    );
  });

  test("invalid content is rejected, never repaired", () => {
    fail(
      encodePageRequest(save({ body: "a".repeat(PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes + 1) })),
      "body_too_large_utf8"
    );
    fail(encodePageRequest(save({ body: "x\ud800" })), "malformed_text");
    fail(encodePageRequest(save({ expectedRevision: undefined })), "missing_field");
    fail(encodePageRequest(save({ expectedRevision: -1 })), "invalid_revision");
    fail(encodePageRequest(save({ noteId: "" })), "invalid_id");
    fail(encodePageRequest(save({ extra: true })), "unexpected_field");
    fail(encodePageRequest({ kind: "delete", noteId: NOTE }), "invalid_enum");
    fail(encodePageRequest(null), "invalid_enum");
    fail(
      encodePageRequest({
        kind: "undo",
        noteId: NOTE,
        targetOperationId: "op_1",
        expectedRevision: 3,
      }),
      "unexpected_field"
    );
    fail(
      encodePageRequest({
        kind: "add_task",
        noteId: NOTE,
        expectedRevision: 1,
        localDate: "2026-02-30",
        task: { title: "T" },
      }),
      "invalid_local_date"
    );
  });
});

describe("D3 admission and replay", () => {
  const requestId = requestIdAt(NOW - 1_000);
  const admit = (matches: unknown[], overrides: Record<string, unknown> = {}) =>
    decideRequestAdmission({
      nowMs: NOW,
      userId: USER,
      noteId: NOTE,
      requestId,
      requestDigest: HEX_A,
      matches,
      ...overrides,
    });

  test("an unseen, fresh key is a first use", () => {
    expect(ok(admit([]))).toEqual({ decision: "first_use" });
  });

  test("first-use window: ULID time within [now - 24h, now + 5 min], inclusive", () => {
    const at = (ms: number) => admit([], { requestId: requestIdAt(ms) });
    expect(ok(at(NOW - 24 * HOUR)).decision).toBe("first_use");
    fail(at(NOW - 24 * HOUR - 1), "request_id_expired");
    expect(ok(at(NOW + 5 * MIN)).decision).toBe("first_use");
    fail(at(NOW + 5 * MIN + 1), "request_id_in_future");
    expect(ok(at(NOW)).decision).toBe("first_use");
  });

  test("the same key and digest replays the original receipt while it is retained", () => {
    const stored = operationRow({ _id: "op_1", requestId });
    const decision = ok(admit([reload(stored)]));
    expect(decision.decision).toBe("replay");
    if (decision.decision === "replay") expect(String(decision.operation._id)).toBe("op_1");
  });

  test("a retained key older than the 24-hour first-use window can still replay", () => {
    const oldId = requestIdAt(NOW - 30 * HOUR);
    const stored = operationRow({
      requestId: oldId,
      appliedAtMs: NOW - 30 * HOUR + 1_000,
      undoUntilMs: NOW - 30 * HOUR + 1_000 + 5 * MIN,
      metadataExpiresAtMs: NOW - 30 * HOUR + 1_000 + 48 * HOUR,
      createdAt: NOW - 30 * HOUR,
      updatedAt: NOW - 30 * HOUR,
    });
    expect(ok(admit([stored], { requestId: oldId })).decision).toBe("replay");
    // With no retained receipt the same old key is expired, never a new intent.
    fail(admit([], { requestId: oldId }), "request_id_expired");
  });

  test("replay ends exactly at the receipt's metadata deadline", () => {
    const stored = operationRow({ requestId });
    expect(ok(admit([stored], { nowMs: NOW + 48 * HOUR - 1 })).decision).toBe("replay");
    fail(admit([stored], { nowMs: NOW + 48 * HOUR }), "request_id_expired");
  });

  test("the same key with any changed content is REQUEST_ID_REUSED", () => {
    const stored = operationRow({ requestId });
    fail(admit([stored], { requestDigest: HEX_B }), "request_id_reused");
    fail(admit([stored], { noteId: OTHER_NOTE }), "request_id_reused");
    // A row that belongs to another owner is a mis-scoped lookup, not a replay.
    fail(admit([stored], { userId: "user_2" }), "record_mismatch");
  });

  test("distinct keys are distinct intents even for identical content", () => {
    const stored = operationRow({ requestId });
    const other = requestIdAt(NOW - 2_000);
    expect(ok(admit([], { requestId: other, requestDigest: HEX_A })).decision).toBe("first_use");
    expect(stored.requestDigest).toBe(HEX_A);
  });

  test("more than one row, a deleted row or a mismatched row fails safe", () => {
    const stored = operationRow({ requestId });
    fail(admit([stored, stored]), "duplicate_request_rows");
    fail(admit([operationRow({ requestId, deletedAt: NOW })]), "row_deleted");
    fail(admit([operationRow({ requestId: requestIdAt(NOW - 5_000) })]), "record_mismatch");
    fail(admit([{ nonsense: true }]), "unexpected_field");
    fail(admit([], { requestId: "req_nope" }), "invalid_request_id");
    fail(admit([], { nowMs: -1 }), "invalid_timestamp");
    fail(admit("none" as unknown as unknown[]), "invalid_shape");
  });

  test("a noop receipt replays like any other", () => {
    expect(ok(admit([noopRow({ requestId })])).decision).toBe("replay");
  });
});

describe("D3 proposal confirmation keeps two revisions apart", () => {
  const digest = HEX_C;
  const decide = (proposal: Record<string, unknown>, overrides: Record<string, unknown> = {}) =>
    decideProposalConfirmation({
      nowMs: NOW + 10 * MIN,
      proposal,
      expectedProposalRevision: 0,
      noteRevision: 3,
      confirmDigest: digest,
      ...overrides,
    } as Parameters<typeof decideProposalConfirmation>[0]);

  test("a fresh pending proposal against the matching page confirms", () => {
    expect(ok(decide(proposalRow()))).toEqual({ decision: "confirm" });
  });

  test("a stale proposal revision and a stale page revision are different failures", () => {
    fail(decide(proposalRow(), { expectedProposalRevision: 1 }), "proposal_revision_stale");
    fail(decide(proposalRow(), { noteRevision: 4 }), "page_revision_stale");
    // Both stale: the proposal guard is evaluated first.
    fail(
      decide(proposalRow(), { expectedProposalRevision: 1, noteRevision: 4 }),
      "proposal_revision_stale"
    );
    // The stored page revision is what the note is compared with, not the caller's proposal revision.
    expect(
      ok(
        decide(proposalRow({ proposalRevision: 7, expectedPageRevision: 3 }), {
          expectedProposalRevision: 7,
        })
      ).decision
    ).toBe("confirm");
  });

  test("a legacy page (no revision) is revision 0", () => {
    const legacy = proposalRow({ expectedPageRevision: 0 });
    expect(ok(decide(legacy, { noteRevision: undefined })).decision).toBe("confirm");
    fail(decide(proposalRow(), { noteRevision: undefined }), "page_revision_stale");
  });

  test("the content window ends exactly at proposalExpiresAtMs", () => {
    expect(ok(decide(proposalRow(), { nowMs: NOW + 24 * HOUR - 1 })).decision).toBe("confirm");
    fail(decide(proposalRow(), { nowMs: NOW + 24 * HOUR }), "proposal_expired");
    fail(
      decide(proposalRow({ payload: { state: "expired", expiredAtMs: NOW + 1 } })),
      "proposal_expired"
    );
  });

  test("rejected, cancelled and expired proposals cannot write", () => {
    for (const status of ["rejected", "cancelled"]) {
      fail(decide(proposalRow({ status, decidedAtMs: NOW + 1 })), "proposal_not_pending");
    }
    fail(decide(proposalRow({ status: "expired" })), "proposal_not_pending");
  });

  test("a repeated identical confirmation returns the original operation; a changed one is rejected", () => {
    const confirmed = proposalRow({
      status: "confirmed",
      decidedAtMs: NOW + 1,
      confirmedOperationId: "op_7",
      confirmDigest: digest,
    });
    expect(ok(decide(confirmed))).toEqual({ decision: "replay", confirmedOperationId: "op_7" });
    fail(decide(confirmed, { confirmDigest: HEX_A }), "proposal_confirm_changed");
    // Still answerable after the content window has closed: the receipt outlives the content.
    expect(ok(decide(confirmed, { nowMs: NOW + 30 * HOUR })).decision).toBe("replay");
  });

  test("deleted proposals and bad inputs fail safe", () => {
    fail(decide(proposalRow({ deletedAt: NOW })), "row_deleted");
    fail(decide(proposalRow(), { confirmDigest: "nope" }), "invalid_digest");
    fail(decide(proposalRow(), { expectedProposalRevision: -1 }), "invalid_number");
    fail(decide({ junk: 1 }), "unexpected_field");
  });

  test("the digests of a confirmation encode both revisions and the edited task", async () => {
    const encoded = ok(
      encodePageRequest({
        kind: "confirm_proposal",
        noteId: NOTE,
        proposalId: "prop_1",
        expectedProposalRevision: 2,
        expectedPageRevision: 9,
        task: { title: "Edited" },
      })
    );
    expect(encoded).toContain("expectedProposalRevision=i2");
    expect(encoded).toContain("expectedPageRevision=i9");
    expect(encoded).toContain("title=s6:Edited");
  });
});

// ---------------------------------------------------------------------------------------------
// D5: explicit-time eligibility, receipts, cleanup and proposal deadlines
// ---------------------------------------------------------------------------------------------

describe("D5 deadlines and eligibility", () => {
  test("operation deadlines", () => {
    expect(ok(operationDeadlines(NOW))).toEqual({
      undoUntilMs: NOW + 300_000,
      cleanupDueAtMs: NOW + 600_000,
      metadataExpiresAtMs: NOW + 48 * HOUR,
    });
    fail(operationDeadlines(-1), "invalid_timestamp");
    fail(operationDeadlines(Number.MAX_SAFE_INTEGER), "invalid_timestamp");
  });

  test("Undo is eligible for appliedAt <= now < undoUntil: inclusive start, exclusive end", () => {
    const applied = NOW;
    const until = NOW + 5 * MIN;
    expect(isUndoEligible(applied, until, applied - 1)).toBe(false);
    expect(isUndoEligible(applied, until, applied)).toBe(true);
    expect(isUndoEligible(applied, until, until - 1)).toBe(true);
    expect(isUndoEligible(applied, until, until)).toBe(false);
    expect(isUndoEligible(applied, until, until + 1)).toBe(false);
    expect(isUndoEligible(applied, until, Number.NaN)).toBe(false);
  });

  test("cleanup is due at its deadline; receipts are past retention at theirs", () => {
    expect(isCleanupDue(NOW + 10 * MIN, NOW + 10 * MIN - 1)).toBe(false);
    expect(isCleanupDue(NOW + 10 * MIN, NOW + 10 * MIN)).toBe(true);
    expect(isMetadataExpired(NOW + 48 * HOUR, NOW + 48 * HOUR - 1)).toBe(false);
    expect(isMetadataExpired(NOW + 48 * HOUR, NOW + 48 * HOUR)).toBe(true);
    expect(isCleanupDue(Number.NaN, NOW)).toBe(false);
  });

  test("inverse fragments stop being readable at undoUntil even when cleanup is late", () => {
    const available = payloadRow();
    expect(isUndoPayloadReadable(available, NOW + 5 * MIN - 1)).toBe(true);
    expect(isUndoPayloadReadable(available, NOW + 5 * MIN)).toBe(false);
    // Still `available` in storage and not yet due for cleanup: unreadable regardless.
    expect(isUndoPayloadReadable(available, NOW + 7 * MIN)).toBe(false);
    expect(isCleanupDue(NOW + 10 * MIN, NOW + 7 * MIN)).toBe(false);
    const expired = payloadRow({ payload: { state: "expired", expiredAtMs: NOW + 11 * MIN } });
    expect(isUndoPayloadReadable(expired, NOW)).toBe(false);
    expect(isUndoPayloadReadable(payloadRow({ deletedAt: NOW }), NOW)).toBe(false);
    expect(isUndoPayloadReadable({ junk: true }, NOW)).toBe(false);
  });

  test("proposal deadlines at creation, after a decision and after confirmation", () => {
    expect(ok(proposalDeadlinesAtCreation(NOW))).toEqual({
      proposalExpiresAtMs: NOW + 24 * HOUR,
      cleanupDueAtMs: NOW + 24 * HOUR + 5 * MIN,
      metadataExpiresAtMs: NOW + 48 * HOUR,
    });
    // Rejection or cancellation: content access ends now, cleanup within the five-minute grace.
    const decidedAt = NOW + 2 * HOUR;
    expect(ok(proposalDeadlinesAfterDecision(proposalRow(), decidedAt))).toEqual({
      proposalExpiresAtMs: decidedAt,
      cleanupDueAtMs: decidedAt + 5 * MIN,
      metadataExpiresAtMs: NOW + 48 * HOUR,
    });
    // Confirmation late in the window: content follows the operation's Undo window and the receipt
    // deadline extends to the operation's.
    const confirmAt = NOW + 23 * HOUR;
    const operation = operationRow({
      kind: "add_task",
      appliedAtMs: confirmAt,
      undoUntilMs: confirmAt + 5 * MIN,
      metadataExpiresAtMs: confirmAt + 48 * HOUR,
      createdAt: confirmAt,
      updatedAt: confirmAt,
    });
    expect(ok(proposalDeadlinesAfterConfirmation(proposalRow(), operation))).toEqual({
      proposalExpiresAtMs: confirmAt + 5 * MIN,
      cleanupDueAtMs: confirmAt + 10 * MIN,
      metadataExpiresAtMs: confirmAt + 48 * HOUR,
    });
    fail(proposalDeadlinesAfterConfirmation(proposalRow(), noopRow()), "state_invariant");
  });

  test("proposal content is readable only while pending or confirmed, inside its window", () => {
    expect(isProposalContentReadable(proposalRow(), NOW + 24 * HOUR - 1)).toBe(true);
    expect(isProposalContentReadable(proposalRow(), NOW + 24 * HOUR)).toBe(false);
    const decided = { decidedAtMs: NOW + 10 };
    for (const status of ["rejected", "cancelled"]) {
      expect(isProposalContentReadable(proposalRow({ status, ...decided }), NOW + 11)).toBe(false);
    }
    expect(isProposalContentReadable(proposalRow({ status: "expired" }), NOW)).toBe(false);
    const confirmed = proposalRow({
      status: "confirmed",
      ...decided,
      confirmedOperationId: "op_1",
      confirmDigest: HEX_A,
      proposalExpiresAtMs: NOW + 5 * MIN,
      cleanupDueAtMs: NOW + 10 * MIN,
    });
    expect(isProposalContentReadable(confirmed, NOW + 5 * MIN - 1)).toBe(true);
    expect(isProposalContentReadable(confirmed, NOW + 5 * MIN)).toBe(false);
    expect(
      isProposalContentReadable(
        proposalRow({ payload: { state: "expired", expiredAtMs: NOW } }),
        NOW
      )
    ).toBe(false);
  });

  test("these windows are not the 30-day account restoration grace", () => {
    for (const ms of Object.values(PAGE_LEDGER_TIMING)) {
      expect(ms).toBeLessThan(ACCOUNT_RESTORE_GRACE_MS);
      expect(ms).not.toBe(ACCOUNT_RESTORE_GRACE_MS);
    }
    expect(PAGE_LEDGER_TIMING.undoWindowMs).toBe(300_000);
    expect(PAGE_LEDGER_TIMING.cleanupGraceMs).toBe(300_000);
    expect(PAGE_LEDGER_TIMING.receiptRetentionMs).toBe(172_800_000);
    expect(PAGE_LEDGER_TIMING.proposalLifetimeMs).toBe(86_400_000);
  });

  test("repeated Undo decisions", () => {
    const target = operationRow({ _id: "op_1" });
    expect(ok(decideUndoRequest({ nowMs: NOW, target }))).toEqual({ decision: "eligible" });
    expect(ok(decideUndoRequest({ nowMs: NOW + 5 * MIN - 1, target })).decision).toBe("eligible");
    fail(decideUndoRequest({ nowMs: NOW + 5 * MIN, target }), "undo_expired");
    fail(decideUndoRequest({ nowMs: NOW - 1, target }), "undo_not_open");
    const undone = operationRow({
      _id: "op_1",
      undoneAtMs: NOW + 1_000,
      undoneByOperationId: "op_2",
    });
    // An authorized retry gets the previous result with no second write, even after the window.
    expect(ok(decideUndoRequest({ nowMs: NOW + 1_001, target: undone }))).toEqual({
      decision: "already_undone",
      undoOperationId: "op_2",
    });
    expect(ok(decideUndoRequest({ nowMs: NOW + 6 * MIN, target: undone })).decision).toBe(
      "already_undone"
    );
    // ... while the receipt is retained.
    expect(ok(decideUndoRequest({ nowMs: NOW + 48 * HOUR - 1, target: undone })).decision).toBe(
      "already_undone"
    );
    fail(decideUndoRequest({ nowMs: NOW + 48 * HOUR, target: undone }), "undo_receipt_expired");
  });

  test("noops, undo receipts and deleted rows are not undoable", () => {
    fail(decideUndoRequest({ nowMs: NOW, target: noopRow({ _id: "op_1" }) }), "undo_not_undoable");
    fail(decideUndoRequest({ nowMs: NOW, target: undoRow({ _id: "op_5" }) }), "undo_not_undoable");
    fail(
      decideUndoRequest({ nowMs: NOW, target: operationRow({ deletedAt: NOW }) }),
      "row_deleted"
    );
    fail(decideUndoRequest({ nowMs: Number.NaN, target: operationRow() }), "invalid_timestamp");
    fail(decideUndoRequest({ nowMs: NOW, target: { junk: 1 } }), "unexpected_field");
  });
});

// ---------------------------------------------------------------------------------------------
// D4: splices, diffs and reconstruction
// ---------------------------------------------------------------------------------------------

/** Literal right-to-left application, as D4 describes it. */
function applyRightToLeft(base: string, splices: readonly PageSplice[]): string {
  let out = base;
  for (let i = splices.length - 1; i >= 0; i -= 1) {
    const s = splices[i] as PageSplice;
    out =
      out.slice(0, s.startUtf16) + s.insertedText + out.slice(s.startUtf16 + s.removedText.length);
  }
  return out;
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = [
  "a",
  "b",
  "c",
  " ",
  "\n",
  "\r\n",
  "é",
  "é",
  "😀",
  "😁",
  "\u{1F200}",
  "日",
  "`",
  "# ",
];
function randomText(random: () => number, maxPieces: number): string {
  const count = Math.floor(random() * (maxPieces + 1));
  let out = "";
  for (let i = 0; i < count; i += 1) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return out;
}
const isSafeBoundary = (text: string, offset: number) =>
  !(
    offset > 0 &&
    offset < text.length &&
    /[\ud800-\udbff]/.test(text[offset - 1] as string) &&
    /[\udc00-\udfff]/.test(text[offset] as string)
  );

describe("linear prefix/suffix diff", () => {
  test("identical strings plan no hunk", () => {
    expect(diffToSingleSplice("same", "same")).toEqual([]);
    expect(diffToSingleSplice("", "")).toEqual([]);
  });

  test("insertions, deletions and replacements are one exact hunk", () => {
    expect(diffToSingleSplice("abcdef", "abXXdef")).toEqual([
      { startUtf16: 2, removedText: "c", insertedText: "XX" },
    ]);
    expect(diffToSingleSplice("abcdef", "abcdefgh")).toEqual([
      { startUtf16: 6, removedText: "", insertedText: "gh" },
    ]);
    expect(diffToSingleSplice("abcdef", "cdef")).toEqual([
      { startUtf16: 0, removedText: "ab", insertedText: "" },
    ]);
    expect(diffToSingleSplice("", "new")).toEqual([
      { startUtf16: 0, removedText: "", insertedText: "new" },
    ]);
    expect(diffToSingleSplice("old", "")).toEqual([
      { startUtf16: 0, removedText: "old", insertedText: "" },
    ]);
  });

  test("a complete rewrite is one hunk holding the whole former body (explicit decision)", () => {
    const [hunk] = diffToSingleSplice("alpha beta", "0123456789");
    expect(hunk).toEqual({ startUtf16: 0, removedText: "alpha beta", insertedText: "0123456789" });
  });

  test("CRLF is preserved exactly and never normalized", () => {
    expect(diffToSingleSplice("a\r\nb\r\nc", "a\r\nB\r\nc")).toEqual([
      { startUtf16: 3, removedText: "b", insertedText: "B" },
    ]);
    expect(diffToSingleSplice("a\r\nb", "a\nb")).toEqual([
      { startUtf16: 1, removedText: "\r", insertedText: "" },
    ]);
  });

  test("combining marks are plain code units: only the changed unit is replaced", () => {
    expect(diffToSingleSplice("café!", "cafe!")).toEqual([
      { startUtf16: 4, removedText: "́", insertedText: "" },
    ]);
  });

  test("a hunk boundary never splits a surrogate pair", () => {
    // 😀 = D83D DE00, 😁 = D83D DE01: the shared high surrogate must not become the prefix.
    expect(diffToSingleSplice("a😀b", "a😁b")).toEqual([
      { startUtf16: 1, removedText: "😀", insertedText: "😁" },
    ]);
    // U+1F200 = D83C DE00 shares its low surrogate with 😀's neighbour: the suffix must not split.
    expect(diffToSingleSplice("a\u{1F600}", "a\u{1F200}")).toEqual([
      { startUtf16: 1, removedText: "\u{1F600}", insertedText: "\u{1F200}" },
    ]);
    expect(diffToSingleSplice("😀", "😀😀")).toEqual([
      { startUtf16: 2, removedText: "", insertedText: "😀" },
    ]);
  });

  test("seeded random pairs: apply, invert and right-to-left all agree, with safe boundaries", () => {
    const random = mulberry32(0x5eed);
    for (let i = 0; i < 400; i += 1) {
      const before = randomText(random, 12);
      let after: string;
      if (random() < 0.7) {
        const cut = Math.floor(random() * (before.length + 1));
        const span = Math.floor(random() * (before.length - cut + 1));
        after = before.slice(0, cut) + randomText(random, 4) + before.slice(cut + span);
      } else {
        after = randomText(random, 12);
      }
      // Edits that cut inside a surrogate pair are not valid strings, so skip them.
      if (!/^(?:[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff])*$/.test(after)) continue;
      const splices = diffToSingleSplice(before, after);
      if (before === after) {
        expect(splices).toEqual([]);
        continue;
      }
      const [hunk] = splices as [PageSplice];
      expect(isSafeBoundary(before, hunk.startUtf16)).toBe(true);
      expect(isSafeBoundary(before, hunk.startUtf16 + hunk.removedText.length)).toBe(true);
      expect(isSafeBoundary(after, hunk.startUtf16)).toBe(true);
      expect(isSafeBoundary(after, hunk.startUtf16 + hunk.insertedText.length)).toBe(true);
      expect(ok(applyPageSplices(before, splices))).toBe(after);
      expect(applyRightToLeft(before, splices)).toBe(after);
      expect(ok(applyPageSplices(after, ok(invertPageSplices(splices))))).toBe(before);
    }
  });
});

describe("forward and inverse reconstruction", () => {
  const base = "The quick brown fox jumps over the lazy dog.";
  const splices: PageSplice[] = [
    { startUtf16: 4, removedText: "quick", insertedText: "slow" },
    { startUtf16: 16, removedText: "", insertedText: "(sly) " },
    { startUtf16: 35, removedText: "lazy ", insertedText: "" },
  ];

  test("forward application equals the literal right-to-left reference", () => {
    const result = ok(applyPageSplices(base, splices));
    expect(result).toBe("The slow brown (sly) fox jumps over the dog.");
    expect(applyRightToLeft(base, splices)).toBe(result);
  });

  test("the inverse, in result coordinates, restores the base byte for byte", () => {
    const result = ok(applyPageSplices(base, splices));
    const inverse = ok(invertPageSplices(splices));
    expect(inverse.map((s) => s.startUtf16)).toEqual([4, 15, 40]);
    expect(ok(applyPageSplices(result, inverse))).toBe(base);
  });

  test("seeded random multi-hunk lists round-trip", () => {
    const random = mulberry32(0xc0ffee);
    let checked = 0;
    for (let i = 0; i < 300; i += 1) {
      const text = randomText(random, 20);
      const list: PageSplice[] = [];
      let cursor = 0;
      while (list.length < 6 && cursor <= text.length) {
        const start = cursor + Math.floor(random() * 4);
        const end = start + Math.floor(random() * 4);
        if (end > text.length) break;
        if (!isSafeBoundary(text, start) || !isSafeBoundary(text, end)) {
          cursor = start + 1;
          continue;
        }
        const removedText = text.slice(start, end);
        const insertedText = randomText(random, 3);
        if (removedText !== insertedText)
          list.push({ startUtf16: start, removedText, insertedText });
        cursor = end + 1;
      }
      if (list.length === 0) continue;
      const forward = applyPageSplices(text, list);
      if (!forward.ok) {
        // Only structural refusals are acceptable here (for example touching hunks).
        expect(["splice_ambiguous", "splice_overlap"]).toContain(forward.code);
        continue;
      }
      checked += 1;
      expect(forward.value).toBe(applyRightToLeft(text, list));
      expect(ok(applyPageSplices(forward.value, ok(invertPageSplices(list))))).toBe(text);
    }
    expect(checked).toBeGreaterThan(50);
  });

  test("a wrong removed fragment, bad offset or surrogate split applies nothing", () => {
    fail(
      applyPageSplices("abcdef", [{ startUtf16: 1, removedText: "X", insertedText: "y" }]),
      "fragment_mismatch"
    );
    fail(
      applyPageSplices("abcdef", [{ startUtf16: 5, removedText: "fg", insertedText: "y" }]),
      "splice_out_of_range"
    );
    fail(
      applyPageSplices("abc", [{ startUtf16: 9, removedText: "", insertedText: "y" }]),
      "splice_out_of_range"
    );
    // Offset 2 is between the halves of the second emoji: "a😀😁" = a D83D DE00 D83D DE01.
    fail(
      applyPageSplices("a😀😁", [{ startUtf16: 2, removedText: "", insertedText: "x" }]),
      "splice_splits_surrogate"
    );
    fail(
      applyPageSplices("a😀😁", [{ startUtf16: 1, removedText: "\ud83d", insertedText: "x" }]),
      "malformed_text"
    );
    fail(
      applyPageSplices("a😀😁", [{ startUtf16: 0, removedText: "a\ud83d", insertedText: "x" }]),
      "malformed_text"
    );
    // The same offsets are fine on a pair boundary.
    expect(
      ok(applyPageSplices("a😀😁", [{ startUtf16: 3, removedText: "", insertedText: "x" }]))
    ).toBe("a😀x😁");
    fail(
      applyPageSplices("a😀😁", [
        { startUtf16: 1, removedText: "😀", insertedText: "x" },
        { startUtf16: 2, removedText: "", insertedText: "y" },
      ]),
      "splice_overlap"
    );
  });

  test("a splice that ends in the middle of a pair is refused even with a well-formed fragment", () => {
    // "a😀" removed at [0,2) would leave a stray low surrogate behind.
    fail(
      applyPageSplices("a😀", [{ startUtf16: 0, removedText: "a\ud83d", insertedText: "" }]),
      "malformed_text"
    );
    fail(
      applyPageSplices("😀", [{ startUtf16: 1, removedText: "", insertedText: "x" }]),
      "splice_splits_surrogate"
    );
    fail(
      applyPageSplices("😀", [{ startUtf16: 0, removedText: "x", insertedText: "y" }]),
      "splice_splits_surrogate"
    );
    fail(
      applyPageSplices("ab", [{ startUtf16: 0, removedText: "x", insertedText: "y" }]),
      "fragment_mismatch"
    );
  });
});

// ---------------------------------------------------------------------------------------------
// D4: planning writes (arbitrary Markdown saves and exact-splice edits)
// ---------------------------------------------------------------------------------------------

describe("planning body writes", () => {
  test("an applied save advances exactly one revision and records offsets and lengths only", async () => {
    const plan = ok(
      await planBodyChange({ before: "hello world", after: "hello brave world", noteRevision: 4 })
    );
    expect(plan.facts).toMatchObject({
      result: "applied",
      affectsBody: true,
      baseRevision: 4,
      resultRevision: 5,
      baseBodyDigest: sha("hello world"),
      resultBodyDigest: sha("hello brave world"),
      delta: [{ startUtf16: 6, removedLengthUtf16: 0, insertedLengthUtf16: 6 }],
    });
    expect(plan.splices).toEqual([{ startUtf16: 6, removedText: "", insertedText: "brave " }]);
    expect(plan.resultBody).toBe("hello brave world");
    expect(JSON.stringify(plan.facts)).not.toContain("brave");
  });

  test("a legacy note (no revision) is revision 0 and its first write is revision 1", async () => {
    const plan = ok(await planBodyChange({ before: "old", after: "new", noteRevision: undefined }));
    expect(plan.facts.baseRevision).toBe(0);
    expect(plan.facts.resultRevision).toBe(1);
  });

  test("a byte-identical save is a noop: same revision, same digests, empty delta, no fragments", async () => {
    const plan = ok(
      await planBodyChange({ before: "keep\r\n", after: "keep\r\n", noteRevision: 9 })
    );
    expect(plan.facts).toEqual({
      result: "noop",
      affectsBody: false,
      baseRevision: 9,
      resultRevision: 9,
      baseBodyDigest: sha("keep\r\n"),
      resultBodyDigest: sha("keep\r\n"),
      delta: [],
    });
    expect(plan.splices).toEqual([]);
    // A change of only line endings or only Unicode form is NOT a noop.
    expect(
      ok(await planBodyChange({ before: "a\nb", after: "a\r\nb", noteRevision: 0 })).facts.result
    ).toBe("applied");
    expect(
      ok(await planBodyChange({ before: "é", after: "é", noteRevision: 0 })).facts.result
    ).toBe("applied");
  });

  test("an oversized write fails before mutation; nothing is truncated", async () => {
    const limit = PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes;
    fail(
      await planBodyChange({ before: "a", after: "a".repeat(limit + 1), noteRevision: 0 }),
      "body_too_large_utf8"
    );
    const exact = ok(
      await planBodyChange({ before: "a", after: "a".repeat(limit), noteRevision: 0 })
    );
    expect(exact.resultBody.length).toBe(limit);
    fail(
      await planBodyChange({ before: "a", after: "a\ud800", noteRevision: 0 }),
      "malformed_text"
    );
  });

  test("a legacy body larger than the budget stays readable; only a write is held to it", async () => {
    const legacy = "x".repeat(200_000);
    // Unchanged: still a noop.
    expect(
      ok(await planBodyChange({ before: legacy, after: legacy, noteRevision: 3 })).facts.result
    ).toBe("noop");
    // Edit that leaves it over budget: refused.
    fail(
      await planBodyChange({ before: legacy, after: `${legacy}y`, noteRevision: 3 }),
      "body_too_large_utf8"
    );
    // Edit that brings it under budget: allowed while the former body still fits the fragment budget.
    const shrink = ok(await planBodyChange({ before: legacy, after: "short", noteRevision: 3 }));
    expect(shrink.facts.result).toBe("applied");
    // A 300,000-character former body cannot be kept as a bounded inverse, so the write fails.
    fail(
      await planBodyChange({ before: "x".repeat(300_000), after: "short", noteRevision: 3 }),
      "fragments_too_large"
    );
  });

  test("a whole-body rewrite inside the budgets is allowed and holds the whole former body", async () => {
    const before = "p".repeat(100_000);
    const after = "q".repeat(100_000);
    const plan = ok(await planBodyChange({ before, after, noteRevision: 0 }));
    expect(plan.splices).toHaveLength(1);
    expect(plan.splices[0]?.removedText).toBe(before);
  });

  test("exact-splice plans address a known target by offset and apply all or nothing", async () => {
    const before = "alpha\nbeta\ngamma\n";
    const plan = ok(
      await planSpliceChange({
        before,
        noteRevision: 2,
        splices: [
          { startUtf16: 0, removedText: "alpha", insertedText: "ALPHA" },
          { startUtf16: 11, removedText: "gamma", insertedText: "GAMMA" },
        ],
      })
    );
    expect(plan.resultBody).toBe("ALPHA\nbeta\nGAMMA\n");
    expect(plan.facts.delta).toHaveLength(2);
    fail(
      await planSpliceChange({
        before,
        noteRevision: 2,
        splices: [
          { startUtf16: 0, removedText: "alpha", insertedText: "ALPHA" },
          { startUtf16: 11, removedText: "WRONG", insertedText: "GAMMA" },
        ],
      }),
      "fragment_mismatch"
    );
    const none = ok(await planSpliceChange({ before, noteRevision: 2, splices: [] }));
    expect(none.facts.result).toBe("noop");
  });

  test("untouched source, broken blocks and adjacent blocks survive exactly", async () => {
    const good = taskFence(BLOCK_A, "Keep me");
    const adjacent = taskFence(BLOCK_B, "Adjacent");
    const broken = "```json tempo\n{not json\n```\n";
    const unclosed = '```json tempo\n{"type":"task"';
    const before = `# Page\r\n\r\n${good}${adjacent}${broken}after é text 😀\r\n${unclosed}`;
    const edited = before.replace("after é text", "AFTER é TEXT");
    const plan = ok(await planBodyChange({ before, after: edited, noteRevision: 1 }));
    expect(plan.resultBody).toBe(edited);
    // The canonical codec round-trips the result with no source loss.
    expect(serializeTempoBlocks(parseTempoBlocks(plan.resultBody))).toBe(plan.resultBody);
    expect(plan.codec.validBlocks).toBe(2);
    expect(plan.codec.brokenBlocks).toBe(2);
    for (const exact of [good, adjacent, broken, unclosed, "\r\n\r\n", "😀\r\n"]) {
      expect(plan.resultBody).toContain(exact);
    }
    // The hunk touches only the edited words.
    expect(plan.splices[0]?.removedText).not.toContain("```");
  });

  test("a task block appended by exact offset is addressed without text search", async () => {
    const before = "# Today\n\nNotes.\n\n";
    const fence = taskFence(BLOCK_A, "Email supervisor");
    const plan = ok(
      await planSpliceChange({
        before,
        noteRevision: undefined,
        splices: [{ startUtf16: before.length, removedText: "", insertedText: fence }],
      })
    );
    expect(plan.codec.validBlocks).toBe(1);
    expect(plan.facts.delta).toEqual([
      { startUtf16: before.length, removedLengthUtf16: 0, insertedLengthUtf16: fence.length },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// D4: interval transform
// ---------------------------------------------------------------------------------------------

describe("interval transform across a later delta", () => {
  const d = (startUtf16: number, removedLengthUtf16: number, insertedLengthUtf16: number) => ({
    startUtf16,
    removedLengthUtf16,
    insertedLengthUtf16,
  });
  const interval = { start: 10, end: 14 };

  test("edits strictly before shift the interval; edits strictly after leave it alone", () => {
    expect(transformIntervalAcrossDelta(interval, [d(9, 0, 2)])).toEqual({ start: 12, end: 16 });
    expect(transformIntervalAcrossDelta(interval, [d(5, 4, 1)])).toEqual({ start: 7, end: 11 });
    expect(transformIntervalAcrossDelta(interval, [d(0, 3, 0)])).toEqual({ start: 7, end: 11 });
    expect(transformIntervalAcrossDelta(interval, [d(15, 0, 3)])).toEqual(interval);
    expect(transformIntervalAcrossDelta(interval, [d(15, 2, 0)])).toEqual(interval);
    expect(transformIntervalAcrossDelta(interval, [d(2, 1, 3), d(20, 0, 5)])).toEqual({
      start: 12,
      end: 16,
    });
    expect(transformIntervalAcrossDelta(interval, [])).toEqual(interval);
  });

  test("insertions inside or at either edge conflict", () => {
    for (const at of [10, 11, 12, 13, 14]) {
      expect(transformIntervalAcrossDelta(interval, [d(at, 0, 1)])).toBeUndefined();
    }
  });

  test("any touching or overlapping replacement or deletion conflicts", () => {
    const touching: [number, number][] = [
      [6, 4], // ends exactly at the left edge
      [14, 2], // starts exactly at the right edge
      [8, 4], // overlaps the left part
      [12, 8], // overlaps the right part
      [9, 7], // covers it
      [11, 2], // inside it
      [10, 4], // the same span
    ];
    for (const [start, removed] of touching) {
      expect(transformIntervalAcrossDelta(interval, [d(start, removed, 1)])).toBeUndefined();
    }
    // One unit clear on either side is not touching.
    expect(transformIntervalAcrossDelta(interval, [d(5, 4, 1)])).toBeDefined();
    expect(transformIntervalAcrossDelta(interval, [d(15, 4, 1)])).toBeDefined();
  });

  test("a zero-width restore anchor conflicts with any edit that touches it", () => {
    const anchor = { start: 10, end: 10 };
    expect(transformIntervalAcrossDelta(anchor, [d(10, 0, 1)])).toBeUndefined();
    expect(transformIntervalAcrossDelta(anchor, [d(8, 2, 0)])).toBeUndefined();
    expect(transformIntervalAcrossDelta(anchor, [d(10, 2, 0)])).toBeUndefined();
    expect(transformIntervalAcrossDelta(anchor, [d(9, 2, 5)])).toBeUndefined();
    expect(transformIntervalAcrossDelta(anchor, [d(9, 0, 4)])).toEqual({ start: 14, end: 14 });
    expect(transformIntervalAcrossDelta(anchor, [d(11, 0, 4)])).toEqual(anchor);
    expect(transformIntervalAcrossDelta(anchor, [d(11, 2, 0)])).toEqual(anchor);
    expect(transformIntervalAcrossDelta(anchor, [d(6, 3, 0)])).toEqual({ start: 7, end: 7 });
  });

  test("one conflicting entry among otherwise harmless ones conflicts the whole delta", () => {
    expect(transformIntervalAcrossDelta(interval, [d(0, 1, 2), d(12, 0, 1)])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------
// D4: chain validation
// ---------------------------------------------------------------------------------------------

describe("gap-free hash-linked chain", () => {
  async function build() {
    const ledger = new Ledger("one two three four\n", 0);
    const target = await ledger.apply({ after: "one TWO three four\n" });
    const second = await ledger.apply({ after: "one TWO three FOUR\n" });
    const third = await ledger.apply({ after: "zero one TWO three FOUR\n" });
    const fourth = await ledger.apply({ after: "zero one TWO three FOUR!\n" });
    return { ledger, target, second, third, fourth };
  }
  const validate = async (
    ledger: Ledger,
    targetId: string,
    chain: unknown[],
    overrides: { currentRevision?: number; body?: string } = {}
  ) =>
    validateOperationChain({
      target: ledger.target(targetId),
      intervening: reload(chain),
      currentRevision: overrides.currentRevision ?? (ledger.revision as number),
      currentBodyDigest: ok(await digestBody(overrides.body ?? ledger.body)),
    });

  test("the exact sequence target+1 .. current validates, including the empty chain", async () => {
    const { ledger, target } = await build();
    const chain = ok(
      await validate(ledger, target.op._id as string, ledger.intervening(target.op._id as string))
    );
    expect(chain.map((entry) => entry.resultRevision)).toEqual([2, 3, 4]);
    const last = ledger.ops.at(-1) as PageOperationFacts;
    expect(ok(await validate(ledger, last._id as string, []))).toEqual([]);
  });

  test("an incomplete, excess, gapped or duplicated chain fails safely", async () => {
    const { ledger, target } = await build();
    const id = target.op._id as string;
    const chain = ledger.intervening(id);
    const [second, third, fourth] = chain as [
      PageOperationFacts,
      PageOperationFacts,
      PageOperationFacts,
    ];
    fail(await validate(ledger, id, [second, third]), "chain_incomplete");
    fail(await validate(ledger, id, []), "chain_incomplete");
    const extra = { ...fourth, resultRevision: 5, baseRevision: 4 };
    fail(await validate(ledger, id, [second, third, fourth, extra]), "chain_excess");
    const skipped = { ...fourth, baseRevision: 4, resultRevision: 5 };
    // Same count as the revisions, but the third entry jumps from 3 to 5.
    fail(await validate(ledger, id, [second, third, skipped]), "chain_gap");
    fail(await validate(ledger, id, [second, second, third]), "chain_duplicate");
    fail(await validate(ledger, id, [third, second, fourth]), "chain_gap");
  });

  test("a broken hash link, a different current body or a wrong revision fails", async () => {
    const { ledger, target } = await build();
    const id = target.op._id as string;
    const [second, third, fourth] = ledger.intervening(id) as [
      PageOperationFacts,
      PageOperationFacts,
      PageOperationFacts,
    ];
    fail(
      await validate(ledger, id, [second, { ...third, baseBodyDigest: HEX_A }, fourth]),
      "chain_hash_link"
    );
    fail(
      await validate(ledger, id, [{ ...second, baseBodyDigest: HEX_A }, third, fourth]),
      "chain_hash_link"
    );
    fail(
      await validate(ledger, id, [second, third, fourth], { body: "something else entirely\n" }),
      "current_body_digest_mismatch"
    );
    fail(
      await validate(ledger, id, [second, third, fourth], { currentRevision: 3 }),
      "chain_excess"
    );
    fail(
      await validate(ledger, id, [second, third, fourth], { currentRevision: 0 }),
      "chain_revision_mismatch"
    );
  });

  test("deleted, malformed, foreign, noop and mis-owned entries fail safely", async () => {
    const { ledger, target } = await build();
    const id = target.op._id as string;
    const [second, third, fourth] = ledger.intervening(id) as [
      PageOperationFacts,
      PageOperationFacts,
      PageOperationFacts,
    ];
    fail(
      await validate(ledger, id, [{ ...second, deletedAt: NOW }, third, fourth]),
      "chain_entry_deleted"
    );
    const { requestId: _dropped, ...malformed } = second;
    fail(await validate(ledger, id, [malformed, third, fourth]), "chain_entry_malformed");
    fail(
      await validate(ledger, id, [second, { ...third, extra: 1 }, fourth]),
      "chain_entry_malformed"
    );
    fail(
      await validate(ledger, id, [second, { ...third, noteId: OTHER_NOTE }, fourth]),
      "record_mismatch"
    );
    fail(
      await validate(ledger, id, [second, { ...third, userId: "user_2" }, fourth]),
      "record_mismatch"
    );
    const noop = { ...third, result: "noop", affectsBody: false };
    fail(await validate(ledger, id, [second, noop, fourth]), "chain_entry_malformed");
  });

  test("an undo of the target that the target does not record is an inconsistent ledger", async () => {
    const { ledger, target } = await build();
    const id = target.op._id as string;
    const [second, third, fourth] = ledger.intervening(id) as [
      PageOperationFacts,
      PageOperationFacts,
      PageOperationFacts,
    ];
    const rogue = { ...third, kind: "undo", undoOfOperationId: id, undoUntilMs: undefined };
    fail(await validate(ledger, id, [second, rogue, fourth]), "chain_inconsistent");
  });

  test("the intervening bound is 256: 256 plan, 257 do not", async () => {
    const ledger = new Ledger("start\n", 0);
    const target = await ledger.apply({
      splices: [{ startUtf16: 0, removedText: "start", insertedText: "begin" }],
    });
    for (let i = 0; i < 256; i += 1) {
      await ledger.apply({
        splices: [{ startUtf16: ledger.body.length, removedText: "", insertedText: "x" }],
      });
    }
    const id = target.op._id as string;
    expect(ledger.intervening(id)).toHaveLength(256);
    const plan = ok(await planUndo(ledger.undoInput(id, NOW + 1_000)));
    expect(plan.interveningCount).toBe(256);
    expect(plan.candidateBody.startsWith("start\n")).toBe(true);

    await ledger.apply({
      splices: [{ startUtf16: ledger.body.length, removedText: "", insertedText: "y" }],
    });
    expect(ledger.intervening(id)).toHaveLength(257);
    // The caller's take(257) detects the excess; passing all 257 entries is refused...
    fail(await planUndo(ledger.undoInput(id, NOW + 1_000)), "too_many_intervening_revisions");
    // ...and so is a truncated list that does not account for the revision distance.
    const truncated = ledger.undoInput(id, NOW + 1_000);
    truncated.intervening = truncated.intervening.slice(0, 256);
    fail(await planUndo(truncated), "too_many_intervening_revisions");
  });
});

// ---------------------------------------------------------------------------------------------
// D4: surgical Undo
// ---------------------------------------------------------------------------------------------

describe("surgical Undo plans", () => {
  test("example 1: coach adds a task; a later edit to earlier prose; Undo removes only the task", async () => {
    const intro = "# Today\n\nWrite the intro paragraph.\n\n";
    const ledger = new Ledger(intro);
    const fence = taskFence(BLOCK_A, "Email supervisor");
    const added = await ledger.apply(
      { splices: [{ startUtf16: intro.length, removedText: "", insertedText: fence }] },
      NOW,
      "add_task"
    );
    const edited = ledger.body.replace(
      "Write the intro paragraph.",
      "Write the whole intro paragraph, twice."
    );
    await ledger.apply({ after: edited }, NOW + 1_000);
    expect(parseTempoBlocks(ledger.body).filter((s) => s.kind === "valid")).toHaveLength(1);

    // "Reload": the plan sees only JSON round-tripped rows, as if read back from the database.
    const plan = ok(await planUndo(ledger.undoInput(added.op._id as string, NOW + 2_000)));
    expect(plan.candidateBody).toBe(edited.replace(fence, ""));
    expect(plan.candidateBody).toContain("Write the whole intro paragraph, twice.");
    expect(plan.codec.validBlocks).toBe(0);
    expect(plan.targetOperationId).toBe(added.op._id as string);
    expect(plan.interveningCount).toBe(1);
    expect(plan.facts).toMatchObject({
      result: "applied",
      affectsBody: true,
      baseRevision: 2,
      resultRevision: 3,
      baseBodyDigest: sha(ledger.body),
      resultBodyDigest: sha(plan.candidateBody),
    });
    // The edit before the target shifted it: the Undo removes the block at its NEW offset.
    expect(plan.facts.delta).toEqual([
      {
        startUtf16: edited.indexOf(fence),
        removedLengthUtf16: fence.length,
        insertedLengthUtf16: 0,
      },
    ]);
  });

  test("example 2: a task tick replaces its exact source segment; later unrelated prose survives Undo", async () => {
    const original = taskFence(BLOCK_A, "Email supervisor", "now");
    const body = `# Plan\n\nIntro text.\n\n${original}\nAfter the task.\n`;
    const ledger = new Ledger(body, 4);
    const segment = parseTempoBlocks(body).find((s) => s.kind === "valid") as {
      start: number;
      source: string;
    };
    const ticked = taskFence(BLOCK_A, "Email supervisor", "done", 1, "2026-10-11T10:00:00Z");
    const tick = await ledger.apply(
      {
        splices: [{ startUtf16: segment.start, removedText: segment.source, insertedText: ticked }],
      },
      NOW,
      "patch_block"
    );
    const later = ledger.body.replace("After the task.", "After the task, plus new notes.");
    await ledger.apply({ after: later }, NOW + 500);

    const plan = ok(await planUndo(ledger.undoInput(tick.op._id as string, NOW + 1_000)));
    expect(plan.candidateBody).toBe(
      body.replace("After the task.", "After the task, plus new notes.")
    );
    const restored = parseTempoBlocks(plan.candidateBody).find((s) => s.kind === "valid");
    expect(
      restored?.kind === "valid" && restored.block.type === "task" ? restored.block.data.status : ""
    ).toBe("now");
    expect(plan.facts).toMatchObject({ baseRevision: 6, resultRevision: 7 });
  });

  test("example 3: a later edit to the same task is a calm conflict and nothing is applied", async () => {
    const original = taskFence(BLOCK_A, "Email supervisor", "now");
    const body = `# Plan\n\n${original}\nAfter.\n`;
    const ledger = new Ledger(body, 0);
    const segment = parseTempoBlocks(body).find((s) => s.kind === "valid") as {
      start: number;
      source: string;
    };
    const ticked = taskFence(BLOCK_A, "Email supervisor", "done", 1, "2026-10-11T10:00:00Z");
    const tick = await ledger.apply(
      {
        splices: [{ startUtf16: segment.start, removedText: segment.source, insertedText: ticked }],
      },
      NOW,
      "patch_block"
    );
    const retitled = ledger.body.replace("Email supervisor", "Email the supervisor today");
    await ledger.apply({ after: retitled }, NOW + 500);
    const result = await planUndo(ledger.undoInput(tick.op._id as string, NOW + 1_000));
    fail(result, "conflict_overlapping_edit");
    // A failure carries no candidate body and no fragments.
    expect(Object.keys(result).sort()).toEqual(["code", "field", "index", "ok"]);
    expect(JSON.stringify(result)).not.toContain("supervisor");
    expect(ledger.body).toBe(retitled);
  });

  test("example 4: a broad rewrite followed by an edit inside the replaced span conflicts", async () => {
    const ledger = new Ledger("old page\nline two\n", 0);
    const rewrite = await ledger.apply({
      after: "Completely different content that shares nothing.\n",
    });
    expect(rewrite.plan.splices[0]?.removedText).toBe("old page\nline two");
    await ledger.apply({ after: ledger.body.replace("different", "unrelated") }, NOW + 500);
    const result = await planUndo(ledger.undoInput(rewrite.op._id as string, NOW + 1_000));
    fail(result, "conflict_overlapping_edit");
    // No whole-body restore is offered: the only outcome is the typed failure.
    expect(result.ok).toBe(false);
  });

  test("example 4b: an edit wholly outside the broad hunk still lets Undo restore the former text", async () => {
    const ledger = new Ledger("old page\nline two\n", 0);
    const rewrite = await ledger.apply({
      after: "Completely different content that shares nothing.\n",
    });
    await ledger.apply({ after: `${ledger.body}Appended afterwards.\n` }, NOW + 500);
    const plan = ok(await planUndo(ledger.undoInput(rewrite.op._id as string, NOW + 1_000)));
    expect(plan.candidateBody).toBe("old page\nline two\nAppended afterwards.\n");
  });

  test("example 5: identical passages are told apart by revisioned position, not text search", async () => {
    // Line 2 is changed from "tea" to "milk", so the inserted text now appears twice in the body.
    const ledger = new Ledger("Buy milk.\nBuy tea.\nDone.\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 14, removedText: "tea", insertedText: "milk" }],
    });
    expect(ledger.body).toBe("Buy milk.\nBuy milk.\nDone.\n");
    expect(ledger.body.split("milk")).toHaveLength(3);
    // An edit before the target shifts its position by one.
    await ledger.apply(
      { splices: [{ startUtf16: 4, removedText: "milk", insertedText: "oat milk" }] },
      NOW + 500
    );
    const plan = ok(await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)));
    expect(plan.candidateBody).toBe("Buy oat milk.\nBuy tea.\nDone.\n");
    expect(plan.facts.delta).toEqual([
      { startUtf16: 18, removedLengthUtf16: 4, insertedLengthUtf16: 3 },
    ]);
  });

  test("example 5b: when the revisioned position no longer holds the text, no nearby duplicate is chosen", async () => {
    const ledger = new Ledger("Buy milk.\nBuy tea.\nDone.\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 14, removedText: "tea", insertedText: "milk" }],
    });
    const target = ledger.target(change.op._id as string);
    // A later (forged but hash-consistent) revision claims to insert 4 units at offset 0 but
    // actually leaves different text at the shifted position, while "milk" still exists elsewhere.
    const tampered = "XXXXBuy milk.\nBuy ????.\nDone.\n";
    const forged = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(NOW - 99),
        requestDigest: HEX_A,
        kind: "save",
        source: "ui",
        nowMs: NOW + 500,
        change: {
          result: "applied",
          affectsBody: true,
          baseRevision: 1,
          resultRevision: 2,
          baseBodyDigest: target.resultBodyDigest,
          resultBodyDigest: sha(tampered),
          delta: [{ startUtf16: 0, removedLengthUtf16: 0, insertedLengthUtf16: 4 }],
        },
      })
    );
    const input = ledger.undoInput(change.op._id as string, NOW + 1_000);
    input.noteRevision = 2;
    input.currentBody = tampered;
    input.intervening = [reload({ ...forged, _id: "op_forged" }) as PageOperationFacts];
    fail(await planUndo(input), "conflict_target_changed");
  });

  test("later disjoint edits survive; edits at either side of a target both shift correctly", async () => {
    const ledger = new Ledger("head\nmiddle\ntail\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 5, removedText: "middle", insertedText: "CENTER-PIECE" }],
    });
    await ledger.apply(
      { splices: [{ startUtf16: 0, removedText: "head", insertedText: "the head line" }] },
      NOW + 1
    );
    await ledger.apply({ after: `${ledger.body}tail two\n` }, NOW + 2);
    const plan = ok(await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)));
    expect(plan.candidateBody).toBe("the head line\nmiddle\ntail\ntail two\n");
  });

  test("zero-width restore anchors: an edit touching the anchor conflicts; clear edits shift", async () => {
    const setup = async (laterSplice: PageSplice) => {
      const ledger = new Ledger("Buy milk and tea today.\n", 0);
      const change = await ledger.apply({
        splices: [{ startUtf16: 8, removedText: " and tea", insertedText: "" }],
      });
      await ledger.apply({ splices: [laterSplice] }, NOW + 500);
      return planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000));
    };
    // Body after the deletion: "Buy milk today.\n" with the anchor at offset 8.
    fail(
      await setup({ startUtf16: 8, removedText: "", insertedText: "!" }),
      "conflict_overlapping_edit"
    );
    fail(
      await setup({ startUtf16: 6, removedText: "lk", insertedText: "LK" }),
      "conflict_overlapping_edit"
    );
    fail(
      await setup({ startUtf16: 8, removedText: " t", insertedText: "" }),
      "conflict_overlapping_edit"
    );
    const before = ok(await setup({ startUtf16: 7, removedText: "", insertedText: "?" }));
    expect(before.candidateBody).toBe("Buy mil?k and tea today.\n");
    const after = ok(await setup({ startUtf16: 9, removedText: "", insertedText: "!" }));
    expect(after.candidateBody).toBe("Buy milk and tea !today.\n");
  });

  test("a non-empty target: an insertion at either edge or inside conflicts, one unit clear does not", async () => {
    const run = async (laterSplice: PageSplice) => {
      const ledger = new Ledger("alpha foo omega\n", 0);
      const change = await ledger.apply({
        splices: [{ startUtf16: 6, removedText: "foo", insertedText: "BARBAZ" }],
      });
      await ledger.apply({ splices: [laterSplice] }, NOW + 500);
      return planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000));
    };
    // Body after: "alpha BARBAZ omega\n"; the target occupies [6, 12).
    fail(
      await run({ startUtf16: 6, removedText: "", insertedText: "-" }),
      "conflict_overlapping_edit"
    );
    fail(
      await run({ startUtf16: 9, removedText: "", insertedText: "-" }),
      "conflict_overlapping_edit"
    );
    fail(
      await run({ startUtf16: 12, removedText: "", insertedText: "-" }),
      "conflict_overlapping_edit"
    );
    fail(
      await run({ startUtf16: 5, removedText: " ", insertedText: "_" }),
      "conflict_overlapping_edit"
    );
    fail(
      await run({ startUtf16: 12, removedText: " ", insertedText: "_" }),
      "conflict_overlapping_edit"
    );
    expect(ok(await run({ startUtf16: 5, removedText: "", insertedText: "-" })).candidateBody).toBe(
      "alpha- foo omega\n"
    );
    expect(
      ok(await run({ startUtf16: 13, removedText: "", insertedText: "-" })).candidateBody
    ).toBe("alpha foo -omega\n");
  });

  test("a multi-hunk operation is all or nothing", async () => {
    const make = async (laterSplice: PageSplice) => {
      const ledger = new Ledger("one two three four five\n", 0);
      const change = await ledger.apply({
        splices: [
          { startUtf16: 0, removedText: "one", insertedText: "ONE" },
          { startUtf16: 8, removedText: "three", insertedText: "THREE!" },
        ],
      });
      await ledger.apply({ splices: [laterSplice] }, NOW + 500);
      return planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000));
    };
    // Body after: "ONE two THREE! four five\n". An edit between the hunks shifts the second one.
    const between = ok(await make({ startUtf16: 4, removedText: "two", insertedText: "TWO-TWO" }));
    expect(between.candidateBody).toBe("one TWO-TWO three four five\n");
    expect(between.facts.delta).toHaveLength(2);
    // A conflict in only the second hunk rejects the whole plan: the first is not restored alone.
    const conflict = await make({ startUtf16: 12, removedText: "E", insertedText: "e" });
    fail(conflict, "conflict_overlapping_edit");
    if (!conflict.ok) expect(conflict.index).toBe(1);
    // A conflict in only the first hunk likewise.
    const first = await make({ startUtf16: 0, removedText: "O", insertedText: "0" });
    fail(first, "conflict_overlapping_edit");
    if (!first.ok) expect(first.index).toBe(0);
  });

  test("a wrong current slice fails even when every digest links", async () => {
    const ledger = new Ledger("keep and drop\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 5, removedText: "and drop", insertedText: "plus add" }],
    });
    const input = ledger.undoInput(change.op._id as string, NOW + 1_000);
    // The body is replaced by different text of the same length and its digest is recomputed, so
    // the hash chain cannot detect it; only the exact target-slice comparison can.
    const swapped = "keep xxxx xxx\n";
    input.currentBody = swapped;
    const op = input.target.operation as PageOperationFacts;
    input.target.operation = { ...op, resultBodyDigest: sha(swapped) } as never;
    fail(await planUndo(input), "conflict_target_changed");
  });

  test("the result is a candidate, not a write: the ledger body is unchanged and the plan is repeatable", async () => {
    const ledger = new Ledger("a b c\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 2, removedText: "b", insertedText: "B" }],
    });
    const bodyBefore = ledger.body;
    const first = ok(await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)));
    const second = ok(await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)));
    expect(second).toEqual(first);
    expect(ledger.body).toBe(bodyBefore);
    expect(first.candidateBody).toBe("a b c\n");
  });

  test("with no intervening revisions the Undo restores the exact base body", async () => {
    const base = "x\r\ny é 😀\r\nz\n";
    const ledger = new Ledger(base, 7);
    const change = await ledger.apply({ after: "x\r\nY é 😁\r\nz\n" });
    const plan = ok(await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)));
    expect(plan.candidateBody).toBe(base);
    expect(plan.facts.baseRevision).toBe(8);
    expect(plan.facts.resultRevision).toBe(9);
    expect(plan.interveningCount).toBe(0);
  });
});

describe("same-span conflicts and Undo in the chain", () => {
  test("a later edit that replaces exactly the same span is a conflict", async () => {
    const ledger = new Ledger("alpha foo omega\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 6, removedText: "foo", insertedText: "BARBAZ" }],
    });
    await ledger.apply(
      { splices: [{ startUtf16: 6, removedText: "BARBAZ", insertedText: "qux" }] },
      NOW + 500
    );
    fail(
      await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000)),
      "conflict_overlapping_edit"
    );
  });

  test("an Undo is itself a body revision that a later Undo transforms across", async () => {
    const ledger = new Ledger("aaa bbb ccc\n", 0);
    const first = await ledger.apply({
      splices: [{ startUtf16: 0, removedText: "aaa", insertedText: "AAA" }],
    });
    const second = await ledger.apply(
      { splices: [{ startUtf16: 8, removedText: "ccc", insertedText: "CCC" }] },
      NOW + 1
    );
    const undoOfFirst = await ledger.undo(first.op._id as string, NOW + 2);
    expect(ledger.body).toBe("aaa bbb CCC\n");
    expect(undoOfFirst.op.kind).toBe("undo");
    expect(undoOfFirst.op.undoUntilMs).toBeUndefined();

    const plan = ok(await planUndo(ledger.undoInput(second.op._id as string, NOW + 3)));
    expect(plan.candidateBody).toBe("aaa bbb ccc\n");
    expect(plan.interveningCount).toBe(1);

    // The already-undone target answers with its previous result; it is never undone twice.
    fail(await planUndo(ledger.undoInput(first.op._id as string, NOW + 4)), "undo_already_undone");
    expect(
      ok(decideUndoRequest({ nowMs: NOW + 4, target: ledger.target(first.op._id as string) }))
    ).toEqual({
      decision: "already_undone",
      undoOperationId: undoOfFirst.op._id as string,
    });
    // An Undo receipt itself is not undoable (no redo).
    fail(decideUndoRequest({ nowMs: NOW + 4, target: undoOfFirst.op }), "undo_not_undoable");
  });

  test("an operation whose region a later Undo did not touch can still be undone", async () => {
    const ledger = new Ledger("one two three\n", 0);
    const first = await ledger.apply({
      splices: [{ startUtf16: 4, removedText: "two", insertedText: "TWO" }],
    });
    await ledger.apply(
      { splices: [{ startUtf16: 8, removedText: "three", insertedText: "THREE" }] },
      NOW + 1
    );
    await ledger.undo(first.op._id as string, NOW + 2);
    const second = ledger.ops[1] as PageOperationFacts;
    // The second operation's region is untouched by the first's Undo, so it can still be undone.
    expect(ok(await planUndo(ledger.undoInput(second._id as string, NOW + 3))).candidateBody).toBe(
      "one two three\n"
    );
  });
});

describe("Undo eligibility and receipts at the planning boundary", () => {
  async function ledgerWithTarget() {
    const ledger = new Ledger("one two\n", 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: 4, removedText: "two", insertedText: "TWO" }],
    });
    return { ledger, id: change.op._id as string };
  }

  test("eligible from appliedAt up to, but excluding, undoUntil", async () => {
    const { ledger, id } = await ledgerWithTarget();
    expect(ok(await planUndo(ledger.undoInput(id, NOW))).candidateBody).toBe("one two\n");
    expect(ok(await planUndo(ledger.undoInput(id, NOW + 5 * MIN - 1))).candidateBody).toBe(
      "one two\n"
    );
    fail(await planUndo(ledger.undoInput(id, NOW + 5 * MIN)), "undo_expired");
    fail(await planUndo(ledger.undoInput(id, NOW + 6 * MIN)), "undo_expired");
    fail(await planUndo(ledger.undoInput(id, NOW - 1)), "undo_not_open");
  });

  test("an expired payload, a deleted payload, an undone target or a non-undoable target is refused", async () => {
    const { ledger, id } = await ledgerWithTarget();
    const expired = ledger.undoInput(id, NOW + 1_000);
    expired.target.payload = {
      ...(expired.target.payload as object),
      payload: { state: "expired", expiredAtMs: NOW + 700_000 },
    } as never;
    fail(await planUndo(expired), "undo_payload_expired");

    const deleted = ledger.undoInput(id, NOW + 1_000);
    deleted.target.payload = { ...(deleted.target.payload as object), deletedAt: NOW } as never;
    fail(await planUndo(deleted), "row_deleted");

    const undone = ledger.undoInput(id, NOW + 1_000);
    undone.target.operation = {
      ...(undone.target.operation as object),
      undoneAtMs: NOW + 10,
      undoneByOperationId: "op_99",
    } as never;
    fail(await planUndo(undone), "undo_already_undone");

    const noop = await ledger.apply({ after: ledger.body }, NOW + 20);
    expect(noop.op.result).toBe("noop");
    fail(
      await planUndo({
        nowMs: NOW + 30,
        userId: USER,
        noteId: NOTE,
        noteRevision: ledger.revision,
        currentBody: ledger.body,
        target: { operation: reload(noop.op), payload: undefined },
        intervening: [],
      }),
      "undo_not_undoable"
    );
  });

  test("rows from another owner or page are refused even though planning is not authorization", async () => {
    const { ledger, id } = await ledgerWithTarget();
    const otherNote = ledger.undoInput(id, NOW + 1_000);
    otherNote.noteId = OTHER_NOTE;
    fail(await planUndo(otherNote), "record_mismatch");
    const otherUser = ledger.undoInput(id, NOW + 1_000);
    otherUser.userId = "user_2";
    fail(await planUndo(otherUser), "record_mismatch");
    const badScope = ledger.undoInput(id, NOW + 1_000);
    badScope.userId = "";
    fail(await planUndo(badScope), "invalid_id");
  });

  test("a mismatched payload, a bad body or a bad revision fail before planning", async () => {
    const { ledger, id } = await ledgerWithTarget();
    const wrongPayload = ledger.undoInput(id, NOW + 1_000);
    wrongPayload.target.payload = {
      ...(wrongPayload.target.payload as object),
      operationId: "op_other",
    } as never;
    fail(await planUndo(wrongPayload), "record_mismatch");

    const badBody = ledger.undoInput(id, NOW + 1_000);
    badBody.currentBody = "bad\ud800";
    fail(await planUndo(badBody), "malformed_text");

    const badRevision = ledger.undoInput(id, NOW + 1_000);
    badRevision.noteRevision = Number.MAX_SAFE_INTEGER;
    fail(await planUndo(badRevision), "invalid_revision");

    const ceiling = ledger.undoInput(id, NOW + 1_000);
    const op = ceiling.target.operation as PageOperationFacts;
    ceiling.noteRevision = Number.MAX_SAFE_INTEGER - 1;
    ceiling.target.operation = {
      ...op,
      baseRevision: Number.MAX_SAFE_INTEGER - 3,
      resultRevision: Number.MAX_SAFE_INTEGER - 2,
    } as never;
    // The chain would be 1 entry long, so a mismatch is reported before any overflow concern.
    expect((await planUndo(ceiling)).ok).toBe(false);
  });

  test("the candidate must satisfy the write budget and the codec round trip", async () => {
    // Fill the page near the budget, change a small piece, then grow the page so that restoring a
    // longer original would exceed 128 KiB.
    const filler = "z".repeat(PAGE_LEDGER_LIMITS.maxBodyUtf8Bytes - 10);
    const ledger = new Ledger(`${filler}\nAAAAAAAA`, 0);
    const change = await ledger.apply({
      splices: [{ startUtf16: filler.length + 1, removedText: "AAAAAAAA", insertedText: "b" }],
    });
    await ledger.apply(
      { splices: [{ startUtf16: 0, removedText: "", insertedText: "newtext" }] },
      NOW + 1
    );
    // Restoring "AAAAAAAA" for "b" adds seven bytes to an already near-full page.
    const result = await planUndo(ledger.undoInput(change.op._id as string, NOW + 1_000));
    fail(result, "inverse_body_too_large");
  });
});

describe("builders and the single undone transition", () => {
  test("operation and payload builders produce rows that pass the strict validators", async () => {
    const plan = ok(await planBodyChange({ before: "abc", after: "aXc", noteRevision: 5 }));
    const facts = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(NOW - 1),
        requestDigest: HEX_A,
        kind: "patch_block",
        source: "mcp",
        change: plan.facts,
        nowMs: NOW,
      })
    );
    expect(facts).toMatchObject({
      result: "applied",
      undoUntilMs: NOW + 300_000,
      metadataExpiresAtMs: NOW + 172_800_000,
      appliedAtMs: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(ok(validatePageOperationFacts(facts))).toEqual(facts);
    const payload = ok(
      buildPayloadFacts({ operation: { ...facts, _id: "op_1" }, splices: plan.splices, nowMs: NOW })
    );
    expect(payload).toMatchObject({
      operationId: "op_1",
      undoUntilMs: NOW + 300_000,
      cleanupDueAtMs: NOW + 600_000,
      payload: { state: "available" },
    });
    expect(ok(validatePageOperationPayloadFacts(payload))).toEqual(payload);
  });

  test("noop receipts carry no undo fields; undo receipts must name their target", async () => {
    const noop = ok(await planBodyChange({ before: "same", after: "same", noteRevision: 0 }));
    const noopFacts = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(NOW - 1),
        requestDigest: HEX_A,
        kind: "save",
        source: "ui",
        change: noop.facts,
        nowMs: NOW,
      })
    );
    expect(noopFacts.undoUntilMs).toBeUndefined();
    expect(noopFacts.result).toBe("noop");
    fail(
      buildPayloadFacts({ operation: { ...noopFacts, _id: "op_1" }, splices: [], nowMs: NOW }),
      "state_invariant"
    );

    const applied = ok(await planBodyChange({ before: "a", after: "b", noteRevision: 0 }));
    const base = {
      userId: USER,
      noteId: NOTE,
      requestId: requestIdAt(NOW - 2),
      requestDigest: HEX_A,
      source: "ui" as const,
      change: applied.facts,
      nowMs: NOW,
    };
    fail(buildOperationFacts({ ...base, kind: "undo" }), "missing_field");
    const undo = ok(buildOperationFacts({ ...base, kind: "undo", undoOfOperationId: "op_1" }));
    expect(undo.undoUntilMs).toBeUndefined();
    fail(
      buildOperationFacts({ ...base, kind: "save", undoOfOperationId: "op_1" }),
      "state_invariant"
    );
    fail(buildOperationFacts({ ...base, kind: "save", proposalId: "prop_1" }), "state_invariant");
    expect(
      String(
        ok(buildOperationFacts({ ...base, kind: "add_task", proposalId: "prop_1" })).proposalId
      )
    ).toBe("prop_1");
    fail(
      buildPayloadFacts({
        operation: { ...undo, _id: "op_2" },
        splices: applied.splices,
        nowMs: NOW,
      }),
      "state_invariant"
    );
    fail(buildOperationFacts({ ...base, kind: "save", nowMs: -1 }), "invalid_timestamp");
  });

  test("a payload whose splices disagree with the operation's delta is refused", async () => {
    const plan = ok(await planBodyChange({ before: "abc", after: "aXc", noteRevision: 0 }));
    const facts = ok(
      buildOperationFacts({
        userId: USER,
        noteId: NOTE,
        requestId: requestIdAt(NOW - 1),
        requestDigest: HEX_A,
        kind: "save",
        source: "ui",
        change: plan.facts,
        nowMs: NOW,
      })
    );
    fail(
      buildPayloadFacts({
        operation: { ...facts, _id: "op_1" },
        splices: [{ startUtf16: 1, removedText: "bb", insertedText: "X" }],
        nowMs: NOW,
      }),
      "record_mismatch"
    );
  });

  test("marking an operation undone is the one allowed transition, and only while eligible", async () => {
    const target = operationRow({ _id: "op_1" });
    const undone = ok(markOperationUndone({ target, undoOperationId: "op_2", nowMs: NOW + 1_000 }));
    expect(undone).toMatchObject({
      undoneAtMs: NOW + 1_000,
      undoneByOperationId: "op_2",
      updatedAt: NOW + 1_000,
    });
    expect(undone.baseBodyDigest).toBe(HEX_B);
    fail(
      markOperationUndone({ target, undoOperationId: "op_2", nowMs: NOW + 5 * MIN }),
      "undo_expired"
    );
    fail(
      markOperationUndone({ target: undone, undoOperationId: "op_3", nowMs: NOW + 2_000 }),
      "undo_already_undone"
    );
    fail(markOperationUndone({ target, undoOperationId: "", nowMs: NOW + 1 }), "invalid_id");
  });
});

// ---------------------------------------------------------------------------------------------
// Failures are bounded and carry no note content
// ---------------------------------------------------------------------------------------------

describe("bounded errors", () => {
  test("no failure from any entry point echoes caller text", async () => {
    const secret = "SECRET-FRAGMENT-9f3a";
    const results: PageLedgerResult<unknown>[] = [
      validatePageSplices([{ startUtf16: 0, removedText: secret, insertedText: secret }]),
      validatePageSplices([{ startUtf16: 0, removedText: secret, insertedText: "\ud800" }]),
      applyPageSplices(`prefix ${secret}`, [
        { startUtf16: 0, removedText: "wrong", insertedText: secret },
      ]),
      validateProposalTaskInput({ title: " ", note: secret }),
      validateProposalTaskInput({ title: secret.repeat(40) }),
      encodePageRequest({
        kind: "save",
        noteId: NOTE,
        expectedRevision: 0,
        body: secret.repeat(20_000),
      }),
      encodePageRequest({
        kind: "patch_block",
        noteId: NOTE,
        expectedRevision: 0,
        blockId: BLOCK_A,
        patch: { [secret]: 1 },
      }),
      validatePageOperationFacts({ [secret]: 1 }),
      validatePageProposalFacts(proposalRow({ [secret]: 1 })),
      await planBodyChange({ before: secret, after: secret.repeat(30_000), noteRevision: 0 }),
      await planSpliceChange({
        before: secret,
        splices: [{ startUtf16: 0, removedText: "nope", insertedText: "x" }],
        noteRevision: 0,
      }),
      await planUndo({
        nowMs: NOW,
        userId: USER,
        noteId: NOTE,
        noteRevision: 1,
        currentBody: secret,
        target: { operation: { [secret]: 1 }, payload: {} },
        intervening: [],
      }),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(secret);
      if (!result.ok) {
        expect(
          Object.keys(result).every((key) => ["ok", "code", "field", "index"].includes(key))
        ).toBe(true);
        expect(typeof result.code).toBe("string");
      }
    }
  });

  test("a success returns metadata and the candidate body only, and no failure throws", async () => {
    const plan = ok(
      await planBodyChange({
        before: "private words here",
        after: "private words there",
        noteRevision: 0,
      })
    );
    expect(Object.keys(plan.facts).sort()).toEqual([
      "affectsBody",
      "baseBodyDigest",
      "baseRevision",
      "delta",
      "result",
      "resultBodyDigest",
      "resultRevision",
    ]);
    expect(JSON.stringify(plan.facts)).not.toContain("private");
    expect(JSON.stringify(plan.facts)).not.toContain("words");
    const hostile: unknown[] = [
      undefined,
      null,
      0,
      "",
      [],
      {},
      () => 1,
      Symbol("x"),
      Object.create(null),
      new Date(0),
    ];
    for (const input of hostile) {
      expect(() => validatePageOperationFacts(input)).not.toThrow();
      expect(() => validatePageOperationPayloadFacts(input)).not.toThrow();
      expect(() => validatePageProposalFacts(input)).not.toThrow();
      expect(() => validatePageSplices(input)).not.toThrow();
      expect(() => validatePageDelta(input)).not.toThrow();
      expect(() => encodePageRequest(input)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The actual schema contract
// ---------------------------------------------------------------------------------------------

describe("successful plans use the actual merged schema", () => {
  const modules = {
    "../_generated/api.js": () => import("../_generated/api.js"),
    "../_generated/server.js": () => import("../_generated/server.js"),
  };

  test("built rows insert into the real tables and read back through the validators", async () => {
    const t = convexTest(schema, modules);
    const owner = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "synthetic@example.com" });
      const noteId = await ctx.db.insert("notes", {
        userId,
        title: "Synthetic",
        body: "one two\n",
        pinned: false,
        periodType: "none",
        createdAt: NOW,
        updatedAt: NOW,
      });
      const conversationId = await ctx.db.insert("conversations", {
        userId,
        title: "Synthetic chat",
        createdAt: NOW,
        updatedAt: NOW,
      });
      return { userId, noteId, conversationId };
    });

    const plan = ok(
      await planSpliceChange({
        before: "one two\n",
        noteRevision: undefined,
        splices: [{ startUtf16: 4, removedText: "two", insertedText: "TWO" }],
      })
    );
    const facts = ok(
      buildOperationFacts({
        userId: owner.userId,
        noteId: owner.noteId,
        requestId: requestIdAt(NOW - 1),
        requestDigest: sha("r1"),
        kind: "patch_block",
        source: "ui",
        change: plan.facts,
        nowMs: NOW,
      })
    );
    const operationId = await t.run(async (ctx) => ctx.db.insert("pageOperations", facts as never));
    const stored = await t.run(async (ctx) => ctx.db.get(operationId));
    expect(String(ok(validatePageOperationFacts(stored))._id)).toBe(String(operationId));

    const payload = ok(
      buildPayloadFacts({
        operation: { ...facts, _id: operationId },
        splices: plan.splices,
        nowMs: NOW,
      })
    );
    const payloadId = await t.run(async (ctx) =>
      ctx.db.insert("pageOperationPayloads", payload as never)
    );
    const storedPayload = await t.run(async (ctx) => ctx.db.get(payloadId));
    const pair = ok(validateOperationPayloadPair(stored, storedPayload));
    expect(pair.payload.payload.state).toBe("available");

    const undoPlan = ok(
      await planUndo({
        nowMs: NOW + 1_000,
        userId: owner.userId,
        noteId: owner.noteId,
        noteRevision: plan.facts.resultRevision,
        currentBody: plan.resultBody,
        target: { operation: stored, payload: storedPayload },
        intervening: [],
      })
    );
    expect(undoPlan.candidateBody).toBe("one two\n");
    const undoFacts = ok(
      buildOperationFacts({
        userId: owner.userId,
        noteId: owner.noteId,
        requestId: requestIdAt(NOW - 2),
        requestDigest: sha("r2"),
        kind: "undo",
        source: "ui",
        change: undoPlan.facts,
        nowMs: NOW + 1_000,
        undoOfOperationId: operationId,
      })
    );
    const undoId = await t.run(async (ctx) => ctx.db.insert("pageOperations", undoFacts as never));
    const transition = ok(
      markOperationUndone({ target: stored, undoOperationId: undoId, nowMs: NOW + 1_000 })
    );
    await t.run(async (ctx) =>
      ctx.db.patch(operationId, {
        undoneAtMs: transition.undoneAtMs,
        undoneByOperationId: transition.undoneByOperationId,
        updatedAt: transition.updatedAt,
      })
    );
    const afterUndo = await t.run(async (ctx) => ctx.db.get(operationId));
    expect(String(ok(validatePageOperationFacts(afterUndo)).undoneByOperationId)).toBe(
      String(undoId)
    );
    expect(ok(decideUndoRequest({ nowMs: NOW + 2_000, target: afterUndo })).decision).toBe(
      "already_undone"
    );

    const noopPlan = ok(await planBodyChange({ before: "same", after: "same", noteRevision: 3 }));
    const noopFacts = ok(
      buildOperationFacts({
        userId: owner.userId,
        noteId: owner.noteId,
        requestId: requestIdAt(NOW - 3),
        requestDigest: sha("r3"),
        kind: "save",
        source: "legacy",
        change: noopPlan.facts,
        nowMs: NOW,
      })
    );
    const noopId = await t.run(async (ctx) => ctx.db.insert("pageOperations", noopFacts as never));
    expect(
      ok(validatePageOperationFacts(await t.run(async (ctx) => ctx.db.get(noopId)))).result
    ).toBe("noop");

    const deadlines = ok(proposalDeadlinesAtCreation(NOW));
    const proposal = proposalRow({
      userId: owner.userId,
      noteId: owner.noteId,
      conversationId: owner.conversationId,
      ...deadlines,
    });
    ok(validatePageProposalFacts(proposal));
    const proposalId = await t.run(async (ctx) =>
      ctx.db.insert("pageProposals", proposal as never)
    );
    const storedProposal = await t.run(async (ctx) => ctx.db.get(proposalId));
    expect(String(ok(validatePageProposalFacts(storedProposal))._id)).toBe(String(proposalId));
  });

  test("a row the validators refuse for shape is also refused by the real table", async () => {
    const t = convexTest(schema, modules);
    const owner = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "synthetic2@example.com" });
      const noteId = await ctx.db.insert("notes", {
        userId,
        title: "S",
        body: "b",
        pinned: false,
        periodType: "none",
        createdAt: NOW,
        updatedAt: NOW,
      });
      return { userId, noteId };
    });
    const row = {
      ...operationRow({ userId: owner.userId, noteId: owner.noteId }),
      unexpected: true,
    };
    fail(validatePageOperationFacts(row), "unexpected_field");
    let rejected = false;
    try {
      await t.run(async (ctx) => ctx.db.insert("pageOperations", row as never));
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
