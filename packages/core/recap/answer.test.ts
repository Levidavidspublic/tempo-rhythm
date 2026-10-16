import { describe, expect, test } from "bun:test";
import { answerFromPage, terms } from "./answer";

const PAGE = `# Cell biology

Mitosis: cell division that makes two identical cells.
Meiosis: cell division that makes four cells with half the chromosomes.
Osmosis: water moving across a membrane toward the saltier side.

## Enzymes

Enzymes speed up reactions. They are not used up.
`;

describe("terms", () => {
  test("drops question words and light-stems the rest", () => {
    expect(terms("What does an enzyme do to reactions?")).toEqual(["enzyme", "reaction"]);
    expect(terms("מה זה המיטוזה?")).toEqual(["המיטוזה"]);
  });
});

describe("answerFromPage", () => {
  test("finds the sentences that share the question's words, in page order", () => {
    const found = answerFromPage(PAGE, "How many cells does meiosis make?");
    expect(found.map((m) => m.text)).toContain(
      "Meiosis: cell division that makes four cells with half the chromosomes."
    );
    expect(answerFromPage(PAGE, "How many cells does meiosis make?", { limit: 1 })[0]?.text).toStartWith("Meiosis");
    expect(found.length).toBeLessThanOrEqual(3);
    const order = found.map((m) => m.index);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  test("rare words weigh more than common ones", () => {
    const [best] = answerFromPage(PAGE, "membrane cells", { limit: 1 });
    expect(best?.text).toContain("membrane");
  });
  test("plural and singular match; headings alone are not answers", () => {
    const found = answerFromPage(PAGE, "enzyme", { limit: 5 });
    expect(found.map((m) => m.text)).toEqual(["Enzymes speed up reactions."]);
  });
  test("Hebrew questions match Hebrew pages, prefixes and all", () => {
    const he = "# תאים\n\nמיטוזה היא חלוקת תא לשני תאים זהים.\nאוסמוזה היא מעבר מים דרך קרום.";
    expect(answerFromPage(he, "מה זה המיטוזה?").map((m) => m.text)).toEqual(["מיטוזה היא חלוקת תא לשני תאים זהים."]);
  });
  test("nothing in common, or only question words, finds nothing", () => {
    expect(answerFromPage(PAGE, "photosynthesis")).toEqual([]);
    expect(answerFromPage(PAGE, "what is it?")).toEqual([]);
    expect(answerFromPage("", "cells")).toEqual([]);
  });
});
