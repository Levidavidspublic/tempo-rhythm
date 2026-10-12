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
 * - the title of every valid task block and the name of every valid template block, with any HTML
 *   in them removed the same way.
 *
 * What it never contains: Tempo envelopes or fence syntax, block ids, the content of any fenced
 * code block or HTML block (also one that ends at a blank line, such as a `<div>` line), inline
 * HTML (also where a comment or tag runs over several lines, or a quoted attribute value holds a
 * `>`), JSON-looking lines, or bidi/invisible control characters. Tags are read by CommonMark's tag
 * grammar; where the end of one cannot be told for sure, the rest of its paragraph is left out.
 * Blocks that fail validation are left out whole, so there is no raw-payload fallback. A body the
 * codec refuses as too large is left out whole too (its prose cannot be located without a second
 * parser).
 *
 * Block recognition is the shared codec (`parseTempoBlocks`); this module has no parser or schema
 * of its own. Its prose filter only decides what plain text to show for the markdown the codec did
 * not claim: it keeps fenced code and raw HTML (also inside quotes and list items) out of the text.
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

/** A regional indicator (U+1F1E6-U+1F1FF) starts at `index`; two of them make one flag. */
function isRegionalIndicator(text: string, index: number): boolean {
  if (text.charCodeAt(index) !== 0xd83c) return false;
  const low = text.charCodeAt(index + 1);
  return low >= 0xdde6 && low <= 0xddff;
}

function attachesToPrevious(text: string, index: number): boolean {
  const unit = text.charCodeAt(index);
  if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  if (text.charCodeAt(index - 1) === 0x200d) return true;
  if (isRegionalIndicator(text, index)) {
    // Flags pair up from the start of a run, so after an odd number of indicators this one is the
    // second half of a flag. The count only walks back over the run itself.
    let before = 0;
    while (isRegionalIndicator(text, index - 2 * (before + 1))) before += 1;
    return before % 2 === 1;
  }
  return ATTACHES.test(text.slice(index, index + 2));
}

/** The largest cut position at or below `end` that keeps every character cluster whole. */
function safeEnd(text: string, end: number): number {
  let cut = Math.min(end, text.length);
  while (cut > 0 && cut < text.length && attachesToPrevious(text, cut)) cut -= 1;
  return cut;
}

/**
 * The smallest start position at or above `start` that does not split a character cluster. It moves
 * forward, toward the match a snippet is built around, never back past the context it was given.
 */
