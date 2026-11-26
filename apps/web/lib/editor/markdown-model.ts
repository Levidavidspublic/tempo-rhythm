/**
 * Tempo v3 markdown model (OVERNIGHT-RUN.md decisions 1-4, 6, 7).
 *
 * `notes.body` Markdown is the only source of truth. Tempo blocks are fenced `json tempo` blocks
 * inside it, read with the shared codec in @tempo/utils; nothing here stores a second
 * representation. Every helper is a pure string function so the editor, the read view and the
 * tests share one behaviour. Saves are byte-exact: helpers that edit a body touch only the range
 * they are asked to change and copy every other UTF-16 unit as it was.
 */
import { BLOCK_CODEC_LIMITS, type BlockSegment, type PageRef, parseTempoBlocks, type TempoBlock } from "@tempo/utils";

/** The editor must never normalise line breaks: CodeMirror gets this as its line separator. */
export const LINE_SEPARATOR = "\n";

/** True when `current` would save a different body than the one that was loaded. */
export function isDirty(loaded: string, current: string): boolean {
  return loaded !== current;
}

/* ------------------------------------------------------------------ */
/* Tempo blocks                                                         */
/* ------------------------------------------------------------------ */

export type BlockRange = {
  from: number;
  to: number;
  segment: Exclude<BlockSegment, { kind: "markdown" }>;
};

/** Every `json tempo` fence (valid or broken) with its exact source range. */
export function tempoBlockRanges(body: string): BlockRange[] {
  const out: BlockRange[] = [];
  for (const segment of parseTempoBlocks(body)) {
    if (segment.kind === "markdown") continue;
    out.push({ from: segment.start, to: segment.end, segment });
  }
  return out;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A block id the codec accepts: `blk_` + a 26-character ULID (time first, then randomness). */
export function newBlockId(now: number = Date.now(), random: () => number = Math.random): string {
  let time = "";
  let t = Math.max(0, Math.floor(now));
  for (let i = 0; i < 10; i += 1) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  let rand = "";
  for (let i = 0; i < 16; i += 1) rand += CROCKFORD[Math.floor(random() * 32) % 32];
  return `blk_${time}${rand}`;
}

/** Serialises a block as a fence. The JSON lives only in the body and is never shown. */
export function tempoFence(block: TempoBlock): string {
  return `\`\`\`json tempo\n${JSON.stringify(block)}\n\`\`\`\n`;
}

export function newTaskBlock(title: string, now: number = Date.now(), random: () => number = Math.random): TempoBlock {
  return {
    id: newBlockId(now, random),
    v: 1,
    type: "task",
    data: { title, durationMin: 15, status: "later", order: 0, inelastic: false },
  };
}

/**
 * Ticks or unticks one task block. Only that fence's source changes; every other byte of the
 * body is copied as it was. Returns the body unchanged when the range is not a valid task.
 */
export function setTaskDone(body: string, range: BlockRange, done: boolean): string {
  if (range.segment.kind !== "valid" || range.segment.block.type !== "task") return body;
  if (body.slice(range.from, range.to) !== range.segment.source) return body;
  const block = range.segment.block;
  const next: TempoBlock = {
    ...block,
    data: { ...block.data, status: done ? "done" : "later", doneAt: done ? new Date().toISOString() : null },
  };
  const trailing = range.segment.source.endsWith("\n") ? "" : "\n";
  const fence = tempoFence(next);
  const replacement = trailing ? fence.slice(0, -1) : fence;
  return body.slice(0, range.from) + replacement + body.slice(range.to);
}

/**
 * Renames one task block (the card's title field). Only that fence changes; an empty title is
 * ignored (the codec needs one), and a long one is cut to the codec's limit.
 */
export function setTaskTitle(body: string, range: BlockRange, title: string): string {
  if (range.segment.kind !== "valid" || range.segment.block.type !== "task") return body;
  if (body.slice(range.from, range.to) !== range.segment.source) return body;
  const clean = title.replace(/\s+/g, " ").trim().slice(0, BLOCK_CODEC_LIMITS.maxTextChars);
  const block = range.segment.block;
  if (!clean || clean === block.data.title) return body;
  const next: TempoBlock = { ...block, data: { ...block.data, title: clean } };
  const trailing = range.segment.source.endsWith("\n") ? "" : "\n";
  const fence = tempoFence(next);
  const replacement = trailing ? fence.slice(0, -1) : fence;
  return body.slice(0, range.from) + replacement + body.slice(range.to);
}

/**
 * The one change that turns `before` into `after`: the differing middle, after the longest common
 * start and end. Applied to an open editor, every caret and selection outside that range keeps
 * its place. A range edge never splits a surrogate pair.
 */
export function textChange(before: string, after: string): { from: number; to: number; insert: string } {
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start += 1;
  if (start > 0) {
    const prev = before.charCodeAt(start - 1);
    if (prev >= 0xd800 && prev <= 0xdbff) start -= 1;
  }
  let end = 0;
  while (
    end < max - start &&
    before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)
  ) {
    end += 1;
  }
  if (end > 0) {
    const next = before.charCodeAt(before.length - end);
    if (next >= 0xdc00 && next <= 0xdfff) end -= 1;
  }
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}

