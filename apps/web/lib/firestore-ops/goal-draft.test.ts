import { expect, test } from "bun:test";
import { draftGoal, GOAL_TITLE_MAX } from "./goal-draft";

const now = 1_700_000_000_000;

test("plain title gives an active goal at 0 percent", () => {
  expect(draftGoal({ title: "Learn piano" }, now)).toEqual({
    ok: true,
    doc: {
      title: "Learn piano",
      progressPercent: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
  });
});

test("title is trimmed and inner spaces are collapsed", () => {
  const result = draftGoal({ title: "  Learn \n\t piano   today  " }, now);

  expect(result.ok).toBe(true);
  if (result.ok) expect(result.doc.title).toBe("Learn piano today");
});

test("empty title is refused", () => {
  expect(draftGoal({ title: " \n\t " }, now)).toEqual({
    ok: false,
    reason: "empty-title",
  });
});

test("long title is shortened to the limit without splitting a surrogate pair", () => {
  const result = draftGoal({ title: `${"a".repeat(GOAL_TITLE_MAX - 1)}😀more` }, now);

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.doc.title).toBe("a".repeat(GOAL_TITLE_MAX - 1));
    expect(result.doc.title.length).toBeLessThanOrEqual(GOAL_TITLE_MAX);
  }
});

test("empty description is left out", () => {
  const result = draftGoal({ title: "Learn piano", description: "   " }, now);

  expect(result.ok).toBe(true);
  if (result.ok) expect("description" in result.doc).toBe(false);
});

test("bad target date is refused", () => {
  expect(draftGoal({ title: "Learn piano", targetDate: Number.NaN }, now)).toEqual({
    ok: false,
    reason: "invalid-target-date",
  });
});
