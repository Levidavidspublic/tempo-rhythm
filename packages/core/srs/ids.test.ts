import { describe, expect, test } from "bun:test";
import { studyItemId } from "@tempo/utils";
import {
  BLOCK_ID_PATTERN,
  encodeUlidTime,
  isBlockId,
  itemIds,
  newBlockId,
  newUlid,
} from "./ids";

const T0 = Date.UTC(2026, 9, 16, 9, 0, 0);

/** A tiny deterministic generator for tests. */
function counter(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] as number;
}

describe("ids", () => {
  test("a block id matches the codec grammar", () => {
    for (let i = 0; i < 200; i++) {
      const id = newBlockId(T0 + i, Math.random);
      expect(id).toMatch(BLOCK_ID_PATTERN);
      expect(id).toHaveLength(30);
      expect(isBlockId(id)).toBe(true);
    }
  });

  test("the same now and random give the same id", () => {
    expect(newBlockId(T0, counter([0.5]))).toBe(newBlockId(T0, counter([0.5])));
  });

  test("time encodes as 10 Crockford characters, known vectors", () => {
    expect(encodeUlidTime(0)).toBe("0000000000");
    expect(encodeUlidTime(1)).toBe("0000000001");
    expect(encodeUlidTime(32)).toBe("0000000010");
    // The ULID spec's example time: 1469918176385 → 01ARYZ6S41.
    expect(encodeUlidTime(1469918176385)).toBe("01ARYZ6S41");
    expect(encodeUlidTime(2 ** 48 - 1)).toBe("7ZZZZZZZZZ");
  });

  test("ids sort by time", () => {
    const a = newBlockId(T0, counter([0.99]));
    const b = newBlockId(T0 + 1, counter([0]));
    expect(a < b).toBe(true);
  });

  test("random draws map onto the alphabet, out-of-range draws are clamped", () => {
    expect(newUlid(0, counter([0])).slice(10)).toBe("0".repeat(16));
    expect(newUlid(0, counter([0.9999999999])).slice(10)).toBe("Z".repeat(16));
    expect(newUlid(0, counter([1, -1, Number.NaN])).slice(10)).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  test("a time outside the ULID range throws", () => {
    expect(() => newBlockId(-1, Math.random)).toThrow(RangeError);
    expect(() => newBlockId(2 ** 48, Math.random)).toThrow(RangeError);
    expect(() => newBlockId(1.5, Math.random)).toThrow(RangeError);
  });

  test("isBlockId rejects other strings", () => {
    expect(isBlockId("blk_8ZZZZZZZZZZZZZZZZZZZZZZZZZ")).toBe(false);
    expect(isBlockId("blk_0000000000000000000000000I")).toBe(false);
    expect(isBlockId(42)).toBe(false);
  });

  test("itemIds counts from 1 and every id is codec-valid", () => {
    expect(itemIds("c", 3)).toEqual(["c1", "c2", "c3"]);
    expect(itemIds("q", 0)).toEqual([]);
    for (const id of itemIds("card_", 100)) expect(studyItemId.safeParse(id).success).toBe(true);
  });

  test("itemIds refuses unsafe prefixes and lengths", () => {
    expect(() => itemIds("a b", 2)).toThrow(RangeError);
    expect(() => itemIds("x".repeat(31), 10)).toThrow(RangeError);
    expect(() => itemIds("c", -1)).toThrow(RangeError);
  });
});
