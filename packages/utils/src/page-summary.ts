import { parseTempoBlocks, type TempoBlock } from "./blocks";

/**
 * Safe public text projection for page bodies.
 *
 * A page body is markdown that may carry Tempo blocks (`json tempo` fences holding JSON
 * envelopes with internal block ids). Anything that shows a preview of a body, or matches a search
 * query against one, must read this projection and never slice `body` itself.
 *
 * What the projection contains:
 * - the prose of the body, reduced to plain text (markdown markers, link destinations and titles,
 *   link reference definitions and HTML tags removed);
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
 * of its own for Tempo blocks. Its prose filter only decides what plain text to show: it follows
 * the markdown block structure (quotes, list items, paragraphs, fenced code, raw HTML and HTML
 * blocks) the way micromark, the CommonMark parser the app renders with, reads it, so that fenced
 * code and HTML stay out of the text. Reading more of a body as code or HTML than micromark does
 * is no safer than reading less: it hides the fences and HTML that start inside it. So where a line
 * is read differently by the spec and by micromark (condition 7 on a lazy line, for one),
 * micromark is followed. Content nested deeper than the containers followed here is left out, up
 * to the next blank line. Where reading exactly would be costly (a definition whose label runs
 * over lines), the projection hides instead. The text of a line is what the block parser left of
 * it, so no container prefix it read can hide JSON-looking text from the checks below.
 *
 * The codec does not model CommonMark HTML blocks that end at a blank line (types 6 and 7, such as
 * a `<div>` line), nor every way a fence ends, so it can accept a Tempo-looking fence that is
 * really literal HTML, or that CommonMark ends at another line. The projection reads the whole body
 * once, the codec's segments included, and counts a block only where that reading agrees it is a
 * fence of its own from its first line to its last; anywhere else its lines are the prose they are.
 * That gap in the codec is a follow-up for the codec's owner; nothing here replaces the codec.
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
 * A code point that must stay attached to the one before it: marks and other extenders (GB9),
 * spacing marks (GB9a, with Thai and Lao SARA AM), emoji modifiers, ZWNJ and ZWJ.
 */
const ATTACHES =
  /^(?:[\p{M}\p{Grapheme_Extend}\p{Emoji_Modifier}\u{0E33}\u{0EB3}]|\u{200C}|\u{200D})/u;
/** Characters that attach to the one after them (GB9b, Grapheme_Cluster_Break=Prepend). */
const PREPEND =
  /^[\u{600}-\u{605}\u{6DD}\u{70F}\u{890}\u{891}\u{8E2}\u{D4E}\u{110BD}\u{110CD}\u{111C2}\u{111C3}\u{1193F}\u{11941}\u{11A3A}\u{11A84}-\u{11A89}\u{11D46}\u{11F02}\u{113D1}]$/u;

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

/** Consonants that Unicode's conjunct rule (GB9c, InCB=Consonant) joins after a virama. */
const CONJUNCT_CONSONANT =
  /[\u0915-\u0939\u0958-\u095F\u0978-\u097F\u0995-\u09B9\u09DC-\u09DF\u09F0\u09F1\u0A95-\u0AB9\u0AF9\u0B15-\u0B39\u0B5C-\u0B5F\u0B71\u0C15-\u0C39\u0C58-\u0C5A\u0D15-\u0D3A]/;
/** The viramas that link them (InCB=Linker). */
const CONJUNCT_LINKER = /[\u094D\u09CD\u0ACD\u0B4D\u0C4D\u0D4D]/;
const CLUSTER_EXTEND = /[\p{Mn}\p{Me}\u{200D}]/u;

/**
 * A consonant at `index` that follows a consonant, a virama and any other marks (`क्ष`) is part of
 * the same cluster. Only the marks right before it are walked, so a cut stays linear.
 */
function joinsConjunct(text: string, index: number): boolean {
  if (!CONJUNCT_CONSONANT.test(text.charAt(index))) return false;
  let linked = false;
  let at = index - 1;
  while (at >= 0 && CLUSTER_EXTEND.test(text.charAt(at))) {
    if (CONJUNCT_LINKER.test(text.charAt(at))) linked = true;
    at -= 1;
  }
  return linked && at >= 0 && CONJUNCT_CONSONANT.test(text.charAt(at));
}

type Jamo = "L" | "V" | "T" | "LV" | "LVT" | undefined;

/** The Hangul syllable type of a UTF-16 unit (all jamo and syllables are in the BMP). */
function jamo(unit: number): Jamo {
  if ((unit >= 0x1100 && unit <= 0x115f) || (unit >= 0xa960 && unit <= 0xa97c)) return "L";
  if ((unit >= 0x1160 && unit <= 0x11a7) || (unit >= 0xd7b0 && unit <= 0xd7c6)) return "V";
  if ((unit >= 0x11a8 && unit <= 0x11ff) || (unit >= 0xd7cb && unit <= 0xd7fb)) return "T";
  if (unit >= 0xac00 && unit <= 0xd7a3) return (unit - 0xac00) % 28 === 0 ? "LV" : "LVT";
  return undefined;
}

