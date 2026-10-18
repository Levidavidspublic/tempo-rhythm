import { joinItems, type RecapLang, readableBlocks, splitSentences, wordCount } from "./text";

/**
 * Recaps, kitchen T4 (S16): an extractive recap of a page (no model, no network) and the full
 * reading. Each sentence keeps its kind so the player can mark section cues.
 */

export type RecapSentenceKind = "cue" | "sentence" | "definition" | "list";

export type RecapSentence = {
  text: string;
  kind: RecapSentenceKind;
  /** Which heading section of the page it came from (0 before the first heading). */
  section: number;
};

export type RecapOptions = { lang: RecapLang; maxSentences?: number };

export const DEFAULT_RECAP_SENTENCES = 12;
/** List items this short (in words, with no stop of their own) fold into one sentence. */
const SHORT_ITEM_WORDS = 8;

function ensureStop(text: string): string {
  return /[.?!…׃]["'”’»)\]]*$/.test(text) ? text : `${text}.`;
}

function definitionSentence(term: string, meaning: string, lang: RecapLang, whole: boolean): string {
  const parts = splitSentences(meaning, lang);
  const said = whole ? parts.join(" ") : (parts[0] ?? meaning);
  return ensureStop(`${term}: ${said}`);
}

function listSentences(items: readonly string[], lang: RecapLang, whole: boolean): string[] {
  const short = items.every((item) => wordCount(item) <= SHORT_ITEM_WORDS && !/[.?!]$/.test(item));
  if (short) {
    const joined = joinItems(items, lang);
    return joined ? [joined] : [];
  }
  return items.flatMap((item) => {
    const parts = splitSentences(item, lang).map(ensureStop);
    return whole ? parts : parts.slice(0, 1);
  });
}

type Candidate = RecapSentence & { order: number };

function candidates(markdown: string, lang: RecapLang, whole: boolean): Candidate[] {
  const out: Candidate[] = [];
  let section = 0;
  const push = (text: string, kind: RecapSentenceKind) => {
    if (text.trim()) out.push({ text: text.trim(), kind, section, order: out.length });
  };
  for (const block of readableBlocks(markdown)) {
    if (block.type === "heading") {
      section += 1;
      push(block.text, "cue");
    } else if (block.type === "paragraph") {
      const parts = splitSentences(block.text, lang).map(ensureStop);
      for (const part of whole ? parts : parts.slice(0, 1)) push(part, "sentence");
    } else if (block.type === "definition") {
      push(definitionSentence(block.term, block.meaning, lang, whole), "definition");
    } else {
      for (const part of listSentences(block.items, lang, whole)) push(part, "list");
    }
  }
  // A heading with nothing under it says nothing on its own.
  return out.filter(
    (item, index) => item.kind !== "cue" || out.slice(index + 1).some((next) => next.section === item.section && next.kind !== "cue")
  );
}

const strip = ({ text, kind, section }: Candidate): RecapSentence => ({ text, kind, section });

/** Every readable sentence of the page, in order: headings as cues, then each sentence. */
export function fullReading(markdown: string, options: { lang: RecapLang }): RecapSentence[] {
  return candidates(markdown, options.lang, true).map(strip);
}

/**
 * An extractive recap: each heading as a section cue, the first sentence of each paragraph,
 * each definition and each list (short items folded into one sentence). Code, json tempo
 * blocks, HTML and link URLs are left out. When the page holds more than `maxSentences`
 * (cues included), sections take turns, so the recap covers the whole page rather than its
 * first part; the result stays in page order.
 */
export function buildRecap(markdown: string, options: RecapOptions): RecapSentence[] {
  const max = Math.max(1, Math.floor(options.maxSentences ?? DEFAULT_RECAP_SENTENCES));
  const all = candidates(markdown, options.lang, false);
  if (all.length <= max) return all.map(strip);

  const cueOf = new Map<number, Candidate>();
  const bySection = new Map<number, Candidate[]>();
  for (const item of all) {
    if (item.kind === "cue") cueOf.set(item.section, item);
    else bySection.set(item.section, [...(bySection.get(item.section) ?? []), item]);
  }
  const picked = new Set<Candidate>();
  let used = 0;
  const sections = [...bySection.keys()].sort((a, b) => a - b);
  for (let round = 0; used < max; round += 1) {
    let any = false;
    for (const section of sections) {
      const item = bySection.get(section)?.[round];
      if (!item) continue;
      any = true;
      const cue = cueOf.get(section);
      const cost = 1 + (cue && !picked.has(cue) ? 1 : 0);
      if (used + cost > max) continue;
      if (cue) picked.add(cue);
      picked.add(item);
      used += cost;
    }
    if (!any) break;
  }
  if (picked.size === 0) {
    const first = all.find((item) => item.kind !== "cue");
    if (first) picked.add(first);
  }
  return all.filter((item) => picked.has(item)).map(strip);
}
