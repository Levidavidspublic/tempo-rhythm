import { describe, expect, test } from "bun:test";

import { draftHabitCheckIn } from "./habit-check-in-draft";

describe("draftHabitCheckIn", () => {
  test("drafts a valid check-in from Today", () => {
    expect(
      draftHabitCheckIn(
        { habitId: "habit-1", localDate: "2026-11-20", source: "today" },
        1_795_171_200_000
      )
    ).toEqual({
      ok: true,
      doc: {
        habitId: "habit-1",
        localDate: "2026-11-20",
        checkedAt: 1_795_171_200_000,
        source: "today",
        createdAt: 1_795_171_200_000,
        updatedAt: 1_795_171_200_000,
      },
    });
  });

  test("trims and shortens a note", () => {
    const result = draftHabitCheckIn(
      {
        habitId: "habit-1",
        localDate: "2026-11-20",
        source: "habits",
        note: `  ${"x".repeat(501)}  `,
      },
      1
    );

    expect(result.ok && result.doc.note).toBe("x".repeat(500));
  });

  test("leaves an empty note out", () => {
    const result = draftHabitCheckIn(
      { habitId: "habit-1", localDate: "2026-11-20", source: "suggestion", note: "   " },
      1
    );

    expect(result.ok && "note" in result.doc).toBe(false);
  });

  test("refuses an empty habit id", () => {
    expect(
      draftHabitCheckIn({ habitId: "  ", localDate: "2026-11-20", source: "today" }, 1)
    ).toEqual({ ok: false, reason: "empty-habit" });
  });

  test("refuses a date that is not a real calendar date", () => {
    expect(
      draftHabitCheckIn({ habitId: "habit-1", localDate: "2026-02-30", source: "today" }, 1)
    ).toEqual({ ok: false, reason: "bad-date" });
  });

  test("refuses legacy sources and non-finite times", () => {
    expect(
      draftHabitCheckIn(
        { habitId: "habit-1", localDate: "2026-11-20", source: "legacy" as "today" },
        1
      )
    ).toEqual({ ok: false, reason: "bad-source" });
    expect(
      draftHabitCheckIn({ habitId: "habit-1", localDate: "2026-11-20", source: "today" }, Infinity)
    ).toEqual({ ok: false, reason: "bad-time" });
  });
});
