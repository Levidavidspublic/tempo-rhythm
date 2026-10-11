import { parseTempoBlocks, type TempoBlock } from "./blocks";

/**
 * Safe public text projection for page bodies.
 *
 * A page body is markdown that may carry Tempo blocks (`json tempo` fences holding JSON
 * envelopes with internal block ids). Anything that shows a preview of a body, or matches a search
 * query against one, must read this projection and never slice `body` itself.
 *
 * What the projection contains:
 * - the prose of the body, reduced to plain text (markdown markers, links and HTML tags removed);
 * - the title of every valid task block and the name of every valid template block.
 *
 * What it never contains: Tempo envelopes or fence syntax, block ids, the content of any fenced
 * code block or raw HTML block, JSON-looking lines, or bidi/invisible control characters. Blocks
 * that fail validation are left out whole, so there is no raw-payload fallback. A body the codec
 * refuses as too large is left out whole too (its prose cannot be located without a second parser).
 *
 * Block recognition is the shared codec (`parseTempoBlocks`); this module has no parser or schema
 * of its own. Its prose filter only decides what plain text to show for the markdown the codec did
 * not claim: it keeps fenced code (also inside quotes and list items) and raw HTML out of the text.
 *
 * The codec does not model CommonMark HTML blocks that end at a blank line (types 6 and 7, such as
 * a `<div>` line), so it can accept a Tempo-looking fence that is really literal HTML. The
 * projection gates the codec's result by line range: a fence that starts inside such an HTML block
 * is read as prose and contributes nothing, never as a structured block. That gap in the codec is
 * a follow-up for the codec's owner; nothing here replaces the codec.
 *
 * Pure: no I/O, no mutation, linear in the body length, output bounded by the limits below.
 */

export const PAGE_TEXT_LIMITS = {
  /** Default length of `summary`, ellipsis included. */
  summaryChars: 140,
  /** Default length of `searchText`. */
  searchChars: 20_000,
  /** Default length of a `pageSnippet`, ellipses included. */
  snippetChars: 120,
  /** Largest limit a caller may ask for. */
  maxChars: 100_000,
} as const;

export type PageTextOptions = {
  summaryChars?: number;
  searchChars?: number;
};

export type PageTextProjection = {
  /** Start of `searchText`, at most `summaryChars` long, ending in an ellipsis when cut. */
  summary: string;
  /** Plain text to match search queries against, at most `searchChars` long. Not lowercased. */
  searchText: string;
  /** True when `searchText` stopped at its limit and more text followed. */
  truncated: boolean;
  /** Tempo blocks (or the whole body, when oversized) that were left out as unreadable. */
  omittedBlocks: number;
};

// ---------------------------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------------------------

/** Invisible characters that reorder, hide or re-flow text: bidi embeddings, overrides, isolates. */
const HIDDEN_FORMAT =
  /[\u{AD}\u{180E}\u{200B}\u{202A}-\u{202E}\u{2060}-\u{206F}\u{FEFF}\u{FFF9}-\u{FFFB}\u{E0000}-\u{E007F}]/gu;
const CONTROLS = /[\p{Cc}\u{2028}\u{2029}]/gu;
const LONE_SURROGATE = /[\uD800-\uDFFF]/gu;
const ALL_FORMAT = /\p{Cf}/gu;
/** A code point that must stay attached to the one before it. */
const ATTACHES = /^(?:[\p{M}\p{Emoji_Modifier}]|\u{200C}|\u{200D})/u;

/**
 * Replaces controls with spaces and drops hidden format characters and lone surrogates. Marks that
 * Hebrew and Arabic text needs (LRM, RLM, ALM, ZWJ, ZWNJ) and combining points are kept.
 */
function tidy(text: string): string {
  return text.replace(LONE_SURROGATE, "").replace(HIDDEN_FORMAT, "").replace(CONTROLS, " ");
}

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function attachesToPrevious(text: string, index: number): boolean {
  const unit = text.charCodeAt(index);
  if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  if (text.charCodeAt(index - 1) === 0x200d) return true;
  return ATTACHES.test(text.slice(index, index + 2));
}

/** The largest cut position at or below `end` that keeps every character cluster whole. */
function safeEnd(text: string, end: number): number {
  let cut = Math.min(end, text.length);
  while (cut > 0 && cut < text.length && attachesToPrevious(text, cut)) cut -= 1;
  return cut;
}

