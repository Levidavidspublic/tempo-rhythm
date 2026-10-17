/**
 * Outline reader, kitchen T3: page markdown → flashcards, a quiz or a practice test, with no model.
 *
 * Pure and deterministic: the same markdown and options always give the same block (shuffles use
 * a seeded generator; the default seed is a hash of the text).
 *
 * What it reads, in English or Hebrew:
 * - Definitions on a line, a bullet or a numbered item: `Term: meaning`, `Term — meaning`
 *   (em dash, en dash or a spaced hyphen) and `**Term** meaning`.
 * - A heading (or a lead-in line ending in `:`) followed by a bullet list: one card, the heading on
 *   the front and the items on the back.
 * - The same with a numbered list: a card whose back keeps the order; with 3 or more steps the
 *   quiz asks for the right order.
 * Code fences (including `json tempo` blocks), HTML tags and comments are dropped first; links and
 * emphasis are reduced to their text.
 *
 * Every builder returns data that passes the page codec's schema for its block type, or `null`
 * when the page has fewer than 2 usable items.
 */

import {
  type FlashcardsData,
  flashcardsDataSchema,
  type QuizData,
  type QuizDifficulty,
  type QuizQuestion,
  quizDataSchema,
  type StudyChoice,
  type StudySource,
  type TestData,
  type TestQuestion,
  testDataSchema,
} from "@tempo/utils";
import { normalizeAnswer } from "./plugins";

export type OutlineLang = "en" | "he";

/** One thing worth studying, read from the page. */
export type OutlineItem = {
  kind: "definition" | "list" | "steps";
  term: string;
  meaning: string;
  /** The list entries, for `list` and `steps`. */
  entries?: string[];
};

export type OutlineOptions = {
  /** The block title, usually the page title. A short default is used when it is blank. */
  title: string;
  source?: StudySource;
  /** Shuffle seed. Default: a hash of the markdown. */
  seed?: number;
  /** Language of the generated prompts. Default: detected from the text. */
  lang?: OutlineLang;
};

const MAX_TEXT = 500;
const MAX_ACCEPTED = 200;
const MAX_TERM_CHARS = 80;
const MAX_TERM_WORDS = 8;
const MAX_ITEMS = 100;
const MAX_SECTION_QUESTIONS = 20;
const MIN_ITEMS = 2;
const ORDER_MIN_STEPS = 3;
const CHOICE_IDS = ["a", "b", "c", "d"] as const;

const COPY = {
  en: {
    flashcards: "Flashcards",
    quiz: "Practice quiz",
    test: "Practice test",
    definition: (t: string) => `What does "${t}" mean?`,
    list: (t: string) => `Which of these goes with "${t}"?`,
    steps: (t: string) => `What is the right order for "${t}"?`,
    shortTerm: "Which term matches this: ",
    shortTopic: "Which topic do these belong to: ",
    mcqTitle: "Multiple choice",
    mcqHelp: "Choose the best answer.",
    shortTitle: "Short answers",
    shortHelp: "Write the term or topic in a few words.",
  },
  he: {
    flashcards: "כרטיסיות",
    quiz: "חידון תרגול",
    test: "מבחן תרגול",
    definition: (t: string) => `מה הפירוש של "${t}"?`,
    list: (t: string) => `מה שייך לנושא "${t}"?`,
    steps: (t: string) => `מה הסדר הנכון של "${t}"?`,
    shortTerm: "איזה מונח מתאים להגדרה: ",
    shortTopic: "לאיזה נושא שייכים: ",
    mcqTitle: "שאלות בחירה",
    mcqHelp: "בחרו את התשובה המתאימה ביותר.",
    shortTitle: "תשובות קצרות",
    shortHelp: "כתבו את המונח או הנושא בכמה מילים.",
  },
} as const;

// ---------------------------------------------------------------------------------------------
// Text helpers

