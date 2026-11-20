import { describe, expect, test } from "bun:test";
import { checkMemoryDoc } from "../firestore-docs/memory-doc";
import {
  draftKeptMemories,
  MEMORY_IMPORT_MAX_ITEMS,
  readMemoryPaste,
} from "./memory-import";

describe("readMemoryPaste", () => {
  test("turns three plain lines into three review items", () => {
    expect(readMemoryPaste("Alpha\nBeta\nGamma")).toEqual({
      items: [
        { index: 0, content: "Alpha" },
        { index: 1, content: "Beta" },
        { index: 2, content: "Gamma" },
      ],
      dropped: 0,
    });
  });

  test("strips list markers and skips blank lines", () => {
    expect(readMemoryPaste("- Alpha\n\n1. Beta\r\n  • Gamma  ")).toEqual({
      items: [
        { index: 0, content: "Alpha" },
        { index: 1, content: "Beta" },
        { index: 2, content: "Gamma" },
      ],
      dropped: 0,
    });
  });

  test("drops and counts a repeat that differs only in case", () => {
    expect(readMemoryPaste("Remember this\nREMEMBER THIS")).toEqual({
      items: [{ index: 0, content: "Remember this" }],
      dropped: 1,
    });
  });

  test("keeps at most 200 distinct lines", () => {
    const result = readMemoryPaste(
      Array.from({ length: 205 }, (_, index) => `Memory ${index}`).join("\n"),
    );

    expect(result.items).toHaveLength(MEMORY_IMPORT_MAX_ITEMS);
    expect(result.dropped).toBe(5);
  });
});

describe("draftKeptMemories", () => {
  test("builds selected documents once in list order", () => {
    const items = readMemoryPaste("Zero\nOne\nTwo").items;
    const result = draftKeptMemories(items, [2, 0], 1_700_000_000_000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.docs.map((doc) => doc.content)).toEqual(["Zero", "Two"]);
      expect(result.docs.every((doc) => checkMemoryDoc(doc).ok)).toBe(true);
    }
  });

  test("refuses an invalid now value", () => {
    const result = draftKeptMemories(
      [{ index: 0, content: "Memory" }],
      [0],
      -1,
    );

    expect(result.ok).toBe(false);
  });
});