/** The largest start position at or below `start` that does not split a character cluster. */
function safeStart(text: string, start: number): number {
  let cut = Math.max(0, start);
  while (cut > 0 && cut < text.length && attachesToPrevious(text, cut)) cut -= 1;
  return cut;
}

function ellipsize(text: string, max: number, force: boolean): string {
  if (text.length <= max && !force) return text;
  const end = safeEnd(text, Math.min(max - 1, text.length));
  return `${text.slice(0, end).trimEnd()}\u{2026}`;
}

function boundedLimit(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(PAGE_TEXT_LIMITS.maxChars, Math.max(1, Math.floor(value)));
}

/** A snippet's limit is a hard cap on its length, so unlike the others it may be 0 (an empty snippet). */
function snippetLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return PAGE_TEXT_LIMITS.snippetChars;
  return Math.min(PAGE_TEXT_LIMITS.maxChars, Math.max(0, Math.floor(value)));
}

// ---------------------------------------------------------------------------------------------
// What may never be emitted
// ---------------------------------------------------------------------------------------------

const FENCE_SYNTAX = /`{3,}|~{3,}/;
/** Deliberately wider than the codec's id grammar: any `blk_` token is an internal id. */
const BLOCK_ID = /blk_[0-9a-z]{8,}/i;
/** Quoted envelope keys. */
const ENVELOPE_KEY = /"(?:id|v|type|data)"\s*:/;
/** Same notion of "raw JSON line" as the notes list preview: braces, arrays, keys, bare strings. */
const JSON_LINE =
  /^(?:[{}\]]|\[\]|\[\s*(?:[{"\d-]|\[\s*[{"\d]|true\b|false\b|null\b)|"(?:[^"\\]|\\.)*"\s*(?::|,?$))/;

function looksLikeJson(text: string): boolean {
  return JSON_LINE.test(text.replace(ALL_FORMAT, "").trimStart());
}

/** Checked on the characters a reader would see, so invisible characters cannot hide a match. */
function isUnsafe(text: string): boolean {
  const visible = text.replace(ALL_FORMAT, "");
  return (
    FENCE_SYNTAX.test(visible) ||
    BLOCK_ID.test(visible) ||
    ENVELOPE_KEY.test(visible) ||
    JSON_LINE.test(visible.trimStart())
  );
}

// ---------------------------------------------------------------------------------------------
// Prose
// ---------------------------------------------------------------------------------------------

/**
 * CommonMark raw HTML blocks with an explicit end marker (start conditions 1-5). Their lines are
 * literal HTML, so the codec leaves fence-looking lines inside them as markdown; they are never
 * shown here either. Every pattern is anchored or a fixed literal.
 */
const RAW_HTML_BLOCKS: readonly { start: RegExp; end: RegExp }[] = [
  {
    start: /^ {0,3}<(?:script|pre|style|textarea)(?:[\t >]|$)/i,
    end: /<\/(?:script|pre|style|textarea)>/i,
  },
  { start: /^ {0,3}<!--/, end: /-->/ },
  { start: /^ {0,3}<\?/, end: /\?>/ },
  { start: /^ {0,3}<![A-Za-z]/, end: />/ },
  { start: /^ {0,3}<!\[CDATA\[/, end: /\]\]>/ },
];

const FENCE_LINE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const QUOTE_MARKER = /^ {0,3}> ?/;
/** A list marker and the spaces after it (none at all only when the line ends there). */
const ITEM_MARKER = /^( {0,3})([-*+]|\d{1,9}[.)])(?: ( *)|$)/;
const LEADING_SPACES = /^ */;
/** Quotes and list items open at once; deeper nesting is read as plain text. */
const MAX_CONTAINERS = 16;
const THEMATIC_BREAK = /^([-*_=])(?: *\1){2,}$/;
// The first class excludes "-" so the one required "-" can match in only one place (no backtracking).
const TABLE_RULE = /^[ :|]*-[ :|-]*$/;
const LINK_DEFINITION = /^\[[^\]]{1,200}\]: *<?\S+(?: +["'(].{0,200})?$/;
const BLOCK_MARKER = /^(?:#{1,6} +|> ?|[-*+] +|\d{1,9}[.)] +)/;
const CHECKBOX = /^\[[ xX]\] +/;
const HTML_COMMENT = /<!--[^<]{0,500}?-->/g;
const HTML_TAG = /<\/?[A-Za-z][A-Za-z0-9-]{0,40}(?: [^<>]{0,500})?\/?>/g;
const LINK_OR_IMAGE = /!?\[([^[\]]{0,300})\]\([^)]{0,2000}\)/g;
const EMPHASIS_PAIR = /(^|[^\p{L}\p{N}_])([*_]{1,2})(\S(?:[^*_]{0,200}\S)?)\2(?![\p{L}\p{N}_])/gu;

/**
 * CommonMark HTML blocks that end at a blank line (start conditions 6 and 7). The codec does not
 * model them, so a fence inside one can look like a Tempo block to it; see `projectPageText`.
 * Condition 6 is a block-level tag name; condition 7 is any other complete tag alone on its line,
 * and cannot interrupt a paragraph. Both are anchored and bounded, so each line is tested in
 * constant time per character.
 */
const HTML_BLOCK_NAMES =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|" +
  "dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|" +
  "hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|" +
  "search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const HTML_BLOCK_6 = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_NAMES})(?:[ \\t]|/?>|$)`, "i");
