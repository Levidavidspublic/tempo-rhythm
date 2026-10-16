import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreCard, type ScoreCardProps } from "./ScoreCard";
import { emptyLabelKeys, fillText, resolveDir } from "./shared";
import { deckLabels, quizLabels, reviewLabels, scoreLabels, testLabels } from "./test-fixtures";

const html = (props: Partial<ScoreCardProps>) =>
  renderToStaticMarkup(
    createElement(ScoreCard, { score: 30, max: 40, percent: 75, labels: scoreLabels, ...props })
  );

describe("ScoreCard", () => {
  test("score and percent, numbers isolated in tp-num", () => {
    const markup = html({});
    expect(markup).toContain('data-component="ScoreCard"');
    expect(markup).toContain(
      '<span class="tp-num">30</span> of <span class="tp-num">40</span> points'
    );
    expect(markup).toContain('<span class="tp-num">75</span>%');
  });

  test("at or above the pass mark: words and an icon, not colour alone", () => {
    const markup = html({ passMark: 55, passed: true });
    expect(markup).toContain('data-result="passed"><svg');
    expect(markup).toContain('At or above the pass mark of <span class="tp-num">55</span>%.');
  });

  test("below the pass mark: calm words and an icon", () => {
    const markup = html({ percent: 40, passMark: 55, passed: false });
    expect(markup).toContain('data-result="below"><svg');
    expect(markup).toContain('Below the pass mark of <span class="tp-num">55</span>% this time.');
    expect(markup).not.toMatch(/\b(failed|fail|must|streak)\b/i);
  });

  test("no pass mark, no pass words", () => {
    expect(html({})).not.toContain("data-result");
  });

  test("per-section breakdown with the section title as user text", () => {
    const markup = html({
      sections: [
        { title: "Section A", score: 20, max: 20 },
        { title: "פרק ב", score: 10, max: 20 },
      ],
    });
    expect(markup).toContain("By section");
    expect(markup).toContain('<span dir="auto">פרק ב</span>');
    expect(markup).toContain('<span class="tp-num">10</span> of <span class="tp-num">20</span>');
  });

  test("Review the ones you missed shows only with something missed; one primary at most", () => {
    const noop = () => {};
    const both = html({ missedCount: 2, onReviewMissed: noop, onTryAgain: noop });
    expect(both).toContain("Review the ones you missed");
    expect(both.match(/tp-btn--primary/g)).toHaveLength(1);
    expect(html({ missedCount: 0, onReviewMissed: noop, onTryAgain: noop })).not.toContain(
      "Review the ones you missed"
    );
    expect(html({})).not.toContain("<button");
  });
});

describe("labels and helpers", () => {
  test("the fixtures' labels are never empty, and the check finds empty ones", () => {
    for (const labels of [deckLabels, reviewLabels, quizLabels, testLabels, scoreLabels])
      expect(emptyLabelKeys(labels)).toEqual([]);
    expect(emptyLabelKeys({ a: "", b: { c: "  ", d: "ok" } })).toEqual(["a", "b.c"]);
  });

  test("templates keep unknown placeholders and the language's word order", () => {
    expect(fillText("{current} מתוך {total}", { current: 3, total: 12 })).toBe("3 מתוך 12");
    expect(fillText("{x} left", {})).toBe("{x} left");
  });

  test("direction: the prop wins, then the closest [dir], then LTR", () => {
    const rtl = { closest: () => ({ getAttribute: () => "rtl" }) } as unknown as Element;
    expect(resolveDir(undefined, rtl)).toBe("rtl");
    expect(resolveDir("ltr", rtl)).toBe("ltr");
    expect(resolveDir(undefined, null)).toBe("ltr");
  });
});