/** The id of the block an inserted fence carries (to focus the new task card's title). */
export function insertedBlockId(text: string): string | null {
  return /"id"\s*:\s*"(blk_[0-9A-HJKMNP-TV-Z]{26})"/.exec(text)?.[1] ?? null;
}

/** Removes one block's source exactly (the "Remove block" action; Undo restores the same bytes). */
export function removeRange(body: string, range: { from: number; to: number }): string {
  return body.slice(0, range.from) + body.slice(range.to);
}

/* ------------------------------------------------------------------ */
/* Slash menu (decision 7)                                              */
/* ------------------------------------------------------------------ */

export type SlashCommandId =
  | "h1"
  | "h2"
  | "h3"
  | "bullet"
  | "numbered"
  | "checklist"
  | "quote"
  | "code"
  | "divider"
  | "table"
  | "task"
  | "link";

export type SlashCommand = {
  id: SlashCommandId;
  group: "tempo" | "text";
  /** Extra words the filter matches (English and Hebrew). */
  keywords: string;
};

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { id: "task", group: "tempo", keywords: "task todo משימה" },
  { id: "link", group: "tempo", keywords: "link page wiki קישור דף" },
  { id: "h1", group: "text", keywords: "heading title h1 # כותרת" },
  { id: "h2", group: "text", keywords: "heading h2 ## כותרת" },
  { id: "h3", group: "text", keywords: "heading h3 ### כותרת" },
  { id: "bullet", group: "text", keywords: "bullet list ul - רשימה נקודות" },
  { id: "numbered", group: "text", keywords: "numbered ordered list ol 1. רשימה ממוספרת" },
  { id: "checklist", group: "text", keywords: "checklist checkbox [] רשימת סימון" },
  { id: "quote", group: "text", keywords: "quote blockquote > ציטוט" },
  { id: "code", group: "text", keywords: "code fence ``` קוד" },
  { id: "divider", group: "text", keywords: "divider rule hr --- קו מפריד" },
  { id: "table", group: "text", keywords: "table grid | טבלה" },
];

/** Commands whose label or keywords contain every typed word. */
export function filterSlashCommands(query: string, labels: Record<SlashCommandId, string>): SlashCommand[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter((command) => {
    const hay = `${labels[command.id]} ${command.keywords} ${command.id}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
}

/**
 * The "/" trigger: the slash is the first thing on its line (or follows a space) and the user
 * has typed only a short query after it. `lineBefore` is the line text before the cursor.
 */
export function slashQuery(lineBefore: string): { query: string; offset: number } | null {
  const match = /(^|\s)\/([^\s/]{0,24})$/.exec(lineBefore);
  if (!match) return null;
  const offset = match.index + match[1]!.length;
  return { query: match[2]!, offset };
}

/** Text the command inserts in place of "/query", and where the cursor lands (offset in it). */
export function slashInsertion(id: SlashCommandId, atLineStart: boolean): { text: string; cursor: number } {
  const lead = atLineStart ? "" : "\n";
  const line = (prefix: string) => ({ text: `${lead}${prefix}`, cursor: lead.length + prefix.length });
  switch (id) {
    case "h1":
      return line("# ");
    case "h2":
      return line("## ");
    case "h3":
      return line("### ");
    case "bullet":
      return line("- ");
    case "numbered":
      return line("1. ");
    case "checklist":
      return line("- [ ] ");
    case "quote":
      return line("> ");
    case "code": {
      const text = `${lead}\`\`\`\n\n\`\`\``;
      return { text, cursor: lead.length + 4 };
    }
    case "divider":
      return { text: `${lead}---\n`, cursor: lead.length + 4 };
    case "table": {
      const text = `${lead}| Column | Column |\n| --- | --- |\n|  |  |`;
      return { text, cursor: lead.length + 2 };
    }
    case "link":
      return { text: "[[", cursor: 2 };
    case "task": {
      const text = `${lead}${tempoFence(newTaskBlock("New task"))}`;
      return { text, cursor: text.length };
    }
  }
}

/* ------------------------------------------------------------------ */
/* [[links]] and "Linked here" (decision 3)                             */
/* ------------------------------------------------------------------ */

export {
  type Backlink,
  backlinksFor,
  findWikiLinks,
  isLinkableTitle,
  type PageRef,
  sameTitle,
  titleKey,
  type WikiLink,
} from "@tempo/utils";

