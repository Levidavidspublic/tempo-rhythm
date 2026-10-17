import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import {
  flashcardSchema,
  flashcardsDataSchema,
  pageMetaDataSchema,
  quizDataSchema,
  quizQuestionSchema,
  studyOriginSchema,
  studySourceSchema,
  taskDataSchema,
  templateDataSchema,
  tempoBlockSchema,
  testDataSchema,
} from "@tempo/utils";
import { z } from "zod";

/**
 * The fixed Tempo block catalog (TEMPO-B06-02).
 *
 * Only the seven component types and the one action declared here may render a stored block. The
 * catalog describes what a card DRAWS, not where the block lives: it carries no database ids, no
 * ownership data and no mutation endpoints. Each field validator is borrowed from the shared codec
 * in `@tempo/utils` (the single block schema), so the catalog cannot drift from what the codec
 * accepts; `catalog.test.ts` pins that.
 *
 * This module is browser-safe and does not import React: it uses the `@json-render/react/schema`
 * entry point (the "React spec shape") without loading the renderer. The React registry that draws
 * these components is a separate ticket (TEMPO-B06-03) and must be built with
 * `defineRegistry(tempoBlockCatalog, ...)`.
 */

/**
 * The exact json-render version this catalog is written against. It is pre-1.0, so the version is
 * pinned without a range in `packages/ui/package.json`; `catalog.test.ts` fails if the manifest,
 * the installed packages and this constant ever disagree. Update all of them together, and only
 * after re-reading the new `d.ts` files.
 */
export const JSON_RENDER_VERSION = "0.21.0" as const;

/** The only component types a stored block may render as, in catalog order. */
export const BLOCK_COMPONENT_TYPES = [
  "TaskBlock",
  "PageMeta",
  "TemplateBlock",
  "BrokenBlockCard",
  "FlashcardsBlock",
  "QuizBlock",
  "TestBlock",
] as const;
export type BlockComponentType = (typeof BLOCK_COMPONENT_TYPES)[number];

/** The only action a block may trigger: a request to set one task's done state. */
export const BLOCK_ACTION_NAMES = ["setTaskDone"] as const;
export type BlockActionName = (typeof BLOCK_ACTION_NAMES)[number];

/** The only event a block component may emit. It is bound to `setTaskDone` on a task checkbox. */
export const TASK_TOGGLE_EVENT = "toggle" as const;
export const BLOCK_EVENT_NAMES = [TASK_TOGGLE_EVENT] as const;
export type BlockEventName = (typeof BLOCK_EVENT_NAMES)[number];

/** Same block id grammar as the codec envelope (`blk_` plus a 26 character ULID). */
export const blockIdSchema = tempoBlockSchema.options[0].shape.id;

/** Longest message a broken block card accepts. */
export const BROKEN_BLOCK_MESSAGE_MAX_CHARS = 200;

/**
 * A broken block card shows a short, calm sentence written by code. It must never be able to carry
 * block source: no braces, quotes, backticks, line breaks, block ids or the fence info string.
 */
