import { describe, expect, test } from "bun:test";
import { buildRecap, fullReading } from "./recap";

const PAGE = `# Cell biology, unit 2

Cells divide in two ways. Each way has its own purpose. Biologists study both.

Mitosis: cell division that makes two identical cells. It happens in body cells.
Meiosis: cell division that makes four cells with half the chromosomes

## Steps of mitosis

1. Prophase
2. Metaphase
3. Anaphase
4. Telophase

\`\`\`json tempo
{"type":"flashcards","cards":[]}
\`\`\`

## Empty heading

## Reading

See [the textbook](https://example.com/book) for more. It has pictures.
`;

describe("buildRecap", () => {
  test("headings as cues, first sentences, definitions and folded lists, nothing from code", () => {
    expect(buildRecap(PAGE, { lang: "en" })).toEqual([
      { text: "Cell biology, unit 2", kind: "cue", section: 1 },
      { text: "Cells divide in two ways.", kind: "sentence", section: 1 },
      { text: "Mitosis: cell division that makes two identical cells.", kind: "definition", section: 1 },
      { text: "Meiosis: cell division that makes four cells with half the chromosomes.", kind: "definition", section: 1 },
      { text: "Steps of mitosis", kind: "cue", section: 2 },
      { text: "Prophase, Metaphase, Anaphase and Telophase.", kind: "list", section: 2 },
      { text: "Reading", kind: "cue", section: 4 },
      { text: "See the textbook for more.", kind: "sentence", section: 4 },
    ]);
  });
  test("a long page keeps to maxSentences and still covers every section", () => {
    const recap = buildRecap(PAGE, { lang: "en", maxSentences: 6 });
    expect(recap.length).toBeLessThanOrEqual(6);
    expect(recap.map((s) => s.text)).toContain("Prophase, Metaphase, Anaphase and Telophase.");
    expect(recap.map((s) => s.text)).toContain("See the textbook for more.");
    const sections = recap.map((s) => s.section);
    expect([...sections].sort((a, b) => a - b)).toEqual(sections);
  });
  test("a tiny budget still says something", () => {
    expect(buildRecap(PAGE, { lang: "en", maxSentences: 1 })).toEqual([
      { text: "Cells divide in two ways.", kind: "sentence", section: 1 },
    ]);
  });
  test("long list items each give their first sentence", () => {
    const recap = buildRecap(
      "- The first item is a long one that keeps going past eight words. More here.\n- Short too.",
      { lang: "en" }
    );
    expect(recap.map((s) => s.text)).toEqual([
      "The first item is a long one that keeps going past eight words.",
      "Short too.",
    ]);
  });
  test("Hebrew page: Hebrew list joining and sentence splitting", () => {
    const recap = buildRecap("# חלוקת תא\n\nהתא מתחלק. זה לוקח זמן.\n\n- פרופאזה\n- מטאפאזה", { lang: "he" });
    expect(recap.map((s) => s.text)).toEqual(["חלוקת תא", "התא מתחלק.", "פרופאזה ומטאפאזה."]);
  });
  test("an empty page has no recap", () => {
    expect(buildRecap("", { lang: "en" })).toEqual([]);
    expect(buildRecap("```\ncode only\n```", { lang: "en" })).toEqual([]);
  });
});

describe("fullReading", () => {
  test("reads every sentence, in order", () => {
    const texts = fullReading(PAGE, { lang: "en" }).map((s) => s.text);
    expect(texts).toContain("Each way has its own purpose.");
    expect(texts).toContain("Biologists study both.");
    expect(texts).toContain("Mitosis: cell division that makes two identical cells. It happens in body cells.");
    expect(texts).toContain("It has pictures.");
    expect(texts).not.toContain("Empty heading");
    expect(texts.join(" ")).not.toContain("example.com");
    expect(texts.join(" ")).not.toContain("flashcards");
  });
});
