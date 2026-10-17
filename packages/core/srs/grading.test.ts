import { describe, expect, test } from "bun:test";
import { type BagrutQuestion, type TestData, testDataSchema } from "@tempo/utils";
import { BAGRUT_PASS_MARK, countedQuestionIds, passMarkFor, scoreTest } from "./grading";

function bagrut(id: string, points = 25): BagrutQuestion {
  return {
    plugin: "bagrut",
    id,
    stem: `Question ${id}`,
    parts: [
      { id: "a", label: "א", prompt: "Part one", points: points - 10 },
      { id: "b", label: "ב", prompt: "Part two", points: 10 },
    ],
  };
}

/** A Bagrut practice paper: section 1 asks for 2 of 3; section 2 has one mcq and one short. */
const PAPER: TestData = {
  title: "Physics practice",
  style: "bagrut",
  sections: [
    {
      id: "s1",
      title: "Mechanics",
      instructions: "Answer 2 of the 3 questions.",
      pick: 2,
      questions: [bagrut("b1"), bagrut("b2"), bagrut("b3")],
    },
    {
      id: "s2",
      title: "Quick questions",
      questions: [
        {
          plugin: "mcq",
          id: "m1",
          prompt: "Unit of force?",
          points: 5,
          choices: [
            { id: "x", text: "Newton" },
            { id: "y", text: "Joule" },
          ],
          answerId: "x",
        },
        {
          plugin: "short",
          id: "t1",
          prompt: "g on Earth (m/s²)?",
          points: 5,
          accepted: ["9.8", "9.81"],
        },
      ],
    },
  ],
  origin: "user",
};

describe("scoreTest", () => {
  test("the paper fixture is codec-valid", () => {
    expect(testDataSchema.safeParse(PAPER).success).toBe(true);
  });

  test("pick: the first N answered questions count, in paper order", () => {
    const responses = {
      b2: { parts: { a: 15, b: 10 } },
      b3: { parts: { a: 10, b: 5 } },
      b1: undefined,
    };
    expect(countedQuestionIds(PAPER.sections[0]!, responses)).toEqual(["b2", "b3"]);

    const all = {
      b1: { parts: { a: 1 } },
      b2: { parts: { a: 15, b: 10 } },
      b3: { parts: { a: 15, b: 10 } },
    };
    // All three answered: b1 and b2 count even though b3 scored higher.
    expect(countedQuestionIds(PAPER.sections[0]!, all)).toEqual(["b1", "b2"]);
    const score = scoreTest(PAPER, all);
    expect(score.sections[0]?.points).toBe(26);
    expect(score.sections[0]?.maxPoints).toBe(50);
    expect(score.sections[0]?.questions.find((q) => q.questionId === "b3")).toMatchObject({
      answered: true,
      counted: false,
      points: 25,
    });
  });

  test("pick: unanswered questions fill the count as 0", () => {
    const responses = { b3: { parts: { a: 15, b: 10 } } };
    expect(countedQuestionIds(PAPER.sections[0]!, responses)).toEqual(["b1", "b3"]);
    const section = scoreTest(PAPER, responses).sections[0]!;
    expect(section.points).toBe(25);
    expect(section.maxPoints).toBe(50);
    expect(countedQuestionIds(PAPER.sections[0]!, {})).toEqual(["b1", "b2"]);
  });

  test("totals, percent and pass at the Bagrut default of 55", () => {
    const responses = {
      b1: { parts: { a: 15, b: 10 } },
      b2: { parts: { a: 5, b: 0 } },
      m1: { choiceId: "x" },
      t1: { text: " 9.81 " },
    };
    const score = scoreTest(PAPER, responses);
    expect(score.points).toBe(40);
    expect(score.maxPoints).toBe(60);
    expect(score.percent).toBe(67);
    expect(score.passMark).toBe(BAGRUT_PASS_MARK);
    expect(score.passed).toBe(true);
    expect(score.sections.map((s) => s.countedIds)).toEqual([
      ["b1", "b2"],
      ["m1", "t1"],
    ]);
    expect(score.sections[1]?.questions.map((q) => q.correct)).toEqual([true, true]);
  });

  test("below the pass mark", () => {
    const score = scoreTest(PAPER, { b1: { parts: { a: 10 } }, m1: { choiceId: "y" } });
    expect(score.points).toBe(10);
    expect(score.percent).toBe(17);
    expect(score.passed).toBe(false);
  });

  test("pass is judged on the shown (rounded) percent", () => {
    // 109.2 / 200 = 54.6% shows as 55 and passes.
    const test: TestData = {
      title: "Edge",
      style: "bagrut",
      sections: [{ id: "s", title: "S", questions: [bagrut("b", 100), bagrut("c", 100)] }],
      origin: "user",
    };
    const score = scoreTest(test, { b: { parts: { a: 90, b: 10 } }, c: { parts: { a: 9.2 } } });
    expect(score.percent).toBe(55);
    expect(score.passed).toBe(true);
  });

  test("standard tests have no pass mark unless they set one", () => {
    const standard: TestData = { ...PAPER, style: "standard" };
    expect(passMarkFor(standard)).toBeNull();
    const score = scoreTest(standard, {});
    expect(score.passMark).toBeNull();
    expect(score.passed).toBeNull();
    expect(score.percent).toBe(0);
    expect(passMarkFor({ style: "standard", passMark: 70 })).toBe(70);
    expect(passMarkFor({ style: "bagrut", passMark: 60 })).toBe(60);
  });

  test("responses for unknown ids and prototype keys are ignored", () => {
    const score = scoreTest(PAPER, { nope: { choiceId: "x" }, toString: { text: "hi" } });
    expect(score.points).toBe(0);
  });
});
