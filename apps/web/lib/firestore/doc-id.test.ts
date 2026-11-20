import { expect, test } from "bun:test";
import { DOC_ID_LENGTH, isDocId, newDocId } from "./doc-id";

test("newDocId returns a valid 20-character document id", () => {
  const id = newDocId();

  expect(id).toHaveLength(DOC_ID_LENGTH);
  expect(isDocId(id)).toBe(true);
});

test("newDocId produces 1000 different ids", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newDocId()));

  expect(ids.size).toBe(1000);
});

test("newDocId supports an injected byte source", () => {
  const bytes = Uint8Array.from({ length: DOC_ID_LENGTH }, (_, index) => index);

  expect(newDocId(() => bytes)).toBe("ABCDEFGHIJKLMNOPQRST");
});

test("newDocId skips bytes of 248 and above", () => {
  const batches = [
    Uint8Array.from([248, 249, 250, 251, 252, 253, 254, 255]),
    Uint8Array.from({ length: DOC_ID_LENGTH }, () => 61),
  ];

  expect(newDocId(() => batches.shift() ?? new Uint8Array())).toBe("9".repeat(20));
});

test("isDocId rejects unsafe or invalid values", () => {
  for (const value of ["", "a".repeat(129), "a/b", "..", "__x__", 42, null]) {
    expect(isDocId(value)).toBe(false);
  }

  expect(isDocId("ConvexId_123-abc")).toBe(true);
});
