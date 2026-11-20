import { describe, expect, test } from "bun:test";

import {
  PAGE_OPERATION_METADATA_TTL_MS,
  checkPageOperationDoc,
  type PageOperationDoc,
} from "./page-operation-doc";

const digest = "a".repeat(64);
const appliedAtMs = 1_700_000_000_000;

function applied(overrides: Partial<PageOperationDoc> = {}): PageOperationDoc {
  return {
    noteId: "note_01",
    requestId: "req_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    requestDigest: digest,
    kind: "save",
    source: "ui",
    result: "applied",
    affectsBody: true,
    baseRevision: 4,
    resultRevision: 5,
    baseBodyDigest: digest,
    resultBodyDigest: "b".repeat(64),
    delta: [{ startUtf16: 0, removedLengthUtf16: 0, insertedLengthUtf16: 3 }],
    appliedAtMs,
    undoUntilMs: appliedAtMs + 300_000,
    metadataExpiresAtMs: appliedAtMs + PAGE_OPERATION_METADATA_TTL_MS,
    createdAt: appliedAtMs,
    updatedAt: appliedAtMs,
    ...overrides,
  };
}

describe("checkPageOperationDoc", () => {
  test("accepts a valid applied save", () => {
    expect(checkPageOperationDoc(applied())).toEqual({
      ok: true,
      doc: applied(),
    });
  });

  test("accepts a valid noop", () => {
    const doc = applied({
      result: "noop",
      affectsBody: false,
      resultRevision: 4,
      resultBodyDigest: digest,
      delta: [],
      undoUntilMs: undefined,
    });
    expect(checkPageOperationDoc(doc)).toEqual({ ok: true, doc });
  });

  test("rejects the unknown userId key", () => {
    expect(checkPageOperationDoc({ ...applied(), userId: "user_01" }).ok).toBe(false);
  });

  test("rejects a bad requestId", () => {
    expect(checkPageOperationDoc(applied({ requestId: "req_not-a-ulid" })).ok).toBe(false);
  });

  test("rejects an uppercase digest", () => {
    expect(checkPageOperationDoc(applied({ requestDigest: "A".repeat(64) })).ok).toBe(false);
  });

  test("rejects an applied write that does not advance one revision", () => {
    expect(checkPageOperationDoc(applied({ resultRevision: 6 })).ok).toBe(false);
  });

  test("rejects a noop carrying undoUntilMs", () => {
    const doc = applied({
      result: "noop",
      affectsBody: false,
      resultRevision: 4,
      resultBodyDigest: digest,
      delta: [],
    });
    expect(checkPageOperationDoc(doc).ok).toBe(false);
  });

  test("rejects kind undo without undoOfOperationId", () => {
    expect(checkPageOperationDoc(applied({ kind: "undo", undoUntilMs: undefined })).ok).toBe(false);
  });

  test("rejects a wrong metadataExpiresAtMs", () => {
    expect(checkPageOperationDoc(applied({ metadataExpiresAtMs: appliedAtMs + 1 })).ok).toBe(false);
  });

  test("rejects an undefined createdAt", () => {
    expect(checkPageOperationDoc({ ...applied(), createdAt: undefined }).ok).toBe(false);
  });

  test("rejects an undefined updatedAt", () => {
    expect(checkPageOperationDoc({ ...applied(), updatedAt: undefined }).ok).toBe(false);
  });
});
