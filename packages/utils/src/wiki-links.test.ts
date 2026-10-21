import { describe, expect, test } from "bun:test";
import { backlinksFor, findWikiLinks, isLinkableTitle, sameTitle, titleKey } from "./wiki-links";

describe("findWikiLinks", () => {
  test("keeps the original offsets of each link", () => {
    const body = "a [[One]] b [[Two|shown]]";
    expect(findWikiLinks(body)).toEqual([
      { title: "One", from: 2, to: 9 },
      { title: "Two", from: 12, to: 25 },
    ]);
  });

  test("ignores links inside fenced code, inline code and Tempo blocks", () => {
    const body = [
      "Real [[Kept]].",
      "```",
      "[[In a fence]]",
      "```",
      "Inline `[[In code]]` and ``[[Double]]``.",
      "~~~ts",
      "[[Tilde fence]]",
      "~~~",
      "```json tempo",
      '{"id":"blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2W","v":1,"type":"page-meta","data":{"pageType":"daily","date":"2026-10-12","tags":["[[Not]]"]}}',
      "```",
      "After [[Also kept]]",
    ].join("\n");
    expect(findWikiLinks(body).map((l) => l.title)).toEqual(["Kept", "Also kept"]);
  });

  test("a code span that runs over a line break is code; a blank line ends the span", () => {
    expect(findWikiLinks("Use `code\n[[Target]]` here").map((l) => l.title)).toEqual([]);
    expect(findWikiLinks("A lone ` tick\n\n[[Real]] and `x`").map((l) => l.title)).toEqual(["Real"]);
    expect(findWikiLinks("A lone ` tick\r\n\r\n[[Real]] and `x`").map((l) => l.title)).toEqual(["Real"]);
    expect(findWikiLinks("A lone ` tick\r\r[[Real]] and `x`").map((l) => l.title)).toEqual(["Real"]);
  });

  test("an unclosed fence hides the rest of the body", () => {
    expect(findWikiLinks("[[A]]\n```\n[[B]]").map((l) => l.title)).toEqual(["A"]);
  });
});

describe("backlinksFor", () => {
  test("matches titles without case or outer spaces, and never lists the page itself", () => {
    expect(sameTitle(" Moving ", "moving")).toBe(true);
    const pages = [
      { id: "self", title: "Moving", body: "[[Moving]]" },
      { id: "x", title: "Week", body: "- [ ] pack for [[moving ]]" },
    ];
    expect(backlinksFor("Moving", "self", pages)).toEqual([{ id: "x", title: "Week", context: "pack for moving" }]);
  });

  test("a blank title has no backlinks", () => {
    expect(backlinksFor("  ", "a", [{ id: "b", title: "B", body: "[[ ]]" }])).toEqual([]);
  });
});

describe("line endings, title identity and linkable titles", () => {
  test("a fence in a lone-CR body is code, so its [[links]] are not links", () => {
    expect(findWikiLinks("prose\r~~~\r[[Hidden]]\r~~~\r[[Real]]").map((l) => l.title)).toEqual(["Real"]);
    expect(findWikiLinks("prose\r\n```\r\n[[Hidden]]\r\n```\r\n[[Real]]").map((l) => l.title)).toEqual(["Real"]);
  });

  test("offsets stay those of the original body after masking CR bodies", () => {
    const body = "a\r```\r[[x]]\r```\r[[Real]]";
    const [link] = findWikiLinks(body);
    expect(body.slice(link!.from, link!.to)).toBe("[[Real]]");
  });

  test("titles compare without a locale", () => {
    expect(titleKey("  Moving DAY ")).toBe("moving day");
    expect(sameTitle("I", "i")).toBe(true);
    expect(sameTitle("רשימה", " רשימה ")).toBe(true);
  });

  test("only titles a [[link]] can hold are linkable", () => {
    expect(isLinkableTitle("Moving day")).toBe(true);
    expect(isLinkableTitle("A|B")).toBe(false);
    expect(isLinkableTitle("[draft]")).toBe(false);
    expect(isLinkableTitle("two\nlines")).toBe(false);
    expect(isLinkableTitle("   ")).toBe(false);
    expect(isLinkableTitle("x".repeat(201))).toBe(false);
  });
});

describe("indented code and lone-CR context", () => {
  test("an indented code block is code, so its [[links]] are not links", () => {
    expect(findWikiLinks("Intro.\n\n    [[Target]]\n\n[[Real]]").map((l) => l.title)).toEqual(["Real"]);
    expect(findWikiLinks("Intro.\n\n\t[[Target]]\n").map((l) => l.title)).toEqual([]);
  });

  test("indented lines that continue a paragraph or a list stay text", () => {
    expect(findWikiLinks("A paragraph\n    [[Lazy]] continues it").map((l) => l.title)).toEqual(["Lazy"]);
    expect(findWikiLinks("- item\n\n    [[InItem]] continues the item").map((l) => l.title)).toEqual(["InItem"]);
  });

  test("indented code inside a list item is code: 4+ columns past the item's content", () => {
    const titles = (body: string) => findWikiLinks(body).map((l) => l.title);
    expect(titles("- item\n\n        [[Hidden]]\n\n[[Real]]")).toEqual(["Real"]);
    expect(titles("1. item\n\n       [[Hidden]]\n")).toEqual([]);
    expect(titles("1. item\n\n      [[InItem]] is text (6 columns, content at 3)\n")).toEqual(["InItem"]);
    expect(titles("- a\n  - nested\n\n          [[Hidden]]\n\n    [[InNested]]\n")).toEqual(["InNested"]);
    expect(titles("- item\n\n\t\t[[Hidden]]\n")).toEqual([]);
    // Leaving the list: a less indented line after a blank line is top-level again.
    expect(titles("- item\n\nParagraph\n\n    [[Hidden]]\n")).toEqual([]);
    // A heading leaves no paragraph to continue; "10." cannot start a list inside a paragraph.
    expect(titles("# H\n    [[Hidden]]\n")).toEqual([]);
    expect(titles("Para\n10. ten\n\n    [[Hidden]]\n")).toEqual([]);
    // A fence inside an item, indented with the item's content.
    expect(titles("- item\n\n  ```\n  [[Hidden]]\n  ```\n- [[Next]]\n")).toEqual(["Next"]);
  });

  test("backlink context is the linking line in a lone-CR body", () => {
    const long = "x".repeat(300);
    const [hit] = backlinksFor("Target", "self", [{ id: "a", title: "A", body: `${long}\rsee [[Target]] here\r${long}` }]);
    expect(hit?.context).toBe("see Target here");
  });
});
