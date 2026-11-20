import { describe, expect, test } from "bun:test";

import { draftTaskRepeat } from "./task-repeat-draft";

describe("draftTaskRepeat", () => {
  test("drafts a daily rule with defaults", () => {
    expect(draftTaskRepeat({ cycle: "DAILY" }, 100)).toEqual({
      ok: true,
      doc: {
        repeatCycle: "DAILY",
        repeatEvery: 1,
        weekdays: [],
        deletedInstanceDates: [],
        skipOverdue: false,
        waitForCompletion: false,
        repeatFromCompletionDate: false,
        isPaused: false,
        createdAt: 100,
        updatedAt: 100,
      },
    });
  });

  test("drafts a daily rule for every three days", () => {
    const result = draftTaskRepeat({ cycle: "DAILY", every: 3, weekdays: [1] }, 200);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc.repeatEvery).toBe(3);
      expect(result.doc.weekdays).toEqual([]);
    }
  });

  test("sorts weekly weekdays and removes repeats", () => {
    const result = draftTaskRepeat({ cycle: "WEEKLY", weekdays: [5, 1, 5, 3, 1] }, 300);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc.weekdays).toEqual([1, 3, 5]);
  });

  test("refuses a weekly rule with no weekday", () => {
    expect(draftTaskRepeat({ cycle: "WEEKLY" }, 400)).toEqual({
      ok: false,
      reason: "no-weekday",
    });
  });

  test("refuses a bad weekday", () => {
    expect(draftTaskRepeat({ cycle: "WEEKLY", weekdays: [7] }, 500)).toEqual({
      ok: false,
      reason: "bad-weekday",
    });
  });

  test("refuses a monthly cycle", () => {
    expect(draftTaskRepeat({ cycle: "MONTHLY" } as never, 600)).toEqual({
      ok: false,
      reason: "bad-cycle",
    });
  });

  test("refuses a bad every or non-finite time", () => {
    expect(draftTaskRepeat({ cycle: "DAILY", every: 0 }, 700)).toEqual({
      ok: false,
      reason: "bad-every",
    });
    expect(draftTaskRepeat({ cycle: "DAILY" }, Number.NaN)).toEqual({
      ok: false,
      reason: "bad-time",
    });
  });
});
