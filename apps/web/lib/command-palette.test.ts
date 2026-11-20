import { describe, expect, test } from "bun:test";
import {
  type CommandRow,
  DEFAULT_JUMP_SLUGS,
  filterRows,
  moveActive,
  REAL_SCREENS,
  recentPages,
  SCREEN_LABEL,
  searchHref,
} from "./command-palette";

const rows: CommandRow[] = [
  { id: "today", group: "jump", name: "Today", hint: "Your plan" },
  { id: "brain", group: "jump", name: "Brain dump" },
  { id: "tasks", group: "jump", name: "Tasks" },
  { id: "theme", group: "act", name: "Switch light or dark", action: "theme" },
  { id: "all", group: "act", name: "Search everything", always: true },
];

describe("filterRows", () => {
  test("matches the name only, keeps order, and always keeps Search everything", () => {
    expect(filterRows(rows, "t").map((r) => r.id)).toEqual(["today", "tasks", "theme", "all"]);
    expect(filterRows(rows, "  TASK ").map((r) => r.id)).toEqual(["tasks", "all"]);
    // The hint is not matched ("plan" is only in Today's hint).
    expect(filterRows(rows, "plan").map((r) => r.id)).toEqual(["all"]);
  });
  test("a screen's English title still matches under a Hebrew name", () => {
    const he: CommandRow[] = [{ id: "today", group: "jump", name: "היום", alt: "Today" }];
    expect(filterRows(he, "tod").map((r) => r.id)).toEqual(["today"]);
    expect(filterRows(he, "היו").map((r) => r.id)).toEqual(["today"]);
  });
  test("an empty query shows every row", () => {
    expect(filterRows(rows, "   ")).toHaveLength(rows.length);
  });
});

describe("moveActive", () => {
  test("arrows wrap at both ends; Home and End jump", () => {
    expect(moveActive(0, "ArrowDown", 3)).toBe(1);
    expect(moveActive(2, "ArrowDown", 3)).toBe(0);
    expect(moveActive(0, "ArrowUp", 3)).toBe(2);
    expect(moveActive(1, "Home", 3)).toBe(0);
    expect(moveActive(1, "End", 3)).toBe(2);
    expect(moveActive(-1, "ArrowDown", 3)).toBe(0);
    expect(moveActive(-1, "ArrowUp", 3)).toBe(2);
    expect(moveActive(0, "ArrowDown", 0)).toBe(-1);
  });
});

describe("targets", () => {
  test("search keeps the typed words", () => {
    expect(searchHref("  bank card ")).toBe("/search?q=bank%20card");
    expect(searchHref("")).toBe("/search");
  });
  test("the default jump targets are real screens with translated names", () => {
    const slugs = new Set(REAL_SCREENS.map((s) => s.slug));
    for (const slug of DEFAULT_JUMP_SLUGS) {
      expect(slugs.has(slug)).toBe(true);
      expect(SCREEN_LABEL[slug]).toBeDefined();
    }
  });
  test("recent pages are the newest first, capped", () => {
    const pages = [
      { id: "a", updatedAt: 1 },
      { id: "b", updatedAt: 3 },
      { id: "c", updatedAt: 2 },
    ];
    expect(recentPages(pages, 2).map((p) => p.id)).toEqual(["b", "c"]);
    expect(recentPages(undefined)).toEqual([]);
  });
});
