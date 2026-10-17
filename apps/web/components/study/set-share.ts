import type { TestQuestion } from "@tempo/utils";
import type { ShareTarget } from "@/components/share";
import { setHref } from "./hub";
import type { StudyT } from "./labels";
import type { SetBlock } from "./StudySetView";

/**
 * Sharing a saved set (S26, "a page or a study set"), the pure part: the set as readable Markdown
 * (every kind), its cards for the Anki file (flashcards only) and the in-app link. Nothing here
 * touches the network; the ShareSheet makes the files on the device.
 */

/** The words a set's Markdown uses, in the person's language. */
export type SetMarkdownWords = {
  answer: string;
  also: string;
  why: string;
  modelAnswer: string;
  /** "{points} points" */
  points: string;
  /** "1 point" */
  onePoint: string;
  /** "Answer {pick} of these {total}." */
  pick: string;
};

export function setMarkdownWords(t: StudyT): SetMarkdownWords {
  return {
    answer: t("st.qz.answerMark"),
    also: t("st.md.also"),
    why: t("st.md.why"),
    modelAnswer: t("st.ts.modelAnswer"),
    points: t("st.ts.points"),
    onePoint: t("st.md.point"),
    pick: t("st.ts.pick"),
  };
}

/**
 * One line of the person's words as Markdown: line breaks become spaces (a list item stays one
 * item) and the characters Markdown would read as formatting are escaped. So is a start that
 * Markdown would read as structure when the words begin a line (a test section's instructions):
 * a heading, list, quote, table or underline mark (# + - = | >) or a number list ("1." / "1)").
 */
export function mdText(text: string): string {
  return text
    .replace(/\s*[\r\n]+\s*/g, " ")
    .trim()
    .replace(/[\\`*_[\]<>]/g, "\\$&")
    .replace(/^[#+=|-]/, "\\$&")
    .replace(/^(\d+)([.)])/, "$1\\$2");
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (slot, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : slot
  );

function pointsText(points: number, words: SetMarkdownWords): string {
  return points === 1 ? words.onePoint : fill(words.points, { points });
}

const labelled = (label: string, text: string) => `${label}: ${mdText(text)}`;

function choiceLines(
  question: { choices: { id: string; text: string }[]; answerId: string; explanation?: string },
  words: SetMarkdownWords,
  indent: string
): string[] {
  const answer = question.choices.find((choice) => choice.id === question.answerId)?.text ?? "";
  const lines = question.choices.map((choice) => `${indent}- ${mdText(choice.text)}`);
  lines.push("", `${indent}${labelled(words.answer, answer)}`);
  if (question.explanation) lines.push(`${indent}${labelled(words.why, question.explanation)}`);
  return lines;
}

function testQuestionLines(
  question: TestQuestion,
  number: number,
  words: SetMarkdownWords
): string[] {
  const indent = " ".repeat(`${number}. `.length);
  if (question.plugin === "bagrut") {
    const lines = [`${number}. ${mdText(question.stem)}`, ""];
    for (const part of question.parts) {
      lines.push(
        `${indent}- **${mdText(part.label)}** ${mdText(part.prompt)} (${pointsText(part.points, words)})`
      );
      if (part.modelAnswer)
        lines.push(`${indent}  ${labelled(words.modelAnswer, part.modelAnswer)}`);
    }
    return lines;
  }
  const head = `${number}. ${mdText(question.prompt)} (${pointsText(question.points, words)})`;
  if (question.plugin === "mcq") return [head, ...choiceLines(question, words, indent)];
  const [first = "", ...rest] = question.accepted;
  const lines = [head, "", `${indent}${labelled(words.answer, first)}`];
  if (rest.length > 0) lines.push(`${indent}${words.also}: ${rest.map(mdText).join(", ")}`);
  if (question.explanation) lines.push(`${indent}${labelled(words.why, question.explanation)}`);
  return lines;
}

/** A set as Markdown any notes app reads: a title, then the cards or the questions with answers. */
export function setMarkdown(block: SetBlock, words: SetMarkdownWords): string {
  const out = [`# ${mdText(block.data.title)}`, ""];
  if (block.type === "flashcards") {
    for (const card of block.data.cards)
      out.push(`- **${mdText(card.front)}**: ${mdText(card.back)}`);
  } else if (block.type === "quiz") {
    block.data.questions.forEach((question, index) => {
      const number = index + 1;
      out.push(
        `${number}. ${mdText(question.prompt)}`,
        ...choiceLines(question, words, " ".repeat(`${number}. `.length)),
        ""
      );
    });
  } else {
    let number = 0;
    for (const section of block.data.sections) {
      out.push(`## ${mdText(section.title)}`, "");
      if (section.instructions) out.push(mdText(section.instructions), "");
      if (section.pick !== undefined)
        out.push(fill(words.pick, { pick: section.pick, total: section.questions.length }), "");
      for (const question of section.questions) {
        number += 1;
        out.push(...testQuestionLines(question, number, words), "");
      }
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}

/** The set's own address in Tempo (it opens only for its owner, signed in). */
export function setShareUrl(setId: string, origin: string): string {
  return `${origin}${setHref(setId)}`;
}

/** What the ShareSheet offers for a set: Markdown for every kind, the Anki file for a deck. */
export function setShareTarget(
  setId: string,
  block: SetBlock,
  words: SetMarkdownWords,
  origin: string
): ShareTarget {
  return {
    kind: "set",
    title: block.data.title,
    markdown: setMarkdown(block, words),
    url: setShareUrl(setId, origin),
    ...(block.type === "flashcards"
      ? { cards: block.data.cards.map((card) => ({ front: card.front, back: card.back })) }
      : {}),
  };
}