/** The "[[" picker trigger: an unclosed `[[query` right before the cursor on the same line. */
export function wikiQuery(lineBefore: string): { query: string; offset: number } | null {
  const match = /\[\[([^[\]\n|]{0,60})$/.exec(lineBefore);
  if (!match) return null;
  return { query: match[1]!, offset: match.index };
}

/**
 * The page title of the `[[link]]` that holds `offset` on one line (its brackets included), or
 * null. Keyboard users open a link with Mod-Enter, so the editor asks this at the cursor.
 */
export function wikiLinkAtOffset(lineText: string, offset: number): string | null {
  const re = /\[\[([^[\]\n|]{1,200})(?:\|[^[\]\n]{1,200})?\]\]/g;
  for (let m = re.exec(lineText); m !== null; m = re.exec(lineText)) {
    if (offset < m.index) return null;
    if (offset <= m.index + m[0].length) return m[1]!.trim() || null;
  }
  return null;
}

/** Titles for the "[[" picker, best match first. */
export function pickPages(query: string, pages: readonly PageRef[], selfId: string, limit = 8): PageRef[] {
  const q = query.trim().toLowerCase();
  return pages
    .filter((p) => p.id !== selfId && p.title.trim().length > 0)
    .filter((p) => !q || p.title.toLowerCase().includes(q))
    .sort((a, b) => {
      const as = a.title.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.title.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Templates (decision 6): {{tokens}}                                   */
/* ------------------------------------------------------------------ */

/**
 * Fills `{{token}}` placeholders. Unknown tokens stay as typed, so a template never loses text.
 * Tokens inside Tempo fences are left alone (the JSON is not template text).
 */
export function applyTemplateTokens(template: string, values: Readonly<Record<string, string>>): string {
  const blocks = tempoBlockRanges(template);
  return template.replace(/\{\{\s*([a-zA-Z][\w-]*)\s*\}\}/g, (whole, name: string, offset: number) => {
    if (blocks.some((b) => offset >= b.from && offset < b.to)) return whole;
    return Object.hasOwn(values, name) ? values[name]! : whole;
  });
}

/** Standard token values for a local calendar day (YYYY-MM-DD). */
export function dayTokens(isoDate: string, lang: "en" | "he" = "en"): Record<string, string> {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date);
  const long = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  return { date: isoDate, weekday, day: long, title: `${weekday}, ${long}`, week: String(isoWeek(date)) };
}

/** ISO 8601 week number of a UTC date. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/* ------------------------------------------------------------------ */
/* Page menu: Copy as Markdown, Export .md                              */
/* ------------------------------------------------------------------ */

/** A safe file name for Export .md. Hebrew and other letters are kept. */
export function exportFileName(title: string): string {
  const cleaned = title
    .trim()
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what a file name must drop
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${cleaned || "Untitled"}.md`;
}

/** What Copy as Markdown copies: the body itself, no front matter, no rewriting. */
export function exportContents(body: string): string {
  return body;
}

/**
 * A page title as the text of a Markdown heading that reads exactly as typed. Inline marks
 * (code, emphasis, links, HTML, strikethrough, entities) are escaped anywhere; a block mark at the
 * start (#, >, -, +, "1.") is escaped so a reader never sees a list or a quote; and a trailing
 * " #" is escaped, because a heading would drop it as its closing sequence.
 */
function markdownHeadingText(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]<~]/g, "\\$&")
    .replace(/&(?=#?\w+;)/g, "\\&")
    .replace(/^(?:[#>+-]|(\d{1,9})([.)]))/, (mark, digits?: string, dot?: string) =>
      digits ? `${digits}\\${dot}` : `\\${mark}`,
    )
    .replace(/ (#+)$/, " \\$1");
}

/**
 * The Export .md file: `# <title>`, a blank line, then the body exactly as saved. An untitled page
 * gets the app's untitled name (`untitled`), and an empty page exports just the heading.
 */
export function exportMarkdownFile(title: string, body: string, untitled: string): string {
  const heading = `# ${markdownHeadingText(title) || markdownHeadingText(untitled)}\n`;
  return body.trim() === "" ? heading : `${heading}\n${body}`;
}

/** The parts of a keydown the page menu reads (a DOM KeyboardEvent fits). */
export type PageMenuKeyEvent = {
  key: string;
  isComposing?: boolean;
  keyCode?: number;
  defaultPrevented?: boolean;
};

/**
 * True when a keydown closes the open page menu: Escape that no popup above already took (it
 * would be `defaultPrevented`) and that isn't an IME cancelling its composition (`isComposing`,
 * or keyCode 229 where a browser leaves `isComposing` unset).
 */
export function closesPageMenu(event: PageMenuKeyEvent): boolean {
  if (event.key !== "Escape" || event.defaultPrevented) return false;
  return !event.isComposing && event.keyCode !== 229;
}
