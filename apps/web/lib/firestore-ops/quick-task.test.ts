import { describe, expect, test } from "bun:test";

import { toTaskDoc } from "../firestore/task-doc";
import { draftQuickTask } from "./quick-task";

describe("draftQuickTask", () => {
  test("a plain title gets the defaults", () => {
    expect(draftQuickTask({ title: "  Call the bank  " }, 1_000)).toEqual({
      ok: true,
      doc: {
        title: "Call the bank",
        status: "todo",
        priority: "medium",
        energy: "medium",
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    });
  });

  test("a whitespace-only title is refused", () => {
    expect(draftQuickTask({ title: " \n\t " }, 1_000)).toEqual({
      ok: false,
      reason: "empty-title",
    });
  });

  test("a title one character over the limit is shortened", () => {
    const result = draftQuickTask({ title: "a".repeat(281) }, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a task draft");
    expect(result.doc.title).toHaveLength(280);
    expect(result.doc.title.endsWith("...")).toBe(true);
  });

  test("project fields are trimmed and an empty project is left out", () => {
    const result = draftQuickTask(
      { title: "Plan", projectId: " project-1 ", projectName: "   " },
      1_000
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a task draft");
    expect(result.doc.projectId).toBe("project-1");
    expect(result.doc).not.toHaveProperty("projectName");
  });

  test("a dueAt of NaN is refused", () => {
    expect(draftQuickTask({ title: "Plan", dueAt: Number.NaN }, 1_000)).toEqual({
      ok: false,
      reason: "bad-due",
    });
  });

  test("the result has no undefined values and passes toTaskDoc", () => {
    const result = draftQuickTask({ title: "Plan", dueAt: 2_000 }, 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a task draft");
    expect(Object.values(result.doc)).not.toContain(undefined);
    expect(toTaskDoc(result.doc as Record<string, unknown>)).toEqual(result.doc);
  });
});
