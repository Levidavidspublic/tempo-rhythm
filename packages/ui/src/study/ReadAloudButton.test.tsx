import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveQuiz } from "./AdaptiveQuiz";
import { FlashcardDeck } from "./FlashcardDeck";
import { FlashcardReview } from "./FlashcardReview";
import { fixedQuizEngine } from "./quiz-engine";
import { ReadAloudButton, type ReadAloudLabels } from "./ReadAloudButton";
import { TestRunner } from "./TestRunner";
import { deckLabels, practiceTest, quizLabels, quizQuestions, reviewLabels, testLabels } from "./test-fixtures";
import { referenceScoreTest } from "./test-scorer";
import { click, hostElements } from "./test-tree";

const labels: ReadAloudLabels = { read: "Read aloud", stop: "Stop reading" };

const button = (pressed: boolean, onToggle: (text: string) => void = () => {}) =>
  createElement(ReadAloudButton, { text: "Mitosis", pressed, onToggle, labels });

describe("ReadAloudButton", () => {
  test("off: a ghost small toggle with the volume icon and the word Read aloud", () => {
    const markup = renderToStaticMarkup(button(false));
    expect(markup).toContain('class="tp-btn tp-btn--ghost tp-btn--sm tp-readaloud"');
    expect(markup).toContain('data-component="ReadAloudButton"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('data-label="Read aloud"');
    expect(markup).toContain("<span>Read aloud</span>");
    expect(markup).toContain('<svg aria-hidden="true"');
    expect(markup).not.toContain("tp-btn--primary");
  });

  test("on: pressed, the pause icon and the word Stop reading", () => {
    const off = renderToStaticMarkup(button(false));
    const on = renderToStaticMarkup(button(true));
    expect(on).toContain('aria-pressed="true"');
    expect(on).toContain('data-label="Stop reading"');
    expect(on).toContain("<span>Stop reading</span>");
    // The icon swaps too (volume to pause), so the state is in words and in shape.
    expect(on.match(/<svg[\s\S]*?<\/svg>/)?.[0]).not.toBe(off.match(/<svg[\s\S]*?<\/svg>/)?.[0]);
  });

  test("a click hands the text to the host", () => {
    const seen: string[] = [];
    const [host] = hostElements(button(false, (text) => seen.push(text)));
    if (!host) throw new Error("no button");
    click(host);
    expect(seen).toEqual(["Mitosis"]);
  });

  test("disabled stays a real, labelled button", () => {
    const markup = renderToStaticMarkup(
      createElement(ReadAloudButton, { text: "x", pressed: false, onToggle: () => {}, labels, disabled: true })
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain("Read aloud");
  });
});

describe("the readAloud slot on the study components", () => {
  const slot = (text: string) =>
    createElement(ReadAloudButton, { text, pressed: false, onToggle: () => {}, labels });
  const count = (markup: string) => markup.match(/data-component="ReadAloudButton"/g)?.length ?? 0;

  test("left out, nothing changes", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardDeck, { cards: [{ front: "A", back: "B" }], labels: deckLabels })
    );
    expect(count(markup)).toBe(0);
  });

  test("a deck card gets one for its front and one for its back", () => {
    const markup = renderToStaticMarkup(
      createElement(FlashcardDeck, {
        cards: [{ front: "Mitosis", back: "Division" }],
        labels: deckLabels,
        readAloud: slot,
      })
    );
    expect(count(markup)).toBe(2);
    expect(markup.match(/tp-btn--primary/g)?.length).toBe(1);
  });

  test("a review card, a quiz prompt and each test prompt get one", () => {
    const review = renderToStaticMarkup(
      createElement(FlashcardReview, {
        cards: [{ key: "a", front: "Mitosis", back: "Division", state: null }],
        now: 0,
        labels: reviewLabels,
        readAloud: slot,
      })
    );
    expect(count(review)).toBe(2);
    const quiz = renderToStaticMarkup(
      <AdaptiveQuiz engine={fixedQuizEngine(quizQuestions)} labels={quizLabels} readAloud={slot} />
    );
    expect(count(quiz)).toBe(1);
    const paper = renderToStaticMarkup(
      createElement(TestRunner, { test: practiceTest, scorer: referenceScoreTest, labels: testLabels, readAloud: slot })
    );
    expect(count(paper)).toBeGreaterThanOrEqual(practiceTest.sections.flatMap((s) => s.questions).length);
  });
});
