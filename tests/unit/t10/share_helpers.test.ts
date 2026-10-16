/** ShareSheet helpers (kitchen T10, S26): the Anki export, file names and flashcards in a page. */
import { describe, expect, test } from "bun:test";
import {
  ankiFileName,
  canSystemShare,
  flashcardsInBody,
  markdownFileName,
  toAnkiTsv,
} from "../../../apps/web/components/share/share-helpers";

const fence = (value: unknown) => `\`\`\`json tempo\n${JSON.stringify(value)}\n\`\`\`\n`;

describe("toAnkiTsv", () => {
  test("one front<TAB>back line per card", () => {
    expect(
      toAnkiTsv([
        { front: "Mitochondria", back: "Makes ATP" },
        { front: "Ribosome", back: "Makes proteins" },
      ]),
    ).toBe("Mitochondria\tMakes ATP\nRibosome\tMakes proteins\n");
  });

  test("tabs and line breaks inside a field become single spaces", () => {
    expect(toAnkiTsv([{ front: "Two\tparts", back: "Line one\nline two\r\nline three" }])).toBe(
      "Two parts\tLine one line two line three\n",
    );
  });

  test("Hebrew stays as written; empty sides are left out; no cards gives an empty file", () => {
    expect(toAnkiTsv([{ front: "תא", back: "יחידת החיים" }])).toBe("תא\tיחידת החיים\n");
    expect(toAnkiTsv([{ front: "  ", back: "x" }, { front: "y", back: "\n" }])).toBe("");
    expect(toAnkiTsv([])).toBe("");
  });

  test("every line has exactly one tab", () => {
    const out = toAnkiTsv([
      { front: "a\tb\tc", back: "d\te" },
      { front: "f", back: "g" },
    ]);
    for (const line of out.trimEnd().split("\n")) expect(line.split("\t")).toHaveLength(2);
  });
});

describe("file names", () => {
  test("markdownFileName drops characters a file name can't hold", () => {
    expect(markdownFileName("Biology: cells / part 1")).toBe("Biology cells part 1.md");
    expect(markdownFileName("   ")).toBe("Untitled.md");
    expect(markdownFileName("שיעורי בית")).toBe("שיעורי בית.md");
    expect(markdownFileName("x".repeat(200))).toBe(`${"x".repeat(80)}.md`);
  });

  test("ankiFileName is a .txt Anki can import", () => {
    expect(ankiFileName("Cell biology")).toBe("Cell biology (Anki).txt");
  });
});

describe("flashcardsInBody", () => {
  test("collects the cards of every flashcards block, in order", () => {
    const deck = (id: string, cards: { id: string; front: string; back: string }[]) => ({
      id,
      v: 1,
      type: "flashcards",
      data: { title: "Deck", origin: "user", cards },
    });
    const body = [
      "# Notes\n\nSome text.\n\n",
      fence(deck("blk_01JABCDEFGHJKMNPQRSTVWXYZ0", [{ id: "c1", front: "A", back: "1" }])),
      "\nMore text.\n\n",
      fence(deck("blk_01JABCDEFGHJKMNPQRSTVWXYZ1", [{ id: "c1", front: "B", back: "2" }])),
    ].join("");
    expect(flashcardsInBody(body)).toEqual([
      { front: "A", back: "1" },
      { front: "B", back: "2" },
    ]);
    expect(flashcardsInBody("Just words.")).toEqual([]);
  });
});

test("canSystemShare looks for navigator.share", () => {
  expect(canSystemShare({ share: async () => {} })).toBe(true);
  expect(canSystemShare({})).toBe(false);
  expect(canSystemShare(undefined)).toBe(false);
});
