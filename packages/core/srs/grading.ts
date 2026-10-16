/**
 * Test scoring, kitchen T3.
 *
 * Pure functions. Each question is marked by its plugin (`plugins.ts`); this module adds the
 * section and test totals.
 *
 * - A section without `pick` counts every question.
 * - A section with `pick: N` ("answer N of these", as in a Bagrut paper) counts the first N
 *   questions the student answered, in paper order. When fewer than N were answered, the first
 *   unanswered questions fill the count and score 0, so skipping never raises the percent.
 * - `percent` is points ÷ max points × 100, rounded to a whole number. `passed` compares that
 *   shown percent with the pass mark (so a screen never says 55% and "below 55"): the test's `passMark`, else 55 for `style: "bagrut"`,
 *   else none (then `passMark` and `passed` are `null`).
 */

import type { TestData, TestQuestion, TestSection } from "@tempo/utils";
import { gradeQuestion, isQuestionAnswered, ownValue } from "./plugins";

export const BAGRUT_PASS_MARK = 55;

/** Responses by question id; each value is the plugin's response shape. */
export type TestResponses = Readonly<Record<string, unknown>>;

export type QuestionScore = {
  questionId: string;
  plugin: TestQuestion["plugin"];
  answered: boolean;
  /** Whether this question counts toward the section (see `pick`). */
  counted: boolean;
  points: number;
  maxPoints: number;
  correct?: boolean;
  parts?: Record<string, number>;
};

export type SectionScore = {
  sectionId: string;
  pick: number | null;
  countedIds: string[];
  questions: QuestionScore[];
  points: number;
  maxPoints: number;
};

export type TestScore = {
  sections: SectionScore[];
  points: number;
  maxPoints: number;
  percent: number;
  passMark: number | null;
  passed: boolean | null;
};

/** The pass mark that applies: the test's own, else 55 for a Bagrut-style test, else none. */
export function passMarkFor(test: Pick<TestData, "style" | "passMark">): number | null {
  if (test.passMark !== undefined) return test.passMark;
  return test.style === "bagrut" ? BAGRUT_PASS_MARK : null;
}

/** The ids that count in a section, in paper order (the `pick` rule above). */
export function countedQuestionIds(section: TestSection, responses: TestResponses): string[] {
  const all = section.questions.map((q) => q.id);
  if (section.pick === undefined) return all;
  const answered = new Set(
    section.questions.filter((q) => isQuestionAnswered(q, ownValue(responses, q.id))).map((q) => q.id),
  );
  const chosen = all.filter((id) => answered.has(id)).slice(0, section.pick);
  const fill = all.filter((id) => !answered.has(id)).slice(0, section.pick - chosen.length);
  const counted = new Set([...chosen, ...fill]);
  return all.filter((id) => counted.has(id));
}

export function scoreSection(section: TestSection, responses: TestResponses): SectionScore {
  const countedIds = countedQuestionIds(section, responses);
  const counted = new Set(countedIds);
  const questions = section.questions.map((question): QuestionScore => {
    const response = ownValue(responses, question.id);
    const grade = gradeQuestion(question, response);
    return {
      questionId: question.id,
      plugin: question.plugin,
      answered: isQuestionAnswered(question, response),
      counted: counted.has(question.id),
      ...grade,
    };
  });
  const scored = questions.filter((q) => q.counted);
  return {
    sectionId: section.id,
    pick: section.pick ?? null,
    countedIds,
    questions,
    points: scored.reduce((sum, q) => sum + q.points, 0),
    maxPoints: scored.reduce((sum, q) => sum + q.maxPoints, 0),
  };
}

/** Scores a whole test against the student's responses. */
export function scoreTest(test: TestData, responses: TestResponses): TestScore {
  const sections = test.sections.map((section) => scoreSection(section, responses));
  const points = sections.reduce((sum, s) => sum + s.points, 0);
  const maxPoints = sections.reduce((sum, s) => sum + s.maxPoints, 0);
  const percent = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const passMark = passMarkFor(test);
  return {
    sections,
    points,
    maxPoints,
    percent,
    passMark,
    passed: passMark === null ? null : percent >= passMark,
  };
}
