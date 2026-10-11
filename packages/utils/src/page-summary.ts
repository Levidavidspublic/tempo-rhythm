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
 * code block or raw HTML block (all seven CommonMark kinds, none of which the renderer shows as
 * text), JSON-looking lines, or bidi/invisible control characters. Blocks that fail validation are
 * left out whole, so there is no raw-payload fallback. A body the codec refuses as too large is left
 * out whole too (its prose cannot be located without a second parser).
 *
 * Block recognition is the shared codec (`parseTempoBlocks`); this module has no Tempo parser or
 * schema of its own. Its prose reader decides what plain text to show for the markdown the codec
 * did not claim, following CommonMark's block structure (quotes, list items and lazy lines, code,
 * raw HTML) as the renderer does; see "Prose" below. Nesting deeper than it follows is hidden whole.
 *
 * The codec reads every `json tempo` fence at column 0 as a block, without the structure around
 * it: it does not model HTML blocks that end at a blank line (conditions 6 and 7, such as a `<div>`
 * line), nor how they move the fences after them. So the projection trusts a block only where its
 * own reader, standing at that line, also opens a fence; anywhere else (inside an HTML block or a
 * fence CommonMark has open) the block is read as prose and shows nothing. That gap in the codec is
 * a follow-up for the codec's owner; nothing here replaces the codec.
 *
 * Every cut (search limit, summary, snippet) falls on a grapheme cluster boundary, so a flag, an
 * emoji sequence or a letter with its marks is kept whole or left out whole.
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

// ---------------------------------------------------------------------------------------------
// Grapheme clusters
// ---------------------------------------------------------------------------------------------

/** The part of `Intl.Segmenter` used here, typed locally so no particular `lib` setting is needed. */
type GraphemeSegmenter = {
  segment(text: string): {
    containing(index: number): { index: number; segment: string } | undefined;
  };
};
type GraphemeSegmenterConstructor = new (
  locales: undefined,
  options: { granularity: "grapheme" }
) => GraphemeSegmenter;

let segmenterCache: { from: unknown; segmenter: GraphemeSegmenter | undefined } | undefined;

/**
 * The runtime's grapheme segmenter (Unicode extended grapheme clusters), or undefined where
 * `Intl.Segmenter` is missing or unusable, as in some mobile engines. Looked up on each call (and
 * cached per constructor), so the fallback below can take over at any time.
 */
function graphemeSegmenter(): GraphemeSegmenter | undefined {
  const from = typeof Intl === "object" ? (Intl as { Segmenter?: unknown }).Segmenter : undefined;
  if (segmenterCache === undefined || segmenterCache.from !== from) {
    let segmenter: GraphemeSegmenter | undefined;
    try {
      segmenter =
        typeof from === "function"
          ? new (from as GraphemeSegmenterConstructor)(undefined, { granularity: "grapheme" })
          : undefined;
    } catch {
      segmenter = undefined;
    }
    segmenterCache = { from, segmenter };
  }
  return segmenterCache.segmenter;
}

/** Code points that never start a cluster: combining marks, emoji modifiers, ZWNJ and ZWJ. */
const EXTENDS = /^[\p{M}\p{Emoji_Modifier}\u{200C}\u{200D}]/u;

function isRegionalIndicatorAt(text: string, index: number): boolean {
  if (text.charCodeAt(index) !== 0xd83c) return false;
  const low = text.charCodeAt(index + 1);
  return low >= 0xdde6 && low <= 0xddff;
}

/**
 * Fallback for runtimes without `Intl.Segmenter`: true when a cut at `index` (0 < index < length)
 * would split a surrogate pair, a flag (a pair of regional indicators), a zero-width-joiner
 * sequence, or a character from its combining marks, emoji modifiers or variation selectors.
 * Only a position inside a run of flags looks back (to count the flags before it), and a cut moves
 * at most one flag to reach an even count, so finding a cut stays linear in the text.
 */
function joinsPrevious(text: string, index: number): boolean {
  const unit = text.charCodeAt(index);
  if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  if (text.charCodeAt(index - 1) === 0x200d) return true;
  if (EXTENDS.test(text.slice(index, index + 2))) return true;
  if (!isRegionalIndicatorAt(text, index)) return false;
  let before = 0;
  for (let at = index - 2; at >= 0 && isRegionalIndicatorAt(text, at); at -= 2) before += 1;
  return before % 2 === 1;
}

