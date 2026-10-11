/**
 * TEMPO-B06-01 (#787) — built-in page source templates (Daily, Plain).
 *
 * A built-in source is itself a small page: one `template` block that names it, followed by the
 * Markdown a new page starts with. It is code, not a row, and it is not part of the starter catalog
 * in `templateCatalog.ts`, so `templates.list` and the periodType proposals are unchanged.
 *
 * A page made from a source does not copy the `template` block. It starts with its own `page-meta`
 * block (fresh `blk_` id, page type and, for a daily page, the local date) and then the same
 * Markdown. Everything is built from fixed strings and the shared block codec's shapes; the codec in
 * `./blocks` stays the only parser, and a test re-parses every output with it.
 *
 * The words are original. No model call.
 */
import { BLOCK_CODEC_LIMITS, type TempoBlock } from "./blocks";

export type BuiltinPageType = "daily" | "plain";
export type BuiltinTemplateId = `builtin:${BuiltinPageType}`;

type TemplateData = Extract<TempoBlock, { type: "template" }>["data"];
type PageMetaData = Extract<TempoBlock, { type: "page-meta" }>["data"];

export type BuiltinTemplate = {
  templateId: BuiltinTemplateId;
  /** The page type a page made from this source gets (`notes.pageType` and its page-meta block). */
  pageType: BuiltinPageType;
  /** The legacy `notes.periodType` value for a page made from this source. */
  periodType: "daily" | "none";
  /**
   * Fixed id of this source's own `template` block. Never copied into a page, so a page never
   * reuses it.
   */
  templateBlockId: string;
  template: TemplateData;
  /** Markdown that follows the first block, both in the source and in a page made from it. */
  content: string;
};

const DAILY_CONTENT = `
## Intention

## Tasks

## Notes
`;

const PLAIN_CONTENT = `
`;

export const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    templateId: "builtin:daily",
    pageType: "daily",
    periodType: "daily",
    templateBlockId: "blk_01K7A00000000000000000D001",
    template: {
      name: "Daily",
      forPageType: "daily",
      isDefault: true,
      tokens: [],
      origin: "builtin",
      status: "live",
      enabled: true,
    },
    content: DAILY_CONTENT,
  },
  {
    templateId: "builtin:plain",
    pageType: "plain",
    periodType: "none",
    templateBlockId: "blk_01K7A00000000000000000P001",
    template: {
      name: "Plain",
      forPageType: "plain",
      isDefault: true,
      tokens: [],
      origin: "builtin",
      status: "live",
      enabled: true,
    },
    content: PLAIN_CONTENT,
  },
];

const BLOCK_ID_PATTERN = /^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

/** One `json tempo` fence holding a compact, key-ordered envelope. */
function tempoFence(block: TempoBlock): string {
  return `\`\`\`json tempo\n${JSON.stringify(block)}\n\`\`\`\n`;
}

/** The built-in source for a page type. */
export function builtinTemplate(pageType: BuiltinPageType): BuiltinTemplate {
  const found = BUILTIN_TEMPLATES.find((template) => template.pageType === pageType);
  if (!found) {
    throw new Error("Built-in template not found");
  }
  return found;
}

/** The source page of a built-in: its `template` block, then its Markdown. */
export function builtinTemplateSourceBody(template: BuiltinTemplate): string {
  return (
    tempoFence({ type: "template", id: template.templateBlockId, v: 1, data: template.template }) +
    template.content
  );
}

/**
 * A new page body from a built-in source: a fresh `page-meta` block, then the source Markdown.
 * `pageMetaBlockId` must be a fresh `blk_` + ULID minted by the caller. A daily page needs a
 * `date` (`YYYY-MM-DD`, validated by the caller); a plain page takes none.
 */
export function renderBuiltinPage(
  template: BuiltinTemplate,
  input: { pageMetaBlockId: string; date?: string },
): string {
  if (!BLOCK_ID_PATTERN.test(input.pageMetaBlockId)) {
    throw new Error("Invalid block id");
  }
  if (input.pageMetaBlockId === template.templateBlockId) {
    throw new Error("Invalid block id");
  }
  if (template.pageType === "daily" && input.date === undefined) {
    throw new Error("A daily page needs a date");
  }
  const data: PageMetaData = {
    pageType: template.pageType,
    ...(input.date === undefined ? {} : { date: input.date }),
    tags: [],
  };
  const body = tempoFence({ type: "page-meta", id: input.pageMetaBlockId, v: 1, data }) + template.content;
  if (body.length > BLOCK_CODEC_LIMITS.maxBodyChars) {
    throw new Error("Built-in page is too large");
  }
  return body;
}