function safeStart(text: string, start: number): number {
  let cut = Math.max(0, start);
  while (cut > 0 && cut < text.length && attachesToPrevious(text, cut)) cut += 1;
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
 * shown here either. Every pattern is anchored or a fixed literal. Condition 1 ends at any of its
 * four end tags, not only the one it opened with: CommonMark says so ("it need not match the start
 * tag"), and the codec ends it the same way, so both read what follows as markdown.
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
/** Inline HTML that ends at a marker of its own: comment, processing instruction, CDATA, declaration. */
const INLINE_DELIMITED = /<(?:!--|\?|!\[CDATA\[|![A-Za-z])/y;
const LINK_OR_IMAGE = /!?\[([^[\]]{0,300})\]\([^)]{0,2000}\)/g;
const EMPHASIS_PAIR = /(^|[^\p{L}\p{N}_])([*_]{1,2})(\S(?:[^*_]{0,200}\S)?)\2(?![\p{L}\p{N}_])/gu;

/**
 * CommonMark HTML blocks that end at a blank line (start conditions 6 and 7). The codec does not
 * model them, so a fence inside one can look like a Tempo block to it; see `projectPageText`.
 * Condition 6 is a block-level tag name; condition 7 is any other complete tag alone on its line
 * (see `startsTagBlock`), and cannot interrupt a paragraph.
 */
const HTML_BLOCK_NAMES =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|" +
  "dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|" +
  "hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|" +
  "search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
const HTML_BLOCK_6 = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_NAMES})(?:[ \\t]|/?>|$)`, "i");
/** A "<" and a tag name (or "</" and one) at the start of a line, up to three spaces in. */
const TAG_LINE = /^ {0,3}<\/?[A-Za-z]/;
const TRAILING_SPACE = /^[ \t]*$/;
/** A line that certainly continues or starts a paragraph (under-reading only gates more). */
const PLAIN_TEXT = /^ {0,3}[\p{L}\p{N}]/u;

// ---------------------------------------------------------------------------------------------
// HTML tags
// ---------------------------------------------------------------------------------------------

const QUOTE = 0x22;
const APOSTROPHE = 0x27;
const SLASH = 0x2f;
const LESS_THAN = 0x3c;
const EQUALS = 0x3d;
const GREATER_THAN = 0x3e;
const BACKTICK = 0x60;
const LINE_FEED = 0x0a;

/**
 * Where a scan of one HTML tag is, in CommonMark's tag grammar (0.31.2, "Raw HTML"): a tag name,
 * then attributes, each a name with an optional `=` and an unquoted, single-quoted or
 * double-quoted value, each after whitespace, then an optional `/` and the closing `>`. A closing
 * tag is a name and optional whitespace. A quoted value may hold `>` and run over lines, so the `>`
 * that ends a tag is found only by following this grammar, never by searching for the next `>`.
 */
type TagState =
  | "name"
  | "space"
  | "attr"
  | "attrSpace"
  | "value"
  | "unquoted"
  | "unquotedSlash"
  | "quoted"
  | "quotedEnd"
  | "slash"
  | "closeName"
  | "closeSpace";

type TagScan = {
  state: TagState;
  /** The quote mark of the quoted value the scan is in. */
  quote: number;
  closing: boolean;
  /**
   * Reading for HTML block start condition 7, which also takes what micromark's block scanner takes
   * beyond the spec (a value right after an unquoted one), so that no block is missed.
   */
  block: boolean;
  /** A "<" was read in a quoted value. Where the tag is not read as one, a tag may start there. */
  innerLt: boolean;
  /**
   * What the scan read may not be exactly what CommonMark reads: a later line (whose prefix this
   * module strips, or which may start a new block), a line with hidden characters, or a "/" in an
   * unquoted value, which the spec keeps in the value and micromark reads as the end of the tag.
   */
  uncertain: boolean;
  /** After "end": the index just past the closing `>`. After "fail": the index it failed at. */
  at: number;
};

/** "end" when the tag ends at this character, "fail" when it is not a tag, undefined to read on. */
type TagStep = "end" | "fail" | undefined;

function isAsciiLetter(code: number): boolean {
  const lower = code | 0x20;
  return lower >= 0x61 && lower <= 0x7a;
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

/** Spaces, tabs and line endings: the whitespace of the tag grammar. */
function isTagSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === LINE_FEED || code === 0x0d;
}

function isTagNameChar(code: number): boolean {
  return isAsciiLetter(code) || isDigit(code) || code === 0x2d;
}

function isAttrStart(code: number): boolean {
  return isAsciiLetter(code) || code === 0x5f || code === 0x3a;
}

function isAttrChar(code: number): boolean {
  return isAttrStart(code) || isDigit(code) || code === 0x2e || code === 0x2d;
}

/** The scan of a tag that starts at `at` (a "<"), and where it reads on; undefined when none starts there. */
function tagAt(
  text: string,
  at: number,
  block: boolean,
  uncertain: boolean
): { scan: TagScan; from: number } | undefined {
  const closing = text.charCodeAt(at + 1) === SLASH;
  const first = at + (closing ? 2 : 1);
  if (!isAsciiLetter(text.charCodeAt(first))) return undefined;
  const state = closing ? "closeName" : "name";
  return {
    scan: { state, quote: 0, closing, block, innerLt: false, uncertain, at: 0 },
    from: first + 1,
  };
}

function stepTag(scan: TagScan, code: number): TagStep {
  const { state } = scan;
  switch (state) {
    case "quoted":
      if (code === scan.quote) scan.state = "quotedEnd";
      else if (code === LESS_THAN) scan.innerLt = true;
      return undefined;
    case "closeName":
    case "closeSpace":
      if (state === "closeName" && isTagNameChar(code)) return undefined;
      if (isTagSpace(code)) {
        scan.state = "closeSpace";
        return undefined;
      }
      return code === GREATER_THAN ? "end" : "fail";
    case "slash":
      return code === GREATER_THAN ? "end" : "fail";
    case "value":
      if (isTagSpace(code)) return undefined;
      if (code === QUOTE || code === APOSTROPHE) {
        scan.quote = code;
        scan.state = "quoted";
        return undefined;
      }
      if (code === LESS_THAN || code === EQUALS || code === GREATER_THAN || code === BACKTICK) {
        return "fail";
      }
      scan.state = "unquoted";
      return undefined;
    case "unquotedSlash":
    case "unquoted":
      if (state === "unquotedSlash") {
        if (code === GREATER_THAN) return "end";
        scan.uncertain = true;
      }
      if (isTagSpace(code)) {
        scan.state = scan.block ? "attrSpace" : "space";
        return undefined;
      }
      if (code === GREATER_THAN) return "end";
      if (code === SLASH) {
        scan.state = scan.block ? "unquoted" : "unquotedSlash";
        return undefined;
      }
      if (code === EQUALS && scan.block) {
        scan.state = "value";
        return undefined;
      }
      if (
        code === QUOTE ||
        code === APOSTROPHE ||
        code === LESS_THAN ||
        code === EQUALS ||
        code === BACKTICK
      ) {
        return "fail";
      }
      scan.state = "unquoted";
      return undefined;
    default: {
      // "name", "space", "attr", "attrSpace" and "quotedEnd".
      if (state === "name" && isTagNameChar(code)) return undefined;
      if (state === "attr" && isAttrChar(code)) return undefined;
      const afterName = state === "attr" || state === "attrSpace";
      if (isTagSpace(code)) {
        scan.state = afterName ? "attrSpace" : "space";
        return undefined;
      }
      if (code === EQUALS && afterName) {
        scan.state = "value";
        return undefined;
      }
      // An attribute starts only after whitespace.
      if (isAttrStart(code) && (state === "space" || state === "attrSpace")) {
        scan.state = "attr";
        return undefined;
      }
      if (code === SLASH) {
        scan.state = "slash";
        return undefined;
      }
      return code === GREATER_THAN ? "end" : "fail";
    }
  }
}

/** Reads `text` from `from` into `scan`: "end" or "fail" (`scan.at` says where), undefined at the end of `text`. */
function scanTag(scan: TagScan, text: string, from: number): TagStep {
  for (let index = from; index < text.length; index += 1) {
    const step = stepTag(scan, text.charCodeAt(index));
    if (step !== undefined) {
      scan.at = step === "end" ? index + 1 : index;
      return step;
    }
  }
  return undefined;
}

/**
 * HTML block start condition 7: a complete open or closing tag alone on its line. The tag is read by
 * the tag grammar, so a quoted value may hold `>`. No tag name is excluded: "<pre>" and the like
 * start condition 1, which is matched first, and micromark starts condition 7 at "</pre>" or
 * "<pre/>". On a line with hidden characters (CommonMark reads them, this module does not) any tag
 * start counts: reading too much as an HTML block only hides more. Linear in the line length.
 */
function startsTagBlock(rest: string, exact: boolean): boolean {
  const start = TAG_LINE.exec(rest);
  if (!start) return false;
  if (!exact) return true;
  const tag = tagAt(rest, start[0].indexOf("<"), true, false);
  return (
    tag !== undefined &&
    scanTag(tag.scan, rest, tag.from) === "end" &&
    TRAILING_SPACE.test(rest.slice(tag.scan.at))
  );
}

// ---------------------------------------------------------------------------------------------
// Prose lines
// ---------------------------------------------------------------------------------------------

/** A quote or a list item whose content a fence may sit in. `indent` is the item's content offset. */
type Container = { kind: "quote" } | { kind: "item"; indent: number };

/**
 * Inline HTML left open at the end of a line, which hides the lines after it up to its end:
 * - "marker": a comment, processing instruction, CDATA section or declaration, up to its end marker;
 * - "tag": a tag, up to where the tag grammar ends it (`scan` reads on from the next line);
 * - "untilGt": a closing tag that turned out not to be one, up to the next `>` (not past a `<`);
 * - "paragraph": HTML whose end cannot be told for sure, up to the end of the paragraph.
 */
type InlineOpen =
  | { kind: "marker"; end: string }
  | { kind: "tag"; scan: TagScan }
  | { kind: "untilGt" }
  | { kind: "paragraph" };

type InlineState = { inline?: InlineOpen };

type ProseState = InlineState & {
  /** Quotes and list items open before the current line, outermost first. */
  containers: Container[];
  /** The open fenced code block, which lasts only while the containers it opened in continue. */
  fence?: { marker: string; length: number };
  /** End marker of the open raw HTML block (conditions 1-5); it too lasts only while its containers do. */
  htmlEnd?: RegExp;
  /** Container depth of an open HTML block that ends at a blank line (condition 6 or 7). */
  htmlBlock?: number;
  /** The previous line was paragraph text, which condition 7 cannot interrupt. */
  afterText: boolean;
};

function createProseState(): ProseState {
  return { containers: [], afterText: false };
}

/**
 * A new segment starts at the top level: only an open top-level HTML block carries over. A block's
 * fence interrupts a paragraph, so inline HTML left open before it ends there too.
 */
function startSegment(state: ProseState): void {
  state.containers.length = 0;
  state.fence = undefined;
  state.htmlEnd = undefined;
  state.inline = undefined;
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

function startsHtmlBlock(rest: string, afterText: boolean, exact: boolean): boolean {
  return HTML_BLOCK_6.test(rest) || (!afterText && startsTagBlock(rest, exact));
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

function inlineEndOf(opener: string): string {
  if (opener === "<!--") return "-->";
  if (opener === "<?") return "?>";
  if (opener === "<![CDATA[") return "]]>";
  return ">";
}

/**
 * An odd run of backslashes right before `at`, counted back to `from` (the start of the text not
 * hidden yet). Each run is counted only by the "<" right after it, so the work stays linear.
 */
function isEscaped(text: string, at: number, from: number): boolean {
  let index = at;
  while (index > from && text.charCodeAt(index - 1) === 0x5c) index -= 1;
  return (at - index) % 2 === 1;
}

const UNTIL_GT: InlineOpen = { kind: "untilGt" };
const TO_PARAGRAPH_END: InlineOpen = { kind: "paragraph" };

/**
 * Hides text from `from` up to and including the next `>`, and returns the index after it. A `<`
 * before any `>` stops the hiding there instead, as a tag may start at it. With neither on the
 * line, the lines after it stay hidden too.
 */
function untilGt(text: string, from: number, open: InlineState): number | undefined {
  for (let index = from; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === GREATER_THAN) return index + 1;
    if (code === LESS_THAN) return index;
  }
  open.inline = UNTIL_GT;
  return undefined;
}

/**
 * Where text shows again after a tag scan stopped (`step` undefined: at the end of the line), or
 * undefined when the rest of the line is hidden; `open.inline` then says up to where. Only a tag
 * that certainly ends is followed by text:
 * - A tag with a "<" in a quoted value hides the rest of the paragraph. Wherever CommonMark does not
 *   read that tag as one (a code span or link around its start, or a line read differently), a tag
 *   of its own may start at that "<" and run past the `>` found here.
 * - An open tag that fails on uncertain text hides the rest of the paragraph: CommonMark may still
 *   be in a quoted value there. A closing tag has no quotes, so it hides only up to the next `>`.
 * The caller handles a tag that fails on certain text: there the "<" is plain text, as in CommonMark.
 */
function tagEnd(scan: TagScan, step: TagStep, text: string, open: InlineState): number | undefined {
  if (step === undefined) {
    open.inline = { kind: "tag", scan };
    return undefined;
  }
  if (!scan.innerLt) {
    if (step === "end") return scan.at;
    if (scan.closing) return untilGt(text, scan.at, open);
  }
  open.inline = TO_PARAGRAPH_END;
  return undefined;
}

/**
 * Removes inline HTML from one line. Inline HTML can run over several lines of a paragraph, so a
 * comment, processing instruction, CDATA section, declaration or tag still open where the line ends
 * hides the rest of the line, and `open.inline` hides the lines after it up to its end. A tag ends
 * only where the tag grammar ends it, so a `>` in a quoted attribute value does not end it.
 *
 * With `exact` false (the line had hidden characters, which can fake a marker) no end marker of a
 * delimited construct is trusted. With `certain` false (the text is not exactly what CommonMark
 * reads) a tag that fails to parse is not trusted to be plain text, nor a backslash to escape the
 * `<` after it. Every character is read a bounded number of times, so the work is linear.
 */
function stripInlineHtml(
  text: string,
  open: InlineState,
  exact: boolean,
  certain: boolean
): string {
  let kept = "";
  let from = 0;
  for (let at = text.indexOf("<"); at !== -1; at = text.indexOf("<", at)) {
    // A backslash-escaped "<" is plain text in CommonMark, so nothing starts there. A hidden
    // character removed from uncertain text may have stood between the two, so there it may be
    // either: hide the rest of the paragraph.
    if (isEscaped(text, at, from)) {
      if (!certain) {
        open.inline = TO_PARAGRAPH_END;
        return `${kept}${text.slice(from, at)} `;
      }
      at += 1;
      continue;
    }
    INLINE_DELIMITED.lastIndex = at;
    const opener = INLINE_DELIMITED.exec(text);
    if (opener) {
      const end = inlineEndOf(opener[0]);
      const close = exact ? text.indexOf(end, at + 2) : -1;
      kept += `${text.slice(from, at)} `;
      if (close === -1) {
        open.inline = { kind: "marker", end };
        return kept;
      }
      from = close + end.length;
      at = from;
      continue;
    }
    const tag = tagAt(text, at, false, !certain);
    const step = tag && scanTag(tag.scan, text, tag.from);
    // A "<" that starts no tag, or a tag that fails on certain text with no "<" in it, is plain text.
    if (!tag || (step === "fail" && !tag.scan.innerLt && !tag.scan.uncertain)) {
      at += 1;
      continue;
    }
    kept += `${text.slice(from, at)} `;
    const resume = tagEnd(tag.scan, step, text, open);
    if (resume === undefined) return kept;
    from = resume;
    at = resume;
  }
  return `${kept}${text.slice(from)}`;
}

/**
 * The rest of a line that starts inside inline HTML, from where that HTML ends, or undefined when
 * it does not end on this line. To a tag, the line ending before this line is whitespace.
 */
function resumeInline(text: string, open: InlineState, exact: boolean): string | undefined {
  const inline = open.inline;
  open.inline = undefined;
  let resume: number | undefined;
  switch (inline?.kind) {
    case undefined:
      return text;
    case "marker": {
      const close = exact ? text.indexOf(inline.end) : -1;
      const lt = text.indexOf("<");
      // This line may start a new block (a quote, a list item), which ends the paragraph and the
      // construct with it; a tag may then start at a "<" here and run past this end marker.
      if (lt !== -1 && (close === -1 || lt < close)) open.inline = TO_PARAGRAPH_END;
      else if (close === -1) open.inline = inline;
      else resume = close + inline.end.length;
      break;
    }
    case "untilGt":
      resume = untilGt(text, 0, open);
      break;
    case "tag": {
      const { scan } = inline;
      // This module strips the prefix of a line (list markers, direction marks), and a line may also
      // start a new block, so what the scan reads from here on may differ from what CommonMark reads.
      scan.uncertain = true;
      let step = stepTag(scan, LINE_FEED);
      if (step === undefined) step = scanTag(scan, text, 0);
      else scan.at = 0;
      resume = tagEnd(scan, step, text, open);
      break;
    }
    case "paragraph":
      open.inline = inline;
      break;
  }
  return resume === undefined ? undefined : text.slice(resume);
}

function stripMarkdownInline(text: string): string {
  return text
    .replace(LINK_OR_IMAGE, "$1")
    .replace(/\*\*|~~|`+/g, "")
    .replace(EMPHASIS_PAIR, "$1$3");
}

