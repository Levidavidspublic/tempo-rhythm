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
