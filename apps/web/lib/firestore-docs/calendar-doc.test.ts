import { describe, expect, test } from "bun:test";

import {
  CalendarDocError,
  parseCalendarEventDoc,
  parseFocusBlockDoc,
  softDeleteCalendarEventDoc,
  softDeleteFocusBlockDoc,
} from "./calendar-doc";

describe("calendar Firestore document shapes", () => {
  test("parses a valid event and trims its title", () => {
    expect(
      parseCalendarEventDoc({ title: "  Planning  ", startsAtMs: 10, createdAt: 1, updatedAt: 2 }),
    ).toEqual({ title: "Planning", startsAtMs: 10, createdAt: 1, updatedAt: 2 });
  });

  test("refuses an empty event title and a non-finite start", () => {
    expect(() =>
      parseCalendarEventDoc({ title: "  ", startsAtMs: 10, createdAt: 1, updatedAt: 2 }),
    ).toThrow(new CalendarDocError("title"));
    expect(() =>
      parseCalendarEventDoc({ title: "Planning", startsAtMs: Infinity, createdAt: 1, updatedAt: 2 }),
    ).toThrow(new CalendarDocError("startsAtMs"));
  });

  test("parses a valid focus block with a label and taskId", () => {
    expect(
      parseFocusBlockDoc({
        startedAtMs: 10,
        durationMs: 30_000,
        createdAt: 1,
        updatedAt: 2,
        label: "  Deep work  ",
        taskId: "task-1",
      }),
    ).toEqual({
      startedAtMs: 10,
      durationMs: 30_000,
      createdAt: 1,
      updatedAt: 2,
      label: "Deep work",
      taskId: "task-1",
    });
  });

  test("refuses invalid focus duration and taskId values", () => {
    const base = { startedAtMs: 10, createdAt: 1, updatedAt: 2 };
    expect(() => parseFocusBlockDoc({ ...base, durationMs: 0 })).toThrow(
      new CalendarDocError("durationMs"),
    );
    expect(() => parseFocusBlockDoc({ ...base, durationMs: 86_400_001 })).toThrow(
      new CalendarDocError("durationMs"),
    );
    expect(() => parseFocusBlockDoc({ ...base, durationMs: 1, taskId: "tasks/one" })).toThrow(
      new CalendarDocError("taskId"),
    );
  });

  test("drops legacy keys and refuses unknown keys in both parsers", () => {
    const legacy = { userId: "user-1", _id: "legacy-id", _creationTime: 0 };
    expect(
      parseCalendarEventDoc({
        ...legacy,
        title: "Event",
        startsAtMs: 10,
        createdAt: 1,
        updatedAt: 2,
      }),
    ).toEqual({ title: "Event", startsAtMs: 10, createdAt: 1, updatedAt: 2 });
    expect(
      parseFocusBlockDoc({ ...legacy, startedAtMs: 10, durationMs: 1, createdAt: 1, updatedAt: 2 }),
    ).toEqual({ startedAtMs: 10, durationMs: 1, createdAt: 1, updatedAt: 2 });
    expect(() =>
      parseCalendarEventDoc({ title: "Event", startsAtMs: 10, createdAt: 1, updatedAt: 2, extra: 1 }),
    ).toThrow(new CalendarDocError("extra"));
    expect(() =>
      parseFocusBlockDoc({ startedAtMs: 10, durationMs: 1, createdAt: 1, updatedAt: 2, extra: 1 }),
    ).toThrow(new CalendarDocError("extra"));
  });

  test("soft deletes both shapes while keeping their other fields", () => {
    const event = { title: "Event", startsAtMs: 10, createdAt: 1, updatedAt: 2 };
    const block = { startedAtMs: 10, durationMs: 20, createdAt: 1, updatedAt: 2, label: "Focus" };

    expect(softDeleteCalendarEventDoc(event, 99)).toEqual({
      ...event,
      updatedAt: 99,
      deletedAt: 99,
    });
    expect(softDeleteFocusBlockDoc(block, 99)).toEqual({
      ...block,
      updatedAt: 99,
      deletedAt: 99,
    });
  });
});
