import type { Spec } from "@json-render/core";
import {
  type BlockErrorCode,
  type BrokenBlockSegment,
  tempoBlockSchema,
  type ValidBlockSegment,
} from "@tempo/utils";
import { z } from "zod";
import {
  brokenBlockCardPropsSchema,
  flashcardsBlockPropsSchema,
  pageMetaPropsSchema,
  quizBlockPropsSchema,
  STUDY_PREVIEW_ITEMS,
  setTaskDoneParamsSchema,
  TASK_TOGGLE_EVENT,
  taskBlockPropsSchema,
  templateBlockPropsSchema,
  tempoBlockCatalog,
  testBlockPropsSchema,
} from "./catalog";

/**
 * Persisted block envelope -> json-render spec (TEMPO-B06-02).
 *
 * A persisted block is `{ type, id, v, data }` (the codec in `@tempo/utils`). json-render draws a
 * different shape: a flat spec of `{ root, elements }`. This module is the only bridge. Every block
 * becomes a spec with exactly one element, because the catalog has no container component.
 *
 * What crosses the bridge, and what does not:
 * - Rendering fields only. The block `id`, `v`, `order`, `doneAt` and template `tokens` are not
 *   props. Study blocks carry counts and the first few fronts or prompts, never card, question or
 *   section ids and never the source page id. A checkbox carries the block id inside its `setTaskDone` action binding, never in props
 *   and never in the element key.
 * - Broken blocks carry a fixed calm sentence chosen by error code. The segment `source` and any
 *   raw JSON are never read, so they cannot reach a spec, an error or a card.
 * - Anything this module cannot prove valid becomes a `BrokenBlockCard`. Nothing throws, not even
 *   for a hostile input: a getter that throws, a throwing or revoked Proxy and a throwing option
 *   all end in the same card as any other block this module cannot read.
 *
 * `catalog.validate()` in json-render 0.21.0 does not check element props against the component's
 * Zod schema when the catalog has more than one component, and its element schema silently drops
 * `on`, `watch` and unknown keys. `validateBlockSpec` is therefore the real gate for specs that did
 * not come from this module's own builders.
 */

/** A json-render spec produced or accepted by this module. */
export type TempoBlockSpec = Spec;

/** The one element key every block spec uses. It is fixed so it can never leak an id. */
export const BLOCK_ELEMENT_KEY = "block" as const;

/** Why a block cannot be drawn. The codec's error codes plus one adapter-level reason. */
export type BrokenBlockReason = BlockErrorCode | "invalid_spec";

const UNCHANGED = "Your page text is unchanged.";

/**
 * The calm copy shown for each reason. Fixed text: it never includes block content, ids, error
 * codes or JSON. Typed over every reason, so a new codec error code fails typecheck until it has
 * copy here.
 */
export const BROKEN_BLOCK_MESSAGES: Record<BrokenBlockReason, string> = {
  body_too_large: `This page is too large to show its blocks. ${UNCHANGED}`,
  too_many_blocks: `This block is past the number of blocks a page can show. ${UNCHANGED}`,
  block_too_large: `This block is too large to show. ${UNCHANGED}`,
  unclosed_fence: `This block was never closed, so it can't be shown. ${UNCHANGED}`,
  malformed_json: `This block can't be read, so it can't be shown. ${UNCHANGED}`,
  invalid_envelope: `This block can't be read, so it can't be shown. ${UNCHANGED}`,
  invalid_data: `This block has details Tempo can't read, so it can't be shown. ${UNCHANGED}`,
  unsupported_type: `This kind of block isn't supported in this version of Tempo. ${UNCHANGED}`,
  unsupported_version: `This block was made with a different version of Tempo, so it can't be shown. ${UNCHANGED}`,
  duplicate_id: `This block repeats another block on the page, so it isn't shown. ${UNCHANGED}`,
  duplicate_page_meta: `This page already has its details block, so this extra one isn't shown. ${UNCHANGED}`,
  nesting_too_deep: `This block is too deeply nested to show. ${UNCHANGED}`,
  invalid_spec: `This block can't be shown. ${UNCHANGED}`,
};

export type BlockSpecOptions = {
  /**
   * Bind the task checkbox to `setTaskDone`. Defaults to true. Pass `false` for display-only
   * surfaces such as a preview pane: the card then has no bound `toggle` event.
   */
  interactive?: boolean;
  /**
   * Whether the host holds a real Undo handle for this block. Defaults to false: a broken block
   * never claims Undo it cannot honour.
   */
  undoAvailable?: boolean;
};

type ToggleBinding = {
  [TASK_TOGGLE_EVENT]: { action: "setTaskDone"; params: { blockId: string; done: boolean } };
};

