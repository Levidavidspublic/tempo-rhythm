import { describe, expect, test } from "bun:test";
import { parseTempoBlocks } from "./blocks";

const ID = "blk_01JABCDEFGHJKMNPQRSTVWXYZ0";
const fence = (value: unknown) => `\`\`\`json tempo\n${JSON.stringify(value)}\n\`\`\`\n`;
const kinds = (body: string) =>
  parseTempoBlocks(body).map((s) => (s.kind === "valid" ? s.block.type : s.kind === "broken" ? s.errorCode : "md"));

const deck = {
  id: ID,
  v: 1,
  type: "flashcards",
  data: {
    title: "Cell biology",
    origin: "user",
    cards: [
      { id: "c1", front: "Mitochondria", back: "Where the cell makes most of its energy" },
      { id: "c2", front: "Ribosome", back: "Builds proteins" },
    ],
  },
};

const quiz = {
  id: ID,
  v: 1,
  type: "quiz",
  data: {
    title: "Cells",
    mode: "adaptive",
    origin: "outline",
    questions: [
      {
        id: "q1",
        prompt: "Which part builds proteins?",
        choices: [
          { id: "a", text: "Ribosome" },
          { id: "b", text: "Nucleus" },
        ],
        answerId: "a",
        difficulty: 1,
      },
    ],
  },
};

const test_ = {
  id: ID,
  v: 1,
  type: "test",
  data: {
    title: "Biology practice paper",
    style: "bagrut",
    durationMin: 90,
    passMark: 55,
    origin: "user",
    sections: [
      {
        id: "s1",
        title: "Part one",
        pick: 1,
        questions: [
          {
            plugin: "bagrut",
            id: "b1",
            stem: "A cell is placed in salty water.",
            parts: [
              { id: "p1", label: "א", prompt: "What happens to the cell?", points: 10, modelAnswer: "It loses water." },
              { id: "p2", label: "ב", prompt: "Explain why.", points: 15 },
            ],
          },
          { plugin: "short", id: "s2", prompt: "Name the cell's power plant.", points: 5, accepted: ["mitochondria"] },
        ],
      },
    ],
  },
};

describe("study blocks in the page codec", () => {
  test("flashcards, quiz and test parse as valid blocks", () => {
    expect(kinds(fence(deck))).toEqual(["flashcards"]);
    expect(kinds(fence(quiz))).toEqual(["quiz"]);
    expect(kinds(fence(test_))).toEqual(["test"]);
  });

  test("a quiz whose answer is not one of its choices is invalid data", () => {
    const bad = structuredClone(quiz);
    bad.data.questions[0]!.answerId = "z";
    expect(kinds(fence(bad))).toEqual(["invalid_data"]);
  });

  test("repeated card ids are invalid data", () => {
    const bad = structuredClone(deck);
    bad.data.cards[1]!.id = "c1";
    expect(kinds(fence(bad))).toEqual(["invalid_data"]);
  });

  test("a section can't ask for more answers than it has questions", () => {
    const bad = structuredClone(test_);
    bad.data.sections[0]!.pick = 3;
    expect(kinds(fence(bad))).toEqual(["invalid_data"]);
  });

  test("an empty deck and unknown fields are invalid data, not a new type", () => {
    expect(kinds(fence({ ...deck, data: { ...deck.data, cards: [] } }))).toEqual(["invalid_data"]);
    expect(kinds(fence({ ...deck, data: { ...deck.data, secret: 1 } }))).toEqual(["invalid_data"]);
  });

  test("unknown block types are still unsupported", () => {
    expect(kinds(fence({ ...deck, type: "mindmap" }))).toEqual(["unsupported_type"]);
  });

  test("text over 500 characters is refused", () => {
    const bad = structuredClone(deck);
    bad.data.cards[0]!.back = "x".repeat(501);
    expect(kinds(fence(bad))).toEqual(["invalid_data"]);
  });
});
