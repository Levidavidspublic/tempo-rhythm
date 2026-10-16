import type { TestData, TestQuestion, TestSection } from "@tempo/utils";

/**
 * How `TestRunner` turns answers into a score. The runner never marks anything itself: the host
 * passes a `TestScorer`. `packages/core/srs/grading.ts` (Builder A, `scoreTest`) is the real one;
 * the lead adapts it to this interface. `referenceScoreTest` below is a small reference scorer
 * with the same rules, used in tests and as a fallback.
 */

export type McqResponse = { plugin: "mcq"; choiceId: string };
export type ShortResponse = { plugin: "short"; text: string };
/** Bagrut parts are self-marked: `marks` holds the points the student gave each part. */
export type BagrutResponse = {
  plugin: "bagrut";
  parts: Record<string, string>;
  marks: Record<string, number>;
};
export type TestResponse = McqResponse | ShortResponse | BagrutResponse;
/** Responses by question id. A missing entry means not answered. */
export type TestResponses = Record<string, TestResponse>;

export type QuestionScore = { points: number; max: number };

export type SectionScore = {
  sectionId: string;
  /** The question ids that count, in paper order (all of them unless the section has `pick`). */
  counted: string[];
  points: number;
  max: number;
};

export type TestScore = {
  sections: SectionScore[];
  /** Points per question id, for every question (counted or not). */
  questions: Record<string, QuestionScore>;
  total: number;
  max: number;
  /** 0 to 100, rounded. */
  percent: number;
  passMark?: number;
  /** Set only when there is a pass mark. */
  passed?: boolean;
};

export type TestScorer = (test: TestData, responses: TestResponses) => TestScore;

/** Default pass mark for Bagrut-style practice; standard tests have none unless set. */
export const BAGRUT_PASS_MARK = 55;

export function questionMaxPoints(question: TestQuestion): number {
  return question.plugin === "bagrut"
    ? question.parts.reduce((sum, part) => sum + part.points, 0)
    : question.points;
}

/** Whether the student wrote or chose anything for this question. */
export function isAnswered(question: TestQuestion, response: TestResponse | undefined): boolean {
  if (!response || response.plugin !== question.plugin) return false;
  if (response.plugin === "mcq") return response.choiceId !== "";
  if (response.plugin === "short") return response.text.trim() !== "";
  return Object.values(response.parts).some((text) => text.trim() !== "");
}

/** Trim, lower case, drop punctuation and Hebrew niqqud / cantillation, fold spaces. */
export function normalizeShortAnswer(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[֑-ׇ]/g, "")
    .toLowerCase()
    .replace(/[\p{P}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampMark(value: unknown, max: number): number {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(max, Math.max(0, number));
}

export function scoreQuestion(
  question: TestQuestion,
  response: TestResponse | undefined
): QuestionScore {
  const max = questionMaxPoints(question);
  if (!isAnswered(question, response) || !response) return { points: 0, max };
  if (question.plugin === "mcq" && response.plugin === "mcq")
    return { points: response.choiceId === question.answerId ? max : 0, max };
  if (question.plugin === "short" && response.plugin === "short") {
    const given = normalizeShortAnswer(response.text);
    const right = question.accepted.some((accepted) => normalizeShortAnswer(accepted) === given);
    return { points: right ? max : 0, max };
  }
  if (question.plugin === "bagrut" && response.plugin === "bagrut") {
    const points = question.parts.reduce(
      (sum, part) => sum + clampMark(response.marks[part.id], part.points),
      0
    );
    return { points, max };
  }
  return { points: 0, max };
}

/**
 * The questions that count in a section. With `pick` = N, the first N answered in paper order
 * count; when fewer than N were answered, the first unanswered ones fill the count (at 0 points).
 */
export function countedQuestions(section: TestSection, responses: TestResponses): TestQuestion[] {
  if (section.pick === undefined) return [...section.questions];
  const answered = section.questions.filter((q) => isAnswered(q, responses[q.id]));
  const counted = new Set(answered.slice(0, section.pick));
  for (const question of section.questions) {
    if (counted.size >= section.pick) break;
    counted.add(question);
  }
  return section.questions.filter((question) => counted.has(question));
}

export const referenceScoreTest: TestScorer = (test, responses) => {
  const questions: Record<string, QuestionScore> = {};
  for (const section of test.sections)
    for (const question of section.questions)
      questions[question.id] = scoreQuestion(question, responses[question.id]);

  const sections = test.sections.map((section): SectionScore => {
    const counted = countedQuestions(section, responses);
    return {
      sectionId: section.id,
      counted: counted.map((question) => question.id),
      points: counted.reduce((sum, question) => sum + (questions[question.id]?.points ?? 0), 0),
      max: counted.reduce((sum, question) => sum + (questions[question.id]?.max ?? 0), 0),
    };
  });
  const total = sections.reduce((sum, section) => sum + section.points, 0);
  const max = sections.reduce((sum, section) => sum + section.max, 0);
  const percent = max > 0 ? Math.round((total / max) * 100) : 0;
  const passMark = test.passMark ?? (test.style === "bagrut" ? BAGRUT_PASS_MARK : undefined);
  return {
    sections,
    questions,
    total,
    max,
    percent,
    ...(passMark !== undefined ? { passMark, passed: percent >= passMark } : {}),
  };
};
