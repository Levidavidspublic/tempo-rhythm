import { expect, test } from "bun:test";

import { planNoteFromTemplate } from "./template-note";

const now = 1_795_046_400_000;
const template = {
  name: "Daily reset",
  periodType: "daily",
  body: "# Today\n",
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_001,
} as const;

test("daily template gives a dated daily note", () => {
  expect(planNoteFromTemplate(template, "2026-11-20", now)).toEqual({
    ok: true,
    doc: {
      title: "Daily reset",
      body: "# Today\n",
      pinned: false,
      periodType: "daily",
      pageType: "daily",
      date: "2026-11-20",
      revision: 1,
      createdAt: now,
      updatedAt: now,
    },
  });
});

test("weekly template gives a dated weekly note", () => {
  const result = planNoteFromTemplate(
    { ...template, name: "Weekly reset", periodType: "weekly" },
    "2026-11-16",
    now
  );

  expect(result).toMatchObject({
    ok: true,
    doc: { title: "Weekly reset", periodType: "weekly", pageType: "weekly", date: "2026-11-16" },
  });
});

test("none template gives a plain note with no date key", () => {
  const result = planNoteFromTemplate({ ...template, periodType: "none" }, "2026-11-20", now);

  expect(result).toMatchObject({ ok: true, doc: { periodType: "none", pageType: "plain" } });
  expect(result.ok && Object.hasOwn(result.doc, "date")).toBe(false);
});

test("body is copied byte-for-byte including Hebrew text", () => {
  const body = "# היום\n\n- שלום  \n\tמשימה\n";
  const result = planNoteFromTemplate({ ...template, body }, "2026-11-20", now);

  expect(result.ok && result.doc.body).toBe(body);
});

test("deleted template is refused", () => {
  expect(planNoteFromTemplate({ ...template, deletedAt: now - 1 }, "2026-11-20", now)).toEqual({
    ok: false,
    reason: "deleted",
  });
});

test("invalid calendar date is refused", () => {
  expect(planNoteFromTemplate(template, "2026-02-30", now)).toEqual({
    ok: false,
    reason: "invalid-date",
  });
});

test("invalid template and invalid now are refused without mutating the input", () => {
  const input = { ...template };
  const before = { ...input };

  expect(planNoteFromTemplate({ ...input, periodType: "yearly" }, "2026-11-20", now)).toEqual({
    ok: false,
    reason: "invalid-template",
  });
  expect(planNoteFromTemplate(input, "2026-11-20", Number.NaN)).toEqual({
    ok: false,
    reason: "invalid-now",
  });
  expect(input).toEqual(before);
});
