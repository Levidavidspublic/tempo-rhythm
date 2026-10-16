import type { QuizQuestion, TestData } from "@tempo/utils";
import {
  answerQuestion,
  currentQuestion,
  lastAnswer,
  type QuizMode,
  type QuizSession,
  quizResult,
  startQuiz,
} from "../../../core/srs/adaptive";
import { scoreTest } from "../../../core/srs/grading";
import type { QuizEngine } from "./quiz-engine";
import type { TestResponses, TestScore, TestScorer } from "./test-scorer";

/**
 * Adapters from `packages/core/srs` (the real study logic) to the injected interfaces the study
 * components take. The core quiz moves to the next question as soon as an answer is recorded; the
 * component shows feedback on the answered question first, so the adapter keeps that question on
 * screen until `next`.
 */

export type CoreQuizState = { session: QuizSession; shown: QuizQuestion | null };

export function coreQuizEngine(
  questions: readonly QuizQuestion[],
  options: { mode?: QuizMode; maxQuestions?: number } = {},
): QuizEngine<CoreQuizState> {
  return {
    start: () => {
      const session = startQuiz(questions, options);
      return { session, shown: currentQuestion(session) };
    },
    current: (state) => state.shown,
    answer: (state, choiceId) => {
      const session = answerQuestion(state.session, choiceId);
      return { state: { session, shown: state.shown }, correct: lastAnswer(session)?.correct ?? false };
    },
    next: (state) => ({ session: state.session, shown: currentQuestion(state.session) }),
    result: (state) => quizResult(state.session),
  };
}

/** The component's responses in the shape the core plugins read. */
export function toCoreResponses(test: TestData, responses: TestResponses): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const section of test.sections) {
    for (const question of section.questions) {
      const response = responses[question.id];
      if (!response || response.plugin !== question.plugin) continue;
      if (response.plugin === "mcq" && response.choiceId !== "") out[question.id] = { choiceId: response.choiceId };
      if (response.plugin === "short" && response.text.trim() !== "") out[question.id] = { text: response.text };
      if (response.plugin === "bagrut" && question.plugin === "bagrut") {
        // A part counts as answered once something is written; its points are the student's own marks.
        const written = question.parts.filter((part) => (response.parts[part.id] ?? "").trim() !== "");
        if (written.length === 0) continue;
        const parts: Record<string, number> = {};
        for (const part of written) parts[part.id] = response.marks[part.id] ?? 0;
        out[question.id] = { parts };
      }
    }
  }
  return out;
}

/** `scoreTest` from `packages/core/srs/grading.ts`, as the `TestRunner` scorer. */
export const coreTestScorer: TestScorer = (test, responses): TestScore => {
  const score = scoreTest(test, toCoreResponses(test, responses));
  const questions: TestScore["questions"] = {};
  for (const section of score.sections) {
    for (const q of section.questions) questions[q.questionId] = { points: q.points, max: q.maxPoints };
  }
  return {
    sections: score.sections.map((s) => ({
      sectionId: s.sectionId,
      counted: s.countedIds,
      points: s.points,
      max: s.maxPoints,
    })),
    questions,
    total: score.points,
    max: score.maxPoints,
    percent: score.percent,
    ...(score.passMark !== null ? { passMark: score.passMark } : {}),
    ...(score.passed !== null ? { passed: score.passed } : {}),
  };
};