/** The last grapheme cluster boundary at or before `index`. */
function clusterFloor(text: string, index: number): number {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  const cluster = graphemeSegmenter()?.segment(text).containing(index);
  if (cluster) return cluster.index;
  let cut = index;
  while (cut > 0 && joinsPrevious(text, cut)) cut -= 1;
  return cut;
}

/** The first grapheme cluster boundary at or after `index`. */
function clusterCeil(text: string, index: number): number {
  if (index <= 0) return 0;
  if (index >= text.length) return text.length;
  const cluster = graphemeSegmenter()?.segment(text).containing(index);
  if (cluster) return cluster.index === index ? index : cluster.index + cluster.segment.length;
  let cut = index;
  while (cut < text.length && joinsPrevious(text, cut)) cut += 1;
  return cut;
}

function ellipsize(text: string, max: number, force: boolean): string {
  if (text.length <= max && !force) return text;
  const end = clusterFloor(text, Math.min(max - 1, text.length));
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

/*
 * The prose reader follows CommonMark's block structure (https://spec.commonmark.org/0.31.2/) one
 * line at a time, as micromark, the parser behind the web app's markdown renderer, reads it: block
 * quotes and list items with their lazy continuation lines, fenced and indented code, raw HTML
 * blocks, headings and paragraphs. It reads the raw line with tabs expanded to 4-column stops, so an
 * invisible character changes the structure exactly as it does for the renderer (a line that only
 * looks like a closing fence once invisible characters are gone does not close one); only the text
 * it shows is tidied. Each line is then reduced to plain text on its own.
 */

/**
 * Raw HTML blocks with an explicit end condition: start conditions 1-5 of
 * https://spec.commonmark.org/0.31.2/#html-blocks, in the spec's order. Each has its own end:
 * 1. `<pre`, `<script`, `<style` or `<textarea` ends at a line with any of the end tags `</pre>`,
 *    `</script>`, `</style>` or `</textarea>`, in any case. The spec says the end tag "need not
 *    match the start tag", so `<pre>` does end at `</script>`; the codec and micromark agree, and
 *    what follows is ordinary markdown again (a Tempo fence there is a real block).
 * 2. `<!--` ends at `-->`; 3. `<?` at `?>`; 4. `<!` and a letter at `>`; 5. `<![CDATA[` at `]]>`.
 * The end may sit on the start line, and is looked for only while a block of its condition is open,
 * in the line without its container prefixes. Every pattern is anchored or a fixed literal.
 */
const RAW_HTML_BLOCKS: readonly { start: RegExp; end: RegExp }[] = [
  {
    start: /^ {0,3}<(?:pre|script|style|textarea)(?:[ >]|$)/i,
    end: /<\/(?:pre|script|style|textarea)>/i,
  },
  { start: /^ {0,3}<!--/, end: /-->/ },
  { start: /^ {0,3}<\?/, end: /\?>/ },
  { start: /^ {0,3}<![A-Za-z]/, end: />/ },
  { start: /^ {0,3}<!\[CDATA\[/, end: /\]\]>/ },
];
/** The end of a block that only its containers can end (nesting too deep to follow). */
const NO_END = /(?!)/;

/** Start condition 6: a block-level tag name. The block ends at a blank line. */
const HTML_BLOCK_NAMES =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|" +
  "dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|" +
  "hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|" +
  "search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const HTML_BLOCK_6 = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_NAMES})(?: |/?>|$)`, "i");
/**
 * Start condition 7: a complete open tag or a complete closing tag, with nothing after it on the
 * line. It ends at a blank line and cannot interrupt a paragraph. The open tag follows the spec's
 * grammar (attribute names, unquoted, single- and double-quoted values); each part can match in
 * one way only, so a failed test stays linear. The spec leaves out open tags named like condition
 * 1 (`RAW_TAG_NAME`; only `<pre/>` and its like get this far), micromark does not.
 */
const HTML_BLOCK_7 =
  /^ {0,3}(?:<[A-Za-z][A-Za-z0-9-]*(?: +[A-Za-z_:][A-Za-z0-9_.:-]*(?: *= *(?:[^"'=<>`\x00-\x20]+|'[^']*'|"[^"]*"))?)* *\/?>|<\/[A-Za-z][A-Za-z0-9-]* *>) *$/;
const RAW_TAG_NAME = /^ {0,3}<(?:pre|script|style|textarea)(?![A-Za-z0-9-])/i;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,}) *$/;
const QUOTE_MARKER = /^ {0,3}> ?/;
/** A list marker (its digits in group 3) and the spaces after it, or the end of the line. */
const ITEM_MARKER = /^( {0,3})([-*+]|(\d{1,9})[.)])(?: ( *)|$)/;
const ATX_HEADING = /^ {0,3}#{1,6}(?: |$)/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+) *$/;
const BREAK_LINE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const BLANK = /^ *$/;
const LEADING_SPACES = /^ */;
/** Quotes and list items open at once; a line nested deeper is hidden with what it contains. */
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
 * A block quote, or a list item with the column its content starts at. `empty` marks an item whose
 * first line had nothing after the marker and no content since: a blank line then ends it.
 */
