/**
 * ReplanPanel (kitchen F-07, "Re-plan the rest") mounted in the small TestNode DOM
 * (tests/unit/record/testDom; there is no Testing Library here): what changes over time and across
 * renders, which static markup can't show. The plan screen's backend is one module of its own
 * (planApi.ts); it is mocked here, faithfully, and put back after this file.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { act, createElement, createRef } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { localSlotToMs } from "../../../apps/web/components/calendar/gridData";
import type { BusyWindows } from "../../../apps/web/components/calendar/plan/busyWindows";
import { LocaleProvider } from "../../../apps/web/components/providers/LocaleProvider";
import { findAll, findByTag, installTestDom, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();

const webDir = `${process.cwd()}/apps/web`;
const planApi = Bun.resolveSync("./components/calendar/plan/planApi", webDir);
let previous: Record<string, unknown> = {};

const MIN = 60_000;
const at = (date: string, hour: number, minute = 0) => localSlotToMs(date, hour * 60 + minute);

type SavedTask = { _id: string; title: string; status: "todo" | "in_progress" | "done"; dueAt: number; timeEstimate: number };
type Saved = { plan: { _id: string; title: string; deadline: string; taskIds: string[] }; tasks: SavedTask[] };

let saved: Saved | undefined;
/** The person's calendar; the busy-time stand-in answers with the events inside the asked windows. */
let calendar: Array<{ _id: string; title: string; startsAtMs: number }> = [];
const spans: Array<BusyWindows | null> = [];
const calls = {
  replan: mock(async (_args: unknown): Promise<unknown> => ({ undoUntil: Date.now() + 5 * MIN, moved: 1, removed: 0 })),
  undoReplan: mock(async (_args: unknown): Promise<unknown> => ({ restored: 1 })),
};

function installModuleMocks() {
  mock.module(planApi, () => ({
    usePlan: () => saved,
    useBusyTime: (span: BusyWindows | null) => {
      spans.push(span);
      if (!span) return { events: undefined, tasks: undefined };
      const inWindows = (ms: number) => span.windows.some((w) => w.startMs <= ms && ms < w.endMs);
      return { events: calendar.filter((e) => inWindows(e.startsAtMs)), tasks: [] };
    },
    useReplanActions: () => ({ replan: calls.replan, undoReplan: calls.undoReplan }),
  }));
}

previous = { ...(await import(planApi)) };
installModuleMocks();
const { ReplanArea } = await import("../../../apps/web/components/calendar/plan/ReplanPanel?replan-dom");

beforeAll(installModuleMocks);
afterAll(() => {
  mock.module(planApi, () => previous);
});

const task = (id: string, title: string, date: string, hour: number, over: Partial<SavedTask> = {}): SavedTask => ({
  _id: id,
  title,
  status: "todo",
  dueAt: at(date, hour),
  timeEstimate: 45 * MIN,
  ...over,
});

/** A biology plan; it is Tuesday 20 Oct 2026 at 21:30 and the exam is tomorrow. */
function tightPlan(): Saved {
  return {
    plan: { _id: "studyPlans:1", title: "Biology", deadline: "2026-10-21", taskIds: ["tasks:1", "tasks:2"] },
    tasks: [
      task("tasks:1", "Learn: Cells", "2026-10-18", 17, { status: "done" }),
      task("tasks:2", "Learn: Mitosis", "2026-10-19", 17),
    ],
  };
}

let root: Root | null = null;
let host: TestNode | null = null;

type PanelProps = { planId: string | null; lang?: "en" | "he" };
const headingRef = createRef<HTMLHeadingElement>();
/** The re-plan area as the plan screen draws it, under the page's heading. */
const panel = ({ planId, lang = "en" }: PanelProps) =>
  createElement(
    LocaleProvider,
    null,
    createElement("h1", { ref: headingRef, tabIndex: -1 }, "Plan back from a deadline"),
    createElement(ReplanArea, { planId: planId as never, lang, headingRef })
  );

async function mount(props: PanelProps) {
  useTestDom(documentNode);
  host = documentNode.createElement("div");
  documentNode.body?.appendChild(host);
  root = createRoot(host as unknown as HTMLElement);
  await act(async () => {
    root?.render(panel(props));
  });
  return host;
}

async function rerender(props: PanelProps) {
  await act(async () => {
    root?.render(panel(props));
  });
}

