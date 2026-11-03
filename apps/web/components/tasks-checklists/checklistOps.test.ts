import { describe, expect, test } from "bun:test";
import { addStep, progress, removeStep, renameStep, toggleStep } from "./checklistOps";

describe("checklist operations", () => {
  test("add, toggle, rename, remove, and calculate progress without mutation", () => {
    const original = [{ id: "step-1", text: "First step", completed: false }];
    const added = addStep(original, "  Second step  ", "step-2");

    expect(original).toEqual([{ id: "step-1", text: "First step", completed: false }]);
    expect(added).toEqual([
      { id: "step-1", text: "First step", completed: false },
      { id: "step-2", text: "Second step", completed: false },
    ]);
    expect(addStep(added, "   ", "unused")).toEqual(added);

    const toggled = toggleStep(added, "step-1");
    expect(progress(toggled)).toEqual({ completed: 1, total: 2 });

    const renamed = renameStep(toggled, "step-2", "  Last step ");
    expect(renamed[1]?.text).toBe("Last step");
    expect(renameStep(renamed, "step-2", " ")).toEqual(renamed);

    expect(removeStep(renamed, "step-1")).toEqual([
      { id: "step-2", text: "Last step", completed: false },
    ]);
  });
});
