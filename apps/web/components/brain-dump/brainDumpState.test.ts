import { describe, expect, test } from "bun:test";
import {
  acceptedItems,
  canSubmit,
  groupByUrgency,
  MAX_ACCEPTED,
  toggleItem,
  type Plan,
} from "./brainDumpState";

const plan: Plan = {
  summary: "Four things.",
  priorities: [
    { title: "Pay rent", reason: "Due Friday", urgency: "soon" },
    { title: "Call the dentist", reason: "Hurts", urgency: "now" },
    { title: "Sort the garage", reason: "Whenever", urgency: "later" },
    { title: "Reply to Sam", reason: "Quick", urgency: "now" },
  ],
};

describe("canSubmit", () => {
  test("rejects empty and whitespace", () => {
    expect(canSubmit("")).toBe(false);
    expect(canSubmit("  \n\t ")).toBe(false);
    expect(canSubmit(" rent ")).toBe(true);
  });
});

describe("toggleItem", () => {
  test("adds then removes without mutating", () => {
    const start: number[] = [];
    const on = toggleItem(start, 2);
    expect(on).toEqual([2]);
    expect(start).toEqual([]);
    expect(toggleItem(on, 2)).toEqual([]);
  });
});

describe("acceptedItems", () => {
  test("no selection creates nothing", () => {
    expect(acceptedItems(plan, [])).toEqual([]);
  });

  test("accepting 2 of 4 returns exactly 2, in plan order", () => {
    expect(acceptedItems(plan, [3, 0])).toEqual([
      { title: "Pay rent", urgency: "soon" },
      { title: "Reply to Sam", urgency: "now" },
    ]);
  });

  test("ignores out-of-range indices and blank titles", () => {
    const odd: Plan = {
      summary: "",
      priorities: [{ title: "  ", reason: "", urgency: "now" }],
    };
    expect(acceptedItems(odd, [0, 5])).toEqual([]);
  });

  test("caps at the maximum", () => {
    const big: Plan = {
      summary: "",
      priorities: Array.from({ length: 9 }, (_, i) => ({
        title: `Task ${i}`,
        reason: "",
        urgency: "later" as const,
      })),
    };
    const all = big.priorities.map((_, i) => i);
    expect(acceptedItems(big, all)).toHaveLength(MAX_ACCEPTED);
  });
});

describe("groupByUrgency", () => {
  test("orders now, soon, later and keeps plan indices", () => {
    const groups = groupByUrgency(plan);
    expect(groups.map((g) => g.urgency)).toEqual(["now", "soon", "later"]);
    expect(groups[0]?.items.map((e) => e.index)).toEqual([1, 3]);
  });

  test("leaves out empty groups", () => {
    const only: Plan = {
      summary: "",
      priorities: [{ title: "A", reason: "", urgency: "later" }],
    };
    expect(groupByUrgency(only).map((g) => g.urgency)).toEqual(["later"]);
  });
});