async function click(node: TestNode | undefined) {
  if (!node) throw new Error("nothing to click");
  await act(async () => {
    node.click();
  });
}

/** Lets the timers the component set for after this render run (focus is handed back in one). */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Focus in the TestNode DOM (as in GuidedPlanCard.dom.test.tsx): `focus()` records the node, and
 * `document.activeElement` falls back to the body once that node leaves the document.
 */
function trackFocus() {
  const proto = Object.getPrototypeOf(documentNode) as { focus: (this: TestNode) => void };
  const plainFocus = proto.focus;
  let focused: TestNode | null = null;
  proto.focus = function (this: TestNode) {
    focused = this;
  };
  Object.defineProperty(documentNode, "activeElement", {
    configurable: true,
    get: () => (focused && documentNode.contains(focused) ? focused : documentNode.body),
  });
  return {
    get active() {
      return documentNode.activeElement;
    },
    restore() {
      proto.focus = plainFocus;
      Object.defineProperty(documentNode, "activeElement", {
        configurable: true,
        writable: true,
        value: documentNode.body,
      });
    },
  };
}

async function press(node: TestNode | undefined) {
  if (!node) throw new Error("nothing to press");
  node.focus();
  await click(node);
}

const byAction = (view: TestNode, action: string) => findAll(view, (n) => n.getAttribute("data-action") === action)[0];

beforeEach(() => {
  installModuleMocks();
  useTestDom(documentNode);
  spans.length = 0;
  for (const fn of Object.values(calls)) fn.mockClear();
  setSystemTime(new Date(2026, 9, 20, 21, 30));
  saved = tightPlan();
  calendar = [];
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  if (host?.parentNode) host.parentNode.removeChild(host);
  root = null;
  host = null;
  setSystemTime();
});

