import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BROKEN_BLOCK_MESSAGES } from "./block-spec";
import {
  DECISION_LIMITS,
  type DecisionStep,
  DecisionSteps,
  decisionStepSpecs,
  isValidDecision,
} from "./decision-steps";

const labels = { list: "Suggested order", minutes: "min" };
const steps: DecisionStep[] = [
  { title: "Reply to Sam", minutes: 10, reason: "Quick, and it unblocks Sam" },
  { title: "Pay the electricity bill", minutes: 5 },
  { title: "Fold laundry", minutes: 20 },
];

const render = (s: readonly DecisionStep[]) => renderToStaticMarkup(createElement(DecisionSteps, { steps: s, labels }));

describe("decision steps", () => {
  test("each step becomes a display-only TaskBlock spec, first now, the rest later, in order", () => {
    const specs = decisionStepSpecs(steps);
    expect(specs).toHaveLength(3);
    const elements = specs.map((spec) => spec.elements[spec.root]);
    expect(elements.map((e) => e?.type)).toEqual(["TaskBlock", "TaskBlock", "TaskBlock"]);
    expect(elements.map((e) => (e?.props as { status: string }).status)).toEqual(["now", "later", "later"]);
    expect(elements.map((e) => (e?.props as { title: string }).title)).toEqual(steps.map((s) => s.title));
    // Display only: no checkbox binding, and the placeholder id never reaches a spec.
    for (const e of elements) expect(e && "on" in e).toBe(false);
    expect(JSON.stringify(specs)).not.toContain("blk_");
  });

  test("draws the steps as an ordered list of task rows, through json-render", () => {
    const html = render(steps);
    expect(html).toContain('<ol class="tp-block-task" data-component="DecisionSteps" aria-label="Suggested order">');
    const titles = [...html.matchAll(/<span class="tp-task-row__title" dir="auto">([^<]*)<\/span>/g)].map((m) => m[1]);
    expect(titles).toEqual(["Reply to Sam", "Pay the electricity bill", "Fold laundry"]);
    expect(html).toContain('<span class="tp-num">10</span> min');
    expect(html).toContain("Quick, and it unblocks Sam");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });

  test("Hebrew titles keep dir=auto and the host's minutes label", () => {
    const html = renderToStaticMarkup(
      createElement(DecisionSteps, { steps: [{ title: "לשלם חשבון", minutes: 5 }, { title: "Email", minutes: 3 }], labels: { list: "סדר מוצע", minutes: "דק׳" } }),
    );
    expect(html).toContain('dir="auto">לשלם חשבון</span>');
    expect(html).toContain('<span class="tp-num">5</span> דק׳');
  });

  test("a step the task block checks reject draws the calm card, never its text or JSON", () => {
    const html = render([{ title: "", minutes: 5 }, { title: "Fine", minutes: 0 }, { title: "Ok", minutes: 15 }]);
    const escaped = BROKEN_BLOCK_MESSAGES.invalid_data.replaceAll("'", "&#x27;");
    expect(html.split(escaped)).toHaveLength(3);
    expect(html).toContain(">Ok</span>");
    expect(html).not.toMatch(/[{[]\s*"[A-Za-z_]+"\s*:/);
  });

  test("validity: 2 to 7 steps, each a valid task block", () => {
    expect(isValidDecision(steps)).toBe(true);
    expect(isValidDecision(steps.slice(0, 1))).toBe(false);
    const eight = Array.from({ length: DECISION_LIMITS.maxSteps + 1 }, (_, i) => ({ title: `Step ${i}`, minutes: 5 }));
    expect(isValidDecision(eight)).toBe(false);
    expect(isValidDecision([...steps.slice(0, 1), { title: "x".repeat(501), minutes: 5 }])).toBe(false);
    expect(isValidDecision([...steps.slice(0, 1), { title: "Long", minutes: 1441 }])).toBe(false);
  });

  test("never draws more than the step limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ title: `Step ${i}`, minutes: 5 }));
    expect(render(many).match(/tp-task-row__title/g)).toHaveLength(DECISION_LIMITS.maxSteps);
  });
});
