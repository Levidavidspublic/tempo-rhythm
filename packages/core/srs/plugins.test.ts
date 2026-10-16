import { describe, expect, test } from "bun:test";
import type { BagrutQuestion, McqQuestion, ShortQuestion } from "@tempo/utils";
import { testQuestionSchema } from "@tempo/utils";
import {
  bagrutPlugin,
  clampPartPoints,
  gradeQuestion,
  isQuestionAnswered,
  mcqPlugin,
  normalizeAnswer,
  QUESTION_PLUGINS,
  questionMaxPoints,
  shortPlugin,
} from "./plugins";

const MCQ: McqQuestion = {
  plugin: "mcq",
  id: "q1",
  prompt: "Capital of France?",
  points: 4,
  choices: [
    { id: "a", text: "Paris" },
    { id: "b", text: "Lyon" },
  ],
  answerId: "a",
};

const SHORT: ShortQuestion = {
  plugin: "short",
  id: "q2",
  prompt: "Which organelle makes energy?",
  points: 5,
  accepted: ["Mitochondria", "the mitochondrion", "מיטוכונדריה"],
};

const BAGRUT: BagrutQuestion = {
  plugin: "bagrut",
  id: "q3",
  stem: "A ball is thrown upwards.",
  parts: [
    {
      id: "p1",
      label: "א",
      prompt: "Find the time to the top.",
      points: 10,
      modelAnswer: "t = v/g",
    },
    { id: "p2", label: "ב", prompt: "Find the height.", points: 15, rubric: "5 for the formula" },
  ],
};

describe("question plugins", () => {
  test("fixtures are codec-valid", () => {
    for (const question of [MCQ, SHORT, BAGRUT]) {
      expect(testQuestionSchema.safeParse(question).success).toBe(true);
    }
  });

  test("the registry has exactly mcq, short and bagrut", () => {
    expect(Object.keys(QUESTION_PLUGINS).sort()).toEqual(["bagrut", "mcq", "short"]);
  });

  test("mcq: full points for the answer, 0 otherwise", () => {
    expect(mcqPlugin.maxPoints(MCQ)).toBe(4);
    expect(mcqPlugin.grade(MCQ, { choiceId: "a" })).toEqual({
      points: 4,
      maxPoints: 4,
      correct: true,
    });
    expect(mcqPlugin.grade(MCQ, { choiceId: "b" })).toEqual({
      points: 0,
      maxPoints: 4,
      correct: false,
    });
    expect(mcqPlugin.grade(MCQ, undefined).points).toBe(0);
    expect(mcqPlugin.isAnswered(MCQ, { choiceId: "b" })).toBe(true);
    expect(mcqPlugin.isAnswered(MCQ, { choiceId: "" })).toBe(false);
    expect(mcqPlugin.isAnswered(MCQ, "a")).toBe(false);
  });

  test("short: normalised comparison with any accepted answer", () => {
    expect(shortPlugin.grade(SHORT, { text: "  MITOCHONDRIA. " }).correct).toBe(true);
    expect(shortPlugin.grade(SHORT, { text: "The   mitochondrion!" }).correct).toBe(true);
    expect(shortPlugin.grade(SHORT, { text: "מִיטוֹכוֹנְדְרְיָה" }).points).toBe(5);
    expect(shortPlugin.grade(SHORT, { text: "nucleus" })).toEqual({
      points: 0,
      maxPoints: 5,
      correct: false,
    });
    expect(shortPlugin.grade(SHORT, { text: "   " }).correct).toBe(false);
    expect(shortPlugin.isAnswered(SHORT, { text: " ?! " })).toBe(false);
    expect(shortPlugin.isAnswered(SHORT, { text: "x" })).toBe(true);
    expect(shortPlugin.isAnswered(SHORT, { text: 3 })).toBe(false);
  });

  test("bagrut: self-marked parts, clamped to 0..points", () => {
    expect(bagrutPlugin.maxPoints(BAGRUT)).toBe(25);
    expect(bagrutPlugin.grade(BAGRUT, { parts: { p1: 8, p2: 15 } })).toEqual({
      points: 23,
      maxPoints: 25,
      parts: { p1: 8, p2: 15 },
    });
    expect(bagrutPlugin.grade(BAGRUT, { parts: { p1: 99, p2: -4 } }).parts).toEqual({
      p1: 10,
      p2: 0,
    });
    expect(bagrutPlugin.grade(BAGRUT, { parts: { p1: Number.NaN, p2: "7" } }).points).toBe(0);
    expect(bagrutPlugin.grade(BAGRUT, { parts: { p1: 2.5 } }).points).toBe(2.5);
    expect(bagrutPlugin.isAnswered(BAGRUT, { parts: { p2: 0 } })).toBe(true);
    expect(bagrutPlugin.isAnswered(BAGRUT, { parts: {} })).toBe(false);
    expect(bagrutPlugin.isAnswered(BAGRUT, { parts: { other: 3 } })).toBe(false);
    expect(clampPartPoints(undefined, 5)).toBe(0);
  });

  test("dispatch helpers pick the right plugin", () => {
    expect(questionMaxPoints(BAGRUT)).toBe(25);
    expect(gradeQuestion(MCQ, { choiceId: "a" }).points).toBe(4);
    expect(isQuestionAnswered(SHORT, { text: "x" })).toBe(true);
  });

  test("prototype keys are never read as responses", () => {
    const sneaky = { ...BAGRUT, parts: [{ ...BAGRUT.parts[0]!, id: "constructor" }] };
    expect(bagrutPlugin.isAnswered(sneaky, { parts: {} })).toBe(false);
    expect(bagrutPlugin.grade(sneaky, { parts: {} }).points).toBe(0);
  });
});

describe("normalizeAnswer", () => {
  test.each([
    ["  Hello   World  ", "hello world"],
    ["Hello, world!", "hello world"],
    ["don't", "dont"],
    ["well-known", "well known"],
    ["ＡＢＣ", "abc"],
    ["שָׁלוֹם", "שלום"],
    ["בֵּית־סֵפֶר", "בית ספר"],
    ['צה"ל', "צהל"],
    ["צה״ל", "צהל"],
    ["3.5", "3.5"],
    ["Paris.", "paris"],
    ["1/2", "1/2"],
    ["-4", "-4"],
    ["x-1", "x-1"],
    ["x+1", "x+1"],
    ["10:30", "10:30"],
    ["(a)", "a"],
  ])("%p → %p", (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });
});
