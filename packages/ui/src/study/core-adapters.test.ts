import { describe, expect, test } from "bun:test";
import { coreQuizEngine, coreTestScorer, toCoreResponses } from "./core-adapters";
import { practiceTest, quizQuestions } from "./test-fixtures";
import { referenceScoreTest, type TestResponses } from "./test-scorer";

describe("core quiz engine adapter", () => {
  test("feedback stays on the answered question until next", () => {
    const engine = coreQuizEngine(quizQuestions, { mode: "fixed" });
    let state = engine.start();
    const first = engine.current(state);
    expect(first?.id).toBe(quizQuestions[0]?.id);
    const answered = engine.answer(state, first?.answerId ?? "");
    expect(answered.correct).toBe(true);
    expect(engine.current(answered.state)?.id).toBe(first?.id);
    state = engine.next(answered.state);
    expect(engine.current(state)?.id).toBe(quizQuestions[1]?.id);
    expect(engine.result(state)).toMatchObject({ correct: 1, total: 1, missedIds: [] });
  });

  test("a wrong answer is reported and counted as missed", () => {
    const engine = coreQuizEngine(quizQuestions, { mode: "adaptive" });
    const state = engine.start();
    const q = engine.current(state);
    const wrong = q?.choices.find((c) => c.id !== q.answerId)?.id ?? "";
    const answered = engine.answer(state, wrong);
    expect(answered.correct).toBe(false);
    expect(engine.result(answered.state).missedIds).toEqual([q?.id ?? ""]);
  });
});

describe("core test scorer adapter", () => {
  const responses: TestResponses = {};
  for (const section of practiceTest.sections) {
    for (const question of section.questions) {
      if (question.plugin === "mcq") responses[question.id] = { plugin: "mcq", choiceId: question.answerId };
      if (question.plugin === "short") responses[question.id] = { plugin: "short", text: question.accepted[0] ?? "" };
      if (question.plugin === "bagrut") {
        const parts: Record<string, string> = {};
        const marks: Record<string, number> = {};
        for (const part of question.parts) {
          parts[part.id] = "My answer";
          marks[part.id] = part.points;
        }
        responses[question.id] = { plugin: "bagrut", parts, marks };
      }
    }
  }

  test("agrees with the reference scorer on a full paper", () => {
    const core = coreTestScorer(practiceTest, responses);
    const reference = referenceScoreTest(practiceTest, responses);
    expect(core.total).toBe(reference.total);
    expect(core.max).toBe(reference.max);
    expect(core.percent).toBe(reference.percent);
    expect(core.passed).toBe(reference.passed);
    expect(core.sections.map((s) => s.counted)).toEqual(reference.sections.map((s) => s.counted));
  });

  test("an empty paper scores 0 and a bagrut answer with no writing is not answered", () => {
    const empty = coreTestScorer(practiceTest, {});
    expect(empty.total).toBe(0);
    const bagrut = practiceTest.sections.flatMap((s) => s.questions).find((q) => q.plugin === "bagrut");
    if (bagrut && bagrut.plugin === "bagrut") {
      const blank = toCoreResponses(practiceTest, {
        [bagrut.id]: { plugin: "bagrut", parts: {}, marks: { [bagrut.parts[0]?.id ?? "x"]: 5 } },
      });
      expect(blank[bagrut.id]).toBeUndefined();
    }
  });
});
