import type { z } from "zod";
import { tempoBlockSchema } from "./blocks";

/**
 * Study block shapes (kitchen T3): flashcards, a quiz and a practice test.
 *
 * The schemas live inside `blocks.ts`, the one page codec (it may import only zod and its public
 * surface is pinned). This module reads them back off `tempoBlockSchema`, the same way the block
 * catalog borrows the id schema, so there is still exactly one schema per field.
 */

const [, , , flashcardsBlock, quizBlock, testBlock] = tempoBlockSchema.options;

export const flashcardsDataSchema = flashcardsBlock.shape.data;
export const quizDataSchema = quizBlock.shape.data;
export const testDataSchema = testBlock.shape.data;

export const flashcardSchema = flashcardsDataSchema.shape.cards.element;
export const studyOriginSchema = flashcardsDataSchema.shape.origin;
export const studySourceSchema = flashcardsDataSchema.shape.source.unwrap();
export const studyItemId = flashcardSchema.shape.id;

export const quizQuestionSchema = quizDataSchema.shape.questions.element;
export const studyChoiceSchema = quizQuestionSchema.shape.choices.element;
export const quizDifficultySchema = quizQuestionSchema.shape.difficulty;

export const testSectionSchema = testDataSchema.shape.sections.element;
export const testQuestionSchema = testSectionSchema.shape.questions.element;
const [mcq, short, bagrut] = testQuestionSchema.options;
export const mcqQuestionSchema = mcq;
export const shortQuestionSchema = short;
export const bagrutQuestionSchema = bagrut;
export const bagrutPartSchema = bagrutQuestionSchema.shape.parts.element;

export type StudyOrigin = z.infer<typeof studyOriginSchema>;
export type StudySource = z.infer<typeof studySourceSchema>;
export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardsData = z.infer<typeof flashcardsDataSchema>;
export type StudyChoice = z.infer<typeof studyChoiceSchema>;
export type QuizDifficulty = z.infer<typeof quizDifficultySchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizData = z.infer<typeof quizDataSchema>;
export type McqQuestion = z.infer<typeof mcqQuestionSchema>;
export type ShortQuestion = z.infer<typeof shortQuestionSchema>;
export type BagrutPart = z.infer<typeof bagrutPartSchema>;
export type BagrutQuestion = z.infer<typeof bagrutQuestionSchema>;
export type TestQuestion = z.infer<typeof testQuestionSchema>;
export type TestSection = z.infer<typeof testSectionSchema>;
export type TestData = z.infer<typeof testDataSchema>;

/** The three study block types, as they appear in a block envelope's `type`. */
export const STUDY_BLOCK_TYPES = ["flashcards", "quiz", "test"] as const;
export type StudyBlockType = (typeof STUDY_BLOCK_TYPES)[number];

export function isStudyBlockType(value: unknown): value is StudyBlockType {
  return (STUDY_BLOCK_TYPES as readonly unknown[]).includes(value);
}
