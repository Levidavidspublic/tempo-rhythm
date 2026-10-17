import { describe, expect, test } from "bun:test";
import { estimateTimeline, SENTENCE_PAUSE_SECONDS, sentenceAt, skip, totalSeconds } from "./timeline";

// 165 words a minute: 11 words take 4 seconds, plus the pause.
const ELEVEN = "one two three four five six seven eight nine ten eleven";

describe("estimateTimeline", () => {
  test("back to back from 0 at 165 words a minute", () => {
    const timeline = estimateTimeline([ELEVEN, { text: ELEVEN }]);
    const one = 4 + SENTENCE_PAUSE_SECONDS;
    expect(timeline).toEqual([
      { index: 0, start: 0, end: one },
      { index: 1, start: one, end: one * 2 },
    ]);
    expect(totalSeconds(timeline)).toBe(one * 2);
  });
  test("a faster rate makes it shorter; bad numbers fall back to the defaults", () => {
    const normal = totalSeconds(estimateTimeline([ELEVEN]));
    expect(totalSeconds(estimateTimeline([ELEVEN], { rate: 2 }))).toBeCloseTo(normal / 2, 2);
    expect(totalSeconds(estimateTimeline([ELEVEN], { rate: 0, wordsPerMinute: -1 }))).toBe(normal);
    expect(totalSeconds(estimateTimeline([]))).toBe(0);
  });
});

describe("sentenceAt and skip", () => {
  const timeline = estimateTimeline(Array.from({ length: 20 }, () => ELEVEN)); // ~4.35 s each
  test("sentenceAt finds the sentence and clamps at both ends", () => {
    expect(sentenceAt(timeline, -3)).toBe(0);
    expect(sentenceAt(timeline, 0)).toBe(0);
    expect(sentenceAt(timeline, 4.4)).toBe(1);
    expect(sentenceAt(timeline, 9999)).toBe(19);
    expect(sentenceAt([], 3)).toBe(-1);
  });
  test("forward 30 s and back 15 s by the estimate", () => {
    expect(skip(timeline, 0, 30)).toBe(6);
    expect(skip(timeline, 10, -15)).toBe(6);
    expect(skip(timeline, 1, -15)).toBe(0);
    expect(skip(timeline, 18, 30)).toBe(19);
  });
  test("a skip always moves when it can, even past one long sentence", () => {
    const long = estimateTimeline([Array.from({ length: 200 }, () => "word").join(" "), "short"]);
    expect(skip(long, 0, 30)).toBe(1);
    expect(skip(long, 1, -1)).toBe(0);
    expect(skip(long, 0, -15)).toBe(0);
    expect(skip([], 0, 30)).toBe(-1);
  });
});