/** Cuts `text` to at most `max` UTF-16 units (the codec's measure), ending in "…" when cut. */
export function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  let cut = trimmed.slice(0, max - 1);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name.startsWith("#")) {
      const hex = name[1] === "x" || name[1] === "X";
      const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/**
 * Drops what is not outline text: fenced code (```/~~~, including `json tempo` blocks), HTML
 * comments and tags. Block-level closing tags and `<br>` become line breaks.
 */
export function cleanMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const kept: string[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence === null && marker) {
      fence = marker;
      continue;
    }
    if (fence !== null) {
      if (
        marker &&
        marker[0] === fence[0] &&
        marker.length >= fence.length &&
        line.trim() === marker
      ) {
        fence = null;
      }
      continue;
    }
    kept.push(line);
  }
  return decodeEntities(
    kept
      .join("\n")
      .replace(/<!--[\s\S]*?(-->|$)/g, "")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<\/?[A-Za-z][^>]*>/g, "")
  );
}

/** Inline markdown reduced to plain text: images dropped, links and wiki links to their text. */
export function inlineText(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_m, target: string, alias?: string) => alias ?? target
    )
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|~~|`|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "he" when the text has more Hebrew letters than Latin ones, else "en". */
export function detectLang(text: string): OutlineLang {
  const hebrew = text.match(/[א-ת]/g)?.length ?? 0;
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return hebrew > latin ? "he" : "en";
}

// ---------------------------------------------------------------------------------------------
// Seeded randomness

/** FNV-1a 32-bit hash: a stable default seed for a text. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32: a small seeded generator returning numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with the given generator. Returns a new array. */
export function seededShuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reading the outline

type Definition = { term: string; meaning: string };

function usableTerm(term: string): boolean {
  return (
    term.length > 0 &&
    term.length <= MAX_TERM_CHARS &&
    term.split(" ").length <= MAX_TERM_WORDS &&
    /\p{L}/u.test(term) &&
    !/https?$|www\./i.test(term)
  );
}

function definition(rawTerm: string, rawMeaning: string): Definition | null {
  const term = inlineText(rawTerm)
    .replace(/[:：]$/, "")
    .trim();
  const meaning = inlineText(rawMeaning)
    .replace(/(?<!\.)[.׃]$/, "")
    .trim();
  if (!usableTerm(term) || !/[\p{L}\p{N}]/u.test(meaning)) return null;
  return { term, meaning };
}

/** `Term: meaning`, `Term — meaning` or `**Term** meaning`; `null` for anything else. */
export function parseDefinition(content: string): Definition | null {
  const bold = /^(?:\*\*(.+?)\*\*|__(.+?)__)\s*(?:[:：—–-]\s*)?(.+)$/.exec(content);
  if (bold) return definition(bold[1] ?? bold[2] ?? "", bold[3] ?? "");
  const colon = /^(.+?)\s*[:：]\s+(.+)$/.exec(content);
  const dash = /^(.+?)\s+[—–-]\s+(.+)$/.exec(content);
  const first = [colon, dash]
    .filter((m): m is RegExpExecArray => m !== null)
    .sort((a, b) => (a[1]?.length ?? 0) - (b[1]?.length ?? 0))[0];
  return first ? definition(first[1] ?? "", first[2] ?? "") : null;
}

type Line =
  | { type: "blank" }
  | { type: "rule" }
  | { type: "heading"; text: string }
  | { type: "item"; ordered: boolean; content: string }
  | { type: "text"; content: string };

function classify(raw: string): Line {
  const line = raw.replace(/^\s*(>\s*)+/, "");
  if (line.trim() === "") return { type: "blank" };
  if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) return { type: "rule" };
  const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
  if (heading) return { type: "heading", text: inlineText(heading[1] ?? "") };
  const bullet = /^\s*[-*+•]\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line);
  if (bullet) return { type: "item", ordered: false, content: (bullet[1] ?? "").trim() };
  const numbered = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
  if (numbered) return { type: "item", ordered: true, content: (numbered[1] ?? "").trim() };
  return { type: "text", content: line.trim() };
}

function joinEntries(entries: readonly string[], ordered: boolean): string {
  return ordered ? entries.map((e, i) => `${i + 1}. ${e}`).join("; ") : entries.join("; ");
}

type ListItem = OutlineItem & { entries: string[] };

/** Reads the study items of a page, in page order, without duplicates (by term). */
export function readOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let heading: string | null = null;
  let leadIn: string | null = null;
  // The list being read; already in `items`, so page order holds.
  let group: ListItem | null = null;

  for (const raw of cleanMarkdown(markdown).split("\n")) {
    const line = classify(raw);
    if (line.type === "blank") continue;
    if (line.type === "rule" || line.type === "heading") {
      group = null;
      leadIn = null;
      heading = line.type === "heading" && /\p{L}/u.test(line.text) ? line.text : null;
      continue;
    }
    const def = parseDefinition(line.content);
    if (def) {
      items.push({ kind: "definition", ...def });
      continue;
    }
    if (line.type === "text") {
      group = null;
      const text = inlineText(line.content);
      leadIn = /[:：]$/.test(text) ? text.replace(/[:：]$/, "").trim() || null : null;
      continue;
    }
    const entry = inlineText(line.content);
    const title = leadIn ?? heading;
    if (!entry || !title) continue;
    const kind = line.ordered ? "steps" : "list";
    let open = group as ListItem | null;
    if (!open || open.term !== title || open.kind !== kind) {
      open = { kind, term: title, meaning: "", entries: [] };
      items.push(open);
    }
    open.entries.push(entry);
    group = open;
  }

  const seen = new Set<string>();
  return items
    .map((item) =>
      item.entries ? { ...item, meaning: joinEntries(item.entries, item.kind === "steps") } : item
    )
    .filter((item) => {
      const key = normalizeAnswer(item.term);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ---------------------------------------------------------------------------------------------
// Builders

type Context = { items: OutlineItem[]; lang: OutlineLang; random: () => number };

function context(markdown: string, options: OutlineOptions): Context | null {
  const items = readOutline(markdown).slice(0, MAX_ITEMS);
  if (items.length < MIN_ITEMS) return null;
  const cleaned = cleanMarkdown(markdown);
  return {
    items,
    lang: options.lang ?? detectLang(cleaned),
    random: seededRandom(options.seed ?? hashSeed(cleaned)),
  };
}

function base(options: OutlineOptions, fallback: string) {
  const title = clip(options.title, MAX_TEXT) || fallback;
  return {
    title,
    origin: "outline" as const,
    ...(options.source ? { source: options.source } : {}),
  };
}

/** Flashcards: one card per item, the term on the front. */
export function outlineToFlashcards(
  markdown: string,
  options: OutlineOptions
): FlashcardsData | null {
  const ctx = context(markdown, options);
  if (!ctx) return null;
  const data = {
    ...base(options, COPY[ctx.lang].flashcards),
    cards: ctx.items.map((item, i) => ({
      id: `c${i + 1}`,
      front: clip(item.term, MAX_TEXT),
      back: clip(item.meaning, MAX_TEXT),
    })),
  };
  const parsed = flashcardsDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

type DraftQuestion = {
  prompt: string;
  choices: StudyChoice[];
  answerId: string;
  difficulty: QuizDifficulty;
};

function withChoiceIds(
  texts: readonly string[],
  answer: string
): { choices: StudyChoice[]; answerId: string } {
  const choices = texts.map((text, i) => ({
    id: CHOICE_IDS[i] as string,
    text: clip(text, MAX_TEXT),
  }));
  const answerId = choices[texts.indexOf(answer)]?.id ?? "a";
  return { choices, answerId };
}

/** A "put these in order" question: the right order and up to 3 other orders. */
function orderQuestion(item: OutlineItem, ctx: Context): DraftQuestion | null {
  const steps = item.entries ?? [];
  if (item.kind !== "steps" || steps.length < ORDER_MIN_STEPS) return null;
  const right = steps.join(" → ");
  const others = new Set<string>();
  for (let tries = 0; tries < 24 && others.size < 3; tries++) {
    const order = seededShuffle(steps, ctx.random).join(" → ");
    if (order !== right) others.add(order);
  }
  if (others.size === 0) return null;
  const texts = seededShuffle([right, ...others], ctx.random);
  return { prompt: COPY[ctx.lang].steps(item.term), ...withChoiceIds(texts, right), difficulty: 3 };
}

/** "What does X mean?": the item's meaning among other items' meanings (same kind first). */
function meaningQuestion(item: OutlineItem, ctx: Context): DraftQuestion | null {
  const answerKey = normalizeAnswer(item.meaning);
  const seen = new Set([answerKey]);
  const pool = seededShuffle(
    ctx.items.filter((other) => other !== item),
    ctx.random
  ).sort((a, b) => Number(a.kind !== item.kind) - Number(b.kind !== item.kind));
  const distractors: string[] = [];
  for (const other of pool) {
    const key = normalizeAnswer(other.meaning);
    if (seen.has(key)) continue;
    seen.add(key);
    distractors.push(other.meaning);
    if (distractors.length === 3) break;
  }
  if (distractors.length === 0) return null;
  const texts = seededShuffle([item.meaning, ...distractors], ctx.random);
  const copy = COPY[ctx.lang];
  const prompt = item.kind === "definition" ? copy.definition(item.term) : copy.list(item.term);
  return {
    prompt,
    ...withChoiceIds(texts, item.meaning),
    difficulty: item.kind === "definition" ? 1 : 2,
  };
}

function draftQuestions(items: readonly OutlineItem[], ctx: Context): DraftQuestion[] {
  return items
    .map((item) => orderQuestion(item, ctx) ?? meaningQuestion(item, ctx))
    .filter((q): q is DraftQuestion => q !== null)
    .map((q) => ({ ...q, prompt: clip(q.prompt, MAX_TEXT) }));
}

/**
 * A quiz: one multiple-choice question per item. Definitions are level 1, lists level 2, and
 * numbered lists of 3 or more steps become level-3 "right order" questions.
 */
export function outlineToQuiz(
  markdown: string,
  options: OutlineOptions & { mode?: QuizData["mode"] }
): QuizData | null {
  const ctx = context(markdown, options);
  if (!ctx) return null;
  const questions: QuizQuestion[] = draftQuestions(ctx.items, ctx).map((q, i) => ({
    id: `q${i + 1}`,
    ...q,
  }));
  if (questions.length < MIN_ITEMS) return null;
  const data = {
    ...base(options, COPY[ctx.lang].quiz),
    mode: options.mode ?? "adaptive",
    questions,
  };
  const parsed = quizDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Accepted answers for a term: as written, without a parenthesis, and the parenthesis alone. */
export function acceptedAnswers(term: string): string[] {
  const paren = /^(.*?)\s*[(（]([^)）]+)[)）]\s*$/.exec(term);
  const forms = paren ? [term, paren[1] ?? "", paren[2] ?? ""] : [term];
  const seen = new Set<string>();
  return forms
    .map((form) => clip(form, MAX_ACCEPTED))
    .filter((form) => {
      const key = normalizeAnswer(form);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function shortQuestion(item: OutlineItem, index: number, lang: OutlineLang): TestQuestion | null {
  const accepted = acceptedAnswers(item.term);
  if (accepted.length === 0) return null;
  const lead = item.kind === "definition" ? COPY[lang].shortTerm : COPY[lang].shortTopic;
  const meaning = clip(item.meaning, MAX_TEXT - lead.length);
  return { plugin: "short", id: `s${index + 1}`, prompt: `${lead}${meaning}`, points: 2, accepted };
}

/**
 * A practice test in two sections: multiple choice for the first half of the items (1 point
 * each) and short answers for the rest (2 points each: recall is harder than recognition).
 * Each section holds at most 20 questions.
 */
export function outlineToTest(
  markdown: string,
  options: OutlineOptions & { style?: TestData["style"] }
): TestData | null {
  const ctx = context(markdown, options);
  if (!ctx) return null;
  const copy = COPY[ctx.lang];
  const half = Math.ceil(ctx.items.length / 2);
  const mcq: TestQuestion[] = draftQuestions(ctx.items.slice(0, half), ctx)
    .slice(0, MAX_SECTION_QUESTIONS)
    .map((q, i) => ({
      plugin: "mcq",
      id: `m${i + 1}`,
      prompt: q.prompt,
      points: 1,
      choices: q.choices,
      answerId: q.answerId,
    }));
  const short = ctx.items
    .slice(half)
    .map((item, i) => shortQuestion(item, i, ctx.lang))
    .filter((q): q is TestQuestion => q !== null)
    .slice(0, MAX_SECTION_QUESTIONS);
  if (mcq.length + short.length < MIN_ITEMS) return null;
  const sections = [
    { id: "mcq", title: copy.mcqTitle, instructions: copy.mcqHelp, questions: mcq },
    { id: "short", title: copy.shortTitle, instructions: copy.shortHelp, questions: short },
  ].filter((section) => section.questions.length > 0);
  const data = { ...base(options, copy.test), style: options.style ?? "standard", sections };
  const parsed = testDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