/**
 * Plain text of one markdown line, or "" when the line is not shown. Tracks fenced code and raw HTML
 * (also in quotes and list items) and, for the codec gate, HTML blocks that end at a blank line.
 * With `emit` false it only follows the state and skips the text work.
 */
function proseLine(rawLine: string, state: ProseState, emit: boolean): string {
  const raw = rawLine.replace(/(?:\r\n|\r|\n)$/, "");
  const content = tidy(raw);
  const expanded = raw.includes("\t") ? detab(raw) : raw;
  const cleaned = expanded === raw ? content : tidy(expanded);
  // CommonMark reads a line with its hidden characters, and to it they are text: a line that has
  // any is not blank, not a closing fence, and holds no end marker they split. So such a line never
  // ends a fence or an HTML block here either; when in doubt, keep hiding.
  const exact = cleaned === expanded;

  // Quotes and list items decide where a fence or raw HTML block starts and ends: it lives only as
  // long as every container it opened in keeps continuing, and its lines are read without their
  // prefixes.
  const { matched, rest: continued } = continueContainers(cleaned, state.containers);
  if (matched < state.containers.length) {
    state.containers.length = matched;
    state.fence = undefined;
    state.htmlEnd = undefined;
    // micromark lets condition 7 start on such a lazy line, even after paragraph text.
    state.afterText = false;
  }
  const blank = exact && /^ *$/.test(continued);
  // A blank line ends the paragraph, and with it any inline HTML left open in it.
  if (blank) state.inline = undefined;
  // A blank line ends an HTML block of condition 6 or 7 even where it falls inside a comment.
  if (state.htmlBlock !== undefined && (state.htmlBlock > matched || blank)) {
    state.htmlBlock = undefined;
  }

  if (state.htmlEnd) {
    state.afterText = false;
    if (exact && state.htmlEnd.test(continued)) state.htmlEnd = undefined;
    return "";
  }

  if (state.fence) {
    const closer = fenceOf(continued, content, state.containers.length);
    const { marker, length } = state.fence;
    if (
      exact &&
      closer &&
      closer[2]![0] === marker &&
      closer[2]!.length >= length &&
      closer[3]!.trim() === ""
    ) {
      state.fence = undefined;
    }
    state.afterText = false;
    return "";
  }

  const depth = state.containers.length;
  // An open HTML block takes its lines as they are: a ">" or "-" in it opens no quote or list item
  // (one would make a line like "> " look blank and end the block too early).
  const rest =
    state.htmlBlock === undefined ? openContainers(continued, state.containers) : continued;
  // A new quote or list item starts a new block, which no paragraph runs on into, so condition 7
  // may start in it.
  if (state.containers.length > depth) state.afterText = false;
  const fence = fenceOf(rest, content, state.containers.length);
  if (fence && (fence[2]![0] === "~" || !fence[3]!.includes("`"))) {
    state.fence = { marker: fence[2]![0]!, length: fence[2]!.length };
    state.afterText = false;
    return "";
  }
  const html = RAW_HTML_BLOCKS.find((block) => block.start.test(rest));
  if (html) {
    state.afterText = false;
    if (!(exact && html.end.test(rest))) state.htmlEnd = html.end;
    return "";
  }
  if (state.htmlBlock === undefined && startsHtmlBlock(rest, state.afterText, exact)) {
    state.htmlBlock = state.containers.length;
  }
  // Every line of an HTML block that ends at a blank line (condition 6 or 7), its first line
  // included, is literal HTML, not text. Fences and raw HTML in it were still followed above, so
  // anything they open keeps hiding past the blank line: reading too much as HTML only hides more.
  if (state.htmlBlock !== undefined) {
    state.afterText = false;
    return "";
  }
  state.afterText = PLAIN_TEXT.test(rest);
  if (!emit) return "";

  // Leading direction marks (common at the start of right-to-left lines) must not hide markers.
  let line = content.replace(/^[\s\u{200E}\u{200F}\u{61C}]+/u, "").trimEnd();
  if (line === "") return "";
  let text = stripBlockMarkers(line);
  if (state.inline) {
    // The line starts inside inline HTML: only what follows its end can be shown, and only that
    // part is checked below.
    const after = resumeInline(text, state, exact);
    if (after === undefined) return "";
    text = after.trimStart();
    line = text;
  }
  // Inline HTML is followed on every line that gets here, also on lines dropped below, because
  // what it leaves open hides the lines after it.
  const withoutHtml = stripInlineHtml(text, state, exact, exact);
  if (THEMATIC_BREAK.test(line) || LINK_DEFINITION.test(line)) return "";
  if (FENCE_SYNTAX.test(line.replace(ALL_FORMAT, ""))) return "";
  if (text === "" || TABLE_RULE.test(text) || looksLikeJson(line) || looksLikeJson(text)) return "";

  const plain = collapse(stripMarkdownInline(withoutHtml));
  return plain === "" || isUnsafe(plain) ? "" : plain;
}

