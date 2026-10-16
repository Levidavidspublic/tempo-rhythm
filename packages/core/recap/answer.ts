import { fullReading } from "./recap";
import { pageLang, type RecapLang } from "./text";

/**
 * "Ask a question" on the listening screen, kitchen T4 (S16): finds the sentences of the page
 * that share the most words with the question. Local and offline; it quotes the page and never
 * makes up an answer. Rare words count for more than common ones.
 */

export type PageMatch = { text: string; index: number; score: number };

export type AnswerOptions = { lang?: RecapLang; limit?: number };

const STOP_EN = new Set(
  (
    "a an the is are was were be been being am what which who whom whose how why when where do does did " +
    "of in on at to for and or but not no it its this that these those by with as from about into than then " +
    "can could would should will shall may might i me my you your we our us they them their he she his her " +
    "there here so if any some all more most very just also explain tell mean means meant please show give " +
    "describe define happens happen"
  ).split(" ")
);

const STOP_HE = new Set(
  (
    "מה מי איך למה מדוע מתי איפה היכן של את על עם זה זו זאת הוא היא הם הן אני אנחנו אתם אתן יש אין כי גם " +
    "או לא כן אם אל מן עד הזה הזו האם כל רק עוד כמה שלי שלו שלה בין לפי אבל תסבירו הסבירו ספרו"
  ).split(" ")
);

/** Hebrew one-letter prefixes (and, the, in, to, from, that, as) that can sit on a word. */
const HEBREW_PREFIX = /^[והבלמשכ]/;

/**
 * Hebrew points and cantillation marks (U+0591–U+05C7) fold away and a maqaf splits words, as in
 * the short-answer checker (`normalizeAnswer` in packages/core/srs): a pointed page (מִיטוֹזָה)
 * matches an unpointed question (מיטוזה), and the other way round.
 */
function foldMarks(text: string): string {
  return text.normalize("NFKD").replace(/\u05BE/g, " ").replace(/[\u0591-\u05C7]/g, "").normalize("NFC");
}

/** Lower-case word stems for matching: light English plural and verb endings. Hebrew words stay
 * whole here (points folded away); their prefix letters are handled when matching. */
export function terms(text: string): string[] {
  const words = foldMarks(text).toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? [];
  const out: string[] = [];
  for (const raw of words) {
    const word = raw.replace(/['’]s$/, "");
    if (word.length < 2 || STOP_EN.has(word) || STOP_HE.has(word)) continue;
    out.push(stem(word));
  }
  return out;
}

function stem(word: string): string {
  if (/[א-ת]/.test(word)) return word;
  if (/^\d/.test(word)) return word;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("es") && /(sh|ch|x|z|ss)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** A term and its forms without one or two Hebrew prefix letters ("והמים" → "המים", "מים"). */
function variants(term: string): string[] {
  const out = [term];
  let word = term;
  for (let i = 0; i < 2 && word.length > 3 && HEBREW_PREFIX.test(word); i += 1) {
    word = word.slice(1);
    out.push(word);
  }
  return out;
}

function bagOf(text: string): Set<string> {
  return new Set(terms(text).flatMap(variants));
}

const has = (bag: Set<string>, term: string) => variants(term).some((form) => bag.has(form));

/**
 * The page sentences that best match the question, best first by score but returned in page
 * order, at most `limit` (default 3). Only sentences sharing at least one real word are kept;
 * an empty list means the page doesn't seem to say.
 */
export function answerFromPage(markdown: string, question: string, options: AnswerOptions = {}): PageMatch[] {
  const asked = [...new Set(terms(question))];
  if (asked.length === 0) return [];
  const lang = options.lang ?? pageLang(markdown);
  const limit = Math.max(1, Math.floor(options.limit ?? 3));
  const sentences = fullReading(markdown, { lang });
  const bags = sentences.map((sentence) => bagOf(sentence.text));
  const docs = Math.max(1, bags.length);
  const weight = new Map(
    asked.map((term) => {
      const seen = bags.filter((bag) => has(bag, term)).length;
      return [term, seen === 0 ? 0 : Math.log(1 + docs / seen)];
    })
  );
  const scored: PageMatch[] = [];
  bags.forEach((bag, index) => {
    let score = 0;
    for (const term of asked) if (has(bag, term)) score += weight.get(term) ?? 0;
    const sentence = sentences[index];
    // A heading alone is a pointer, not an answer.
    if (score > 0 && sentence && sentence.kind !== "cue") {
      scored.push({ text: sentence.text, index, score: Math.round(score * 1000) / 1000 });
    }
  });
  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index);
}
