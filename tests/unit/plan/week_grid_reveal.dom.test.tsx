/**
 * Quality pass (docs/kitchen/study/a11y-walk.mjs): on a phone the week grid shows about two days,
 * and Tab left a session at the region's far side partly outside it (Chromium doesn't scroll a
 * partly shown item sideways). A session that takes focus now asks to come all the way into view:
 * the nearest edge on both axes, with no glide. Only keyboard focus from another element does it
 * (whole-run review): a mouse press or coming back to the tab doesn't. Mounted in the small
 * TestNode DOM (tests/unit/record/testDom). Sample items are fictional.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { act, createElement } from "../../../apps/web/node_modules/react";
import { createRoot, type Root } from "../../../apps/web/node_modules/react-dom/client";
import {
  revealItem,
  shouldRevealOnFocus,
  WeekGrid,
  type WeekItem,
} from "../../../apps/web/components/calendar/WeekGrid";
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

  test("every item, fixed or flexible, reveals itself when the keyboard brings focus to it", async () => {
    useTestDom(documentNode);
    const host = documentNode.createElement("div");
    documentNode.body?.appendChild(host);
    root = createRoot(host as unknown as HTMLElement);
    await act(async () => {
      root?.render(createElement(WeekGrid, { weekStart: WEEK, items, today: "2026-10-20", lang: "en" }));
    });
    const buttons = findAll(host, (node) => node.getAttribute("data-item-id") !== null);
    expect(buttons.map((node) => node.getAttribute("data-item-id"))).toEqual(["cells", "swim"]);
    for (const [index, button] of buttons.entries()) {
      const calls: unknown[] = [];
      let visible = true;
      Object.assign(button, {
        scrollIntoView: (options: unknown) => void calls.push(options),
        matches: (selector: string) => selector === ":focus-visible" && visible,
      });
      const focusFrom = (from: TestNode | null) =>
        act(async () => {
          button.dispatchEvent(Object.assign(new TestEvent("focusin", button), { relatedTarget: from }));
        });
      // Tab from the item before it (or from the grid's region): keyboard focus from somewhere.
      await focusFrom(buttons[index - 1] ?? host);
      expect(calls).toEqual([NEAREST]);
      // Back to the tab (no related target), or a mouse press (not focus-visible): it stays put.
      await focusFrom(null);
      visible = false;
      await focusFrom(host);
      expect(calls).toEqual([NEAREST]);
    }
  });
});

describe("week grid: only keyboard focus from another element reveals an item (whole-run review)", () => {
  const item = (focusVisible: boolean | "throws") => ({
    matches: (selector: string) => {
      if (focusVisible === "throws") throw new SyntaxError(`unknown pseudo-class ${selector}`);
      return selector === ":focus-visible" && focusVisible;
    },
  });
  const other = {};

  test("keyboard focus moving in from another element reveals it", () => {
    expect(shouldRevealOnFocus({ currentTarget: item(true), relatedTarget: other })).toBe(true);
  });

  test("a mouse press doesn't, so a click near the edge isn't scrolled away and lost", () => {
    expect(shouldRevealOnFocus({ currentTarget: item(false), relatedTarget: other })).toBe(false);
  });

  test("coming back to the tab (no related target) doesn't, so the grid doesn't jump", () => {
    expect(shouldRevealOnFocus({ currentTarget: item(true), relatedTarget: null })).toBe(false);
    expect(shouldRevealOnFocus({ currentTarget: item(true), relatedTarget: undefined })).toBe(false);
  });

  test("a browser that doesn't know :focus-visible doesn't", () => {
    expect(shouldRevealOnFocus({ currentTarget: item("throws"), relatedTarget: other })).toBe(false);
  });
});
