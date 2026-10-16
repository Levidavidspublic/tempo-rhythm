import type { QuizDifficulty, QuizQuestion } from "@tempo/utils";

/**
 * The quiz engine `AdaptiveQuiz` drives. The component never picks questions itself: the host
 * passes an engine. `packages/core/srs/adaptive.ts` (Builder A) is the real adaptive one; the lead
 * adapts it to this interface. `fixedQuizEngine` below is the plain in-order engine, used for
 * fixed-mode quizzes and in tests.
 *
 * Engines are pure: every call returns a new state and never changes the one it was given.
 */
export type QuizEngine<S = unknown> = {
  /** A fresh run. */
  start: () => S;
  /** The question to show now, or null when the quiz is over. */
  current: (state: S) => QuizQuestion | null;
  /** Record an answer to the current question. */
  answer: (state: S, choiceId: string) => { state: S; correct: boolean };
  /** Move on after an answer. */
  next: (state: S) => S;
  result: (state: S) => QuizResult;
};

export type DifficultyCount = { correct: number; total: number };

export type QuizResult = {
  correct: number;
  total: number;
  byDifficulty: Record<QuizDifficulty, DifficultyCount>;
  /** Ids of the questions answered wrongly, in the order they were asked. */
  missedIds: string[];
};

export type QuizAnswer = {
  questionId: string;
  choiceId: string;
  correct: boolean;
  difficulty: QuizDifficulty;
};

/** Counts for a list of answers, shared by engines. */
export function quizResultFrom(answers: readonly QuizAnswer[]): QuizResult {
  const byDifficulty: Record<QuizDifficulty, DifficultyCount> = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
  };
  for (const answer of answers) {
    byDifficulty[answer.difficulty].total += 1;
    if (answer.correct) byDifficulty[answer.difficulty].correct += 1;
  }
  return {
    correct: answers.filter((answer) => answer.correct).length,
    total: answers.length,
    byDifficulty,
    missedIds: answers.filter((answer) => !answer.correct).map((answer) => answer.questionId),
  };
}

export type FixedQuizState = { index: number; answers: QuizAnswer[] };

/** Questions in their saved order, each once. */
export function fixedQuizEngine(questions: readonly QuizQuestion[]): QuizEngine<FixedQuizState> {
  return {
    start: () => ({ index: 0, answers: [] }),
    current: (state) => questions[state.index] ?? null,
    answer: (state, choiceId) => {
      const question = questions[state.index];
      if (!question || state.answers.length > state.index) return { state, correct: false };
      const correct = question.answerId === choiceId;
      const record = {
        questionId: question.id,
        choiceId,
        correct,
        difficulty: question.difficulty,
      };
      return { state: { ...state, answers: [...state.answers, record] }, correct };
    },
    next: (state) => ({ ...state, index: state.index + 1 }),
    result: (state) => quizResultFrom(state.answers),
  };
}
