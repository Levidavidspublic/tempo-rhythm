import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdaptiveQuiz,
  AdaptiveQuizView,
  initQuiz,
  notifyQuizEnd,
  type QuizAction,
  type QuizViewState,
  quizReducer,
} from "./AdaptiveQuiz";
import { type FixedQuizState, fixedQuizEngine } from "./quiz-engine";
import { quizLabels, quizQuestions } from "./test-fixtures";
import { byAction, click } from "./test-tree";

const engine = fixedQuizEngine(quizQuestions);
const run = (actions: QuizAction[]) =>
  actions.reduce(
    (state: QuizViewState<FixedQuizState>, action) => quizReducer(engine, state, action),
    initQuiz(engine)
  );
const pick = (choiceId: string): QuizAction => ({ type: "select", choiceId });
const check: QuizAction = { type: "check" };
const next: QuizAction = { type: "next" };

function view(state: QuizViewState<FixedQuizState>, extra: Record<string, unknown> = {}) {
  const question = engine.current(state.engine);
  return createElement(AdaptiveQuizView, {
    question,
    result: question ? null : engine.result(state.engine),
    state,
    labels: quizLabels,
    onAction: () => {},
    name: "quiz",
    ...extra,
  });
}
const html = (state: QuizViewState<FixedQuizState>) => renderToStaticMarkup(view(state));

describe("fixed quiz engine", () => {
  test("asks in order, once each, and counts the result", () => {
    let state = engine.start();
    expect(engine.current(state)?.id).toBe("q1");
    const first = engine.answer(state, "b");
    expect(first.correct).toBe(false);
    expect(engine.answer(first.state, "a").state).toBe(first.state);
    state = engine.next(first.state);
    const second = engine.answer(state, "a");
    expect(second.correct).toBe(true);
    state = engine.next(second.state);
    expect(engine.current(state)).toBeNull();
    expect(engine.result(state)).toEqual({
      correct: 1,
      total: 2,
      byDifficulty: {
        1: { correct: 0, total: 1 },
        2: { correct: 1, total: 1 },
        3: { correct: 0, total: 0 },
      },
      missedIds: ["q1"],
    });
  });
});

describe("AdaptiveQuiz flow", () => {
  test("Check needs a choice; after Check the choice is locked until Next", () => {
    expect(run([check])).toEqual(initQuiz(engine));
    const checked = run([pick("a"), check, pick("b")]);
    expect(checked.selected).toBe("a");
    expect(checked.feedback).toEqual({ correct: true, choiceId: "a" });
    expect(run([next])).toEqual(initQuiz(engine));
    expect(run([pick("a"), check, next])).toMatchObject({
      asked: 2,
      selected: null,
      feedback: null,
    });
  });

  test("the host hears the result once the last Next ends the quiz", () => {
    const onFinish = mock((_result: unknown) => {});
    notifyQuizEnd(engine, run([pick("a"), check]), next, onFinish);
    expect(onFinish).not.toHaveBeenCalled();
    notifyQuizEnd(engine, run([pick("a"), check, next, pick("b"), check]), next, onFinish);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]).toEqual([
      expect.objectContaining({ correct: 1, total: 2, missedIds: ["q2"] }),
    ]);
  });
});

describe("AdaptiveQuiz view", () => {
  test("a question is a radio group with Check, disabled until a choice is made", () => {
    const markup = html(initQuiz(engine));
    expect(markup).toContain('data-component="Quiz" data-checked="false"');
    expect(markup).toContain('<legend class="tp-quiz__q" dir="auto">What makes ATP?</legend>');
    expect(markup.match(/type="radio" class="tp-radio" name="quiz"/g)).toHaveLength(2);
    expect(markup).toMatch(/data-action="quiz-check" disabled="">Check</);
    expect(markup).toContain("Pick an answer to check it.");
    expect(markup).toContain('Question <span class="tp-num">1</span>');
  });

  test("a right answer: icon and the word Right., plus the explanation", () => {
    const markup = html(run([pick("a"), check]));
    expect(markup).toContain('data-checked="true"');
    expect(markup).toContain('data-result="right"');
    expect(markup).toContain("<p>Right.</p>");
    expect(markup).toContain("Mitochondria run cellular respiration.");
    expect(markup).toMatch(/data-result="right"><svg/);
    expect(markup).toContain('data-action="quiz-next">Next</button>');
  });

  test("a wrong answer: Not quite, with the right answer in words, and marks on the choices", () => {
    const markup = html(run([pick("b"), check]));
    expect(markup).toContain('data-result="wrong"');
    expect(markup).toContain("Not quite. The answer is: Mitochondria");
    expect(markup).toContain('class="tp-choice" data-correct="true"');
    expect(markup).toContain('class="tp-choice" data-correct="false"');
    expect(markup).toMatch(/data-result="wrong"><svg/);
  });

  test("the end is a ScoreCard; Try again restarts and Review gets the missed ids", () => {
    const done = run([pick("b"), check, next, pick("a"), check, next]);
    const markup = html(done);
    expect(markup).toContain('data-component="ScoreCard"');
    expect(markup).toContain(
      '<span class="tp-num">1</span> of <span class="tp-num">2</span> right'
    );
    expect(markup).toContain('<span class="tp-num">50</span>%');
    expect(markup).not.toContain("pass mark");
    const sent: QuizAction[] = [];
    const onReviewMissed = mock((_ids: string[]) => {});
    const tree = view(done, {
      onAction: (action: QuizAction) => sent.push(action),
      onReviewMissed,
    });
    click(byAction(tree, "score-try-again"));
    click(byAction(tree, "score-review-missed"));
    expect(sent).toEqual([{ type: "restart" }]);
    expect(onReviewMissed).toHaveBeenCalledWith(["q1"]);
  });

  test("the stateful quiz renders its first question", () => {
    const markup = renderToStaticMarkup(<AdaptiveQuiz engine={engine} labels={quizLabels} />);
    expect(markup).toContain("What makes ATP?");
    expect(markup).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});
