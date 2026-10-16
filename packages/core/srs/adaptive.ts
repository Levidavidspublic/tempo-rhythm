/**
 * Adaptive quiz, kitchen T3.
 *
 * Pure functions over the codec's `QuizQuestion`s; sessions are immutable values.
 *
 * Difficulty is 1 (recall), 2 (understand) or 3 (apply). In adaptive mode:
 * - The quiz starts at level 1, or at 2 when there are no level-1 questions.
 * - Two right answers in a row at the same difficulty move the level up one; a miss moves it down
 *   one (never below 1 or above 3).
 * - A question is never asked twice. When the current level has nothing left, the nearest level
 *   that does is used (the easier one on a tie), and the questions keep their given order inside
 *   a level.
 * Fixed mode asks the questions in order. Either way the quiz ends after `maxQuestions` (default:
 * all of them) or when none are left.
 */

import type { QuizDifficulty, QuizQuestion } from "@tempo/utils";

export type QuizMode = "adaptive" | "fixed";

export type QuizAnswer = {
  questionId: string;
  choiceId: string;
  correct: boolean;
  difficulty: QuizDifficulty;
};

export type QuizSession = {
  mode: QuizMode;
  questions: readonly QuizQuestion[];
  maxQuestions: number;
  /** The level the next adaptive pick aims for. */
  level: QuizDifficulty;
  /** Right answers in a row at the last answered difficulty. */
  streak: number;
  answers: readonly QuizAnswer[];
  /** The question on screen, or `null` when the quiz is over. */
  currentId: string | null;
};

export type DifficultyCount = { correct: number; total: number };

export type QuizResult = {
  correct: number;
  total: number;
  byDifficulty: Record<QuizDifficulty, DifficultyCount>;
  missedIds: string[];
};

const LEVELS: readonly QuizDifficulty[] = [1, 2, 3];

function clampLevel(level: number): QuizDifficulty {
  return Math.min(3, Math.max(1, level)) as QuizDifficulty;
}

/** True when `choiceId` is the question's answer. */
export function isCorrectChoice(question: QuizQuestion, choiceId: string): boolean {
  return question.answerId === choiceId;
}

/** Level 1, or 2 when no question is level 1. */
export function startLevel(questions: readonly QuizQuestion[]): QuizDifficulty {
  return questions.some((q) => q.difficulty === 1) ? 1 : 2;
}

/**
 * The next unasked question at `level`, or at the nearest level that still has one (the easier
 * level on a tie). `null` when every question was asked.
 */
export function pickAdaptiveQuestion(
  questions: readonly QuizQuestion[],
  asked: ReadonlySet<string>,
  level: QuizDifficulty,
): QuizQuestion | null {
  const byDistance = [...LEVELS].sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b);
  for (const candidate of byDistance) {
    const next = questions.find((q) => q.difficulty === candidate && !asked.has(q.id));
    if (next) return next;
  }
  return null;
}

function nextQuestionId(session: Omit<QuizSession, "currentId">): string | null {
  if (session.answers.length >= session.maxQuestions) return null;
  const asked = new Set(session.answers.map((a) => a.questionId));
  if (session.mode === "fixed") {
    return session.questions.find((q) => !asked.has(q.id))?.id ?? null;
  }
  return pickAdaptiveQuestion(session.questions, asked, session.level)?.id ?? null;
}

export function startQuiz(
  questions: readonly QuizQuestion[],
  options: { mode?: QuizMode; maxQuestions?: number } = {},
): QuizSession {
  const all = questions.length;
  const requested = options.maxQuestions === undefined ? all : Math.floor(options.maxQuestions);
  const base = {
    mode: options.mode ?? "adaptive",
    questions,
    maxQuestions: Math.min(all, Math.max(0, requested)),
    level: startLevel(questions),
    streak: 0,
    answers: [],
  } satisfies Omit<QuizSession, "currentId">;
  return { ...base, currentId: nextQuestionId(base) };
}

/** The question on screen, or `null` when the quiz is over. */
export function currentQuestion(session: QuizSession): QuizQuestion | null {
  if (session.currentId === null) return null;
  return session.questions.find((q) => q.id === session.currentId) ?? null;
}

export function isQuizOver(session: QuizSession): boolean {
  return session.currentId === null;
}

/** The level and streak after one answer at `difficulty` (adaptive mode). */
export function nextLevel(
  previous: QuizAnswer | undefined,
  streak: number,
  answer: Pick<QuizAnswer, "correct" | "difficulty">,
): { level: QuizDifficulty; streak: number } {
  if (!answer.correct) return { level: clampLevel(answer.difficulty - 1), streak: 0 };
  const sameRun = previous?.correct === true && previous.difficulty === answer.difficulty;
  const run = sameRun ? streak + 1 : 1;
  if (run >= 2) return { level: clampLevel(answer.difficulty + 1), streak: 0 };
  return { level: answer.difficulty, streak: run };
}

/** Answers the current question with `choiceId`. A finished quiz is returned unchanged. */
export function answerQuestion(session: QuizSession, choiceId: string): QuizSession {
  const question = currentQuestion(session);
  if (!question) return session;
  const answer: QuizAnswer = {
    questionId: question.id,
    choiceId,
    correct: isCorrectChoice(question, choiceId),
    difficulty: question.difficulty,
  };
  const moved =
    session.mode === "adaptive"
      ? nextLevel(session.answers.at(-1), session.streak, answer)
      : { level: session.level, streak: 0 };
  const base = { ...session, ...moved, answers: [...session.answers, answer] };
  return { ...base, currentId: nextQuestionId(base) };
}

/** The last answer given, for the "Right." / "Not quite." feedback. */
export function lastAnswer(session: QuizSession): QuizAnswer | null {
  return session.answers.at(-1) ?? null;
}

/** Score so far (or final): right answers, answered count, per-difficulty counts, missed ids. */
export function quizResult(session: Pick<QuizSession, "answers">): QuizResult {
  const byDifficulty: Record<QuizDifficulty, DifficultyCount> = {
    1: { correct: 0, total: 0 },
    2: { correct: 0, total: 0 },
    3: { correct: 0, total: 0 },
  };
  const missedIds: string[] = [];
  let correct = 0;
  for (const answer of session.answers) {
    const bucket = byDifficulty[answer.difficulty];
    bucket.total += 1;
    if (answer.correct) {
      bucket.correct += 1;
      correct += 1;
    } else {
      missedIds.push(answer.questionId);
    }
  }
  return { correct, total: session.answers.length, byDifficulty, missedIds };
}
