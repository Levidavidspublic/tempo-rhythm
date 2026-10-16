import { wordCount } from "./text";

/**
 * The listening timeline, kitchen T4 (S16). Speech engines don't say how long a sentence will
 * take, so the player estimates it from words per minute and the chosen speed. Seconds are at
 * the chosen speed (a faster rate makes the whole timeline shorter).
 */

export type TimelineEntry = { index: number; start: number; end: number };

export type TimelineOptions = { rate?: number; wordsPerMinute?: number };

export const DEFAULT_WORDS_PER_MINUTE = 165;
/** The short breath between sentences, in seconds at speed 1. */
export const SENTENCE_PAUSE_SECONDS = 0.35;

type Sayable = string | { text: string };

/** Start and end seconds for each sentence, back to back from 0. */
export function estimateTimeline(
  sentences: readonly Sayable[],
  { rate = 1, wordsPerMinute = DEFAULT_WORDS_PER_MINUTE }: TimelineOptions = {}
): TimelineEntry[] {
  const speed = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const wpm = Number.isFinite(wordsPerMinute) && wordsPerMinute > 0 ? wordsPerMinute : DEFAULT_WORDS_PER_MINUTE;
  const out: TimelineEntry[] = [];
  let at = 0;
  sentences.forEach((sentence, index) => {
    const text = typeof sentence === "string" ? sentence : sentence.text;
    const seconds = (wordCount(text) * 60) / (wpm * speed) + SENTENCE_PAUSE_SECONDS / speed;
    const end = Math.round((at + seconds) * 1000) / 1000;
    out.push({ index, start: at, end });
    at = end;
  });
  return out;
}

/** The whole timeline's length in seconds (0 when empty). */
export function totalSeconds(timeline: readonly TimelineEntry[]): number {
  return timeline.at(-1)?.end ?? 0;
}

/**
 * The sentence playing at `seconds`: before 0 is the first, past the end is the last, and an
 * empty timeline gives -1.
 */
export function sentenceAt(timeline: readonly TimelineEntry[], seconds: number): number {
  if (timeline.length === 0) return -1;
  if (!(seconds > 0)) return 0;
  for (const entry of timeline) if (seconds < entry.end) return entry.index;
  return timeline.length - 1;
}

/**
 * The sentence to jump to from sentence `index` when skipping `deltaSeconds` (negative goes
 * back), measured from the start of that sentence. A skip always moves at least one sentence
 * when there is one to move to, so a long sentence never swallows a "forward 30 s".
 */
export function skip(timeline: readonly TimelineEntry[], index: number, deltaSeconds: number): number {
  if (timeline.length === 0) return -1;
  const from = Math.min(Math.max(0, Math.floor(index)), timeline.length - 1);
  const start = timeline[from]?.start ?? 0;
  const target = sentenceAt(timeline, start + deltaSeconds);
  if (deltaSeconds > 0 && target <= from) return Math.min(from + 1, timeline.length - 1);
  if (deltaSeconds < 0 && target >= from) return Math.max(from - 1, 0);
  return target;
}
