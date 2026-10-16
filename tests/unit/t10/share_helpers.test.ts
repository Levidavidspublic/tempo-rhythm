/** ShareSheet helpers (kitchen T10, S26): the Anki export, file names and flashcards in a page. */
import { describe, expect, test } from "bun:test";
import {
  ankiFileName,
  canSystemShare,
  downloadText,
  flashcardsInBody,
  markdownFileName,
  toAnkiTsv,
} from "../../../apps/web/components/share/share-helpers";

const fence = (value: unknown) => `\`\`\`json tempo\n${JSON.stringify(value)}\n\`\`\`\n`;

describe("toAnkiTsv", () => {
  const H = "#separator:tab\n#html:false\n";

  test("a header, then one quoted front<TAB>back line per card", () => {
    expect(
      toAnkiTsv([
        { front: "Mitochondria", back: "Makes ATP" },
        { front: "Ribosome", back: "Makes proteins" },
      ]),
    ).toBe(`${H}"Mitochondria"\t"Makes ATP"\n"Ribosome"\t"Makes proteins"\n`);
  });

  test("tabs and line breaks inside a field become single spaces", () => {
    expect(toAnkiTsv([{ front: "Two\tparts", back: "Line one\nline two\r\nline three" }])).toBe(
      `${H}"Two parts"\t"Line one line two line three"\n`,
    );
  });

  test("a leading # stays a card, not a comment; inner quotes are doubled so rows never merge", () => {
    const out = toAnkiTsv([
      { front: "#1 rule", back: 'Say "hi' },
      { front: "next", back: "card" },
    ]);
    expect(out).toBe(`${H}"#1 rule"\t"Say ""hi"\n"next"\t"card"\n`);
    const rows = out.split("\n").filter((line) => line && !line.startsWith("#"));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.startsWith('"'))).toBe(true);
  });

  test("Hebrew stays as written; empty sides are left out; no cards gives an empty file", () => {
    expect(toAnkiTsv([{ front: "תא", back: "יחידת החיים" }])).toBe(`${H}"תא"\t"יחידת החיים"\n`);
    expect(toAnkiTsv([{ front: "  ", back: "x" }, { front: "y", back: "\n" }])).toBe("");
    expect(toAnkiTsv([])).toBe("");
  });

  test("every card line has exactly one tab", () => {
    const out = toAnkiTsv([
      { front: "a\tb\tc", back: "d\te" },
      { front: "f", back: "g" },
    ]);
    const cardLines = out.trimEnd().split("\n").slice(2);
    expect(cardLines).toHaveLength(2);
    for (const line of cardLines) expect(line.split("\t")).toHaveLength(2);
  });
});

describe("downloadText", () => {
  test("keeps the object URL for about 5 seconds after the click", () => {
    const g = globalThis as Record<string, unknown>;
    const saved = { document: g.document, window: g.window };
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    const timers: { fn: () => void; ms: number }[] = [];
    const revoked: string[] = [];
    let clicked = 0;
    const anchor = { href: "", download: "", rel: "", click: () => (clicked += 1), remove: () => {} };
    g.document = { createElement: () => anchor, body: { appendChild: () => {} } };
    g.window = { setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }) };
    URL.createObjectURL = () => "blob:test-1";
    URL.revokeObjectURL = (url: string) => void revoked.push(url);
    try {
      downloadText("a", "a.txt", "text/plain");
      expect(clicked).toBe(1);
      expect(revoked).toEqual([]);
      expect(timers).toHaveLength(1);
      expect(timers[0]?.ms).toBeGreaterThanOrEqual(5_000);
      timers[0]?.fn();
      expect(revoked).toEqual(["blob:test-1"]);
    } finally {
      g.document = saved.document;
      g.window = saved.window;
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
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