type Container = { kind: "quote" } | { kind: "item"; indent: number; empty: boolean };

/**
 * The open leaf block in the innermost container. `fence`, `html` (conditions 1-5) and `htmlBlock`
 * (conditions 6 and 7, which end at a blank line) are never shown.
 */
type Leaf = "none" | "paragraph" | "code" | "fence" | "html" | "htmlBlock";

/**
 * One reading of the body. Where the spec's text and micromark differ, the two readings follow
 * each, and a line is shown only when both show it (see `readLines`):
 * - micromark restricts a list item after indented code as if it interrupted a paragraph, and does
 *   not restrict one on a lazy line; the spec does the opposite;
 * - on a lazy line, micromark opens a condition-7 HTML block inside the containers the line did not
 *   continue; for the spec the line is paragraph text;
 * - micromark reads `<pre/>` (and `<script/>` and so on) as condition 7; the spec leaves them out.
 */
type ProseState = {
  micromark: boolean;
  /** Quotes and list items open before the current line, outermost first. */
  containers: Container[];
  leaf: Leaf;
  /** The marker and length of the open fence, while `leaf` is "fence". */
  fence: { marker: string; length: number };
  /** The end of the open raw HTML block, while `leaf` is "html". */
  htmlEnd: RegExp;
};

type Readers = { spec: ProseState; micromark: ProseState };

function createReader(micromark: boolean): ProseState {
  return { micromark, containers: [], leaf: "none", fence: { marker: "`", length: 3 }, htmlEnd: NO_END };
}

function createReaders(): Readers {
  return { spec: createReader(false), micromark: createReader(true) };
}

/**
 * Whether a `json tempo` fence line (at column 0, with an info string) opens a fence where the
 * reader stands. Such a line continues no quote or list item and is no lazy line, so it closes any
 * open container; at the top level it is only content of an open fence or raw HTML block.
 */
function opensFence(state: ProseState): boolean {
  return (
    state.containers.length > 0 ||
    (state.leaf !== "fence" && state.leaf !== "html" && state.leaf !== "htmlBlock")
  );
}

/** Expands tabs to 4-column stops, so tab-indented container content lines up as CommonMark reads it. */
function detab(line: string): string {
  let out = "";
  for (const char of line) {
    out += char === "\t" ? " ".repeat(4 - (out.length % 4)) : char;
  }
  return out;
}

function indentOf(text: string): number {
  return LEADING_SPACES.exec(text)![0].length;
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
    } else if (BLANK.test(rest)) {
      // A blank line keeps a list item open, unless the item has had no content at all yet.
      if (container.empty) break;
      rest = "";
    } else {
      if (indentOf(rest) < container.indent) break;
      rest = rest.slice(container.indent);
      container.empty = false;
    }
    matched += 1;
  }
  return { matched, rest };
}

/**
 * The quotes and list items that start at the front of `text`, and what follows their markers. A
 * `restricted` list item (one that interrupts a paragraph) must have content, and an ordered one
 * must start at 1.
 */
function startContainers(
  text: string,
  room: number,
  restricted: boolean
): { opened: Container[]; tail: string } {
  const opened: Container[] = [];
  let tail = text;
  let restrict = restricted;
  while (opened.length < room) {
    const quote = QUOTE_MARKER.exec(tail);
    if (quote) {
      opened.push({ kind: "quote" });
      tail = tail.slice(quote[0].length);
      restrict = false;
      continue;
    }
    const item = ITEM_MARKER.exec(tail);
    if (!item || BREAK_LINE.test(tail)) break;
    const markerEnd = item[1]!.length + item[2]!.length;
    const empty = BLANK.test(tail.slice(markerEnd));
    if (restrict && (empty || (item[3] !== undefined && Number(item[3]) !== 1))) break;
    const spaces = item[4] === undefined ? 0 : item[4].length + 1;
    // One to four spaces belong to the marker; more than that leaves the content indented as code.
    const indent = empty || spaces > 4 ? markerEnd + 1 : markerEnd + spaces;
    opened.push({ kind: "item", indent, empty });
    tail = empty ? "" : tail.slice(indent);
    restrict = false;
  }
  return { opened, tail };
}

