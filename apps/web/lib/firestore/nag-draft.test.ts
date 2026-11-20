import { describe, expect, test } from "bun:test";

import { draftNag } from "./nag-draft";

describe("draftNag", () => {
  test("builds a validated, enabled nag with no phrases", () => {
    expect(draftNag("Drink water", 123)).toEqual({
      kind: "draft",
      doc: {
        label: "Drink water",
        enabled: true,
        phrases: [],
        createdAt: 123,
        updatedAt: 123,
      },
    });
  });

  test("trims spaces around the label", () => {
    expect(draftNag("  Stretch  ", 1)).toMatchObject({
      kind: "draft",
      doc: { label: "Stretch" },
    });
  });

  test.each(["", "   "])("refuses an empty label %#", (label) => {
    expect(draftNag(label, 1).kind).toBe("refused");
  });

  test("refuses a non-string label", () => {
    expect(draftNag(42, 1).kind).toBe("refused");
  });

  test("shortens a long label to 120 characters", () => {
    const result = draftNag("a".repeat(300), 1);

    expect(result.kind).toBe("draft");
    if (result.kind === "draft") {
      expect(result.doc.label).toBe("a".repeat(120));
    }
  });

  test("does not split an emoji when shortening", () => {
    const fittingEmoji = draftNag(`${"a".repeat(118)}😀trailing`, 1);
    const overflowingEmoji = draftNag(`${"a".repeat(119)}😀trailing`, 1);

    expect(fittingEmoji.kind).toBe("draft");
    if (fittingEmoji.kind === "draft") {
      expect(fittingEmoji.doc.label).toBe(`${"a".repeat(118)}😀`);
      expect(fittingEmoji.doc.label).not.toContain("�");
    }
    expect(overflowingEmoji.kind).toBe("draft");
    if (overflowingEmoji.kind === "draft") {
      expect(overflowingEmoji.doc.label).toBe("a".repeat(119));
      expect(overflowingEmoji.doc.label).not.toContain("�");
    }
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "refuses a non-finite now %#",
    (now) => {
      expect(draftNag("Stretch", now).kind).toBe("refused");
    }
  );

  test("does not add deletion or ownership fields", () => {
    const result = draftNag("Stretch", 1);

    expect(result.kind).toBe("draft");
    if (result.kind === "draft") {
      expect(result.doc).not.toHaveProperty("deletedAt");
      expect(result.doc).not.toHaveProperty("owner");
      expect(result.doc).not.toHaveProperty("ownerId");
      expect(result.doc).not.toHaveProperty("userId");
    }
  });
});
