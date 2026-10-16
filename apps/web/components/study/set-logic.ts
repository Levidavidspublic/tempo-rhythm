import type { TestScore } from "@tempo/ui";
import type { QuizQuestion, TestData } from "@tempo/utils";

/**
 * Pure pieces of a set's screen (/study/[setId]): what's due in a deck, the attempt to record
 * after a quiz or a test (ids and marks only, never the person's written words), and the
 * "Review the ones you missed" subsets.
 */

export type AttemptAnswer = { itemId: string; correct?: boolean; points?: number; maxPoints?: number };

/** Cards due now and cards never reviewed, from `getSet`'s states. */
export function deckCounts(
  cards: readonly { id: string }[],
  states: Readonly<Record<string, { dueAt: number }>>,
  now: number,
): { due: number; fresh: number } {
  let due = 0;
  let fresh = 0;
  for (const card of cards) {
    const state = states[card.id];
    if (!state) fresh += 1;
    else if (state.dueAt <= now) due += 1;
  }
  return { due, fresh };
}

/** A quiz attempt: one answer per question asked, the last answer for a question winning. */
export function quizAttempt(log: ReadonlyMap<string, boolean>): { score: number; maxScore: number; answers: AttemptAnswer[] } {
  const answers = [...log].map(([itemId, correct]) => ({ itemId, correct }));
  return { score: answers.filter((a) => a.correct).length, maxScore: answers.length, answers };
}

/** A test attempt: the counted questions with their points (written answers are never sent). */
export function testAttempt(score: TestScore): { score: number; maxScore: number; answers: AttemptAnswer[] } {
  const answers: AttemptAnswer[] = [];
  for (const section of score.sections) {
    for (const itemId of section.counted) {
      const q = score.questions[itemId];
      if (q) answers.push({ itemId, points: q.points, maxPoints: q.max });
    }
  }
  return { score: score.total, maxScore: score.max, answers };
}

/** The quiz questions with these ids, in their saved order. */
export function onlyQuizQuestions(questions: readonly QuizQuestion[], ids: readonly string[]): QuizQuestion[] {
  const wanted = new Set(ids);
  return questions.filter((q) => wanted.has(q.id));
}

/**
 * The test cut down to these questions: sections without any are left out, and "answer N of
 * these" no longer applies (every missed question is worth another look). Null when none match.
 */
export function onlyTestQuestions(test: TestData, ids: readonly string[]): TestData | null {
  const wanted = new Set(ids);
  const sections = test.sections
    .map(({ pick: _pick, ...section }) => ({ ...section, questions: section.questions.filter((q) => wanted.has(q.id)) }))
    .filter((section) => section.questions.length > 0);
  if (sections.length === 0) return null;
  const { durationMin: _duration, ...rest } = test;
  return { ...rest, sections };
}
