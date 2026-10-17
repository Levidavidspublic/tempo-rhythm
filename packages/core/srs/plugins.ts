/**
 * Test question plugins, kitchen T3.
 *
 * Pure functions. Each plugin owns how one kind of test question is marked:
 * - `mcq`: the response names a choice; full points when it is the answer, else 0.
 * - `short`: the response is free text, compared with each accepted answer after `normalizeAnswer`
 *   (case, spacing, punctuation and Hebrew niqqud do not matter); full points or 0.
 * - `bagrut`: self-marked. After seeing the model answer and rubric, the student gives each part
 *   its points; each part is clamped to 0..its points and the question scores their sum.
 *
 * Responses arrive from the UI or storage, so every plugin accepts `unknown` and treats anything
 * malformed as "not answered" (0 points), never as an error.
 */

import type { BagrutQuestion, McqQuestion, ShortQuestion, TestQuestion } from "@tempo/utils";

export type McqResponse = { choiceId: string };
export type ShortResponse = { text: string };
/** Points the student gave each part, by part id. */
export type BagrutResponse = { parts: Record<string, number> };
export type QuestionResponse = McqResponse | ShortResponse | BagrutResponse;

export type QuestionGrade = {
  points: number;
  maxPoints: number;
  /** Right or not, for mcq and short. Self-marked Bagrut questions leave it out. */
  correct?: boolean;
  /** Bagrut only: the clamped points per part id. */
  parts?: Record<string, number>;
};

export type QuestionPlugin<Q extends TestQuestion> = {
  maxPoints(question: Q): number;
  isAnswered(question: Q, response: unknown): boolean;
  grade(question: Q, response: unknown): QuestionGrade;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An own property only, so ids like "constructor" never read the prototype. */
export function ownValue(record: unknown, key: string): unknown {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

const QUOTES = /['"`‘’‚‛“”„׳״]/g;
const KEEP_BETWEEN_DIGITS = new Set([".", ",", "/", ":"]);

/**
 * Folds a short answer for comparison: Unicode compatibility forms, Hebrew niqqud and cantillation
 * (U+0591–U+05C7) removed, lower case, quotes and gershayim dropped, other punctuation turned into
 * spaces, spaces collapsed. Number punctuation survives: "3.5", "1/2", "-4" keep their marks. The
 * Hebrew punctuation inside U+0591–U+05C7 (maqaf, paseq, sof pasuq, nun hafukha) splits words
 * rather than folding away, so "הָאָרֶץ׃וְהָאָרֶץ" stays two words.
 */
export function normalizeAnswer(text: string): string {
  const folded = text
    .normalize("NFKD")
    .replace(/[\u05BE\u05C0\u05C3\u05C6]/g, " ")
    .replace(/[֑-ׇ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(QUOTES, "");
  const chars = Array.from(folded);
  const kept = chars.map((ch, i) => {
    if (!/\p{P}/u.test(ch)) return ch;
    const before = chars[i - 1] ?? "";
    const after = chars[i + 1] ?? "";
    if (KEEP_BETWEEN_DIGITS.has(ch) && /\d/.test(before) && /\d/.test(after)) return ch;
    if (ch === "-" && /\d/.test(after)) return ch;
    return " ";
  });
  return kept.join("").replace(/\s+/g, " ").trim();
}

export const mcqPlugin: QuestionPlugin<McqQuestion> = {
  maxPoints: (question) => question.points,
  isAnswered: (_question, response) => {
    const choiceId = ownValue(response, "choiceId");
    return typeof choiceId === "string" && choiceId.length > 0;
  },
  grade(question, response) {
    const correct = ownValue(response, "choiceId") === question.answerId;
    return { points: correct ? question.points : 0, maxPoints: question.points, correct };
  },
};

export const shortPlugin: QuestionPlugin<ShortQuestion> = {
  maxPoints: (question) => question.points,
  isAnswered: (_question, response) => {
    const text = ownValue(response, "text");
    return typeof text === "string" && normalizeAnswer(text).length > 0;
  },
  grade(question, response) {
    const text = ownValue(response, "text");
    const given = typeof text === "string" ? normalizeAnswer(text) : "";
    const correct = given.length > 0 && question.accepted.some((a) => normalizeAnswer(a) === given);
    return { points: correct ? question.points : 0, maxPoints: question.points, correct };
  },
};

/** The points a student gave one Bagrut part, clamped to 0..`max`; missing or not a number = 0. */
export function clampPartPoints(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export const bagrutPlugin: QuestionPlugin<BagrutQuestion> = {
  maxPoints: (question) => question.parts.reduce((sum, part) => sum + part.points, 0),
  isAnswered: (question, response) => {
    const parts = ownValue(response, "parts");
    return question.parts.some((part) => {
      const value = ownValue(parts, part.id);
      return typeof value === "number" && Number.isFinite(value);
    });
  },
  grade(question, response) {
    const given = ownValue(response, "parts");
    const parts: Record<string, number> = {};
    let points = 0;
    for (const part of question.parts) {
      const value = clampPartPoints(ownValue(given, part.id), part.points);
      parts[part.id] = value;
      points += value;
    }
    return { points, maxPoints: bagrutPlugin.maxPoints(question), parts };
  },
};

/** The registry: one plugin per `plugin` value of the codec's test questions. */
export const QUESTION_PLUGINS = {
  mcq: mcqPlugin,
  short: shortPlugin,
  bagrut: bagrutPlugin,
} as const;

export type QuestionPluginName = keyof typeof QUESTION_PLUGINS;

/** The plugin for a question, typed loosely so callers can stay generic. */
export function pluginFor(question: TestQuestion): QuestionPlugin<TestQuestion> {
  return QUESTION_PLUGINS[question.plugin] as QuestionPlugin<TestQuestion>;
}

export function questionMaxPoints(question: TestQuestion): number {
  return pluginFor(question).maxPoints(question);
}

export function isQuestionAnswered(question: TestQuestion, response: unknown): boolean {
  return pluginFor(question).isAnswered(question, response);
}

export function gradeQuestion(question: TestQuestion, response: unknown): QuestionGrade {
  return pluginFor(question).grade(question, response);
}
