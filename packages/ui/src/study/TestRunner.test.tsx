import { describe, expect, mock, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  initRunner,
  initTimer,
  missedQuestionIds,
  notifyTestEnd,
  openQuestions,
  type RunnerAction,
  type RunnerState,
  runnerReducer,
  TestRunner,
  TestRunnerView,
  timerReducer,
} from "./TestRunner";
import { practiceTest, testLabels } from "./test-fixtures";
import {
  countedQuestions,
  normalizeShortAnswer,
  referenceScoreTest,
  type TestResponses,
  type TestScore,
  type TestScorer,
} from "./test-scorer";
import { byAction, click } from "./test-tree";

const sectionA = practiceTest.sections[0]!;
const right = { plugin: "mcq", choiceId: "x" } as const;
const wrong = { plugin: "mcq", choiceId: "y" } as const;
const respond = (questionId: string, response: TestResponses[string]): RunnerAction => ({
  type: "respond",
  questionId,
  response,
});
const bagrut = (marks: Record<string, number> = {}) =>
  respond("b1", { plugin: "bagrut", parts: { p1: "Lipids in two layers", p2: "" }, marks });

function runWith(scorer: TestScorer, actions: RunnerAction[]): RunnerState {
  return actions.reduce(
    (state: RunnerState, action) => runnerReducer(practiceTest, scorer, state, action),
    initRunner(practiceTest)
  );
}
const run = (actions: RunnerAction[]) => runWith(referenceScoreTest, actions);

const view = (state: RunnerState, extra: Record<string, unknown> = {}) =>
  createElement(TestRunnerView, {
    test: practiceTest,
    state,
    labels: testLabels,
    onAction: () => {},
    idBase: "t",
    ...extra,
  });
const html = (state: RunnerState) => renderToStaticMarkup(view(state));

describe("reference scorer", () => {
  test("pick 2 of 3: the first two answered, in paper order, count", () => {
    const responses: TestResponses = {
      a1: right,
      a2: { plugin: "short", text: "the mitochondria" },
      a3: { plugin: "mcq", choiceId: "x" },
    };
    expect(countedQuestions(sectionA, responses).map((q) => q.id)).toEqual(["a1", "a2"]);
    const score = referenceScoreTest(practiceTest, responses);
    expect(score.sections[0]).toEqual({
      sectionId: "A",
      counted: ["a1", "a2"],
      points: 10,
      max: 20,
    });
  });

  test("pick 2 of 3 with one answered: the first unanswered fills the count at 0", () => {
    const responses: TestResponses = { a3: { plugin: "mcq", choiceId: "x" } };
    expect(countedQuestions(sectionA, responses).map((q) => q.id)).toEqual(["a1", "a3"]);
    expect(referenceScoreTest(practiceTest, responses).sections[0]?.points).toBe(10);
  });

  test("short answers ignore case, spaces, punctuation and Hebrew niqqud", () => {
    expect(normalizeShortAnswer("  The  Nucleus. ")).toBe("the nucleus");
    for (const text of [" Nucleus. ", "NUCLEUS", "גַּרְעִין", "גרעין!"]) {
      const score = referenceScoreTest(practiceTest, { a2: { plugin: "short", text } });
      expect(score.questions.a2).toEqual({ points: 10, max: 10 });
    }
  });

  test("bagrut parts are self-marked and clamped to each part's points", () => {
    const responses: TestResponses = {
      b1: { plugin: "bagrut", parts: { p1: "Lipids", p2: "Guards" }, marks: { p1: 9, p2: -3 } },
    };
    expect(referenceScoreTest(practiceTest, responses).questions.b1).toEqual({
      points: 5,
      max: 20,
    });
  });

  test("percent and the Bagrut default pass mark", () => {
    const score = referenceScoreTest(practiceTest, {
      a1: right,
      a3: right,
      b1: { plugin: "bagrut", parts: { p1: "a", p2: "b" }, marks: { p1: 5, p2: 5 } },
    });
    expect(score).toMatchObject({ total: 30, max: 40, percent: 75, passMark: 55, passed: true });
    expect(missedQuestionIds(score)).toEqual(["b1"]);
    const standard = referenceScoreTest({ ...practiceTest, style: "standard" }, {});
    expect(standard.passMark).toBeUndefined();
    expect(standard.passed).toBeUndefined();
  });
});