function singleElementSpec(
  type: string,
  props: Record<string, unknown>,
  on?: ToggleBinding
): TempoBlockSpec {
  return {
    root: BLOCK_ELEMENT_KEY,
    elements: { [BLOCK_ELEMENT_KEY]: { type, props, children: [], ...(on ? { on } : {}) } },
  };
}

const noChildren = z.array(z.string()).max(0);

/** The only binding a block element may carry: the task checkbox. No confirm, navigate or state. */
const toggleBindingSchema = z
  .object({ action: z.literal("setTaskDone"), params: setTaskDoneParamsSchema })
  .strict();

const blockElementSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("TaskBlock"),
      props: taskBlockPropsSchema,
      children: noChildren,
      on: z
        .object({ [TASK_TOGGLE_EVENT]: toggleBindingSchema })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({ type: z.literal("PageMeta"), props: pageMetaPropsSchema, children: noChildren })
    .strict(),
  z
    .object({
      type: z.literal("TemplateBlock"),
      props: templateBlockPropsSchema,
      children: noChildren,
    })
    .strict(),
  z
    .object({
      type: z.literal("BrokenBlockCard"),
      props: brokenBlockCardPropsSchema,
      children: noChildren,
    })
    .strict(),
  z
    .object({
      type: z.literal("FlashcardsBlock"),
      props: flashcardsBlockPropsSchema,
      children: noChildren,
    })
    .strict(),
  z
    .object({ type: z.literal("QuizBlock"), props: quizBlockPropsSchema, children: noChildren })
    .strict(),
  z
    .object({ type: z.literal("TestBlock"), props: testBlockPropsSchema, children: noChildren })
    .strict(),
]);

const blockSpecSchema = z
  .object({
    root: z.literal(BLOCK_ELEMENT_KEY),
    elements: z.object({ [BLOCK_ELEMENT_KEY]: blockElementSchema }).strict(),
  })
  .strict();

export type BlockSpecValidation = { ok: true; spec: TempoBlockSpec } | { ok: false };

/**
 * Accept a spec only if it is exactly one allowlisted element with valid props and, for a task, at
 * most the `toggle` -> `setTaskDone` binding with valid params. Rejects unknown component types,
 * unknown or extra actions and events, `confirm`/`onSuccess`/`onError` handlers, `visible`,
 * `repeat`, `watch`, `slots`, `state`, child elements and `$state`/`$bindState`/`$computed`
 * expression objects in props. The result carries no error detail on purpose: a rejection message
 * could echo the rejected value.
 */
export function validateBlockSpec(input: unknown): BlockSpecValidation {
  try {
    const parsed = blockSpecSchema.safeParse(input);
    if (!parsed.success) return { ok: false };
    if (!tempoBlockCatalog.validate(parsed.data).success) return { ok: false };
    return { ok: true, spec: parsed.data };
  } catch {
    return { ok: false };
  }
}

/** Read `undoAvailable` without ever throwing: a hostile `options` just means no Undo. */
function holdsUndo(options: BlockSpecOptions | undefined): boolean {
  try {
    return options?.undoAvailable === true;
  } catch {
    return false;
  }
}

/** The fixed copy for `reason`, or the generic copy. Never throws, even for a hostile `reason`. */
function brokenBlockMessage(reason: unknown): string {
  try {
    if (typeof reason === "string" && Object.hasOwn(BROKEN_BLOCK_MESSAGES, reason))
      return BROKEN_BLOCK_MESSAGES[reason as BrokenBlockReason];
  } catch {
    // Fall through to the generic copy.
  }
  return BROKEN_BLOCK_MESSAGES.invalid_spec;
}

/** A `BrokenBlockCard` spec with the fixed copy for `reason`. Never reads block content. */
export function brokenBlockSpec(
  reason: BrokenBlockReason,
  options: BlockSpecOptions = {}
): TempoBlockSpec {
  return singleElementSpec("BrokenBlockCard", {
    message: brokenBlockMessage(reason),
    undoAvailable: holdsUndo(options),
  });
}

/** A spec that passed `validateBlockSpec`, or the safe fallback card. Use for specs from outside. */
export function safeBlockSpec(input: unknown, options: BlockSpecOptions = {}): TempoBlockSpec {
  const result = validateBlockSpec(input);
  return result.ok ? result.spec : brokenBlockSpec("invalid_spec", options);
}

const KNOWN_BLOCK_TYPES = new Set<unknown>(
  tempoBlockSchema.options.map((option) => option.shape.type.value)
);

/** Same order as the codec: version first, then type, then data. Only picks the copy. */
function classifyUnreadableBlock(block: unknown): BrokenBlockReason {
  if (typeof block !== "object" || block === null || Array.isArray(block))
    return "invalid_envelope";
  const record = block as Record<string, unknown>;
  if (record.v !== 1) return "unsupported_version";
  if (!KNOWN_BLOCK_TYPES.has(record.type)) return "unsupported_type";
  return "invalid_data";
}