/** Hangul jamo that make one syllable, as in decomposed text (GB6, GB7, GB8). */
function joinsHangul(before: Jamo, at: Jamo): boolean {
  if (before === "L") return at !== undefined && at !== "T";
  if (before === "LV" || before === "V") return at === "V" || at === "T";
  if (before === "LVT" || before === "T") return at === "T";
  return false;
}

/** The code point that ends right before `index`. */
function previousCodePoint(text: string, index: number): string {
  const low = text.charCodeAt(index - 1);
  const pair = low >= 0xdc00 && low <= 0xdfff && index >= 2;
  return String.fromCodePoint(text.codePointAt(pair ? index - 2 : index - 1) ?? 0);
}

/**
 * Whether a cut at `index` would split a character cluster. Each no-break rule of Unicode's
 * grapheme clusters (UAX #29) is followed; where one is followed loosely it joins more, never less.
 */
function attachesToPrevious(text: string, index: number): boolean {
  const unit = text.charCodeAt(index);
  if (unit >= 0xdc00 && unit <= 0xdfff) return true;
  if (text.charCodeAt(index - 1) === 0x200d) return true;
  if (joinsHangul(jamo(text.charCodeAt(index - 1)), jamo(unit))) return true;
  if (PREPEND.test(previousCodePoint(text, index)) && !/[\p{Cc}\u{2028}\u{2029}]/u.test(text.charAt(index))) {
    return true;
  }
  if (isRegionalIndicator(text, index)) {
    // Flags pair up from the start of a run, so after an odd number of indicators this one is the
    // second half of a flag. The count only walks back over the run itself.
    let before = 0;
    while (isRegionalIndicator(text, index - 2 * (before + 1))) before += 1;
    return before % 2 === 1;
  }
  return ATTACHES.test(text.slice(index, index + 2)) || joinsConjunct(text, index);
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
/** Quotes and list items open at once. Deeper nesting is not followed, so it is hidden. */
const MAX_CONTAINERS = 16;
const THEMATIC_BREAK = /^([-*_=])(?: *\1){2,}$/;
// The first class excludes "-" so the one required "-" can match in only one place (no backtracking).
const TABLE_RULE = /^[ :|]*-[ :|-]*$/;
const LINK_DEFINITION = /^\[[^\]]{1,200}\]: *<?\S+(?: +["'(].{0,200})?$/;
/** One heading, quote or list marker and the whitespace after it, read from `lastIndex`. */
const BLOCK_MARKER = /(?:#{1,6} +|> ?|[-*+] +|\d{1,9}[.)] +)\s*/y;
const CHECKBOX = /^\[[ xX]\] +/;
/** Inline HTML that ends at a marker of its own: comment, processing instruction, CDATA, declaration. */
const INLINE_DELIMITED = /<(?:!--|\?|!\[CDATA\[|![A-Za-z])/y;
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
/** Lines that end a paragraph or never start one (CommonMark ATX headings and thematic breaks). */
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/;

/**
 * A thematic break: up to three spaces, then three or more of one of `-`, `*` and `_`, with only
 * spaces and tabs between and after them. A plain scan: the same test as a regex needs a
 * backreference, which is slow on a long line.
 */
function isThematicLine(line: string): boolean {
  let at = 0;
  while (at < 3 && line.charCodeAt(at) === 0x20) at += 1;
  const marker = line.charAt(at);
  if (marker !== "-" && marker !== "*" && marker !== "_") return false;
  let count = 0;
  for (; at < line.length; at += 1) {
    const char = line.charAt(at);
    if (char === marker) count += 1;
    else if (char !== " " && char !== "\t") return false;
  }
  return count >= 3;
}
/** Turns the open paragraph into a heading, and so ends it. */
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;

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
   * Reading for HTML block start condition 7 as micromark's block scanner does: it takes a value
   * right after an unquoted one, and ends an unquoted value at "/", which then must close the tag.
   */
  block: boolean;
  /** A "<" was read in a quoted value. Where the tag is not read as one, a tag may start there. */
  innerLt: boolean;
  /** A "](" was read in the tag, where CommonMark may read a link destination instead. */
  innerLink: boolean;
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
    scan: { state, quote: 0, closing, block, innerLt: false, innerLink: false, uncertain, at: 0 },
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
        scan.state = scan.block ? "slash" : "unquotedSlash";
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
 * HTML block start condition 7: a complete open or closing tag alone on its line, read exactly as
 * micromark (the parser the app renders with) reads it, so a quoted value may hold `>`. No tag
 * name is excluded: "<pre>" and the like start condition 1, which is matched first, and micromark
 * starts condition 7 at "</pre>" or "<pre/>". Exact both ways on purpose: reading a line as an HTML
 * block that is not one would hide the fences and raw HTML that start in it. Linear in the line.
 */
function startsTagBlock(rest: string): boolean {
  const start = TAG_LINE.exec(rest);
  if (!start) return false;
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

/**
 * A quote or a list item whose content a fence may sit in. `indent` is the item's content offset.
 * An item whose first line is empty (`blankStart`) ends at the first line after a blank line that
 * follows it (`blankAfter`): a list item can begin with at most one blank line.
 */
type Container =
  | { kind: "quote" }
  | { kind: "item"; indent: number; blankStart: boolean; blankAfter: boolean };

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

type InlineState = {
  inline?: InlineOpen;
  /**
   * Text earlier in the paragraph had a backtick or a "](": a code span or a link may cover what
   * follows, and inside one CommonMark opens no HTML. Then an inline construct opened here may not
   * be one to CommonMark, which reads its inside as markdown instead.
   */
  skew?: boolean;
};

type ProseState = InlineState & {
  /** Quotes and list items open before the current line, outermost first. */
  containers: Container[];
  /** The open fenced code block, which lasts only while the containers it opened in continue. */
  fence?: { marker: string; length: number };
  /** End marker of the open raw HTML block (conditions 1-5); it too lasts only while its containers do. */
  htmlEnd?: RegExp;
  /** Container depth of an open HTML block that ends at a blank line (condition 6 or 7). */
  htmlBlock?: number;
  /**
   * Container depth of the open paragraph (micromark's "content", definitions included), which
   * condition 7 cannot interrupt (except on a lazy line) and an empty or non-1 list item cannot.
   */
  paragraph?: number;
  /**
   * An indented code block is open: a paragraph does not start on its indented lines. "lazy" when it
   * started on a line that did not continue every container: micromark reads that line in a flow of
   * its own, so unlike other indented code it does not keep a list item from starting next.
   */
  indentedCode?: boolean | "lazy";
  /** A link reference definition that goes on on the next line. */
  definition?: DefinitionScan;
  /**
   * Set while lines nest deeper than MAX_CONTAINERS: what is in there (a fence, an HTML block) is
   * not followed, so every line that still continues all the open containers is hidden. True when
   * the last such line was not blank, so the next line may continue its paragraph lazily.
   */
  tooDeep?: boolean;
  /**
   * Text nested too deep has ended without a blank line. CommonMark may go on with that paragraph
   * lazily on any line that starts no block of its own, even one that looks like a quote here, so
   * every line is hidden up to the next blank line, which alone surely ends it.
   */
  hideToBlank?: boolean;
};

function createProseState(): ProseState {
  return { containers: [] };
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
        if (lead < container.indent || container.blankAfter) break;
        rest = rest.slice(container.indent);
        container.blankStart = false;
      } else if (container.blankStart) {
        container.blankAfter = true;
      }
    }
    matched += 1;
  }
  return { matched, rest };
}

/**
 * Opens the quotes and list items that start this line, and returns what follows their markers, or
 * undefined when the line nests deeper than MAX_CONTAINERS. With `interrupt` (a paragraph or
 * indented code is open) a list item starts only when it is not empty and, if ordered, starts at 1,
 * as in micromark, also inside a quote or item opened on the same line; otherwise the line goes on
 * with the paragraph (or underlines it).
 */
function openContainers(line: string, open: Container[], interrupt: boolean): string | undefined {
  let rest = line;
  for (;;) {
    const quote = QUOTE_MARKER.exec(rest);
    const item = quote ? null : ITEM_MARKER.exec(rest);
    if (!quote && (!item || isThematicLine(rest))) return rest;
    if (
      item &&
      interrupt &&
      (TRAILING_SPACE.test(rest.slice(item[0].length)) || !/^(?:[-*+]|1[.)])$/.test(item[2]!))
    ) {
      return rest;
    }
    // One container more than this module follows: what is in it cannot be told.
    if (open.length === MAX_CONTAINERS) return undefined;
    if (item) {
      const markerEnd = item[1]!.length + item[2]!.length;
      const spaces = item[3] === undefined ? 0 : item[3].length + 1;
      // One to four spaces belong to the marker; more than that (or none) leaves the content indented.
      const indent =
        spaces >= 1 && spaces <= 4 && rest.length > markerEnd + spaces
          ? markerEnd + spaces
          : markerEnd + 1;
      rest = rest.slice(indent);
      open.push({ kind: "item", indent, blankStart: TRAILING_SPACE.test(rest), blankAfter: false });
    } else {
      open.push({ kind: "quote" });
      rest = rest.slice(quote![0].length);
    }
  }
}

/** A fence or HTML block starts: the paragraph before it ends, and any inline HTML left open in it. */
function endParagraph(state: ProseState): void {
  state.paragraph = undefined;
  state.indentedCode = false;
  state.inline = undefined;
  state.skew = undefined;
  state.definition = undefined;
}

/**
 * The line without the heading, quote and list markers it starts with, however many: the block
 * parser has already removed every container prefix it read, and these are the markers left (an
 * item that could not interrupt a paragraph, a heading). There is no limit, so no JSON-looking
 * text can hide behind one more marker than is stripped; each match moves on, so it is linear.
 */
function stripBlockMarkers(line: string): string {
  let at = 0;
  for (BLOCK_MARKER.lastIndex = 0; BLOCK_MARKER.exec(line); BLOCK_MARKER.lastIndex = at) {
    at = BLOCK_MARKER.lastIndex;
  }
  return line.slice(at).replace(CHECKBOX, "").replace(/ #+$/, "");
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

/** Text in which CommonMark may start something it hides: HTML, or a link destination. */
function mayHide(text: string): boolean {
  return text.includes("<") || text.includes("](");
}

const UNTIL_GT: InlineOpen = { kind: "untilGt" };
const TO_PARAGRAPH_END: InlineOpen = { kind: "paragraph" };

/**
 * Hides text from `from` up to and including the next `>`, and returns the index after it. A `<`
 * before any `>` stops the hiding there instead, as a tag may start at it. With neither on the
 * line, the lines after it stay hidden too.
 */
function untilGt(
  text: string,
  from: number,
  open: InlineState,
  exact: boolean
): number | undefined {
  for (let index = from; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === GREATER_THAN) return index + 1;
    if (code !== LESS_THAN || !isEscaped(text, index, from)) {
      if (code === LESS_THAN) return index;
      continue;
    }
    // An escaped "<" is text (what is hidden here is plain text to CommonMark, backslash and all),
    // unless a removed hidden character stood between the two: then it may start a tag.
    if (!exact) {
      open.inline = TO_PARAGRAPH_END;
      return undefined;
    }
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
 * - So does a tag with a "](" in it, after a backtick or "](" earlier in the paragraph: where a code
 *   span or link covers its start, CommonMark may read a link destination from there on.
 * - An open tag that fails on uncertain text hides the rest of the paragraph: CommonMark may still
 *   be in a quoted value there. A closing tag has no quotes, so it hides only up to the next `>`.
 * The caller handles a tag that fails on certain text: there the "<" is plain text, as in CommonMark.
 */
function tagEnd(
  scan: TagScan,
  step: TagStep,
  text: string,
  open: InlineState,
  exact: boolean
): number | undefined {
  if (step === undefined) {
    open.inline = { kind: "tag", scan };
    return undefined;
  }
  if (!scan.innerLt && !(open.skew && scan.innerLink)) {
    if (step === "end") return scan.at;
    if (scan.closing) return untilGt(text, scan.at, open, exact);
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
  // Text before this index (outside HTML) has been checked for what makes the paragraph skewed.
  let checked = 0;
  const readText = (to: number) => {
    if (!open.skew && to > checked) {
      const part = text.slice(Math.max(checked, from), to);
      if (part.includes("`") || part.includes("](")) open.skew = true;
    }
    checked = Math.max(checked, to);
  };
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
    readText(at);
    INLINE_DELIMITED.lastIndex = at;
    const opener = INLINE_DELIMITED.exec(text);
    if (opener) {
      const end = inlineEndOf(opener[0]);
      const close = exact ? text.indexOf(end, at + 2) : -1;
      kept += `${text.slice(from, at)} `;
      // In a skewed paragraph, what the construct hides may hold HTML or a link destination that
      // CommonMark reads instead, running past the end found here.
      const inside = text.slice(at + opener[0].length, close === -1 ? text.length : close);
      if (open.skew && mayHide(inside)) {
        open.inline = TO_PARAGRAPH_END;
        return kept;
      }
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
    if (tag && step !== "fail") {
      tag.scan.innerLink = text
        .slice(at, step === "end" ? tag.scan.at : text.length)
        .includes("](");
    }
    // A "<" that starts no tag, or a tag that fails on certain text with no "<" in it, is plain text.
    if (!tag || (step === "fail" && !tag.scan.innerLt && !tag.scan.uncertain)) {
      at += 1;
      continue;
    }
    kept += `${text.slice(from, at)} `;
    const resume = tagEnd(tag.scan, step, text, open, exact);
    if (resume === undefined) return kept;
    from = resume;
    at = resume;
  }
  readText(text.length);
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
      // A backstop: lines that start a new block end the construct before this is reached, but
      // should this line be read differently by CommonMark, a tag starting at a "<" here could run
      // past this end marker, so a "<" before it hides the rest of the paragraph.
      const link = open.skew && text.slice(0, close === -1 ? text.length : close).includes("](");
      if (link || (lt !== -1 && (close === -1 || lt < close))) open.inline = TO_PARAGRAPH_END;
      else if (close === -1) open.inline = inline;
      else resume = close + inline.end.length;
      break;
    }
    case "untilGt":
      resume = untilGt(text, 0, open, exact);
      break;
    case "tag": {
      const { scan } = inline;
      // This module strips the prefix of a line (list markers, direction marks), and a line may also
      // start a new block, so what the scan reads from here on may differ from what CommonMark reads.
      scan.uncertain = true;
      let step = stepTag(scan, LINE_FEED);
      if (step === undefined) step = scanTag(scan, text, 0);
      else scan.at = 0;
      if (text.slice(0, step === undefined ? text.length : scan.at).includes("](")) {
        scan.innerLink = true;
      }
      resume = tagEnd(scan, step, text, open, exact);
      break;
    }
    case "paragraph":
      open.inline = inline;
      break;
  }
  return resume === undefined ? undefined : text.slice(resume);
}

function isAsciiPunctuation(code: number): boolean {
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e)
  );
}

function skipSpaces(text: string, from: number): number {
  let index = from;
  while (text.charCodeAt(index) === 0x20) index += 1;
  return index;
}

/** The link ran on past the end of the line (a destination or title may continue there). */
const LINK_OPEN = -1;
/** What follows the `](` is not a link destination this module can read. */
const NOT_A_LINK = -2;

/**
 * Where the `(destination "title")` of an inline link that starts at `from` (just past its `(`)
 * ends: the index after its `)`, or LINK_OPEN or NOT_A_LINK. Read by CommonMark's rules: the
 * destination is `<...>`, or text with no spaces whose parentheses are escaped or balanced; the
 * optional title is in double quotes, single quotes or parentheses; a backslash escapes ASCII
 * punctuation in either.
 */
function linkEnd(text: string, from: number): number {
  let index = skipSpaces(text, from);
  if (index >= text.length) return LINK_OPEN;
  if (text.charCodeAt(index) === LESS_THAN) {
    for (index += 1; ; index += 1) {
      if (index >= text.length) return NOT_A_LINK;
      const code = text.charCodeAt(index);
      if (code === 0x5c && isAsciiPunctuation(text.charCodeAt(index + 1))) index += 1;
      else if (code === GREATER_THAN) break;
      else if (code === LESS_THAN) return NOT_A_LINK;
    }
    index += 1;
  } else {
    let depth = 0;
    for (; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code === 0x5c && isAsciiPunctuation(text.charCodeAt(index + 1))) index += 1;
      else if (code <= 0x20 || code === 0x7f) break;
      else if (code === 0x28) depth += 1;
      else if (code === 0x29) {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    if (depth > 0) return index >= text.length ? LINK_OPEN : NOT_A_LINK;
  }
  index = skipSpaces(text, index);
  if (index >= text.length) return LINK_OPEN;
  const opener = text.charCodeAt(index);
  if (opener === QUOTE || opener === APOSTROPHE || opener === 0x28) {
    const closer = opener === 0x28 ? 0x29 : opener;
    for (index += 1; ; index += 1) {
      if (index >= text.length) return LINK_OPEN;
      const code = text.charCodeAt(index);
      if (code === 0x5c && isAsciiPunctuation(text.charCodeAt(index + 1))) index += 1;
      else if (code === closer) break;
    }
    index = skipSpaces(text, index + 1);
    if (index >= text.length) return LINK_OPEN;
  }
  return text.charCodeAt(index) === 0x29 ? index + 1 : NOT_A_LINK;
}

/**
 * Keeps the text of every inline link and image and drops its destination and title, which are
 * never shown. The text may have started on an earlier line, so every `](` is read as the end of
 * one. What follows a `](` that is not a link this module can read is hidden to the end of the line,
 * and a destination or title still open there (they may run over lines) hides the rest of the
 * paragraph. Each search starts past the last, so the work is linear.
 */
function stripLinks(text: string, open: InlineState): string {
  let kept = "";
  let from = 0;
  for (let at = text.indexOf("]("); at !== -1; at = text.indexOf("](", from)) {
    // Drops the "[" (or "![") that opened the link text, if it is on this line.
    let bracket = at - 1;
    while (bracket >= from && text.charCodeAt(bracket) !== 0x5b) bracket -= 1;
    if (bracket < from) kept += text.slice(from, at);
    else {
      const bang = bracket > from && text.charCodeAt(bracket - 1) === 0x21 ? bracket - 1 : bracket;
      kept += `${text.slice(from, bang)}${text.slice(bracket + 1, at)}`;
    }
    const end = linkEnd(text, at + 2);
    if (end === LINK_OPEN) open.inline = TO_PARAGRAPH_END;
    if (end < 0) return kept;
    from = end;
  }
  return `${kept}${text.slice(from)}`;
}

// ---------------------------------------------------------------------------------------------
// Link reference definitions
// ---------------------------------------------------------------------------------------------

/**
 * Where a scan of a link reference definition `[label]: destination "title"` is, in CommonMark's
 * grammar as micromark reads it: the label (backslash escapes, no unescaped "[", not blank, and
 * over lines), the ":" right after it, whitespace (also a line ending), the destination (`<...>` on
 * one line, or text without spaces whose parentheses are balanced or escaped), and an optional
 * title after whitespace (in quotes or parentheses, also over lines), then nothing but spaces. No
 * label length is enforced (CommonMark stops at 999): reading too long a label as one only hides.
 */
type DefinitionState =
  | "label"
  | "colon"
  | "beforeDestination"
  | "angleDestination"
  | "destination"
  | "afterDestination"
  | "title"
  | "afterTitle";

type DefinitionScan = {
  state: DefinitionState;
  /** The label has a character that is not whitespace. */
  seen: boolean;
  /** Open parentheses in the destination. */
  depth: number;
  /** The character that closes the title. */
  closer: number;
  /** Whitespace came after the destination, so a title may start. */
  spaced: boolean;
};

function isDefinitionSpace(code: number): boolean {
  return code === 0x20 || code === 0x09;
}

/**
 * Reads one line of a definition into `scan`: "not" when it is not one, "open" when it goes on on
 * the next line, "done" when it may end here (with `scan.state` "afterDestination", a title may
 * still follow on the next line). Linear in the line.
 */
function scanDefinition(text: string, from: number, scan: DefinitionScan): "done" | "open" | "not" {
  for (let index = from; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    const escaped = code === 0x5c && isAsciiPunctuation(text.charCodeAt(index + 1));
    switch (scan.state) {
      case "label":
        if (escaped) {
          index += 1;
          scan.seen = true;
        } else if (code === 0x5b) return "not";
        else if (code === 0x5d) {
          if (!scan.seen) return "not";
          scan.state = "colon";
        } else if (!isDefinitionSpace(code)) scan.seen = true;
        break;
      case "colon":
        if (code !== 0x3a) return "not";
        scan.state = "beforeDestination";
        break;
      case "beforeDestination":
        if (isDefinitionSpace(code)) break;
        if (code === LESS_THAN) scan.state = "angleDestination";
        else if (code === 0x29 || code < 0x20 || code === 0x7f) return "not";
        else {
          scan.state = "destination";
          scan.depth = 0;
          index -= 1;
        }
        break;
      case "angleDestination":
        if (escaped) index += 1;
        else if (code === GREATER_THAN) {
          scan.state = "afterDestination";
          scan.spaced = false;
        } else if (code === LESS_THAN) return "not";
        break;
      case "destination":
        if (escaped) index += 1;
        else if (isDefinitionSpace(code)) {
          if (scan.depth > 0) return "not";
          scan.state = "afterDestination";
          scan.spaced = true;
        } else if (code < 0x20 || code === 0x7f) return "not";
        else if (code === 0x28) scan.depth += 1;
        else if (code === 0x29) {
          if (scan.depth === 0) return "not";
          scan.depth -= 1;
        }
        break;
      case "afterDestination":
        if (isDefinitionSpace(code)) scan.spaced = true;
        else if (scan.spaced && (code === QUOTE || code === APOSTROPHE || code === 0x28)) {
          scan.closer = code === 0x28 ? 0x29 : code;
          scan.state = "title";
        } else return "not";
        break;
      case "title":
        if (escaped) index += 1;
        else if (code === scan.closer) scan.state = "afterTitle";
        break;
      case "afterTitle":
        if (!isDefinitionSpace(code)) return "not";
        break;
    }
  }
  // The line ending: whitespace in a label, before a destination and before a title.
  switch (scan.state) {
    case "colon":
    case "angleDestination":
      return "not";
    case "destination":
      if (scan.depth > 0) return "not";
      scan.state = "afterDestination";
      scan.spaced = true;
      return "done";
    case "afterDestination":
      scan.spaced = true;
      return "done";
    case "afterTitle":
      return "done";
    default:
      return "open";
  }
}

/**
 * A paragraph line that may start a definition: "[" after any indentation (a line that continues a
 * paragraph, after a definition, may hold the next definition however far it is indented).
 */
const DEFINITION_START = /^ *\[/;

/**
 * How a paragraph line reads as a link reference definition, whose destination and title are never
 * text: "text" (not part of one), "hide" (part of one), or "follow" (part of one unless a later line
 * says otherwise: it is hidden, but its inline HTML and links are followed, so that should the
 * definition turn out not to be one, the text after it reads as CommonMark reads that paragraph).
 * Any paragraph line is checked, not only one that starts a paragraph (where alone CommonMark
 * reads a definition): that only hides more.
 */
function readDefinition(rest: string, state: ProseState): "text" | "hide" | "follow" {
  let scan = state.definition;
  state.definition = undefined;
  if (scan?.state === "afterDestination") {
    // The definition ended on the line before, unless a title follows on this one.
    const first = rest.charCodeAt(LEADING_SPACES.exec(rest)![0].length);
    if (first !== QUOTE && first !== APOSTROPHE && first !== 0x28) scan = undefined;
  }
  let from = 0;
  if (!scan) {
    const start = DEFINITION_START.exec(rest);
    if (!start) return "text";
    scan = { state: "label", seen: false, depth: 0, closer: 0, spaced: false };
    from = start[0].length;
  }
  const result = scanDefinition(rest, from, scan);
  if (result === "not") return "text";
  if (result === "open") {
    state.definition = scan;
    return "follow";
  }
  // A title may still follow on the next line.
  if (scan.state === "afterDestination") state.definition = scan;
  return "hide";
}

function stripMarkdownInline(text: string): string {
  return text.replace(/\*\*|~~|`+/g, "").replace(EMPHASIS_PAIR, "$1$3");
}

/**
 * Plain text of one markdown line, or "" when the line is not shown. Tracks quotes, list items,
 * paragraphs, indented and fenced code, raw HTML and HTML blocks that end at a blank line, as
 * micromark does. With `emit` false it only follows the state and skips the text work.
 */
function proseLine(rawLine: string, state: ProseState, emit: boolean): string {
  const raw = rawLine.replace(/(?:\r\n|\r|\n)$/, "");
  // Block structure is read on the line as it is (tabs expanded), as CommonMark reads it: to it
  // hidden and control characters are text, so a line that has any is not blank, does not open or
  // close a fence or an HTML block it would not open or close without them, and holds no end
  // marker they split. Inline HTML is read on the tidied line, where they are gone and could fake
  // a marker: `exact` says whether the line had any.
  const expanded = raw.includes("\t") ? detab(raw) : raw;
  const exact = tidy(expanded) === expanded;

  // Quotes and list items decide where a fence or raw HTML block starts and ends: it lives only as
  // long as every container it opened in keeps continuing, and its lines are read without their
  // prefixes.
  const { matched, rest: continued } = continueContainers(expanded, state.containers);
  const allContinued = matched === state.containers.length;
  // The open paragraph is in a container this line does not continue: the line may continue it
  // lazily, and micromark lets condition 7 start on it.
  const blank = /^ *$/.test(continued);
  const lazy = !blank && state.paragraph !== undefined && state.paragraph > matched;
  // Containers the line does not continue end, except on a lazy line: there micromark keeps them
  // open, and they end only where the line turns out to start a block of its own (`close`).
  let unmatched = !allContinued;
  const close = () => {
    if (unmatched) state.containers.length = matched;
    unmatched = false;
  };
  if (!allContinued) {
    if (!lazy) close();
    state.fence = undefined;
    state.htmlEnd = undefined;
    state.indentedCode = false;
    // Containers nested too deep end with these. After text in them, this line may continue that
    // paragraph lazily, inline HTML and all.
    if (state.tooDeep) state.hideToBlank = true;
    state.tooDeep = undefined;
  }
  if (blank) {
    // A blank line ends the paragraph, and with it any inline HTML left open in it.
    state.inline = undefined;
    state.skew = undefined;
    state.definition = undefined;
    state.paragraph = undefined;
    state.hideToBlank = undefined;
  }
  // A blank line ends an HTML block of condition 6 or 7 even where it falls inside a comment.
  if (state.htmlBlock !== undefined && (state.htmlBlock > matched || blank)) {
    state.htmlBlock = undefined;
  }
  if (state.tooDeep !== undefined) {
    state.tooDeep = !blank;
    return "";
  }

  if (state.htmlEnd) {
    if (state.htmlEnd.test(continued)) state.htmlEnd = undefined;
    return "";
  }

  if (state.fence) {
    const closer = FENCE_LINE.exec(continued);
    const { marker, length } = state.fence;
    if (
      closer &&
      closer[2]![0] === marker &&
      closer[2]!.length >= length &&
      TRAILING_SPACE.test(closer[3]!)
    ) {
      state.fence = undefined;
    }
    return "";
  }

  // Every line of an HTML block that ends at a blank line (condition 6 or 7) is literal HTML, not
  // text. CommonMark starts no quote, list item, fence or raw HTML block in it, and neither does
  // this module: a fence opened here would outlast the blank line that ends the block and then
  // close at a fence CommonMark opens, showing that fence's code.
  if (state.htmlBlock !== undefined) return "";

  // On a lazy line micromark still has the paragraph's containers open, unmatched, so a list item
  // may start there as it may after any container that ends.
  const interrupt =
    allContinued && !lazy && (state.paragraph !== undefined || state.indentedCode === true);
  if (lazy && (QUOTE_MARKER.test(continued) || ITEM_MARKER.test(continued))) close();
  const depth = state.containers.length;
  const rest = openContainers(continued, state.containers, interrupt);
  if (rest === undefined) {
    state.tooDeep = true;
    endParagraph(state);
    return "";
  }
  // A new quote or list item starts a new block: the paragraph before it ends, and with it any
  // inline HTML left open in it.
  if (state.containers.length > depth) endParagraph(state);
  const indent = LEADING_SPACES.exec(rest)![0].length;
  // Four spaces in, a line continues the paragraph or is indented code: it starts no block.
  if (indent < 4) {
    const fence = FENCE_LINE.exec(rest);
    if (fence && (fence[2]![0] === "~" || !fence[3]!.includes("`"))) {
      close();
      state.fence = { marker: fence[2]![0]!, length: fence[2]!.length };
      endParagraph(state);
      return "";
    }
    const html = RAW_HTML_BLOCKS.find((block) => block.start.test(rest));
    if (html) {
      close();
      if (!html.end.test(rest)) state.htmlEnd = html.end;
      endParagraph(state);
      return "";
    }
    // Condition 6 may interrupt a paragraph; condition 7 may not, except on a lazy line, where
    // micromark keeps it in the container the line does not continue (so it ends at the next line
    // that does not continue that container either). The first line of either is literal HTML too.
    const sixth = HTML_BLOCK_6.test(rest);
    if (sixth || ((state.paragraph === undefined || lazy) && startsTagBlock(rest))) {
      if (sixth) close();
      state.htmlBlock = state.containers.length;
      endParagraph(state);
      return "";
    }
  }
  let paragraphLine = false;
  if (TRAILING_SPACE.test(rest)) {
    state.paragraph = undefined;
  } else if (indent >= 4 && (state.indentedCode || state.paragraph === undefined)) {
    state.indentedCode = allContinued ? true : "lazy";
  } else {
    state.indentedCode = false;
    const underline = state.paragraph !== undefined && !lazy && SETEXT_UNDERLINE.test(rest);
    const heading = !underline && ATX_HEADING.test(rest);
    if (underline || heading || isThematicLine(rest)) {
      close();
      endParagraph(state);
      // An underline or a thematic break shows no text and can open no inline HTML or link, so the
      // cleanup below (a scan per marker on a long line) has nothing to do.
      if (!heading) return "";
    } else {
      state.paragraph ??= state.containers.length;
      paragraphLine = true;
    }
  }
  if (!emit || state.hideToBlank) return "";
  // A link reference definition (or a line that may be part of one) shows nothing.
  const definition = paragraphLine ? readDefinition(rest, state) : "text";
  if (definition === "hide") return "";

  // The text is what the block parser left of the line, so no container prefix it read is in it.
  // Leading direction marks (common at the start of right-to-left lines) must not hide markers.
  let line = tidy(rest)
    .replace(/^[\s\u{200E}\u{200F}\u{61C}]+/u, "")
    .trimEnd();
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
  // Inline HTML and links are followed on every line that gets here, also on lines dropped below,
  // because what they leave open hides the lines after them.
  const withoutLinks = stripLinks(stripInlineHtml(text, state, exact, exact), state);
  if (definition === "follow") return "";
  if (THEMATIC_BREAK.test(line) || LINK_DEFINITION.test(line)) return "";
  if (FENCE_SYNTAX.test(line.replace(ALL_FORMAT, ""))) return "";
  if (text === "" || TABLE_RULE.test(text) || looksLikeJson(line) || looksLikeJson(text)) return "";

  const plain = collapse(stripMarkdownInline(withoutLinks));
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

/**
 * Reads the lines of a codec block like any other markdown, and says how CommonMark (as followed
 * here) reads its fence: `opens` when its first line opens a fence at the top level, and
 * `closesAtEnd` when that fence then stays open up to the last line and closes there. Every line of
 * a fence adds nothing; where the reading parts from the codec's, the lines after that point were
 * added as the prose they are.
 */
function readBlock(
  source: string,
  out: Collector,
  state: ProseState
): { opens: boolean; closesAtEnd: boolean } {
  const lines = /[^\r\n]*(?:\r\n|\r|\n|$)/g;
  let opens = false;
  let closesAtEnd = false;
  let first = true;
  for (
    let line = lines.exec(source);
    line !== null && line[0].length > 0;
    line = lines.exec(source)
  ) {
    const wasOpen = state.fence !== undefined;
    out.add(proseLine(line[0], state, !out.full));
    const isOpen = state.fence !== undefined;
    if (first) {
      opens = !wasOpen && isOpen && state.containers.length === 0;
      closesAtEnd = opens;
      first = false;
    } else if (closesAtEnd) {
      // Open on every line but the last, closed after the last.
      closesAtEnd = lines.lastIndex >= source.length ? !isOpen : isOpen;
    }
  }
  return { opens, closesAtEnd };
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
  const only = segments[0]!;
  // A body the codec refuses as too large: its prose cannot be located without a second parser.
  if (segments.length === 1 && only.kind === "broken" && only.errorCode === "body_too_large") {
    return { summary: "", searchText: "", truncated: false, omittedBlocks: 1 };
  }
  // Past the last block only text is left, and once `out` is full there is nothing to add or gate.
  let lastBlock = segments.length - 1;
  while (lastBlock >= 0 && segments[lastBlock]!.kind === "markdown") lastBlock -= 1;
  // One reading of the whole body, segment boundaries included: the codec only says which fences
  // are Tempo blocks. A block counts only where that reading agrees it is a fence of its own,
  // which it is not inside an HTML block that runs to the next blank line, or where CommonMark ends
  // the fence at another line than the codec does. Then its lines are the prose they are.
  const state = createProseState();
  for (const [index, segment] of segments.entries()) {
    if (out.full && index > lastBlock) break;
    if (segment.kind === "markdown") {
      addProse(segment.source, out, state, index < lastBlock);
      continue;
    }
    const { opens, closesAtEnd } = readBlock(segment.source, out, state);
    if (segment.kind === "broken") {
      if (opens) omittedBlocks += 1;
    } else if (closesAtEnd) {
      addBlockText(segment.block, out);
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