const UNSAFE_BROKEN_MESSAGE = /[{}`"\r\n]|blk_|json\s*tempo/i;

export const taskBlockPropsSchema = z
  .object({
    title: taskDataSchema.shape.title,
    status: taskDataSchema.shape.status,
    durationMin: taskDataSchema.shape.durationMin,
    inelastic: taskDataSchema.shape.inelastic,
    reason: taskDataSchema.shape.reason,
    scheduledAt: taskDataSchema.shape.scheduledAt,
  })
  .strict();

export const pageMetaPropsSchema = z
  .object({
    pageType: pageMetaDataSchema.shape.pageType,
    date: pageMetaDataSchema.shape.date,
    tags: pageMetaDataSchema.shape.tags,
  })
  .strict();

export const templateBlockPropsSchema = z
  .object({
    name: templateDataSchema.shape.name,
    forPageType: templateDataSchema.shape.forPageType,
    isDefault: templateDataSchema.shape.isDefault,
    origin: templateDataSchema.shape.origin,
    status: templateDataSchema.shape.status,
    enabled: templateDataSchema.shape.enabled,
  })
  .strict();

export const brokenBlockCardPropsSchema = z
  .object({
    message: z
      .string()
      .min(1)
      .max(BROKEN_BLOCK_MESSAGE_MAX_CHARS)
      .refine((value) => !UNSAFE_BROKEN_MESSAGE.test(value), "Message must be plain sentence text"),
    undoAvailable: z.boolean(),
  })
  .strict();

/**
 * Study blocks (kitchen T3) draw as a quiet summary card: the title, how many items, the first few
 * fronts or prompts, who made it and the page it came from. Display only: no action, no event,
 * and never an id (no block id, item id or source page id). Studying happens on the study screens,
 * which read the block from the page, not from these props.
 */
export const STUDY_PREVIEW_ITEMS = 3;

/** Most questions a test block can hold: 10 sections of 20. */
const MAX_TEST_QUESTIONS = 200;

const studyPreviewText = flashcardSchema.shape.front;
const studyPreviewList = z.array(studyPreviewText).min(1).max(STUDY_PREVIEW_ITEMS);
const studySourceTitle = studySourceSchema.shape.title.optional();

export const flashcardsBlockPropsSchema = z
  .object({
    title: flashcardsDataSchema.shape.title,
    cardCount: z.number().int().min(1).max(100),
    fronts: studyPreviewList,
    origin: studyOriginSchema,
    sourceTitle: studySourceTitle,
  })
  .strict();

export const quizBlockPropsSchema = z
  .object({
    title: quizDataSchema.shape.title,
    mode: quizDataSchema.shape.mode,
    questionCount: z.number().int().min(1).max(100),
    prompts: z.array(quizQuestionSchema.shape.prompt).min(1).max(STUDY_PREVIEW_ITEMS),
    origin: studyOriginSchema,
    sourceTitle: studySourceTitle,
  })
  .strict();

export const testBlockPropsSchema = z
  .object({
    title: testDataSchema.shape.title,
    style: testDataSchema.shape.style,
    sectionCount: z.number().int().min(1).max(10),
    questionCount: z.number().int().min(1).max(MAX_TEST_QUESTIONS),
    durationMin: testDataSchema.shape.durationMin,
    passMark: testDataSchema.shape.passMark,
    prompts: studyPreviewList,
    origin: studyOriginSchema,
    sourceTitle: studySourceTitle,
  })
  .strict();

export const setTaskDoneParamsSchema = z
  .object({
    blockId: blockIdSchema,
    done: z.boolean(),
  })
  .strict();

export type TaskBlockProps = z.infer<typeof taskBlockPropsSchema>;
export type PageMetaProps = z.infer<typeof pageMetaPropsSchema>;
export type TemplateBlockProps = z.infer<typeof templateBlockPropsSchema>;
export type BrokenBlockCardProps = z.infer<typeof brokenBlockCardPropsSchema>;
export type FlashcardsBlockProps = z.infer<typeof flashcardsBlockPropsSchema>;
export type QuizBlockProps = z.infer<typeof quizBlockPropsSchema>;
export type TestBlockProps = z.infer<typeof testBlockPropsSchema>;
export type SetTaskDoneParams = z.infer<typeof setTaskDoneParamsSchema>;

/**
 * Every component and the action, by name. No `Button`, `Link`, `Html`, `Code` or container
 * component exists here, and there is no `setState`/`navigate`-style action: anything outside this
 * table is rejected by `validateBlockSpec` in `./block-spec`.
 */
export const tempoBlockCatalog = defineCatalog(schema, {
  components: {
    TaskBlock: {
      props: taskBlockPropsSchema,
      slots: [],
      description:
        "One task as a quiet card with a checkbox. The title is the user's own text: draw it with " +
        'dir="auto". The checkbox is enabled only when the "toggle" event is bound to setTaskDone.',
      example: {
        title: "Email supervisor",
        status: "now",
        durationMin: 15,
        inelastic: false,
      },
    },
    PageMeta: {
      props: pageMetaPropsSchema,
      slots: [],
      description:
        "The page's type, date and tags. Draws nothing in the page body; hosts may read it for headers.",
      example: { pageType: "daily", date: "2026-10-11", tags: ["uni"] },
    },
    TemplateBlock: {
      props: templateBlockPropsSchema,
      slots: [],
      description:
        "A page template as a quiet card. The name is the user's own text: draw it with " +
        'dir="auto".',
      example: {
        name: "Daily",
        forPageType: "daily",
        isDefault: true,
        origin: "builtin",
        status: "live",
        enabled: true,
      },
    },
    BrokenBlockCard: {
      props: brokenBlockCardPropsSchema,
      slots: [],
      description:
        "A block that cannot be drawn. Shows only the calm message it is given, never block source. " +
        "Offers Undo only when undoAvailable is true.",
      example: {
        message: "This block can't be shown. Your page text is unchanged.",
        undoAvailable: false,
      },
    },
    FlashcardsBlock: {
      props: flashcardsBlockPropsSchema,
      slots: [],
      description:
        "A flashcard deck as a quiet summary card: title, card count and the first few fronts. " +
        'Fronts and titles are the user\'s own text: draw them with dir="auto". Display only.',
      example: {
        title: "Cell biology",
        cardCount: 12,
        fronts: ["Mitochondria", "Ribosome"],
        origin: "outline",
        sourceTitle: "Biology notes",
      },
    },
    QuizBlock: {
      props: quizBlockPropsSchema,
      slots: [],
      description:
        "A quiz as a quiet summary card: title, question count, adaptive or fixed, and the first " +
        'few prompts. Prompts are the user\'s own text: draw them with dir="auto". Display only.',
      example: {
        title: "Cell biology check",
        mode: "adaptive",
        questionCount: 8,
        prompts: ["What makes ATP?"],
        origin: "coach",
      },
    },
    TestBlock: {
      props: testBlockPropsSchema,
      slots: [],
      description:
        "A practice test as a quiet summary card: title, style, sections, questions, time and " +
        'pass mark when set, and the first few prompts. Draw user text with dir="auto". Display only.',
      example: {
        title: "Biology practice paper",
        style: "bagrut",
        sectionCount: 2,
        questionCount: 6,
        durationMin: 90,
        passMark: 55,
        prompts: ["Describe the cell membrane."],
        origin: "user",
      },
    },
  },
  actions: {
    setTaskDone: {
      params: setTaskDoneParamsSchema,
      description:
        "Ask the host to set one task block's done state. The host validates, writes and confirms; " +
        "the card must not show success until the host does.",
    },
  },
});

export type TempoBlockCatalog = typeof tempoBlockCatalog;
