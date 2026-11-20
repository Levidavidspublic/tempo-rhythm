import { describe, expect, test } from "bun:test";
import type { CalendarEventDoc } from "../firestore-docs/calendar-doc";
import { planCalendarEventEdit } from "./calendar-event-edit";

const STORED_EVENT: CalendarEventDoc = {
  title: "Team standup",
  startsAtMs: 1_000,
  createdAt: 100,
  updatedAt: 200,
};

describe("planCalendarEventEdit", () => {
  test("plans a title change", () => {
    expect(planCalendarEventEdit(STORED_EVENT, { title: "  Project sync  " }, 300)).toEqual({
      kind: "patch",
      patch: { title: "Project sync", updatedAt: 300 },
      fields: ["title", "updatedAt"],
    });
  });

  test("plans a start time change", () => {
    expect(planCalendarEventEdit(STORED_EVENT, { startsAtMs: 2_000 }, 300)).toEqual({
      kind: "patch",
      patch: { startsAtMs: 2_000, updatedAt: 300 },
      fields: ["startsAtMs", "updatedAt"],
    });
  });

  test("shortens a long title to 200 characters", () => {
    const plan = planCalendarEventEdit(STORED_EVENT, { title: "a".repeat(300) }, 300);

    expect(plan.kind).toBe("patch");
    if (plan.kind === "patch") expect(plan.patch.title).toBe("a".repeat(200));
  });

  test("refuses an empty title", () => {
    expect(planCalendarEventEdit(STORED_EVENT, { title: "   " }, 300)).toEqual({
      kind: "refused",
      reason: "title must not be empty",
    });
  });

  test("refuses a negative or NaN start time", () => {
    for (const startsAtMs of [-1, Number.NaN]) {
      expect(planCalendarEventEdit(STORED_EVENT, { startsAtMs }, 300)).toEqual({
        kind: "refused",
        reason: "start time is invalid",
      });
    }
  });

  test("refuses a deleted event", () => {
    expect(
      planCalendarEventEdit({ ...STORED_EVENT, deletedAt: 250 }, { title: "New title" }, 300),
    ).toEqual({ kind: "refused", reason: "event is deleted" });
  });

  test("returns unchanged for the same values without mutating the stored event", () => {
    const stored = { ...STORED_EVENT };
    const before = { ...stored };

    expect(
      planCalendarEventEdit(
        stored,
        { title: STORED_EVENT.title, startsAtMs: STORED_EVENT.startsAtMs },
        300,
      ),
    ).toEqual({ kind: "unchanged" });
    expect(stored).toEqual(before);
  });
});