/**
 * What a line starts in the innermost container: a leaf block, more of an open paragraph, or
 * ("lazyHtml", micromark only) a condition-7 HTML block on a lazy line, opened inside the
 * containers the line did not continue, which stay open.
 */
type Start = Leaf | "heading" | "blank" | "more" | "lazyHtml";

function leafStart(tail: string, paragraph: boolean, lazy: boolean, micromark: boolean): Start {
  if (BLANK.test(tail)) return "blank";
  // Indented code cannot interrupt a paragraph.
  if (indentOf(tail) >= 4) return paragraph ? "more" : "code";
  const fence = FENCE_OPEN.exec(tail);
  if (fence && (fence[1]![0] === "~" || !fence[2]!.includes("`"))) return "fence";
  if (RAW_HTML_BLOCKS.some((block) => block.start.test(tail))) return "html";
  if (HTML_BLOCK_6.test(tail)) return "htmlBlock";
  if (HTML_BLOCK_7.test(tail) && (micromark || !RAW_TAG_NAME.test(tail))) {
    // Condition 7 cannot interrupt a paragraph.
    if (!paragraph) return "htmlBlock";
    if (lazy && micromark) return "lazyHtml";
    return "more";
  }
  // A setext underline cannot be a lazy line; there `===` is paragraph text and `---` a break.
  if (paragraph && !lazy && SETEXT_UNDERLINE.test(tail)) return "heading";
  if (ATX_HEADING.test(tail) || BREAK_LINE.test(tail)) return "heading";
  return paragraph ? "more" : "paragraph";
}

/**
 * Reads one line (tabs expanded, line ending removed) into `state`. True when the line is shown as
 * text: paragraph, heading and indented code lines are; fenced code and raw HTML never are, at the
 * top level and in quotes and list items alike.
 */
