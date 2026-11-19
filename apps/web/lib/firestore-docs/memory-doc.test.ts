import { describe, expect, test } from "bun:test";
import { checkMemoryDoc, type MemoryDoc } from "./memory-doc";

const validMemory: MemoryDoc = {
  content: "The weekly review happens on Friday.",
  sector: "semantic",
  salience: 0.8,
  decayRate: 0.05,
  lastAccessed: 1_700_000_000_000,
  accessCount: 2,
  metadata: { source: "coach" },
  createdAt: 1_699_000_000_000,
  updatedAt: 1_700_000_000_000,
};

describe("checkMemoryDoc", () => {
  test("accepts a valid memory", () => {
    expect(checkMemoryDoc(validMemory)).toEqual({ ok: true, doc: validMemory });
  });

  test("refuses a memory with userId", () => {
    expect(checkMemoryDoc({ ...validMemory, userId: "owner" })).toEqual({
      ok: false,
      reason: "unknown field: userId",
    });
  });

  test("refuses empty content", () => {
    expect(checkMemoryDoc({ ...validMemory, content: "  \n " }).ok).toBe(false);
  });

  test("refuses an unknown sector", () => {
    expect(checkMemoryDoc({ ...validMemory, sector: "other" }).ok).toBe(false);
  });

  test("refuses a fractional access count", () => {
    expect(checkMemoryDoc({ ...validMemory, accessCount: 1.5 }).ok).toBe(false);
  });

  test("accepts and keeps deletedAt on a soft-deleted memory", () => {
    const result = checkMemoryDoc({
      ...validMemory,
      deletedAt: 1_701_000_000_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.deletedAt).toBe(1_701_000_000_000);
    }
  });
});
