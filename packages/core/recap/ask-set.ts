import type { FlashcardsData, QuizData, TestData, TestQuestion } from "@tempo/utils";
import { type AnswerOptions, scoreTexts, terms } from "./answer";
import { fullReading } from "./recap";
import { pageLang } from "./text";

/**
 * "Ask about this set" (kitchen backlog, local and quote-only): the passages of a study set's page
 * and of the set's own items (a card's front and back; a question, its right answer and its
 * explanation) that best match a question. One pool, ranked with `scoreTexts`, the scoring
 * `answerFromPage` uses. No model, no network: every result is a quote of the person's own words.
 */

/**
 * Where a passage came from. `sentence` counts the page's full reading from 0. Cards and quiz
 * questions count from 1 in the set's order (the edit list's order); a test question counts from 1
 * inside its section, as the test itself numbers them.
 */
export type AskFrom =
  | { kind: "page"; sentence: number }
  | { kind: "card"; n: number }
  | { kind: "question"; n: number }
  | { kind: "test"; section: string; n: number };

/** One quotable passage: its lines as written (a card's front and back, a question and its answer). */
export type AskPassage = { from: AskFrom; lines: string[] };

/** A passage that matched. `id` is stable within one answer; `score` is on `scoreTexts`' scale. */
export type SetMatch = AskPassage & { id: string; score: number };

/** The parts of a study block that Ask reads. */
export type AskSetBlock =
  | { type: "flashcards"; data: Pick<FlashcardsData, "cards"> }
  | { type: "quiz"; data: Pick<QuizData, "questions"> }
  | { type: "test"; data: Pick<TestData, "sections"> };

const clean = (lines: readonly (string | undefined)[]) =>
  lines.map((line) => line?.trim() ?? "").filter((line) => line.length > 0);

function testLines(question: TestQuestion): string[] {
  if (question.plugin === "mcq") {
    const right = question.choices.find((choice) => choice.id === question.answerId);
    return clean([question.prompt, right?.text, question.explanation]);
  }
  // A short answer shows its first accepted wording; the others are spellings of the same answer.
  if (question.plugin === "short") return clean([question.prompt, question.accepted[0], question.explanation]);
  // A Bagrut-style question: its stem, then each part with its model answer. Rubrics are marking notes.
  return clean([question.stem, ...question.parts.map((part) => clean([`${part.label}. ${part.prompt}`, part.modelAnswer]).join(" "))]);
}

/** The set's items as passages, in the set's order. */
export function setPassages(block: AskSetBlock): AskPassage[] {
  if (block.type === "flashcards") {
    return block.data.cards.map((card, at) => ({ from: { kind: "card", n: at + 1 }, lines: clean([card.front, card.back]) }));
  }
  if (block.type === "quiz") {
    return block.data.questions.map((question, at) => {
      const right = question.choices.find((choice) => choice.id === question.answerId);
      return { from: { kind: "question", n: at + 1 }, lines: clean([question.prompt, right?.text, question.explanation]) };
    });
  }
  return block.data.sections.flatMap((section) =>
    section.questions.map((question, at) => ({
      from: { kind: "test", section: section.title, n: at + 1 } as const,
      lines: testLines(question),
    }))
  );
}

export type AskSetInput = {
  /** The page's markdown; null or undefined when only the set is searched. */
  page?: string | null;
  /** The set's items (`setPassages`). */
  items: readonly AskPassage[];
};

type Entry = AskPassage & { set: boolean; order: number; quotable: boolean; words: string };

/**
 * The passages of the page and the set that best match the question, at most `limit` (default 3).
 * Picked best first by score; on a tie the set's own items come before the page, then each source
 * keeps its order. A passage with the same words as one already picked is left out: a set made
 * from a page often repeats its sentences, and the tie rule keeps the card or question. Shown
 * source by source: the source holding the best match first, and within a source in its own
 * order, as `answerFromPage` keeps page order. Headings alone are never answers. An empty list
 * means neither seems to say.
 */
export function answerFromSet({ page, items }: AskSetInput, question: string, options: AnswerOptions = {}): SetMatch[] {
  if (terms(question).length === 0) return [];
  const limit = Math.max(1, Math.floor(options.limit ?? 3));
  const sentences = page ? fullReading(page, { lang: options.lang ?? pageLang(page) }) : [];
  const pool: Entry[] = [
    ...sentences.map((sentence, order) => ({
      from: { kind: "page", sentence: order } as const,
      lines: [sentence.text],
      set: false,
      order,
      quotable: sentence.kind !== "cue",
      words: terms(sentence.text).join(" "),
    })),
    ...items.map((item, order) => ({
      ...item,
      set: true,
      order,
      quotable: item.lines.length > 0,
      words: terms(item.lines.join(" ")).join(" "),
    })),
  ];
  const scores = scoreTexts(pool.map((entry) => entry.lines.join(" ")), question);
  const ranked = pool
    .map((entry, at) => ({ ...entry, score: scores[at] ?? 0 }))
    .filter((entry) => entry.quotable && entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.set) - Number(a.set) || a.order - b.order);
  const picked: typeof ranked = [];
  const seen = new Set<string>();
  for (const entry of ranked) {
    if (picked.length >= limit) break;
    if (seen.has(entry.words)) continue;
    seen.add(entry.words);
    picked.push(entry);
  }
  const setFirst = picked[0]?.set ?? true;
  return picked
    .sort((a, b) => (a.set === b.set ? a.order - b.order : a.set === setFirst ? -1 : 1))
    .map(({ from, lines, set, order, score }) => ({ from, lines, id: `${set ? "set" : "page"}-${order}`, score }));
}
