import { describe, expect, test } from "bun:test";
import { type QuizQuestion, quizDataSchema } from "@tempo/utils";
import {
  answerQuestion,
  currentQuestion,
  isQuizOver,
  lastAnswer,
  pickAdaptiveQuestion,
  type QuizSession,
  quizResult,
  startLevel,
  startQuiz,
} from "./adaptive";

function q(id: string, difficulty: 1 | 2 | 3): QuizQuestion {
  return {
    id,
    prompt: `Question ${id}`,
    choices: [
      { id: "a", text: "Right" },
      { id: "b", text: "Wrong" },
    ],
    answerId: "a",
    difficulty,
  };
}

const BANK: QuizQuestion[] = [
  q("e1", 1),
  q("e2", 1),
  q("e3", 1),
  q("m1", 2),
  q("m2", 2),
  q("m3", 2),
  q("h1", 3),
  q("h2", 3),
];

/** Answers with a sequence of right (true) / wrong (false); returns the asked ids. */
function play(session: QuizSession, rights: boolean[]): { session: QuizSession; asked: string[] } {
  const asked: string[] = [];
  let s = session;
  for (const right of rights) {
    const current = currentQuestion(s);
    if (!current) break;
    asked.push(current.id);
    s = answerQuestion(s, right ? current.answerId : "b");
  }
  return { session: s, asked };
}

describe("adaptive quiz", () => {
  test("the fixture bank is codec-valid", () => {
    const data = { title: "Bank", mode: "adaptive", questions: BANK, origin: "user" };
    expect(quizDataSchema.safeParse(data).success).toBe(true);
  });

  test("starts at level 1, or 2 without level-1 questions", () => {
    expect(startLevel(BANK)).toBe(1);
    expect(startLevel([q("m", 2), q("h", 3)])).toBe(2);
    expect(startLevel([q("h", 3)])).toBe(2);
    expect(currentQuestion(startQuiz([q("h", 3), q("m", 2)]))?.id).toBe("m");
    expect(currentQuestion(startQuiz([q("h", 3)]))?.id).toBe("h");
  });

  test("two right in a row move up; a miss moves down", () => {
    const { asked, session } = play(startQuiz(BANK), [true, true, true, true, false, false]);
    // e1, e2 right → level 2; m1, m2 right → level 3; h1 wrong → level 2; m3 wrong → level 1.
    expect(asked).toEqual(["e1", "e2", "m1", "m2", "h1", "m3"]);
    expect(session.level).toBe(1);
    expect(currentQuestion(session)?.id).toBe("e3");
  });

  test("right, wrong, right does not move up", () => {
    const { asked } = play(startQuiz(BANK), [true, false, true, true]);
    // e1 right (run 1), e2 wrong (level stays 1), e3 right (run 1), then level 1 is empty → m1.
    expect(asked).toEqual(["e1", "e2", "e3", "m1"]);
  });

  test("a miss at level 1 stays at level 1", () => {
    const { session } = play(startQuiz(BANK), [false]);
    expect(session.level).toBe(1);
    expect(currentQuestion(session)?.id).toBe("e2");
  });

  test("level 3 is the ceiling", () => {
    const { session } = play(startQuiz(BANK), [true, true, true, true, true, true]);
    expect(session.level).toBe(3);
  });

  test("a level that runs out takes the nearest level, easier on a tie", () => {
    expect(pickAdaptiveQuestion(BANK, new Set(["m1", "m2", "m3"]), 2)?.id).toBe("e1");
    expect(pickAdaptiveQuestion(BANK, new Set(["e1", "e2", "e3", "m1", "m2", "m3"]), 1)?.id).toBe("h1");
    expect(pickAdaptiveQuestion(BANK, new Set(BANK.map((x) => x.id)), 2)).toBeNull();
  });

  test("never repeats a question and ends when none are left", () => {
    const { asked, session } = play(startQuiz(BANK), Array(20).fill(false));
    expect(asked).toHaveLength(BANK.length);
    expect(new Set(asked).size).toBe(BANK.length);
    expect(isQuizOver(session)).toBe(true);
    expect(currentQuestion(session)).toBeNull();
  });

  test("ends after maxQuestions", () => {
    const { session, asked } = play(startQuiz(BANK, { maxQuestions: 3 }), Array(10).fill(true));
    expect(asked).toHaveLength(3);
    expect(isQuizOver(session)).toBe(true);
    expect(startQuiz(BANK, { maxQuestions: 0 }).currentId).toBeNull();
    expect(startQuiz(BANK, { maxQuestions: 99 }).maxQuestions).toBe(BANK.length);
  });

  test("fixed mode asks in order whatever the answers", () => {
    const { asked } = play(startQuiz(BANK, { mode: "fixed" }), [true, true, true, false, true]);
    expect(asked).toEqual(["e1", "e2", "e3", "m1", "m2"]);
  });

  test("quizResult counts right answers, difficulties and misses", () => {
    const { session } = play(startQuiz(BANK), [true, true, false, true, true, true]);
    const result = quizResult(session);
    expect(result.correct).toBe(5);
    expect(result.total).toBe(6);
    expect(result.missedIds).toEqual(["m1"]);
    expect(result.byDifficulty[1]).toEqual({ correct: 3, total: 3 });
    expect(result.byDifficulty[1].total + result.byDifficulty[2].total + result.byDifficulty[3].total).toBe(6);
    expect(lastAnswer(session)?.correct).toBe(true);
  });

  test("an empty quiz is over at once and scores zero", () => {
    const s = startQuiz([]);
    expect(isQuizOver(s)).toBe(true);
    expect(answerQuestion(s, "a")).toBe(s);
    expect(quizResult(s)).toEqual({
      correct: 0,
      total: 0,
      byDifficulty: { 1: { correct: 0, total: 0 }, 2: { correct: 0, total: 0 }, 3: { correct: 0, total: 0 } },
      missedIds: [],
    });
  });
});
