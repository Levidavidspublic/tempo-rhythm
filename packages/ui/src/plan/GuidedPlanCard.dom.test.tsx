/**
 * GuidedPlanCard mounted in the small TestNode DOM (tests/unit/record/testDom; there is no
 * Testing Library here): what changes over time and across renders, which static markup can't
 * show. The countdown after a late Accept, the live note, and where focus goes.
 */
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  findAll,
  installTestDom,
  type TestNode,
  useTestDom,
} from "../../../../tests/unit/record/testDom";
import { GuidedPlanCard, type GuidedPlanCardProps, type GuidedPlanLabels } from "./GuidedPlanCard";
import type { GuidedStep } from "./guided-plan";

const documentNode = installTestDom();

const labels: GuidedPlanLabels = {
  kind: "Plan",
  summary: "{steps} sessions on {days} days, {hours} h {minutes} min in all.",
  list: "Plan steps",
  minutes: "{n} min",
  kinds: { learn: "Learn", review: "Review", practice: "Practice", rest: "Rest", task: "Task" },
  statuses: { todo: "To do", doing: "Doing", done: "Done" },
  statusGroup: "Status of {title}",
  accept: "Add these sessions",
  accepting: "Adding…",
  edit: "Edit",
  doneEditing: "Done editing",
  reject: "Not this one",
  undo: "Undo",
  undoLeft: "{time} left to undo",
  accepted: "Added to your calendar. You can take it back for 5 minutes.",
  kept: "Added to your calendar.",
  undone: "Taken back.",
  rejected: "Set aside.",
  editHint: "Nothing is saved until you add them.",
  nameField: "Name of step {n}",
  minutesField: "Minutes for step {n}",
  moveUp: "Move {title} earlier",
  moveDown: "Move {title} later",
  remove: "Remove {title}",
  errors: {
    titleEmpty: "Give this step a short name.",
    titleLong: "Shorter.",
    minutesRange: "Use {min} to {max} minutes.",
  },
  tooFew: "Keep at least one step.",
};

const steps: GuidedStep[] = [
  { id: "a", title: "Learn: Algebra", minutes: 45, kind: "learn" },
  { id: "b", title: "Review: Algebra", minutes: 30, kind: "review" },
  { id: "c", title: "Practice test", minutes: 60, kind: "practice" },
];

const card = (over: Partial<GuidedPlanCardProps> = {}) =>
  createElement(GuidedPlanCard, {
    title: "Maths exam",
    steps,
    labels,
    onAccept: () => {},
    onReject: () => {},
    ...over,
  });

let root: Root | null = null;
let host: TestNode | null = null;

async function mount(node: ReturnType<typeof card>) {
  useTestDom(documentNode);
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(node);
  });
  return host;
}
async function rerender(node: ReturnType<typeof card>) {
  await act(async () => {
    root?.render(node);
  });
}

afterEach(async () => {
  setSystemTime();
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
});

const countdown = (view: TestNode) =>
  findAll(
    view,
    (n) => n.className === "tp-num tp-mono" && n.getAttribute("aria-hidden") === "true"
  )[0]?.textContent;

describe("GuidedPlanCard, mounted", () => {
  test("accepted long after the card was drawn, Undo opens at 5:00", async () => {
    const drawnAt = Date.UTC(2026, 9, 16, 17, 0, 0);
    setSystemTime(new Date(drawnAt));
    const view = await mount(card());
    // Ten minutes of reading the plan, then Accept: the host's 5-minute window starts now.
    const acceptedAt = drawnAt + 10 * 60_000;
    setSystemTime(new Date(acceptedAt));
    await rerender(
      card({ status: "accepted", undoUntilMs: acceptedAt + 5 * 60_000, onUndo: () => {} })
    );
    expect(countdown(view)).toBe("5:00");
  });
});
