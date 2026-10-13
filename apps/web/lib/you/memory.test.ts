import { describe, expect, test } from "bun:test";
import {
  checkMemory,
  type ImportItem,
  itemsToSave,
  MAX_IMPORT_BYTES,
  readImport,
  shownMemories,
} from "./memory";
import { checkNagLabel, checkPhrase, nagCounts, shownPhrases } from "./nags";

describe("shownMemories", () => {
  const rows = [
    { id: "a", createdAt: 1 },
    { id: "b", createdAt: 3, importedFrom: "chatgpt" as const },
    { id: "c", createdAt: 2 },
  ];

  test("newest first, filtered by where each memory came from", () => {
    expect(shownMemories(rows, "all").map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(shownMemories(rows, "you").map((r) => r.id)).toEqual(["c", "a"]);
    expect(shownMemories(rows, "imported").map((r) => r.id)).toEqual(["b"]);
  });

  test("checkMemory trims and limits", () => {
    expect(checkMemory("  Likes tea ")).toEqual({ ok: true, text: "Likes tea" });
    expect(checkMemory("   ")).toEqual({ ok: false, problem: "empty" });
    expect(checkMemory("x".repeat(501))).toEqual({ ok: false, problem: "long" });
  });
});

describe("readImport (RAM-only review)", () => {
  test("splits the text into items, all kept, and marks what Tempo already remembers", () => {
    const read = readImport("- Lives in Haifa\n- Her manager is Dana\n", "chatgpt", [
      "her manager is dana",
    ]);
    expect(read).toEqual({
      ok: true,
      items: [
        { id: "item-0", text: "Lives in Haifa", choice: "keep", duplicate: false },
        { id: "item-1", text: "Her manager is Dana", choice: "keep", duplicate: true },
      ],
    });
  });

  test("an empty box or an oversized text is refused before anything is read", () => {
    expect(readImport("  \n ", "claude", [])).toEqual({ ok: false, reason: "empty" });
    expect(readImport("x".repeat(MAX_IMPORT_BYTES + 1), "claude", [])).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  test("text with nothing to remember gives no items", () => {
    expect(readImport("- --", "other", [])).toEqual({ ok: true, items: [] });
  });

  test("itemsToSave keeps and edits, drops the rest, and never sends blanks or repeats", () => {
    const items: ImportItem[] = [
      { id: "1", text: "Lives in Haifa", choice: "keep", duplicate: false },
      { id: "2", text: "  Works   from home ", choice: "edit", duplicate: false },
      { id: "3", text: "Dropped", choice: "drop", duplicate: false },
      { id: "4", text: "   ", choice: "edit", duplicate: false },
      { id: "5", text: "lives in haifa", choice: "keep", duplicate: false },
    ];
    expect(itemsToSave(items)).toEqual(["Lives in Haifa", "Works from home"]);
  });
});

describe("nag checks", () => {
  test("phrases are the person's words: not empty, not too long, no emoji", () => {
    expect(checkPhrase("  Glass, Maya. ")).toEqual({ ok: true, text: "Glass, Maya." });
    expect(checkPhrase(" ")).toEqual({ ok: false, problem: "empty" });
    expect(checkPhrase("x".repeat(141))).toEqual({ ok: false, problem: "long" });
    expect(checkPhrase("Water 💧")).toEqual({ ok: false, problem: "emoji" });
  });

  test("a nag name is up to 60 characters", () => {
    expect(checkNagLabel("Water")).toEqual({ ok: true, text: "Water" });
    expect(checkNagLabel("x".repeat(61))).toEqual({ ok: false, problem: "long" });
  });

  test("rejected phrases stay hidden; counts say how many are on", () => {
    const phrases = [
      { id: "a", status: "accepted" as const },
      { id: "b", status: "rejected" as const },
      { id: "c", status: "proposed" as const },
    ];
    expect(shownPhrases(phrases).map((p) => p.id)).toEqual(["a", "c"]);
    expect(nagCounts([{ enabled: true }, { enabled: false }, { enabled: true }])).toEqual({
      total: 3,
      on: 2,
    });
  });
});