const HTML_BLOCK_7 =
  /^ {0,3}<\/?(?!(?:pre|script|style|textarea)(?![A-Za-z0-9-]))[A-Za-z][A-Za-z0-9-]*(?:[ \t/][^<>]{0,500})?>[ \t]*$/;
/** A line that certainly continues or starts a paragraph (under-reading only gates more). */
const PLAIN_TEXT = /^ {0,3}[\p{L}\p{N}]/u;

/** A quote or a list item whose content a fence may sit in. `indent` is the item's content offset. */
type Container = { kind: "quote" } | { kind: "item"; indent: number };

type ProseState = {
  /** Quotes and list items open before the current line, outermost first. */
  containers: Container[];
  /** The open fenced code block, which lasts only while the containers it opened in continue. */
  fence?: { marker: string; length: number };
  htmlEnd?: RegExp;
  /** Container depth of an open HTML block that ends at a blank line (condition 6 or 7). */
  htmlBlock?: number;
  /** The previous line was paragraph text, which condition 7 cannot interrupt. */
  afterText: boolean;
};

function createProseState(): ProseState {
  return { containers: [], afterText: false };
}

/** A new segment starts at the top level: only an open top-level HTML block carries over. */
function startSegment(state: ProseState): void {
  state.containers.length = 0;
  state.fence = undefined;
  state.htmlEnd = undefined;
  state.afterText = false;
  if (state.htmlBlock !== 0) state.htmlBlock = undefined;
}

/** Expands tabs to 4-column stops, so tab-indented container content lines up as CommonMark reads it. */
function detab(line: string): string {
  let out = "";
  for (const char of line) {
    out += char === "\t" ? " ".repeat(4 - (out.length % 4)) : char;
  }
  return out;
}

/** How many of the open containers continue on this line, and the line without their prefixes. */
function continueContainers(
  line: string,
  open: readonly Container[]
): { matched: number; rest: string } {
  let rest = line;
  let matched = 0;
  for (const container of open) {
    if (container.kind === "quote") {
      const marker = QUOTE_MARKER.exec(rest);
      if (!marker) break;
      rest = rest.slice(marker[0].length);
    } else {
      const lead = LEADING_SPACES.exec(rest)![0].length;
      // A blank line keeps a list item open; any other line must be indented into its content.
      if (lead < rest.length) {
        if (lead < container.indent) break;
        rest = rest.slice(container.indent);
      }
    }
    matched += 1;
  }
  return { matched, rest };
}

/** Opens the quotes and list items that start this line, and returns what follows their markers. */
function openContainers(line: string, open: Container[]): string {
  let rest = line;
  while (open.length < MAX_CONTAINERS) {
    const quote = QUOTE_MARKER.exec(rest);
    if (quote) {
      open.push({ kind: "quote" });
      rest = rest.slice(quote[0].length);
      continue;
    }
    const item = ITEM_MARKER.exec(rest);
    if (!item || THEMATIC_BREAK.test(rest.trim())) break;
    const markerEnd = item[1]!.length + item[2]!.length;
    const spaces = item[3] === undefined ? 0 : item[3].length + 1;
    // One to four spaces belong to the marker; more than that (or none) leaves the content indented.
    const indent =
      spaces >= 1 && spaces <= 4 && rest.length > markerEnd + spaces ? markerEnd + spaces : markerEnd + 1;
    open.push({ kind: "item", indent });
    rest = rest.slice(indent);
  }
  return rest;
}

