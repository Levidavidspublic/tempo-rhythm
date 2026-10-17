/**
 * Quality pass (docs/kitchen/study/a11y-walk.mjs): on a phone the week grid shows about two days,
 * and Tab left a session at the region's far side partly outside it (Chromium doesn't scroll a
 * partly shown item sideways). A session that takes focus now asks to come all the way into view:
 * the nearest edge on both axes, with no glide. Mounted in the small TestNode DOM
 * (tests/unit/record/testDom). Sample items are fictional.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import { revealItem, WeekGrid, type WeekItem } from "../../../apps/web/components/calendar/WeekGrid";
import { findAll, installTestDom, TestEvent, type TestNode, useTestDom } from "../record/testDom";

const documentNode = installTestDom();

const WEEK = "2026-10-19"; // Monday
const items: WeekItem[] = [
  { id: "cells", date: "2026-10-20", startMinute: 17 * 60, durationMinutes: 45, kind: "flexible", title: "Learn: cells" },
  { id: "swim", date: "2026-10-21", startMinute: 17 * 60, durationMinutes: 60, kind: "fixed", title: "Swimming club" },
];
const NEAREST = { block: "nearest", inline: "nearest" };

let root: Root | null = null;

afterAll(async () => {
  await act(async () => {
    root?.unmount();
  });
});

describe("week grid: a focused item comes all the way into view", () => {
  test("revealItem scrolls to the nearest edge on both axes and passes no behavior", () => {
    const calls: unknown[] = [];
    revealItem({ scrollIntoView: (options?: boolean | ScrollIntoViewOptions) => void calls.push(options) });
    expect(calls).toEqual([NEAREST]);
  });

  test("every item, fixed or flexible, reveals itself when it takes focus", async () => {
    useTestDom(documentNode);
    const host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => {
      root?.render(createElement(WeekGrid, { weekStart: WEEK, items, today: "2026-10-20", lang: "en" }));
    });
    const buttons = findAll(host, (node) => node.getAttribute("data-item-id") !== null);
    expect(buttons.map((node) => node.getAttribute("data-item-id"))).toEqual(["cells", "swim"]);
    for (const button of buttons) {
      const calls: unknown[] = [];
      (button as TestNode & { scrollIntoView: (options: unknown) => void }).scrollIntoView = (options) => {
        calls.push(options);
      };
      await act(async () => {
        button.dispatchEvent(new TestEvent("focusin", button));
      });
      expect(calls).toEqual([NEAREST]);
    }
  });
});
