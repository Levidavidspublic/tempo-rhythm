import { describe, expect, test } from "bun:test";
import { undoFeedback } from "../../apps/web/components/tasks-checklists/checklistOps";

describe("checklist undo feedback", () => {
  test("describes whether undo restored the task", () => {
    expect(undoFeedback({ success: true })).toBe("Task restored.");
    expect(undoFeedback({ success: false })).toBe(
      "That undo has expired, so the task stays deleted.",
    );
  });
});
