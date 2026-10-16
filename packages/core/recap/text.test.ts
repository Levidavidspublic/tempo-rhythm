import { describe, expect, test } from "bun:test";
import { detectLang, joinItems, plainInline, readableBlocks, splitSentences, wordCount } from "./text";

describe("splitSentences", () => {
  test("splits English on . ? ! and keeps numbers like 3.5 whole", () => {
    expect(splitSentences("The pH was 3.5 at noon. Why? Because of the acid! Done")).toEqual([
      "The pH was 3.5 at noon.",
      "Why?",
      "Because of the acid!",
      "Done",
    ]);
  });
  test("keeps common abbreviations and versions inside a sentence", () => {
    expect(splitSentences("Use a buffer, e.g. phosphate. Dr. Levi said v1.2 works.")).toEqual([
      "Use a buffer, e.g. phosphate.",
      "Dr. Levi said v1.2 works.",
    ]);
  });
  test("no. and st. are abbreviations only before a number", () => {
    expect(splitSentences("The answer is no. Then we go on.")).toEqual(["The answer is no.", "Then we go on."]);
    expect(splitSentences("Turn onto the main st. Then stop.")).toEqual(["Turn onto the main st.", "Then stop."]);
    expect(splitSentences("See no. 5 on the list. Then st. 3 below.")).toEqual([
      "See no. 5 on the list.",
      "Then st. 3 below.",
    ]);
  });
  test("splits Hebrew on . ? ! and the sof pasuq", () => {
    expect(splitSentences("התא מתחלק לשניים. מה קורה אחר כך? נוצרים שני תאים׃ זהים", "he")).toEqual([
      "התא מתחלק לשניים.",
      "מה קורה אחר כך?",
      "נוצרים שני תאים׃",
      "זהים",
    ]);
  });
  test("keeps closing quotes with their sentence and ignores empty text", () => {
    expect(splitSentences('She said "go." Then left.')).toEqual(['She said "go."', "Then left."]);
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("plainInline", () => {
  test("keeps link words, drops URLs, HTML and marks", () => {
    expect(plainInline("See [the guide](https://example.com/x) and https://example.com now")).toBe("See the guide and now");
    expect(plainInline("A <b>bold</b> **move** with `code` and _style_ ~~gone~~ [[Cells|cell page]]")).toBe(
      "A bold move with code and style gone cell page"
    );
  });
});

describe("readableBlocks", () => {
  test("drops code fences, json tempo blocks and HTML comments", () => {
    const blocks = readableBlocks(
      '# Title\n\nKept line.\n\n```json tempo\n{"type":"flashcards"}\n```\n\n~~~\nconst x = 1;\n~~~\n<!-- hidden -->\nAfter.'
    );
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Title" },
      { type: "paragraph", text: "Kept line." },
      { type: "paragraph", text: "After." },
    ]);
  });
  test("reads definitions, lists and joined paragraph lines", () => {
    const blocks = readableBlocks(
      "Mitosis: cell division\n- Prophase\n- Metaphase\n\nOne line\nwraps here.\n\n1. **First** step\n2. Second step"
    );
    expect(blocks).toEqual([
      { type: "definition", term: "Mitosis", meaning: "cell division" },
      { type: "list", items: ["Prophase", "Metaphase"] },
      { type: "paragraph", text: "One line wraps here." },
      { type: "list", items: ["First step", "Second step"] },
    ]);
  });
  test("table rows read as cells and the rule row is skipped", () => {
    expect(readableBlocks("| Term | Meaning |\n|---|---|\n| ATP | energy |")).toEqual([
      { type: "paragraph", text: "Term, Meaning" },
      { type: "paragraph", text: "ATP, energy" },
    ]);
  });
});

describe("small helpers", () => {
  test("detectLang picks Hebrew when Hebrew letters lead", () => {
    expect(detectLang("שלום world")).toBe("en");
    expect(detectLang("מיטוזה היא חלוקת תא")).toBe("he");
    expect(detectLang("")).toBe("en");
  });
  test("wordCount counts words, at least one", () => {
    expect(wordCount("Cell division, then two cells.")).toBe(5);
    expect(wordCount("")).toBe(1);
  });
  test("joinItems folds a list into one sentence in each language", () => {
    expect(joinItems(["Prophase", "Metaphase", "Anaphase"], "en")).toBe("Prophase, Metaphase and Anaphase.");
    expect(joinItems(["פרופאזה", "מטאפאזה", "אנאפאזה"], "he")).toBe("פרופאזה, מטאפאזה ואנאפאזה.");
    expect(joinItems(["א", "2024"], "he")).toBe("א ו-2024.");
    expect(joinItems([], "en")).toBe("");
  });
});