/**
 * Plain text of a block field such as a task title, or "" when it is not safe to show. A field is
 * schema-checked text, not markup, so the HTML in it is removed the same way as in prose, and HTML
 * it leaves open hides the rest of the field. Removed hidden characters could fake an end marker,
 * so then none is trusted (tidy keeps the length when it only turns controls into spaces). Once
 * tidy changed anything, a tag that fails to parse is not trusted to be plain text either.
 */
function fieldText(value: string): string {
  const tidied = tidy(value);
  const exact = tidied.length === value.length;
  const plain = collapse(stripInlineHtml(tidied, {}, exact, tidied === value));
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
  // Up to 20 characters before the match, fewer when the window between two ellipses would then
  // have no room left for the match itself.
  const lead = Math.min(20, Math.max(0, Math.floor((max - 2 - needle.length) / 2)));
  // A window cut at both ends needs room for two ellipses and a character between them.
  const start = at > lead && max >= 3 ? safeStart(text, at - lead) : 0;

  let budget = max - (start > 0 ? 1 : 0);
  if (start + budget < text.length) budget -= 1;
  const end = safeEnd(text, start + Math.max(0, budget));
  return `${start > 0 ? "\u{2026}" : ""}${text.slice(start, end).trim()}${end < text.length ? "\u{2026}" : ""}`;
}
