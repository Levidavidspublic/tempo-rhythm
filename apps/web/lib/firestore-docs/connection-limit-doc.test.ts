import { describe, expect, test } from "bun:test";
import {
  checkConnectionLimitDoc,
  checkConnectionLimitUpdate,
  disconnectGenerationOf,
  nextDisconnectGeneration,
} from "./connection-limit-doc";

const validDoc = {
  connectWindowStartMs: 1_795_000_000_000,
  connectWindowCount: 2,
  callWindowStartMs: 1_795_000_000_000,
  callWindowCount: 3,
  disconnectGeneration: 4,
  createdAt: 1_795_000_000_000,
  updatedAt: 1_795_000_000_001,
} as const;

describe("connection limit documents", () => {
  test("accepts a valid document", () => {
    expect(checkConnectionLimitDoc(validDoc)).toEqual({ ok: true, doc: validDoc });
  });

  test("accepts a document with only createdAt and updatedAt", () => {
    const doc = { createdAt: 10, updatedAt: 10 };
    expect(checkConnectionLimitDoc(doc)).toEqual({ ok: true, doc });
  });

  test("refuses userId because ownership comes from the path", () => {
    expect(checkConnectionLimitDoc({ ...validDoc, userId: "user-1" }).ok).toBe(false);
  });

  test("refuses a negative or fractional count", () => {
    expect(checkConnectionLimitDoc({ ...validDoc, connectWindowCount: -1 }).ok).toBe(false);
    expect(checkConnectionLimitDoc({ ...validDoc, callWindowCount: 1.5 }).ok).toBe(false);
  });

  test("refuses a window count without its start", () => {
    const { connectWindowStartMs: _start, ...withoutStart } = validDoc;
    expect(checkConnectionLimitDoc(withoutStart).ok).toBe(false);
  });

  test("refuses updatedAt before createdAt", () => {
    expect(checkConnectionLimitDoc({ ...validDoc, updatedAt: validDoc.createdAt - 1 }).ok).toBe(false);
  });

  test("reads a missing disconnect generation as zero and increments it", () => {
    const doc = { createdAt: 10, updatedAt: 10 };
    expect(disconnectGenerationOf(doc)).toBe(0);
    expect(disconnectGenerationOf(null)).toBe(0);
    expect(nextDisconnectGeneration(doc)).toBe(1);
    expect(nextDisconnectGeneration(validDoc)).toBe(5);
  });

  test("refuses an update with a lower disconnect generation", () => {
    expect(
      checkConnectionLimitUpdate(validDoc, { ...validDoc, disconnectGeneration: 3 }).ok,
    ).toBe(false);
  });
});