/**
 * Map one persisted block envelope to a spec. The input is re-validated with the codec schema, so
 * hand-built, stale or hostile values never reach a component: an unknown `type`, a `v` other
 * than 1 or invalid `data` returns a `BrokenBlockCard` spec instead. The whole conversion is
 * guarded: if reading the input or the options throws (a throwing getter, a throwing or revoked
 * Proxy), the result is the generic `invalid_spec` card, never an exception and never the error
 * text.
 */
export function tempoBlockToSpec(block: unknown, options: BlockSpecOptions = {}): TempoBlockSpec {
  try {
    return convertBlock(block, options);
  } catch {
    return brokenBlockSpec("invalid_spec", options);
  }
}

function convertBlock(block: unknown, options: BlockSpecOptions): TempoBlockSpec {
  const parsed = tempoBlockSchema.safeParse(block);
  if (!parsed.success) return brokenBlockSpec(classifyUnreadableBlock(block), options);

  const value = parsed.data;
  let spec: TempoBlockSpec;
  switch (value.type) {
    case "task": {
      const { title, status, durationMin, inelastic, reason, scheduledAt } = value.data;
      const props = {
        title,
        status,
        durationMin,
        inelastic,
        ...(reason !== undefined ? { reason } : {}),
        ...(scheduledAt !== undefined ? { scheduledAt } : {}),
      };
      // The requested NEW state: ticking an open task asks for done, unticking a done task asks
      // for not done. The host decides which open status to restore.
      const toggle: ToggleBinding = {
        [TASK_TOGGLE_EVENT]: {
          action: "setTaskDone",
          params: { blockId: value.id, done: status !== "done" },
        },
      };
      spec = singleElementSpec(
        "TaskBlock",
        props,
        options?.interactive === false ? undefined : toggle
      );
      break;
    }
    case "page-meta": {
      const { pageType, date, tags } = value.data;
      spec = singleElementSpec("PageMeta", {
        pageType,
        ...(date !== undefined ? { date } : {}),
        tags,
      });
      break;
    }
    case "template": {
      const { name, forPageType, isDefault, origin, status, enabled } = value.data;
      spec = singleElementSpec("TemplateBlock", {
        name,
        forPageType,
        isDefault,
        origin,
        status,
        enabled,
      });
      break;
    }
    case "flashcards": {
      const { title, cards, origin, source } = value.data;
      spec = singleElementSpec("FlashcardsBlock", {
        title,
        cardCount: cards.length,
        fronts: firstFew(cards.map((card) => card.front)),
        origin,
        ...sourceTitle(source),
      });
      break;
    }
    case "quiz": {
      const { title, mode, questions, origin, source } = value.data;
      spec = singleElementSpec("QuizBlock", {
        title,
        mode,
        questionCount: questions.length,
        prompts: firstFew(questions.map((question) => question.prompt)),
        origin,
        ...sourceTitle(source),
      });
      break;
    }
    case "test": {
      const { title, style, durationMin, passMark, sections, origin, source } = value.data;
      const questions = sections.flatMap((section) => section.questions);
      spec = singleElementSpec("TestBlock", {
        title,
        style,
        sectionCount: sections.length,
        questionCount: questions.length,
        ...(durationMin !== undefined ? { durationMin } : {}),
        ...(passMark !== undefined ? { passMark } : {}),
        prompts: firstFew(questions.map((q) => (q.plugin === "bagrut" ? q.stem : q.prompt))),
        origin,
        ...sourceTitle(source),
      });
      break;
    }
  }

  // Belt and braces: never hand the renderer a spec the gate would reject.
  const checked = validateBlockSpec(spec);
  return checked.ok ? checked.spec : brokenBlockSpec("invalid_spec", options);
}

/** The first few preview lines of a study block. */
function firstFew(lines: readonly string[]): string[] {
  return lines.slice(0, STUDY_PREVIEW_ITEMS);
}

/** The source page's title only: its id is never a prop. */
function sourceTitle(source: { title: string } | undefined): { sourceTitle?: string } {
  return source !== undefined ? { sourceTitle: source.title } : {};
}

/**
 * Map one codec segment to a spec. A broken segment is drawn from its error code alone: its
 * `source` text is never read.
 */
export function blockSegmentToSpec(
  segment: ValidBlockSegment | BrokenBlockSegment,
  options: BlockSpecOptions = {}
): TempoBlockSpec {
  try {
    if (segment.kind === "valid") return tempoBlockToSpec(segment.block, options);
    if (segment.kind === "broken") return brokenBlockSpec(segment.errorCode, options);
  } catch {
    // A hostile segment ends in the generic card below.
  }
  return brokenBlockSpec("invalid_spec", options);
}