describe("timer", () => {
  test("counts down, pauses, resumes and stops at zero", () => {
    const start = initTimer(2);
    expect(start).toEqual({ remainingMs: 120_000, paused: false });
    if (!start) throw new Error("no timer");
    const ticked = timerReducer(start, { type: "tick", ms: 1000 });
    expect(ticked.remainingMs).toBe(119_000);
    const paused = timerReducer(ticked, { type: "pause" });
    expect(timerReducer(paused, { type: "tick", ms: 5000 })).toEqual(paused);
    const resumed = timerReducer(paused, { type: "resume" });
    expect(timerReducer(resumed, { type: "tick", ms: 500_000 }).remainingMs).toBe(0);
    expect(initTimer(undefined)).toBeNull();
  });

  test("at zero the runner asks to submit and never submits or marks on its own", () => {
    const state = run([respond("a1", right), { type: "tick", ms: 200_000 }]);
    expect(state.timer?.remainingMs).toBe(0);
    expect(state.phase).toBe("answer");
    expect(state.score).toBeNull();
    const markup = html(state);
    expect(markup).toContain("Time is up. Submit when you&#x27;re ready.");
    expect(markup).not.toContain("timer-pause");
    expect(markup).toContain('data-action="test-submit"');
  });

  test("time left in words with numbers in tp-num; Pause shows Paused and Resume", () => {
    expect(html(initRunner(practiceTest))).toContain(
      '<span><span class="tp-num">2</span> min left</span>'
    );
    expect(html(run([{ type: "tick", ms: 75_000 }]))).toContain(
      '<span class="tp-num">45</span> s left'
    );
    const paused = run([{ type: "pause" }, { type: "tick", ms: 10_000 }]);
    expect(paused.timer).toEqual({ remainingMs: 120_000, paused: true });
    const markup = html(paused);
    expect(markup).toContain('<span class="tp-badge">Paused</span>');
    expect(markup).toContain('data-action="timer-resume"');
    expect(markup).toContain("Resume");
  });
});

