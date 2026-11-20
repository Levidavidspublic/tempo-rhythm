import { expect, test } from "bun:test";
import { draftTemplate } from "./template-draft";

test("drafts a complete template form", () => {
  expect(
    draftTemplate(
      { name: "  Weekly reset  ", body: "# Reset", periodType: "weekly", description: "  Plan  " },
      1_700_000_000_000
    )
  ).toEqual({
    kind: "draft",
    doc: {
      name: "Weekly reset",
      body: "# Reset",
      periodType: "weekly",
      description: "Plan",
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    },
  });
});

test("uses no period when it is omitted", () => {
  const result = draftTemplate({ name: "Plain note", body: "Text" }, 10);
  expect(result.kind === "draft" && result.doc.periodType).toBe("none");
});

test("refuses an unknown period", () => {
  expect(draftTemplate({ name: "Plan", body: "", periodType: "yearly" }, 10)).toEqual({
    kind: "refused",
    reason: "periodType is invalid",
  });
});

test("refuses an empty or non-string name", () => {
  expect(draftTemplate({ name: "   ", body: "" }, 10).kind).toBe("refused");
  expect(draftTemplate({ name: 42, body: "" }, 10).kind).toBe("refused");
});

test("shortens a long name to 120 characters", () => {
  const result = draftTemplate({ name: "a".repeat(300), body: "" }, 10);
  expect(result.kind === "draft" && result.doc.name).toBe("a".repeat(120));
});

test("refuses a non-string body but keeps an empty body", () => {
  expect(draftTemplate({ name: "Plan", body: null }, 10).kind).toBe("refused");
  const result = draftTemplate({ name: "Plan", body: "" }, 10);
  expect(result.kind === "draft" && result.doc.body).toBe("");
});

test("leaves out a blank description", () => {
  const result = draftTemplate({ name: "Plan", body: "", description: "  " }, 10);
  expect(result.kind).toBe("draft");
  if (result.kind === "draft") expect(result.doc).not.toHaveProperty("description");
});

test("refuses a non-finite timestamp without throwing", () => {
  expect(draftTemplate({ name: "Plan", body: "" }, Number.NaN).kind).toBe("refused");
  expect(draftTemplate({ name: "Plan", body: "" }, Number.POSITIVE_INFINITY).kind).toBe("refused");
});

test("does not add a deletion timestamp", () => {
  const result = draftTemplate({ name: "Plan", body: "" }, 10);
  expect(result.kind).toBe("draft");
  if (result.kind === "draft") expect(result.doc).not.toHaveProperty("deletedAt");
});