/** A fence line, read once as the container-free text and, at top level, as the raw text too. */
function fenceOf(rest: string, content: string, depth: number): RegExpExecArray | null {
  return FENCE_LINE.exec(rest) ?? (depth === 0 ? FENCE_LINE.exec(content) : null);
}

function startsHtmlBlock(rest: string, afterText: boolean): boolean {
  return HTML_BLOCK_6.test(rest) || (!afterText && HTML_BLOCK_7.test(rest));
}

function stripBlockMarkers(line: string): string {
  let text = line;
  for (let depth = 0; depth < 8; depth += 1) {
    const next = text.replace(BLOCK_MARKER, "").trimStart();
    if (next === text) break;
    text = next;
  }
  return text.replace(CHECKBOX, "").replace(/ #+$/, "");
}

function stripInline(text: string): string {
  return text
    .replace(HTML_COMMENT, " ")
    .replace(HTML_TAG, " ")
    .replace(LINK_OR_IMAGE, "$1")
    .replace(/\*\*|~~|`+/g, "")
    .replace(EMPHASIS_PAIR, "$1$3");
}

/**
 * Plain text of one markdown line, or "" when the line is not shown. Tracks fenced code (also in
 * quotes and list items), raw HTML and, for the codec gate, HTML blocks that end at a blank line.
 * With `emit` false it only follows the state and skips the text work.
 */
function proseLine(rawLine: string, state: ProseState, emit: boolean): string {
  const raw = rawLine.replace(/(?:\r\n|\r|\n)$/, "");
  const content = tidy(raw);

  if (state.htmlEnd) {
    state.afterText = false;
    // A blank line ends an HTML block of condition 6 or 7 even where it falls inside a comment.
    if (/^ *$/.test(content)) state.htmlBlock = undefined;
    if (state.htmlEnd.test(content)) state.htmlEnd = undefined;
    return "";
  }

  // Quotes and list items decide where a fence starts and ends: a fence lives only as long as every
  // container it opened in keeps continuing, and its closing line is read without their prefixes.
  const { matched, rest: continued } = continueContainers(
    raw.includes("\t") ? tidy(detab(raw)) : content,
    state.containers
  );
  if (matched < state.containers.length) {
    state.containers.length = matched;
    state.fence = undefined;
  }
  if (state.htmlBlock !== undefined && (state.htmlBlock > matched || /^ *$/.test(continued))) {
    state.htmlBlock = undefined;
  }

  if (state.fence) {
    const closer = fenceOf(continued, content, state.containers.length);
    const { marker, length } = state.fence;
    if (closer && closer[2]![0] === marker && closer[2]!.length >= length && closer[3]!.trim() === "") {
      state.fence = undefined;
    }
    state.afterText = false;
    return "";
  }

  const rest = openContainers(continued, state.containers);
  const fence = fenceOf(rest, content, state.containers.length);
  if (fence && (fence[2]![0] === "~" || !fence[3]!.includes("`"))) {
    state.fence = { marker: fence[2]![0]!, length: fence[2]!.length };
    state.afterText = false;
    return "";
  }
  const html = RAW_HTML_BLOCKS.find((block) => block.start.test(content));
  if (html) {
    state.afterText = false;
    if (!html.end.test(content)) state.htmlEnd = html.end;
    return "";
  }
  if (state.htmlBlock === undefined && startsHtmlBlock(rest, state.afterText)) {
    state.htmlBlock = state.containers.length;
  }
  state.afterText = PLAIN_TEXT.test(rest);
  if (!emit) return "";

  // Leading direction marks (common at the start of right-to-left lines) must not hide markers.
  const line = content.replace(/^[\s\u{200E}\u{200F}\u{61C}]+/u, "").trimEnd();
  if (line === "" || THEMATIC_BREAK.test(line) || LINK_DEFINITION.test(line)) return "";
  if (FENCE_SYNTAX.test(line.replace(ALL_FORMAT, ""))) return "";

  const text = stripBlockMarkers(line);
  if (text === "" || TABLE_RULE.test(text) || looksLikeJson(line) || looksLikeJson(text)) return "";

  const plain = collapse(stripInline(text));
  return plain === "" || isUnsafe(plain) ? "" : plain;
}

/** Plain text of a block field such as a task title, or "" when it is not safe to show. */
function fieldText(value: string): string {
  const plain = collapse(tidy(value));
  return plain === "" || isUnsafe(plain) ? "" : plain;
}

// ---------------------------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------------------------

function createCollector(limit: number) {
  const parts: string[] = [];
  let length = 0;
  let full = false;
  return {
    get full() {
      return full;
    },
    add(text: string) {
      if (full || text === "") return;
      const room = limit - length - (parts.length > 0 ? 1 : 0);
      if (room <= 0) {
        full = true;
        return;
      }
      const fits = text.length <= room;
      const piece = fits ? text : text.slice(0, safeEnd(text, room)).trimEnd();
      if (piece !== "") {
        length += piece.length + (parts.length > 0 ? 1 : 0);
        parts.push(piece);
      }
      if (!fits) full = true;
    },
    value(): string {
      return parts.join(" ");
    },
  };
}

type Collector = ReturnType<typeof createCollector>;

/**
 * Adds the prose of one segment. With `follow` set (a block comes later) it keeps reading lines once
 * `out` is full, because the state at the end of the segment decides whether that block is trusted.
 */
function addProse(source: string, out: Collector, state: ProseState, follow: boolean): void {
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  for (
    let line = lines.exec(source);
    line !== null && line[0].length > 0;
    line = lines.exec(source)
  ) {
    if (out.full && !follow) return;
    out.add(proseLine(line[0], state, !out.full));
  }
}

/** Only fields that are plain visible text. Everything else in a block stays out, by omission. */
function addBlockText(block: TempoBlock, out: Collector): void {
  if (block.type === "task") out.add(fieldText(block.data.title));
  else if (block.type === "template") out.add(fieldText(block.data.name));
}

/**
 * The one safe text view of a page body, for list previews and search. The input is not changed;
 * the same body always gives the same result.
 */
export function projectPageText(body: string, options: PageTextOptions = {}): PageTextProjection {
  const searchLimit = boundedLimit(options.searchChars, PAGE_TEXT_LIMITS.searchChars);
  const summaryLimit = boundedLimit(options.summaryChars, PAGE_TEXT_LIMITS.summaryChars);
  const out = createCollector(searchLimit);
  let omittedBlocks = 0;
  const segments = parseTempoBlocks(body);
  // Past the last block only text is left, and once `out` is full there is nothing to add or gate.
  let lastBlock = segments.length - 1;
  while (lastBlock >= 0 && segments[lastBlock]!.kind === "markdown") lastBlock -= 1;
  const state = createProseState();
  for (const [index, segment] of segments.entries()) {
    if (out.full && index > lastBlock) break;
    startSegment(state);
    // The codec reads a fence at the top level as a block even where CommonMark has it inside an HTML
    // block that runs to the next blank line. There it is literal markup, so it is prose, not a block.
    if (segment.kind === "markdown" || state.htmlBlock === 0) {
      addProse(segment.source, out, state, index < lastBlock);
    } else {
      state.htmlBlock = undefined;
      if (segment.kind === "broken") omittedBlocks += 1;
      else addBlockText(segment.block, out);
    }
  }
  const searchText = out.value();
  return {
    summary: ellipsize(searchText, summaryLimit, out.full),
    searchText,
    truncated: out.full,
    omittedBlocks,
  };
}

/**
 * A short window of `searchText` around the first match of `query` (the start when there is none),
 * never longer than `maxChars` with its ellipses counted (0 gives an empty snippet). Takes a
 * projection, not a body, so a caller cannot window raw text by mistake.
 */
export function pageSnippet(
  projection: Pick<PageTextProjection, "searchText">,
  query: string,
  maxChars?: number
): string {
  const max = snippetLimit(maxChars);
  const text = projection.searchText;
  if (text.length <= max) return text;
  if (max === 0) return "";

  const needle = collapse(tidy(query)).toLowerCase();
  const lowered = text.toLowerCase();
  // Lowercasing can change a string's length (and so every offset); then fall back to the start.
  const at = needle !== "" && lowered.length === text.length ? lowered.indexOf(needle) : -1;
  // A window cut at both ends needs room for two ellipses and a character between them.
  const start = at > 20 && max >= 3 ? safeStart(text, at - 20) : 0;

  let budget = max - (start > 0 ? 1 : 0);
  if (start + budget < text.length) budget -= 1;
  const end = safeEnd(text, start + Math.max(0, budget));
  return `${start > 0 ? "\u{2026}" : ""}${text.slice(start, end).trim()}${end < text.length ? "\u{2026}" : ""}`;
}