function readLine(line: string, state: ProseState): boolean {
  const { matched, rest } = continueContainers(line, state.containers);
  const all = matched === state.containers.length;
  const current = state.leaf;

  // An open fence or HTML block takes every line its containers continue on, up to its end.
  if (all) {
    if (current === "fence") {
      const closer = FENCE_CLOSE.exec(rest);
      if (closer && closer[1]![0] === state.fence.marker && closer[1]!.length >= state.fence.length) {
        state.leaf = "none";
      }
      return false;
    }
    if (current === "html") {
      if (state.htmlEnd.test(rest)) state.leaf = "none";
      return false;
    }
    if (current === "htmlBlock") {
      if (BLANK.test(rest)) state.leaf = "none";
      return false;
    }
    if (current === "code" && (BLANK.test(rest) || indentOf(rest) >= 4)) return true;
  }

  const paragraph = current === "paragraph";
  const restricted = state.micromark
    ? all && (paragraph || current === "code")
    : paragraph;
  const { opened, tail } = startContainers(rest, MAX_CONTAINERS - matched, restricted);
  if (
    matched + opened.length >= MAX_CONTAINERS &&
    (QUOTE_MARKER.test(tail) || (ITEM_MARKER.test(tail) && !BREAK_LINE.test(tail)))
  ) {
    // Nested deeper than this reader follows: hide it, and all it holds, until its containers end.
    state.containers.length = matched;
    state.containers.push(...opened);
    state.leaf = "html";
    state.htmlEnd = NO_END;
    return false;
  }
  const start = leafStart(tail, paragraph && opened.length === 0, !all, state.micromark);
  // Paragraph text goes on, also as a lazy line where some containers did not continue: those
  // stay open. Only a paragraph has lazy lines; any other block that is not continued ends.
  if (start === "more") return true;
  if (start === "lazyHtml") {
    state.leaf = "htmlBlock";
    return false;
  }

  state.containers.length = matched;
  state.containers.push(...opened);
  switch (start) {
    case "fence": {
      const marks = FENCE_OPEN.exec(tail)![1]!;
      state.leaf = "fence";
      state.fence = { marker: marks[0]!, length: marks.length };
      return false;
    }
    case "html": {
      const end = RAW_HTML_BLOCKS.find((block) => block.start.test(tail))!.end;
      state.leaf = end.test(tail) ? "none" : "html";
      state.htmlEnd = end;
      return false;
    }
    case "htmlBlock":
      state.leaf = "htmlBlock";
      return false;
    case "blank":
      state.leaf = "none";
      return false;
    case "heading":
      state.leaf = "none";
      return true;
    default:
      state.leaf = start;
      return true;
  }
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

/** Plain text of a shown line, or "" when it is not safe to show. */
function lineText(raw: string): string {
  // Leading direction marks (common at the start of right-to-left lines) must not hide markers.
  const line = tidy(raw).replace(/^[\s\u{200E}\u{200F}\u{61C}]+/u, "").trimEnd();
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
      const piece = fits ? text : text.slice(0, clusterFloor(text, room)).trimEnd();
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
 * Reads the lines of one segment with both readings, adding to `out` (when given and not full) the
 * text of each line that both show. With `follow` set it keeps reading once nothing more is shown,
 * because the state at the end of the segment decides whether a later block is trusted and how
 * later lines are read.
 */
function readLines(
  source: string,
  readers: Readers,
  out: Collector | undefined,
  follow: boolean
): void {
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  for (
    let line = lines.exec(source);
    line !== null && line[0].length > 0;
    line = lines.exec(source)
  ) {
    const show = out !== undefined && !out.full;
    if (!show && !follow) return;
    const raw = line[0].replace(/(?:\r\n|\r|\n)$/, "");
    const structure = raw.includes("\t") ? detab(raw) : raw;
    // Both readings take every line, so neither falls behind.
    const bySpec = readLine(structure, readers.spec);
    const byMicromark = readLine(structure, readers.micromark);
    if (show && bySpec && byMicromark) out.add(lineText(raw));
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
  const readers = createReaders();
  for (const [index, segment] of segments.entries()) {
    if (out.full && index > lastBlock) break;
    const follow = index < lastBlock;
    // The codec reads every `json tempo` fence at column 0 as a block, without the structure around
    // it. Where either reading has that line inside an open fence or raw HTML block, it is literal
    // text there, so it is read as prose (and shows nothing), never as a block.
    if (
      segment.kind === "markdown" ||
      !opensFence(readers.spec) ||
      !opensFence(readers.micromark)
    ) {
      readLines(segment.source, readers, out, follow);
      continue;
    }
    if (segment.kind === "broken") omittedBlocks += 1;
    else addBlockText(segment.block, out);
    // The block's own lines, read without showing them, leave the state CommonMark has after them.
    readLines(segment.source, readers, undefined, follow || !out.full);
  }
  const searchText = out.value();
  return {
    summary: ellipsize(searchText, summaryLimit, out.full),
    searchText,
    truncated: out.full,
    omittedBlocks,
  };
}

/** Most context a snippet shows before its match; less when the limit leaves less room. */
const SNIPPET_LEAD_CHARS = 20;

/**
 * A short window of `searchText` around the first match of `query` (the start when there is none),
 * never longer than `maxChars` with its ellipses counted (0 gives an empty snippet). An ellipsis
 * marks each end where text was left out, and every cut falls between grapheme clusters.
 *
 * The match is in the snippet whenever any window of that length could hold it: from the start
 * (one closing ellipsis), to the end (one opening ellipsis), or in between when the match, widened
 * to whole clusters, is at most `maxChars - 2` long. The context before it is up to 20 characters,
 * cut down to half of whatever room the match leaves, so a short limit never pushes the match out.
 * Takes a projection, not a body, so a caller cannot window raw text by mistake.
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

  const headEnd = clusterFloor(text, max - 1);
  const head = `${text.slice(0, headEnd).trim()}\u{2026}`;

  const needle = collapse(tidy(query)).toLowerCase();
  const lowered = text.toLowerCase();
  // Lowercasing can change a string's length (and so every offset); then fall back to the start.
  const at = needle !== "" && lowered.length === text.length ? lowered.indexOf(needle) : -1;
  if (at < 0) return head;
  const from = clusterFloor(text, at);
  const to = clusterCeil(text, at + needle.length);
  if (to <= headEnd) return head;

  const tailStart = clusterCeil(text, text.length - (max - 1));
  if (from >= tailStart) return `\u{2026}${text.slice(tailStart).trim()}`;

  // In between: two ellipses (so at least 3 characters) and the match, with lead context before it.
  // `start` is before `tailStart`, so the window stops short of the end and its closing ellipsis
  // is earned; `end` is at least `to` whenever the match fits in `room`.
  const room = max - 2;
  if (room < 1) return head;
  const lead = Math.min(SNIPPET_LEAD_CHARS, Math.max(0, Math.floor((room - (to - from)) / 2)));
  const start = clusterCeil(text, from - lead);
  if (start === 0) return head;
  const middle = text.slice(start, clusterFloor(text, start + room)).trim();
  return middle === "" ? head : `\u{2026}${middle}\u{2026}`;
}
