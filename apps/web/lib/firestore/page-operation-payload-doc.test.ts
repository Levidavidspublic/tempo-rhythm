import { expect, test } from "bun:test";
import {
  checkPageOperationPayloadDoc,
  softDeletePageOperationPayloadDoc,
  type PageOperationPayloadDoc,
} from "./page-operation-payload-doc";

const availableDoc: PageOperationPayloadDoc = {
  noteId: "note-1",
  operationId: "operation-1",
  undoUntilMs: 100,
  cleanupDueAtMs: 200,
  payload: {
    state: "available",
    splices: [{ startUtf16: 3, removedText: "old", insertedText: "new" }],
  },
  createdAt: 10,
  updatedAt: 20,
};

test("accepts valid available and expired documents", () => {
  expect(checkPageOperationPayloadDoc(availableDoc)).toEqual({ ok: true, doc: availableDoc });

  const expiredDoc: PageOperationPayloadDoc = {
    ...availableDoc,
    payload: { state: "expired", expiredAtMs: 250 },
    deletedAt: 300,
  };
  expect(checkPageOperationPayloadDoc(expiredDoc)).toEqual({ ok: true, doc: expiredDoc });
});

test("rejects owner identity, unknown fields, and empty identifiers", () => {
  expect(checkPageOperationPayloadDoc({ ...availableDoc, userId: "user-1" }).ok).toBe(false);
  expect(checkPageOperationPayloadDoc({ ...availableDoc, extra: true }).ok).toBe(false);
  expect(checkPageOperationPayloadDoc({ ...availableDoc, noteId: "" }).ok).toBe(false);
  expect(checkPageOperationPayloadDoc({ ...availableDoc, operationId: "" }).ok).toBe(false);
});

test("rejects invalid times and cleanup before the undo deadline", () => {
  for (const field of [
    "undoUntilMs",
    "cleanupDueAtMs",
    "createdAt",
    "updatedAt",
    "deletedAt",
  ] as const) {
    expect(checkPageOperationPayloadDoc({ ...availableDoc, [field]: -1 }).ok).toBe(false);
    expect(checkPageOperationPayloadDoc({ ...availableDoc, [field]: 1.5 }).ok).toBe(false);
    expect(
      checkPageOperationPayloadDoc({ ...availableDoc, [field]: Number.MAX_SAFE_INTEGER + 1 }).ok
    ).toBe(false);
  }
  expect(checkPageOperationPayloadDoc({ ...availableDoc, deletedAt: undefined }).ok).toBe(false);
  expect(checkPageOperationPayloadDoc({ ...availableDoc, undoUntilMs: 201 }).ok).toBe(false);
});

test("rejects invalid available payloads without exposing splice text", () => {
  const invalidPayloads = [
    {
      state: "available",
      splices: [{ startUtf16: -1, removedText: "secret-a", insertedText: "secret-b" }],
    },
    {
      state: "available",
      splices: [{ startUtf16: 1.5, removedText: "secret-a", insertedText: "secret-b" }],
    },
    { state: "available", splices: [{ startUtf16: 0, removedText: 1, insertedText: "secret-b" }] },
    { state: "available", splices: [{ startUtf16: 0, removedText: "secret-a", insertedText: 1 }] },
  ];

  for (const payload of invalidPayloads) {
    const result = checkPageOperationPayloadDoc({ ...availableDoc, payload });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain("secret-a");
      expect(result.reason).not.toContain("secret-b");
    }
  }
});

test("rejects unknown payload states and invalid expired times", () => {
  expect(checkPageOperationPayloadDoc({ ...availableDoc, payload: { state: "missing" } }).ok).toBe(
    false
  );
  expect(
    checkPageOperationPayloadDoc({
      ...availableDoc,
      payload: { state: "expired", expiredAtMs: -1 },
    }).ok
  ).toBe(false);
});

test("soft deletes a copy without changing its input", () => {
  const before = structuredClone(availableDoc);
  const deleted = softDeletePageOperationPayloadDoc(availableDoc, 500);

  expect(deleted).toEqual({ ...availableDoc, deletedAt: 500, updatedAt: 500 });
  expect(availableDoc).toEqual(before);
  expect(deleted).not.toBe(availableDoc);
});
