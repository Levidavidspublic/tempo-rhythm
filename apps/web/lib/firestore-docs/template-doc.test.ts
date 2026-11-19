import { describe, expect, test } from "bun:test";

import { checkTemplateDoc } from "./template-doc";

const validTemplate = {
  name: "Daily reset",
  description: "A short daily planning template",
  periodType: "daily",
  body: "# Today\n",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_001,
} as const;

describe("checkTemplateDoc", () => {
  test("accepts a valid template", () => {
    expect(checkTemplateDoc(validTemplate)).toEqual({
      ok: true,
      doc: validTemplate,
    });
  });

  test("refuses a template with userId", () => {
    expect(checkTemplateDoc({ ...validTemplate, userId: "user-1" })).toEqual({
      ok: false,
      reason: "Unexpected field: userId",
    });
  });

  test("refuses a name containing only spaces", () => {
    expect(checkTemplateDoc({ ...validTemplate, name: "   " }).ok).toBe(false);
  });

  test("refuses an unsupported periodType", () => {
    expect(checkTemplateDoc({ ...validTemplate, periodType: "yearly" }).ok).toBe(false);
  });

  test("refuses an object body", () => {
    expect(checkTemplateDoc({ ...validTemplate, body: {} }).ok).toBe(false);
  });

  test("accepts and keeps a soft-delete timestamp", () => {
    const result = checkTemplateDoc({ ...validTemplate, deletedAt: 1_700_000_000_002 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.deletedAt).toBe(1_700_000_000_002);
  });
});
