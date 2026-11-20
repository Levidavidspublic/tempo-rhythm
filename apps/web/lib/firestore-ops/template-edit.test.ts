import { describe, expect, test } from "bun:test";

import type { TemplateDoc } from "../firestore-docs/template-doc";
import { planTemplateEdit } from "./template-edit";

const storedTemplate = (): TemplateDoc => ({
  name: "Daily plan",
  description: "Plan the day",
  periodType: "daily",
  body: "## Today",
  createdAt: 100,
  updatedAt: 200,
});

describe("planTemplateEdit", () => {
  test("plans a name change", () => {
    expect(planTemplateEdit(storedTemplate(), { name: "Weekly plan" }, 300)).toEqual({
      kind: "patch",
      patch: { name: "Weekly plan", updatedAt: 300 },
      fields: ["name", "updatedAt"],
    });
  });

  test("keeps leading and trailing spaces in a body change", () => {
    expect(planTemplateEdit(storedTemplate(), { body: "  changed body  " }, 300)).toEqual({
      kind: "patch",
      patch: { body: "  changed body  ", updatedAt: 300 },
      fields: ["body", "updatedAt"],
    });
  });

  test("cuts a 200-character name to 120 characters", () => {
    const name = "x".repeat(200);
    const result = planTemplateEdit(storedTemplate(), { name }, 300);

    expect(result).toEqual({
      kind: "patch",
      patch: { name: "x".repeat(120), updatedAt: 300 },
      fields: ["name", "updatedAt"],
    });
  });

  test("refuses an empty name", () => {
    expect(planTemplateEdit(storedTemplate(), { name: "   " }, 300)).toEqual({
      kind: "refused",
      reason: "name must not be empty",
    });
  });

  test("refuses an unknown period", () => {
    expect(planTemplateEdit(storedTemplate(), { periodType: "yearly" }, 300)).toEqual({
      kind: "refused",
      reason: "period is invalid",
    });
  });

  test("refuses a deleted template", () => {
    expect(
      planTemplateEdit({ ...storedTemplate(), deletedAt: 250 }, { name: "New name" }, 300)
    ).toEqual({ kind: "refused", reason: "template is deleted" });
  });

  test("returns unchanged for the same values without mutating the stored template", () => {
    const stored = storedTemplate();
    const before = structuredClone(stored);

    expect(
      planTemplateEdit(
        stored,
        {
          name: stored.name,
          body: stored.body,
          description: stored.description,
          periodType: stored.periodType,
        },
        300
      )
    ).toEqual({ kind: "unchanged" });
    expect(stored).toEqual(before);
  });
});