describe("ReplanPanel, mounted", () => {
  test("a later date picked in the preview widens busy time to that date", async () => {
    // Swimming on Wednesday at 17:00, a day only the later date opens up.
    calendar = [{ _id: "calendarEvents:1", title: "Swimming", startsAtMs: at("2026-10-21", 17) }];
    const view = await mount({ planId: "studyPlans:1" });
    await click(byAction(view, "replan-open"));
    expect(view.textContent).toContain("1 session doesn't fit before");
    expect(spans.at(-1)?.range).toEqual({ startMs: at("2026-10-20", 0), endMs: at("2026-10-21", 0) });

    await click(findByTag(view, "BUTTON", "Use Thu"));
    expect(view.textContent).toMatch(/The plan's date moves to Thursday,? 22 October\./);
    // The day the later date adds is read for busy time too, so the move goes around swimming
    // (17:00 to 18:00) instead of landing on it.
    expect(spans.at(-1)?.range).toEqual({ startMs: at("2026-10-20", 0), endMs: at("2026-10-22", 0) });
    expect(view.textContent).toMatch(/to Wed,? 21 Oct, 16:15/);
    expect(view.textContent).not.toMatch(/to Wed,? 21 Oct, 17:00/);
  });

  test("the Undo toast outlives a change of the plan shown, and undoes the plan it was for", async () => {
    setSystemTime(new Date(2026, 9, 20, 18, 0));
    saved = {
      plan: { _id: "studyPlans:1", title: "Biology", deadline: "2026-10-30", taskIds: ["tasks:2"] },
      tasks: [task("tasks:2", "Learn: Mitosis", "2026-10-19", 17)],
    };
    const view = await mount({ planId: "studyPlans:1" });
    await click(byAction(view, "replan-open"));
    await click(byAction(view, "replan-accept"));
    expect(calls.replan).toHaveBeenCalledTimes(1);
    expect(view.textContent).toContain("1 session has a new time.");
    expect(view.textContent).toContain("5:00");

    // "Add these sessions" made another plan the one the screen shows.
    saved = { plan: { _id: "studyPlans:2", title: "Maths", deadline: "2026-11-02", taskIds: [] }, tasks: [] };
    await rerender({ planId: "studyPlans:2" });
    expect(view.textContent).toContain("1 session has a new time.");
    await click(findByTag(view, "BUTTON", "Undo"));
    expect(calls.undoReplan.mock.calls[0]?.[0]).toMatchObject({ planId: "studyPlans:1" });
    expect(view.textContent).not.toContain("1 session has a new time.");
  });

  test("Undo names its re-plan; when a newer one was made since, nothing changes and it says so", async () => {
    setSystemTime(new Date(2026, 9, 20, 18, 0));
    saved = {
      plan: { _id: "studyPlans:1", title: "Biology", deadline: "2026-10-30", taskIds: ["tasks:2"] },
      tasks: [task("tasks:2", "Learn: Mitosis", "2026-10-19", 17)],
    };
    const undoUntil = Date.now() + 5 * MIN;
    calls.replan.mockImplementationOnce(async () => ({ undoUntil, moved: 1, removed: 0 }));
    // Another tab re-planned again after this one.
    calls.undoReplan.mockImplementationOnce(async () => ({ restored: 0, superseded: true }));
    const view = await mount({ planId: "studyPlans:1" });
    await click(byAction(view, "replan-open"));
    await click(byAction(view, "replan-accept"));
    await click(findByTag(view, "BUTTON", "Undo"));
    expect(calls.undoReplan.mock.calls[0]?.[0]).toEqual({ planId: "studyPlans:1", undoUntil });
    // The toast stays, in words, with nothing left to undo; Dismiss closes it.
    expect(view.textContent).toContain("Nothing changed. These sessions were re-planned again after this");
    expect(view.textContent).not.toContain("1 session has a new time.");
    expect(findAll(view, (n) => n.tagName === "BUTTON" && n.textContent === "Undo")).toHaveLength(0);
    await click(findAll(view, (n) => n.tagName === "BUTTON" && n.getAttribute("aria-label") === "Dismiss")[0]);
    expect(view.textContent).not.toContain("Nothing changed.");
  });

  describe("where the keyboard goes when the toast closes", () => {
    const missedPlan = (): Saved => ({
      plan: { _id: "studyPlans:1", title: "Biology", deadline: "2026-10-30", taskIds: ["tasks:2"] },
      tasks: [task("tasks:2", "Learn: Mitosis", "2026-10-19", 17)],
    });
    const movedPlan = (): Saved => ({
      plan: { _id: "studyPlans:1", title: "Biology", deadline: "2026-10-30", taskIds: ["tasks:2"] },
      tasks: [task("tasks:2", "Learn: Mitosis", "2026-10-20", 18)],
    });

    async function replanned() {
      setSystemTime(new Date(2026, 9, 20, 18, 0));
      saved = missedPlan();
      calls.replan.mockImplementationOnce(async () => {
        saved = movedPlan();
        return { undoUntil: Date.now() + 5 * MIN, moved: 1, removed: 0 };
      });
      const view = await mount({ planId: "studyPlans:1" });
      await press(byAction(view, "replan-open"));
      await press(byAction(view, "replan-accept"));
      await settle();
      // Saved: the notice has gone and the toast offers Undo.
      expect(byAction(view, "replan-open")).toBeUndefined();
      return view;
    }

    test("after Undo, back to Re-plan the rest, which is there again", async () => {
      const focus = trackFocus();
      try {
        const view = await replanned();
        calls.undoReplan.mockImplementationOnce(async () => {
          saved = missedPlan();
          return { restored: 1 };
        });
        await press(findByTag(view, "BUTTON", "Undo"));
        await settle();
        expect(focus.active).toBe(byAction(view, "replan-open") as TestNode);
        expect(focus.active?.textContent).toBe("Re-plan the rest");
      } finally {
        focus.restore();
      }
    });

    test("after Dismiss, with nothing left to re-plan, to the page heading", async () => {
      const focus = trackFocus();
      try {
        const view = await replanned();
        await press(findAll(view, (n) => n.tagName === "BUTTON" && n.getAttribute("aria-label") === "Dismiss")[0]);
        await settle();
        expect(focus.active?.tagName).toBe("H1");
      } finally {
        focus.restore();
      }
    });

    test("the end of the 5:00 doesn't take the keyboard from a field elsewhere", async () => {
      const focus = trackFocus();
      try {
        const view = await replanned();
        const elsewhere = documentNode.createElement("input");
        documentNode.body?.appendChild(elsewhere);
        elsewhere.focus();
        setSystemTime(new Date(Date.now() + 5 * MIN + 1000));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1100));
        });
        await settle();
        expect(view.textContent).not.toContain("1 session has a new time.");
        expect(focus.active).toBe(elsewhere);
        documentNode.body?.removeChild(elsewhere);
      } finally {
        focus.restore();
      }
    });
  });
});
