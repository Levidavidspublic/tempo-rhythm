import { describe, expect, test } from "bun:test";
import { markQuote } from "./answer";
import { type AskPassage, answerFromSet, setPassages } from "./ask-set";

// Fictional study notes and sets.
const PAGE = `# Cell biology

Mitosis: cell division that makes two identical cells.
Diffusion: particles spreading from high to low concentration.

## Enzymes

Enzymes speed up reactions. They are not used up.
`;

const deck = setPassages({
  type: "flashcards",
  data: {
    cards: [
      { id: "a", front: "Mitosis", back: "Cell division that makes two identical cells" },
      { id: "b", front: "Osmosis", back: "Water moving across a membrane toward the saltier side" },
      { id: "c", front: "Meiosis", back: "Four cells with half the chromosomes" },
    ],
  },
});

const where = (found: { from: AskPassage["from"] }[]) =>
  found.map(({ from }) => (from.kind === "page" ? `page ${from.sentence}` : from.kind === "test" ? `${from.section} ${from.n}` : `${from.kind} ${from.n}`));

describe("setPassages", () => {
  test("a card is its front and back, numbered from 1", () => {
    expect(deck[1]).toEqual({ from: { kind: "card", n: 2 }, lines: ["Osmosis", "Water moving across a membrane toward the saltier side"] });
  });
  test("a quiz question is its prompt, the right answer and the explanation", () => {
    const [first, second] = setPassages({
      type: "quiz",
      data: {
        questions: [
          {
            id: "q1",
            prompt: "Where does photosynthesis happen?",
            choices: [
              { id: "a", text: "In the nucleus" },
              { id: "b", text: "In the chloroplasts" },
            ],
            answerId: "b",
            explanation: "Chloroplasts hold the chlorophyll.",
            difficulty: 1,
          },
          { id: "q2", prompt: "What makes ATP?", choices: [{ id: "a", text: "Mitochondria" }, { id: "b", text: "Ribosomes" }], answerId: "a", difficulty: 2 },
        ],
      },
    });
    expect(first).toEqual({
      from: { kind: "question", n: 1 },
      lines: ["Where does photosynthesis happen?", "In the chloroplasts", "Chloroplasts hold the chlorophyll."],
    });
    expect(second?.lines).toEqual(["What makes ATP?", "Mitochondria"]);
  });
  test("test questions count inside their section; short answers show the first wording; Bagrut parts carry their model answers", () => {
    const passages = setPassages({
      type: "test",
      data: {
        sections: [
          {
            id: "s1",
            title: "Part A",
            questions: [
              { plugin: "mcq", id: "m1", prompt: "Which organelle makes ATP?", points: 5, choices: [{ id: "a", text: "Mitochondria" }, { id: "b", text: "Nucleus" }], answerId: "a" },
              { plugin: "short", id: "s1q", prompt: "How many cells does mitosis make?", points: 5, accepted: ["two", "2"], explanation: "Two identical cells." },
            ],
          },
          {
            id: "s2",
            title: "Part B",
            questions: [
              {
                plugin: "bagrut",
                id: "b1",
                stem: "A cell divides.",
                parts: [
                  { id: "p1", label: "a", prompt: "Name the process.", points: 10, modelAnswer: "Mitosis.", rubric: "Full points for mitosis." },
                  { id: "p2", label: "b", prompt: "How many cells result?", points: 10 },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(where(passages)).toEqual(["Part A 1", "Part A 2", "Part B 1"]);
    expect(passages[0]?.lines).toEqual(["Which organelle makes ATP?", "Mitochondria"]);
    expect(passages[1]?.lines).toEqual(["How many cells does mitosis make?", "two", "Two identical cells."]);
    expect(passages[2]?.lines).toEqual(["A cell divides.", "a. Name the process. Mitosis.", "b. How many cells result?"]);
  });
});

describe("answerFromSet", () => {
  test("English: searches the page and the set together; each quote says where it came from", () => {
    const found = answerFromSet({ page: PAGE, items: deck }, "Does diffusion go from high to low, and what is osmosis?");
    // The page's sentence shares three words, the card one, so the page comes first.
    expect(where(found)).toEqual(["page 2", "card 2"]);
    expect(found[0]?.lines).toEqual(["Diffusion: particles spreading from high to low concentration."]);
    expect(found[1]?.lines).toEqual(["Osmosis", "Water moving across a membrane toward the saltier side"]);
    expect(found[0]?.id).toBe("page-2");
    expect(found[1]?.id).toBe("set-1");
    expect((found[0]?.score ?? 0) > (found[1]?.score ?? 0)).toBe(true);
  });
  test("a page sentence a card repeats is quoted once, from the card", () => {
    const found = answerFromSet({ page: PAGE, items: deck }, "mitosis");
    expect(where(found)).toEqual(["card 1"]);
  });
  test("within a source, its own order; the source with the best match first", () => {
    const found = answerFromSet({ page: PAGE, items: deck }, "cells chromosomes enzymes");
    // Meiosis (card 3) holds the rarest word; card 1 shares "cells"; the page adds enzymes.
    expect(where(found)).toEqual(["card 1", "card 3", "page 4"]);
    expect(found[2]?.lines).toEqual(["Enzymes speed up reactions."]);
  });
  test("ties prefer the set's items, in picking and in order", () => {
    const page = "Osmosis moves water.";
    const items: AskPassage[] = [{ from: { kind: "card", n: 1 }, lines: ["Osmosis", "Across a membrane"] }];
    expect(where(answerFromSet({ page, items }, "osmosis", { limit: 1 }))).toEqual(["card 1"]);
    const both = answerFromSet({ page, items }, "osmosis");
    expect(where(both)).toEqual(["card 1", "page 0"]);
    expect(both[0]?.score).toBe(both[1]?.score as number);
  });
  test("at most 3 by default, `limit` otherwise, never under 1", () => {
    const items: AskPassage[] = [1, 2, 3, 4, 5].map((n) => ({ from: { kind: "card", n }, lines: [`Cell note ${n * 11}`, "About cells"] }));
    expect(answerFromSet({ items }, "cells")).toHaveLength(3);
    expect(answerFromSet({ items }, "cells", { limit: 5 })).toHaveLength(5);
    expect(answerFromSet({ items }, "cells", { limit: 0 })).toHaveLength(1);
    expect(where(answerFromSet({ items }, "cells"))).toEqual(["card 1", "card 2", "card 3"]);
  });
  test("an empty question, or only question words, finds nothing", () => {
    expect(answerFromSet({ page: PAGE, items: deck }, "")).toEqual([]);
    expect(answerFromSet({ page: PAGE, items: deck }, "   ")).toEqual([]);
    expect(answerFromSet({ page: PAGE, items: deck }, "what is it?")).toEqual([]);
    expect(answerFromSet({ page: PAGE, items: deck }, "photosynthesis")).toEqual([]);
  });
  test("headings alone are not answers; no page searches the set only", () => {
    expect(where(answerFromSet({ page: "# Photosynthesis\n\nLight makes sugar.", items: [] }, "photosynthesis"))).toEqual([]);
    expect(where(answerFromSet({ page: null, items: deck }, "membrane"))).toEqual(["card 2"]);
    expect(where(answerFromSet({ items: deck }, "membrane"))).toEqual(["card 2"]);
  });
  test("Hebrew: a pointed card matches an unpointed question, prefix letters and all", () => {
    const items = setPassages({
      type: "flashcards",
      data: { cards: [{ id: "a", front: "מִיטוֹזָה", back: "חֲלוּקָה שֶׁל תָּאִים" }, { id: "b", front: "אוסמוזה", back: "מעבר מים דרך קרום" }] },
    });
    const page = "# תאים\n\nהמיטוזה קורית בתאי הגוף.\nהתא נח בין חלוקות.";
    expect(where(answerFromSet({ page, items }, "מה זה מיטוזה?"))).toEqual(["card 1", "page 1"]);
    expect(where(answerFromSet({ page: null, items }, "מה עושה החלוקה?"))).toEqual(["card 1"]);
  });
  test("mixed: an English deck on a Hebrew page; each question finds its own language", () => {
    const page = "# שלבי המיטוזה\n\nפרופאזה היא השלב הראשון.\nבמטאפאזה הכרומוזומים מסתדרים באמצע.";
    const items = setPassages({ type: "flashcards", data: { cards: [{ id: "a", front: "Prophase", back: "Chromosomes condense" }] } });
    expect(where(answerFromSet({ page, items }, "When do chromosomes condense?"))).toEqual(["card 1"]);
    expect(where(answerFromSet({ page, items }, "מה קורה במטאפאזה?"))).toEqual(["page 2"]);
  });
  test("the same input gives the same answer", () => {
    const ask = () => answerFromSet({ page: PAGE, items: deck }, "cells membrane diffusion");
    expect(ask()).toEqual(ask());
  });
});

describe("markQuote", () => {
  test("marks the words that matched, stems and case included; the runs join back to the quote", () => {
    const runs = markQuote("Cell division that makes two identical cells", "What does a cell make?");
    expect(runs.filter((run) => run.match).map((run) => run.text)).toEqual(["Cell", "makes", "cells"]);
    expect(runs.map((run) => run.text).join("")).toBe("Cell division that makes two identical cells");
  });
  test("Hebrew: a pointed word with a prefix letter is marked whole", () => {
    const quote = "בַּמִּיטוֹזָה נוצרים שני תאים.";
    const runs = markQuote(quote, "מה זה מיטוזה?");
    expect(runs.filter((run) => run.match).map((run) => run.text)).toEqual(["בַּמִּיטוֹזָה"]);
    expect(runs.map((run) => run.text).join("")).toBe(quote);
  });
  test("no real words in the question: one plain run", () => {
    expect(markQuote("Enzymes speed up reactions.", "what is it?")).toEqual([{ text: "Enzymes speed up reactions.", match: false }]);
    expect(markQuote("", "cells")).toEqual([]);
  });
});
