import type { StudyBlockType, TempoBlock } from "@tempo/utils";

/** A study block as the page codec returns it (flashcards, quiz or practice test). */
export type StudyBlock = Extract<TempoBlock, { type: StudyBlockType }>;

export function isStudyBlock(block: TempoBlock): block is StudyBlock {
  return block.type === "flashcards" || block.type === "quiz" || block.type === "test";
}

/** How many cards or questions the block holds (test parts count as questions). */
export function studyItemCount(block: StudyBlock): number {
  if (block.type === "flashcards") return block.data.cards.length;
  if (block.type === "quiz") return block.data.questions.length;
  return block.data.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

const KIND: Record<"en" | "he", Record<StudyBlockType, string>> = {
  en: { flashcards: "Flashcards", quiz: "Quiz", test: "Practice test" },
  he: { flashcards: "כרטיסיות", quiz: "בוחן", test: "מבחן תרגול" },
};
const COUNT: Record<"en" | "he", Record<StudyBlockType, (n: number) => string>> = {
  en: {
    flashcards: (n) => (n === 1 ? "1 card" : `${n} cards`),
    quiz: (n) => (n === 1 ? "1 question" : `${n} questions`),
    test: (n) => (n === 1 ? "1 question" : `${n} questions`),
  },
  he: {
    flashcards: (n) => (n === 1 ? "כרטיס אחד" : `${n} כרטיסים`),
    quiz: (n) => (n === 1 ? "שאלה אחת" : `${n} שאלות`),
    test: (n) => (n === 1 ? "שאלה אחת" : `${n} שאלות`),
  },
};

/** The card's kind word and count, in the page's language. */
export function studyBlockSummary(block: StudyBlock, lang: string): { kind: string; count: string } {
  const l = lang === "he" ? "he" : "en";
  return { kind: KIND[l][block.type], count: COUNT[l][block.type](studyItemCount(block)) };
}
