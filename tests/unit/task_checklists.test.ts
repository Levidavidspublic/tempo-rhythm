import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  MAX_CHECKLIST_ITEMS,
  getChecklistProgress,
  normalizeChecklist,
  parseChecklistText,
  taskHasChecklist,
  toggleChecklistItem,
} from "../../convex/lib/taskChecklists";
import { filterTasksForView, type TaskViewRecord } from "../../apps/web/lib/task-view-filters";

const baseTask = (id: string, checklist?: TaskViewRecord["checklist"]): TaskViewRecord => ({
  id,
  title: id,
  status: "todo",
  priority: "medium",
  energy: "medium",
  updatedAt: 1,
  checklist,
});

describe("task checklist leftover from #206", () => {
  test("parseChecklistText drops empty lines and caps at 20", () => {
    const parsed = parseChecklistText("  unpack  \n\nput kettle on\n");
    expect(parsed).toEqual([
      { id: "check-0-unpack", text: "unpack", completed: false },
      { id: "check-1-put-kettle-on", text: "put kettle on", completed: false },
    ]);

    const overflowing = Array.from({ length: MAX_CHECKLIST_ITEMS + 5 }, (_, index) => `step ${index}`).join(
      "\n",
    );
    expect(parseChecklistText(overflowing)?.length).toBe(MAX_CHECKLIST_ITEMS);
    expect(parseChecklistText("   \n\n")).toBeUndefined();
  });

  test("normalizeChecklist trims, drops blanks, and treats only true as completed", () => {
    expect(
      normalizeChecklist([
        { id: " keep ", text: "  first  ", completed: true },
        { id: "", text: "second", completed: false },
        { id: "gone", text: "   ", completed: true },
      ]),
    ).toEqual([
      { id: "keep", text: "first", completed: true },
      { id: "check-1-second", text: "second", completed: false },
    ]);
    expect(normalizeChecklist([])).toBeUndefined();
  });

  test("progress stays honest for empty, partial, and complete lists", () => {
    expect(getChecklistProgress(undefined)).toEqual({ completed: 0, total: 0, percent: 0 });
    expect(
      getChecklistProgress([
        { id: "a", text: "one", completed: true },
        { id: "b", text: "two", completed: false },
      ]),
    ).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(
      getChecklistProgress([
        { id: "a", text: "one", completed: true },
        { id: "b", text: "two", completed: true },
      ]),
    ).toEqual({ completed: 2, total: 2, percent: 100 });
  });

  test("toggleChecklistItem flips only the named step", () => {
    const items = [
      { id: "a", text: "one", completed: false },
      { id: "b", text: "two", completed: true },
    ];
    expect(toggleChecklistItem(items, "a")).toEqual([
      { id: "a", text: "one", completed: true },
      { id: "b", text: "two", completed: true },
    ]);
    expect(toggleChecklistItem(items, "missing")).toEqual(items);
  });

  test("checklists view keeps only live tasks that have steps", () => {
    const visible = filterTasksForView(
      [
        baseTask("plain"),
        baseTask("with-steps", [{ id: "a", text: "one", completed: false }]),
        { ...baseTask("cancelled-steps", [{ id: "a", text: "one", completed: false }]), status: "cancelled" },
      ],
      { view: "checklists" },
    );
    expect(visible.map((task) => task.id)).toEqual(["with-steps"]);
    const onlyVisible = visible[0];
    expect(onlyVisible).toBeDefined();
    if (onlyVisible) {
      expect(taskHasChecklist(onlyVisible)).toBe(true);
    }
    expect(taskHasChecklist(baseTask("plain"))).toBe(false);
  });
});

describe("TaskViews checklist leftover wiring", () => {
  test("create form and checklists route sit on landed TaskViews, not a second TasksScreen", () => {
    const screen = readFileSync(
      join(import.meta.dir, "../../apps/web/components/tasks/TaskViewsScreen.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(import.meta.dir, "../../apps/web/app/(tempo)/tasks/checklists/page.tsx"),
      "utf8",
    );
    const tasks = readFileSync(join(import.meta.dir, "../../convex/tasks.ts"), "utf8");

    expect(page).toContain("ChecklistBoard");
    expect(screen).toContain("/tasks/checklists");
    expect(screen).toContain("parseChecklistText");
    expect(screen).toContain("Checklist steps");
    expect(screen).not.toContain("recurrenceFrequency");
    expect(screen).not.toContain("{frequency,interval");
    expect(tasks).toContain("normalizeChecklist");
    expect(tasks).toContain("checklist: v.optional");
  });
});
