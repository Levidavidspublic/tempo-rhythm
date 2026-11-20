import { describe, expect, test } from "bun:test";
import type { TimeBlockDoc } from "../firestore-docs/time-block-doc";
import { draftTimeBlock, sortTimeBlocksForDay } from "./time-block-draft";

const validInput = {
  localDate: "2026-11-20",
  title: "  Deep work  ",
  startMinute: 540,
  durationMinutes: 30,
  startsAtMs: 1_795_168_800_000,
  endsAtMs: 1_795_170_600_000,
  kind: "focus" as const,
};

describe("draftTimeBlock", () => {
  test("a valid block gets the defaults", () => {
    expect(draftTimeBlock(validInput, 123)).toEqual({
      ok: true,
      doc: {
        ...validInput,
        title: "Deep work",
        status: "planned",
        source: "user",
        createdAt: 123,
        updatedAt: 123,
      },
    });
  });

  test("an empty title is refused", () => {
    expect(draftTimeBlock({ ...validInput, title: "  " }, 123)).toEqual({
      ok: false,
      reason: "empty-title",
    });
  });

  test("startMinute 1440 is refused", () => {
    expect(draftTimeBlock({ ...validInput, startMinute: 1440 }, 123)).toEqual({
      ok: false,
      reason: "bad-start",
    });
  });

  test("durationMinutes 4 and 721 are refused", () => {
    expect(draftTimeBlock({ ...validInput, durationMinutes: 4 }, 123)).toEqual({
      ok: false,
      reason: "bad-length",
    });
    expect(draftTimeBlock({ ...validInput, durationMinutes: 721 }, 123)).toEqual({
      ok: false,
      reason: "bad-length",
    });
  });

  test("endsAtMs equal to startsAtMs is refused", () => {
    expect(draftTimeBlock({ ...validInput, endsAtMs: validInput.startsAtMs }, 123)).toEqual({
      ok: false,
      reason: "bad-range",
    });
  });

  test("a bad date is refused", () => {
    expect(draftTimeBlock({ ...validInput, localDate: "2026-02-29" }, 123)).toEqual({
      ok: false,
      reason: "bad-date",
    });
  });

  test("optional ids are left out when missing or empty and no value is undefined", () => {
    const result = draftTimeBlock(
      { ...validInput, taskId: "", habitId: "   ", dayPlanId: undefined },
      123
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.doc).not.toHaveProperty("taskId");
    expect(result.doc).not.toHaveProperty("habitId");
    expect(result.doc).not.toHaveProperty("dayPlanId");
    expect(Object.values(result.doc)).not.toContain(undefined);
  });
});

test("sort drops deleted rows and other days and orders by start minute then start time", () => {
  const block = (overrides: Partial<TimeBlockDoc>): TimeBlockDoc => ({
    ...validInput,
    title: "Deep work",
    status: "planned",
    source: "user",
    createdAt: 123,
    updatedAt: 123,
    ...overrides,
  });
  const laterStart = block({ title: "later start", startMinute: 600, startsAtMs: 30 });
  const laterTie = block({ title: "later tie", startsAtMs: 20 });
  const earlierTie = block({ title: "earlier tie", startsAtMs: 10 });
  const deleted = block({ title: "deleted", startMinute: 1, deletedAt: 999 });
  const otherDay = block({ title: "other day", localDate: "2026-11-21", startMinute: 1 });
  const rows = [laterStart, laterTie, deleted, otherDay, earlierTie];

  expect(sortTimeBlocksForDay(rows, "2026-11-20").map((row) => row.title)).toEqual([
    "earlier tie",
    "later tie",
    "later start",
  ]);
  expect(rows).toEqual([laterStart, laterTie, deleted, otherDay, earlierTie]);
});
