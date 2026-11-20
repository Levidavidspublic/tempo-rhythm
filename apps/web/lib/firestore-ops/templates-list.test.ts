import { describe, expect, test } from "bun:test";

import { pickTemplates, type TemplateRow } from "./templates-list";

function template(overrides: Partial<TemplateRow> = {}): TemplateRow {
  return {
    id: "template-1",
    name: "Template",
    periodType: "none",
    body: "Body",
    updatedAt: 1,
    ...overrides,
  };
}

describe("pickTemplates", () => {
  test("leaves out deleted templates", () => {
    const deleted = template({ id: "deleted", deletedAt: 0 });
    const live = template({ id: "live" });

    const result = pickTemplates([deleted, live]);

    expect(result.templates).toEqual([live]);
    expect(result.counts.all).toBe(1);
  });

  test("sorts names A to Z ignoring case", () => {
    const rows = [
      template({ id: "z", name: "zebra" }),
      template({ id: "a", name: "apple" }),
      template({ id: "b", name: "Banana" }),
    ];

    expect(pickTemplates(rows).templates.map(({ name }) => name)).toEqual([
      "apple",
      "Banana",
      "zebra",
    ]);
    expect(rows.map(({ id }) => id)).toEqual(["z", "a", "b"]);
  });

  test("puts the newest edit first when names are equal", () => {
    const older = template({ id: "older", name: "Review", updatedAt: 10 });
    const newer = template({ id: "newer", name: "review", updatedAt: 20 });

    expect(pickTemplates([older, newer]).templates).toEqual([newer, older]);
  });

  test("searches name and description but not body", () => {
    const byName = template({ id: "name", name: "Project Review" });
    const byDescription = template({ id: "description", description: "Review the week" });
    const byBody = template({ id: "body", body: "review" });

    expect(
      pickTemplates([byName, byDescription, byBody], { search: "  REVIEW " }).templates.map(
        ({ id }) => id
      )
    ).toEqual(["name", "description"]);
  });

  test("keeps only the selected period", () => {
    const daily = template({ id: "daily", periodType: "daily" });
    const weekly = template({ id: "weekly", periodType: "weekly" });

    expect(pickTemplates([daily, weekly], { period: "weekly" }).templates).toEqual([weekly]);
  });

  test("counts each period before search and period filters", () => {
    const rows = [
      template({ id: "daily", periodType: "daily", name: "Match" }),
      template({ id: "weekly", periodType: "weekly" }),
      template({ id: "monthly", periodType: "monthly" }),
      template({ id: "none", periodType: "none" }),
      template({ id: "deleted", periodType: "daily", deletedAt: 5 }),
    ];

    expect(pickTemplates(rows, { search: "match", period: "daily" }).counts).toEqual({
      daily: 1,
      weekly: 1,
      monthly: 1,
      none: 1,
      all: 4,
    });
  });

  test("marks an empty list and a search with no hit", () => {
    expect(pickTemplates([])).toMatchObject({ isEmpty: true, noMatches: false });
    expect(pickTemplates([template()], { search: "missing" })).toMatchObject({
      isEmpty: false,
      noMatches: true,
    });
  });
});