describe("TestRunner flow", () => {
  test("sections show instructions, the pick rule and each plugin's inputs", () => {
    const markup = html(initRunner(practiceTest));
    expect(markup).toContain("Short questions.");
    expect(markup).toContain(
      'Answer <span class="tp-num">2</span> of these <span class="tp-num">3</span>.'
    );
    expect(markup).toContain('data-plugin="mcq"');
    expect(markup).toContain('<input id="t-a2" class="tp-input" dir="auto" value=""/>');
    expect(markup).toContain('<textarea id="t-b1-p1" class="tp-textarea" dir="auto">');
    expect(markup).toContain("Part א");
    expect(markup.match(/tp-btn--primary/g)).toHaveLength(1);
  });

  test("submit confirm lists the open questions; a pick section with enough answers is not open", () => {
    expect(openQuestions(practiceTest, {}).map((q) => q.questionId)).toEqual([
      "a1",
      "a2",
      "a3",
      "b1",
    ]);
    const state = run([respond("a1", right), respond("a3", wrong), { type: "askSubmit" }]);
    expect(state.phase).toBe("confirm");
    expect(openQuestions(practiceTest, state.responses)).toEqual([
      { questionId: "b1", sectionTitle: "Section B", number: 1 },
    ]);
    const markup = html(state);
    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("These are still open:");
    expect(markup).toContain('Section B, question <span class="tp-num">1</span>');
    expect(markup).not.toContain('data-action="test-submit"');
    expect(markup.match(/tp-btn--primary/g)).toHaveLength(1);
    expect(run([{ type: "askSubmit" }, { type: "keepGoing" }]).phase).toBe("answer");
  });

  test("scoring goes through the injected scorer, with the pick rule's counted ids", () => {
    const fake: TestScore = {
      sections: [
        { sectionId: "A", counted: ["a1", "a3"], points: 10, max: 20 },
        { sectionId: "B", counted: ["b1"], points: 0, max: 20 },
      ],
      questions: {
        a1: { points: 10, max: 10 },
        a3: { points: 0, max: 10 },
        b1: { points: 0, max: 20 },
      },
      total: 10,
      max: 40,
      percent: 25,
      passMark: 55,
      passed: false,
    };
    const scorer = mock((_test: unknown, _responses: TestResponses) => fake);
    const state = runWith(scorer, [
      respond("a1", right),
      respond("a3", wrong),
      { type: "askSubmit" },
      { type: "submit" },
    ]);
    expect(scorer).toHaveBeenCalledTimes(1);
    expect(scorer.mock.calls[0]?.[0]).toBe(practiceTest);
    expect(scorer.mock.calls[0]?.[1]).toEqual({ a1: right, a3: wrong });
    expect(state).toMatchObject({ phase: "done", score: fake });
    expect(missedQuestionIds(fake)).toEqual(["a3", "b1"]);
    const markup = html(state);
    expect(markup).toContain('<span dir="auto">Section A</span>');
    expect(markup).toContain('<span class="tp-num">10</span> of <span class="tp-num">20</span>');
    expect(markup).toContain("Below the pass mark of");
  });

  test("written Bagrut parts are self-marked against the model answer and rubric first", () => {
    const scorer = mock(referenceScoreTest);
    const submitted = runWith(scorer, [
      respond("a1", right),
      respond("a3", right),
      bagrut(),
      { type: "askSubmit" },
      { type: "submit" },
    ]);
    expect(submitted.phase).toBe("mark");
    expect(scorer).not.toHaveBeenCalled();
    const markup = html(submitted);
    expect(markup).toContain("Mark your written answers");
    expect(markup).toContain("Lipids in two layers");
    expect(markup).toContain("A phospholipid bilayer.");
    expect(markup).toContain("5 for bilayer, 2 for lipids only.");
    expect(markup).toContain("Nothing written.");
    expect(markup).toContain('max="5"');
    const marked = [
      { type: "mark", questionId: "b1", partId: "p1", points: 4 },
      { type: "finishMarking" },
    ] as RunnerAction[];
    const done = marked.reduce(
      (state: RunnerState, action) => runnerReducer(practiceTest, scorer, state, action),
      submitted
    );
    expect(scorer).toHaveBeenCalledTimes(1);
    expect(done.score).toMatchObject({ total: 24, max: 40, percent: 60, passed: true });
    expect(html(done)).toContain("At or above the pass mark of");
  });

  test("the host hears the score once, when the attempt ends", () => {
    const onComplete = mock((_score: unknown, _responses: unknown) => {});
    const confirm = run([respond("a1", right), { type: "askSubmit" }]);
    notifyTestEnd(practiceTest, referenceScoreTest, confirm, { type: "submit" }, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]).toEqual([
      expect.objectContaining({ total: 10, max: 40 }),
      { a1: right },
    ]);
    notifyTestEnd(practiceTest, referenceScoreTest, confirm, { type: "keepGoing" }, onComplete);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("Try again starts a fresh attempt; buttons send their actions", () => {
    const done = run([{ type: "askSubmit" }, { type: "submit" }]);
    const sent: RunnerAction[] = [];
    click(byAction(view(done, { onAction: (a: RunnerAction) => sent.push(a) }), "score-try-again"));
    expect(sent).toEqual([{ type: "restart" }]);
    expect(run([respond("a1", right), { type: "restart" }])).toEqual(initRunner(practiceTest));
    const answering = view(initRunner(practiceTest), {
      onAction: (a: RunnerAction) => sent.push(a),
    });
    click(byAction(answering, "timer-pause"));
    click(byAction(answering, "test-submit"));
    expect(sent.slice(1)).toEqual([{ type: "pause" }, { type: "askSubmit" }]);
  });

  test("the stateful runner renders the paper", () => {
    const markup = renderToStaticMarkup(
      createElement(TestRunner, {
        test: practiceTest,
        scorer: referenceScoreTest,
        labels: testLabels,
      })
    );
    expect(markup).toContain("Biology practice paper");
    expect(markup).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});
